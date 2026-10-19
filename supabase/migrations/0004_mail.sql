-- ===========================================================================
-- 0004 - club mailboxes
--
-- Receiving runs on Brevo's inbound parse webhook, which POSTs each message to
-- /api/mail/inbound. Sending reuses the existing Brevo transactional API.
--
-- Brevo requires the receiving domain to be DIFFERENT from the authenticated
-- sending domain, so an address lives on the inbound domain and mail is sent
-- out from the sending domain with Reply-To pointed back at the inbound one.
-- Both are configured in .env; nothing here hardcodes a domain.
--
-- Safe to re-run.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Accounts: one row per address the club owns.
--    member_id null means a shared mailbox (hi@, contact@) that admins read.
-- ---------------------------------------------------------------------------
create table if not exists public.mail_accounts (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid references public.profiles (id) on delete cascade,
  address    text not null,
  label      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- Addresses are case-insensitive; store and compare them lowercased.
create unique index if not exists mail_accounts_address_key
  on public.mail_accounts (lower(address));
create index if not exists mail_accounts_member_idx
  on public.mail_accounts (member_id);

-- ---------------------------------------------------------------------------
-- 2. Threads and messages
-- ---------------------------------------------------------------------------
create table if not exists public.mail_threads (
  id                 uuid primary key default gen_random_uuid(),
  account_id         uuid not null references public.mail_accounts (id) on delete cascade,
  subject            text not null default '',
  normalized_subject text not null default '',
  last_message_at    timestamptz not null default now(),
  message_count      integer not null default 0,
  unread_count       integer not null default 0,
  is_spam            boolean not null default false,
  archived_at        timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists mail_threads_account_idx
  on public.mail_threads (account_id, last_message_at desc);
-- The subject fallback in matchThread() looks up by this pair.
create index if not exists mail_threads_subject_idx
  on public.mail_threads (account_id, normalized_subject, last_message_at desc);

create table if not exists public.mail_messages (
  id           uuid primary key default gen_random_uuid(),
  thread_id    uuid not null references public.mail_threads (id) on delete cascade,
  account_id   uuid not null references public.mail_accounts (id) on delete cascade,
  direction    text not null check (direction in ('in','out')),
  -- Brevo's own id for an inbound message. The unique index on it is what
  -- makes webhook retries idempotent.
  brevo_uuid   text,
  message_id   text,
  in_reply_to  text,
  references_ids text[] not null default '{}',
  from_email   text,
  from_name    text,
  to_emails    text[] not null default '{}',
  cc_emails    text[] not null default '{}',
  subject      text not null default '',
  text_body    text,
  html_body    text,
  spam_score   numeric,
  is_spam      boolean not null default false,
  sent_at      timestamptz not null default now(),
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create unique index if not exists mail_messages_brevo_uuid_key
  on public.mail_messages (brevo_uuid) where brevo_uuid is not null;
create index if not exists mail_messages_thread_idx
  on public.mail_messages (thread_id, sent_at);
-- matchThread() resolves In-Reply-To and References against this.
create index if not exists mail_messages_message_id_idx
  on public.mail_messages (message_id) where message_id is not null;

create table if not exists public.mail_attachments (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references public.mail_messages (id) on delete cascade,
  name         text not null,
  content_type text not null default 'application/octet-stream',
  size_bytes   integer not null default 0,
  content_id   text,
  -- Brevo hands over a token, not the bytes. The file is fetched separately
  -- and parked in the mail-attachments bucket; storage_path is null until then.
  storage_path text,
  created_at   timestamptz not null default now()
);

create index if not exists mail_attachments_message_idx
  on public.mail_attachments (message_id);

-- ---------------------------------------------------------------------------
-- 3. Keep thread counters honest without a round trip from the app
-- ---------------------------------------------------------------------------
create or replace function public.mail_touch_thread()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.mail_threads t
     set message_count   = (select count(*) from public.mail_messages m where m.thread_id = t.id),
         unread_count    = (select count(*) from public.mail_messages m
                             where m.thread_id = t.id and m.direction = 'in' and m.read_at is null),
         last_message_at = greatest(t.last_message_at,
                                    coalesce(new.sent_at, t.last_message_at))
   where t.id = coalesce(new.thread_id, old.thread_id);
  return null;
end $$;

drop trigger if exists mail_messages_touch on public.mail_messages;
create trigger mail_messages_touch
  after insert or update or delete on public.mail_messages
  for each row execute function public.mail_touch_thread();

-- ---------------------------------------------------------------------------
-- 4. RLS: you read your own mailbox, admins read everything
-- ---------------------------------------------------------------------------
alter table public.mail_accounts    enable row level security;
alter table public.mail_threads     enable row level security;
alter table public.mail_messages    enable row level security;
alter table public.mail_attachments enable row level security;

-- True when the signed-in member owns the account, or is an admin. Shared
-- mailboxes (member_id is null) are admin-only.
create or replace function public.owns_mail_account(p_account uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.mail_accounts a
     where a.id = p_account
       and (a.member_id = auth.uid() or public.is_admin())
  );
$$;

drop policy if exists mail_accounts_read  on public.mail_accounts;
drop policy if exists mail_accounts_admin on public.mail_accounts;
create policy mail_accounts_read on public.mail_accounts for select
  using (member_id = auth.uid() or public.is_admin());
create policy mail_accounts_admin on public.mail_accounts for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists mail_threads_read  on public.mail_threads;
drop policy if exists mail_threads_write on public.mail_threads;
create policy mail_threads_read on public.mail_threads for select
  using (public.owns_mail_account(account_id));
-- Archiving is the only thing a member changes directly.
create policy mail_threads_write on public.mail_threads for update
  using (public.owns_mail_account(account_id))
  with check (public.owns_mail_account(account_id));

drop policy if exists mail_messages_read  on public.mail_messages;
drop policy if exists mail_messages_write on public.mail_messages;
create policy mail_messages_read on public.mail_messages for select
  using (public.owns_mail_account(account_id));
-- Marking read. Inserts come from the server with the service-role key, which
-- bypasses RLS, so there is deliberately no insert policy here.
create policy mail_messages_write on public.mail_messages for update
  using (public.owns_mail_account(account_id))
  with check (public.owns_mail_account(account_id));

drop policy if exists mail_attachments_read on public.mail_attachments;
create policy mail_attachments_read on public.mail_attachments for select
  using (exists (
    select 1 from public.mail_messages m
     where m.id = mail_attachments.message_id
       and public.owns_mail_account(m.account_id)
  ));

-- ---------------------------------------------------------------------------
-- 5. Private bucket for attachment bytes
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('mail-attachments','mail-attachments',false)
on conflict (id) do nothing;

drop policy if exists mail_attachments_storage on storage.objects;
-- Reads go through signed URLs minted server-side after the RLS check above,
-- so the bucket itself stays closed to anon and authenticated clients.
create policy mail_attachments_storage on storage.objects for all
  using (bucket_id = 'mail-attachments' and public.is_admin())
  with check (bucket_id = 'mail-attachments' and public.is_admin());
