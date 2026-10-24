-- ---------------------------------------------------------------------------
-- 0015 - contact messages
--
-- The footer pointed at the parent company's contact page, which is not ours
-- and was dead anyway. The club takes its own messages now.
--
-- Anyone can write one, including somebody who has never signed in - that is
-- the point of a contact form. So there is deliberately NO insert policy here:
-- the row is written by the server with the service role, after it has checked
-- the lengths and the honeypot. An open insert policy on a public table is an
-- invitation to fill the database with spam.
-- ---------------------------------------------------------------------------

create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  subject    text,
  body       text not null,
  -- Set when the sender happened to be signed in, so a reply can find them
  -- again. Null for the general public, which is most of them.
  member_id  uuid references public.profiles (id) on delete set null,
  status     text not null default 'new' check (status in ('new', 'read', 'handled')),
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_new
  on public.contact_messages (created_at desc)
  where status <> 'handled';

alter table public.contact_messages enable row level security;

-- Staff and above: everyone with a job to do here. A plain member has no
-- reason to read what the public writes to the club.
drop policy if exists contact_review on public.contact_messages;
create policy contact_review on public.contact_messages for select
  using (public.can_review_applications());

drop policy if exists contact_update on public.contact_messages;
create policy contact_update on public.contact_messages for update
  using (public.can_review_applications())
  with check (public.can_review_applications());

drop policy if exists contact_delete on public.contact_messages;
create policy contact_delete on public.contact_messages for delete
  using (public.is_admin());
