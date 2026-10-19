-- ===========================================================================
-- CODIHA Club — member platform schema
-- Run this whole file once in: Supabase Dashboard > SQL Editor > New query.
-- It is idempotent-ish: safe to re-run (drops/recreates policies & functions).
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------------

-- Members -------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  full_name     text not null default '',
  university    text,
  field         text,
  year          text,
  avatar_url    text,
  bio           text,
  discord       text,
  github        text,
  linkedin      text,
  phone         text,
  role          text not null default 'member' check (role in ('member','admin')),
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  onboarded_at  timestamptz,
  approved_at   timestamptz,
  approved_by   uuid references public.profiles (id) on delete set null,
  reject_reason text,
  created_at    timestamptz not null default now()
);

-- Semesters (points reset boundary) -----------------------------------------
create table if not exists public.semesters (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,
  starts_on  date not null,
  ends_on    date not null,
  created_at timestamptz not null default now(),
  check (ends_on > starts_on)
);

-- Points: append-only ledger, never a mutable total -------------------------
create table if not exists public.points_ledger (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.profiles (id) on delete cascade,
  amount     integer not null check (amount <> 0),
  reason     text not null check (length(btrim(reason)) > 0),
  source     text not null default 'manual',
  source_id  uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists points_ledger_member_idx on public.points_ledger (member_id, created_at desc);
-- one award per (member, source, source_id): makes check-in points idempotent
create unique index if not exists points_ledger_source_uniq
  on public.points_ledger (member_id, source, source_id) where source_id is not null;

-- Badges --------------------------------------------------------------------
create table if not exists public.badges (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  icon        text default '🏅',
  color       text default '#fa9200',
  created_at  timestamptz not null default now()
);

create table if not exists public.member_badges (
  member_id  uuid not null references public.profiles (id) on delete cascade,
  badge_id   uuid not null references public.badges (id) on delete cascade,
  awarded_at timestamptz not null default now(),
  awarded_by uuid references public.profiles (id) on delete set null,
  primary key (member_id, badge_id)
);

-- Events --------------------------------------------------------------------
create table if not exists public.events (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  title          text not null,
  summary        text,
  description    text,
  cover_url      text,
  location       text,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  capacity       integer,
  checkin_points integer not null default 10,
  status         text not null default 'draft' check (status in ('draft','published','cancelled','archived')),
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists events_starts_idx on public.events (starts_at desc);

create table if not exists public.event_registrations (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  member_id   uuid not null references public.profiles (id) on delete cascade,
  status      text not null default 'registered' check (status in ('registered','waitlist','cancelled')),
  created_at  timestamptz not null default now(),
  unique (event_id, member_id)
);

create table if not exists public.event_attendance (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  member_id     uuid not null references public.profiles (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  unique (event_id, member_id)
);

-- Hackathons ----------------------------------------------------------------
create table if not exists public.hackathons (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text unique not null,
  title                text not null,
  theme                text,
  summary              text,
  description          text,
  cover_url            text,
  location             text,
  prize_pool           text,
  starts_at            timestamptz not null,
  ends_at              timestamptz not null,
  apply_opens_at       timestamptz,
  apply_deadline       timestamptz,
  capacity             integer,
  team_size_min        integer not null default 1,
  team_size_max        integer not null default 4,
  points_participation integer not null default 25,
  points_first         integer not null default 150,
  points_second        integer not null default 100,
  points_third         integer not null default 60,
  status               text not null default 'draft' check (status in ('draft','published','closed','cancelled','archived')),
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  check (ends_at > starts_at),
  check (team_size_max >= team_size_min)
);

create table if not exists public.hackathon_applications (
  id           uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  member_id    uuid not null references public.profiles (id) on delete cascade,
  team_name    text,
  teammates    text,
  motivation   text,
  skills       text,
  status       text not null default 'pending' check (status in ('pending','accepted','rejected','withdrawn')),
  decided_at   timestamptz,
  decided_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (hackathon_id, member_id)
);

create table if not exists public.hackathon_winners (
  id           uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  member_id    uuid not null references public.profiles (id) on delete cascade,
  place        integer not null check (place between 1 and 3),
  team_name    text,
  created_at   timestamptz not null default now(),
  unique (hackathon_id, member_id)
);

-- Certificates --------------------------------------------------------------
create table if not exists public.certificates (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null default ('CODIHA-' || to_char(now(),'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 8))),
  member_id    uuid not null references public.profiles (id) on delete cascade,
  kind         text not null check (kind in ('participation','winner')),
  event_id     uuid references public.events (id) on delete cascade,
  hackathon_id uuid references public.hackathons (id) on delete cascade,
  place        integer check (place between 1 and 3),
  title        text not null,
  issued_at    timestamptz not null default now(),
  revoked_at   timestamptz,
  check (event_id is not null or hackathon_id is not null)
);
create unique index if not exists certificates_unique_event
  on public.certificates (member_id, kind, event_id) where event_id is not null;
create unique index if not exists certificates_unique_hack
  on public.certificates (member_id, kind, hackathon_id) where hackathon_id is not null;

-- Polls / votes -------------------------------------------------------------
create table if not exists public.polls (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  opens_at    timestamptz not null default now(),
  closes_at   timestamptz not null,
  status      text not null default 'draft' check (status in ('draft','published','archived')),
  results_public boolean not null default true,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (closes_at > opens_at)
);

create table if not exists public.poll_options (
  id        uuid primary key default gen_random_uuid(),
  poll_id   uuid not null references public.polls (id) on delete cascade,
  label     text not null,
  member_id uuid references public.profiles (id) on delete set null,
  position  integer not null default 0
);

-- Who voted (prevents double voting) — never joined to the ballot content.
create table if not exists public.poll_ballots (
  poll_id   uuid not null references public.polls (id) on delete cascade,
  voter_id  uuid not null references public.profiles (id) on delete cascade,
  voted_at  timestamptz not null default now(),
  primary key (poll_id, voter_id)
);

-- The anonymous vote itself — deliberately has NO voter column.
create table if not exists public.poll_votes (
  id        uuid primary key default gen_random_uuid(),
  poll_id   uuid not null references public.polls (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  cast_at   timestamptz not null default now()
);

-- Admin outbound mail log ---------------------------------------------------
create table if not exists public.email_log (
  id            uuid primary key default gen_random_uuid(),
  subject       text not null,
  html          text,
  audience      text,
  recipients    jsonb not null default '[]'::jsonb,
  recipient_count integer not null default 0,
  attachments   jsonb not null default '[]'::jsonb,
  status        text not null default 'queued' check (status in ('queued','sent','failed','partial')),
  provider_ref  text,
  error         text,
  sent_by       uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

-- Site settings: tiny key/value store. Currently holds the colour palette the
-- admin picks. Public read, because anonymous visitors need the palette too.
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

-- ---------------------------------------------------------------------------
-- 2. HELPERS (security definer → safe to use inside RLS without recursion)
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'approved'
  );
$$;

create or replace function public.is_approved()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved'
  );
$$;

-- Bounds of the running scoring period (one academic year). Falls back to
-- "all time" when no row covers today, so the board never silently zeroes out.
drop function if exists public.semester_bounds();
create function public.semester_bounds()
returns table (name text, starts_on date, ends_on date)
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(max(s.name), 'All time'),
         coalesce(min(s.starts_on), date '1970-01-01'),
         coalesce(max(s.ends_on),   date '2999-01-01')
  from public.semesters s
  where current_date between s.starts_on and s.ends_on;
$$;

-- A member's semester total. SECURITY DEFINER on purpose: the leaderboard is
-- public, but points_ledger rows are private (RLS lets you read only your
-- own). This exposes the aggregate without exposing the entries.
create or replace function public.semester_points(p_member uuid)
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sum(l.amount), 0)::int
  from public.points_ledger l, public.semester_bounds() sb
  where l.member_id = p_member
    and l.created_at >= sb.starts_on
    and l.created_at <  (sb.ends_on + 1);
$$;

-- ---------------------------------------------------------------------------
-- 3. TRIGGERS
-- ---------------------------------------------------------------------------

-- New OAuth user → pending profile seeded from the provider metadata --------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'name',
             new.raw_user_meta_data->>'user_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url',
             new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- A member may never promote themselves or self-approve --------------------
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role          := old.role;
    new.status        := old.status;
    new.approved_at   := old.approved_at;
    new.approved_by   := old.approved_by;
    new.reject_reason := old.reject_reason;
    new.email         := old.email;
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Award a badge without tripping RLS ---------------------------------------
create or replace function public.award_badge(p_member uuid, p_slug text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_badge uuid;
begin
  select id into v_badge from public.badges where slug = p_slug;
  if v_badge is null then return; end if;
  insert into public.member_badges (member_id, badge_id)
  values (p_member, v_badge) on conflict do nothing;
end $$;

-- Event check-in → points + participation certificate + badge --------------
create or replace function public.on_event_attendance()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_event public.events;
begin
  select * into v_event from public.events where id = new.event_id;

  insert into public.points_ledger (member_id, amount, reason, source, source_id)
  values (new.member_id,
          greatest(coalesce(v_event.checkin_points, 10), 1),
          'Attended ' || v_event.title,
          'event_checkin', new.event_id)
  on conflict do nothing;

  insert into public.certificates (member_id, kind, event_id, title)
  values (new.member_id, 'participation', new.event_id,
          'Certificate of Participation — ' || v_event.title)
  on conflict do nothing;

  perform public.award_badge(new.member_id, 'first-steps');
  if (select count(*) from public.event_attendance where member_id = new.member_id) >= 5 then
    perform public.award_badge(new.member_id, 'regular');
  end if;
  return new;
end $$;

drop trigger if exists event_attendance_rewards on public.event_attendance;
create trigger event_attendance_rewards
  after insert on public.event_attendance
  for each row execute function public.on_event_attendance();

-- Hackathon application accepted → points + participation certificate ------
create or replace function public.on_hackathon_accepted()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_hack public.hackathons;
begin
  if new.status <> 'accepted' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'accepted' then return new; end if;

  select * into v_hack from public.hackathons where id = new.hackathon_id;

  insert into public.points_ledger (member_id, amount, reason, source, source_id)
  values (new.member_id, greatest(coalesce(v_hack.points_participation, 25), 1),
          'Participated in ' || v_hack.title, 'hackathon_participation', new.hackathon_id)
  on conflict do nothing;

  insert into public.certificates (member_id, kind, hackathon_id, title)
  values (new.member_id, 'participation', new.hackathon_id,
          'Certificate of Participation — ' || v_hack.title)
  on conflict do nothing;

  perform public.award_badge(new.member_id, 'hacker');
  return new;
end $$;

drop trigger if exists hackathon_accepted_rewards on public.hackathon_applications;
create trigger hackathon_accepted_rewards
  after insert or update of status on public.hackathon_applications
  for each row execute function public.on_hackathon_accepted();

-- Winner selected → points + winner certificate + badge --------------------
create or replace function public.on_hackathon_winner()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_hack public.hackathons; v_pts integer; v_label text;
begin
  select * into v_hack from public.hackathons where id = new.hackathon_id;
  v_pts := case new.place
             when 1 then v_hack.points_first
             when 2 then v_hack.points_second
             else v_hack.points_third end;
  v_label := case new.place when 1 then '1st place' when 2 then '2nd place' else '3rd place' end;

  insert into public.points_ledger (member_id, amount, reason, source, source_id)
  values (new.member_id, greatest(coalesce(v_pts, 50), 1),
          v_label || ' at ' || v_hack.title, 'hackathon_winner', new.hackathon_id)
  on conflict (member_id, source, source_id) where source_id is not null do update
    set amount = excluded.amount, reason = excluded.reason;

  insert into public.certificates (member_id, kind, hackathon_id, place, title)
  values (new.member_id, 'winner', new.hackathon_id, new.place,
          'Winner Certificate (' || v_label || ') — ' || v_hack.title)
  on conflict (member_id, kind, hackathon_id) where hackathon_id is not null do update
    set place = excluded.place, title = excluded.title, revoked_at = null;

  perform public.award_badge(new.member_id, 'champion');
  return new;
end $$;

drop trigger if exists hackathon_winner_rewards on public.hackathon_winners;
create trigger hackathon_winner_rewards
  after insert or update on public.hackathon_winners
  for each row execute function public.on_hackathon_winner();

-- ---------------------------------------------------------------------------
-- 4. RPC
-- ---------------------------------------------------------------------------

-- One anonymous vote per eligible member.
create or replace function public.cast_vote(p_poll uuid, p_option uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_poll public.polls;
begin
  if not public.is_approved() then
    raise exception 'Only approved members can vote';
  end if;

  select * into v_poll from public.polls where id = p_poll and status = 'published';
  if v_poll.id is null then raise exception 'Poll not found'; end if;
  if now() < v_poll.opens_at then raise exception 'Voting has not opened yet'; end if;
  if now() > v_poll.closes_at then raise exception 'Voting is closed'; end if;

  if not exists (select 1 from public.poll_options where id = p_option and poll_id = p_poll) then
    raise exception 'Invalid option';
  end if;

  insert into public.poll_ballots (poll_id, voter_id) values (p_poll, auth.uid());
  -- the ballot row is the duplicate guard; it throws before we record the vote
  insert into public.poll_votes (poll_id, option_id) values (p_poll, p_option);
exception
  when unique_violation then raise exception 'You have already voted in this poll';
end $$;

-- Public, anonymous-safe poll results.
create or replace function public.poll_results(p_poll uuid)
returns table (option_id uuid, label text, votes bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  select o.id, o.label, count(v.id)
  from public.poll_options o
  left join public.poll_votes v on v.option_id = o.id
  join public.polls p on p.id = o.poll_id
  where o.poll_id = p_poll
    and (public.is_admin() or (p.results_public and (now() > p.closes_at)))
  group by o.id, o.label, o.position
  order by count(v.id) desc, o.position;
$$;

-- Public certificate verification (used by /verify/[id], no auth required).
create or replace function public.verify_certificate(p_id uuid)
returns table (
  id uuid, code text, kind text, title text, place integer,
  issued_at timestamptz, revoked boolean, member_name text,
  member_university text, context_title text, context_date timestamptz
)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.id, c.code, c.kind, c.title, c.place, c.issued_at,
         (c.revoked_at is not null) as revoked,
         p.full_name, p.university,
         coalesce(e.title, h.title),
         coalesce(e.starts_at, h.starts_at)
  from public.certificates c
  join public.profiles p on p.id = c.member_id
  left join public.events e on e.id = c.event_id
  left join public.hackathons h on h.id = c.hackathon_id
  where c.id = p_id;
$$;

-- ---------------------------------------------------------------------------
-- 5. VIEWS
-- ---------------------------------------------------------------------------

-- Public, safe projection of profiles: approved members only, and none of the
-- contact columns. Runs with the view owner's rights (security_invoker is off
-- by default), which is what lets anonymous visitors read it while the
-- profiles table itself stays locked to "own row or admin".
drop view if exists public.members;
create view public.members as
select p.id, p.full_name, p.university, p.field, p.year, p.avatar_url, p.bio,
       p.github, p.linkedin, p.created_at
from public.profiles p
where p.status = 'approved';

grant select on public.members to anon, authenticated;

-- Semester leaderboard. Also owner-rights: it must be readable by anonymous
-- visitors, and it only ever exposes approved members and their totals.
drop view if exists public.leaderboard;
create view public.leaderboard as
with totals as (
  select p.id, p.full_name, p.university, p.field, p.year, p.avatar_url,
         public.semester_points(p.id) as points
  from public.profiles p
  where p.status = 'approved'
)
select t.*,
       rank() over (order by t.points desc, t.full_name asc)::int as rank,
       (select count(*) from public.member_badges mb where mb.member_id = t.id)::int as badge_count
from totals t;

grant select on public.leaderboard to anon, authenticated;

-- Points for the current member/semester, plus the all-time total.
drop view if exists public.my_points;
create view public.my_points with (security_invoker = true) as
select l.member_id,
       sum(case when l.created_at >= sb.starts_on
                 and l.created_at <  (sb.ends_on + 1)
                then l.amount else 0 end)::int as semester_points,
       sum(l.amount)::int as total_points
from public.points_ledger l
cross join public.semester_bounds() sb
group by l.member_id;

-- ---------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

alter table public.profiles               enable row level security;
alter table public.semesters              enable row level security;
alter table public.points_ledger          enable row level security;
alter table public.badges                 enable row level security;
alter table public.member_badges          enable row level security;
alter table public.events                 enable row level security;
alter table public.event_registrations    enable row level security;
alter table public.event_attendance       enable row level security;
alter table public.hackathons             enable row level security;
alter table public.hackathon_applications enable row level security;
alter table public.hackathon_winners      enable row level security;
alter table public.certificates           enable row level security;
alter table public.polls                  enable row level security;
alter table public.poll_options           enable row level security;
alter table public.poll_ballots           enable row level security;
alter table public.poll_votes             enable row level security;
alter table public.email_log              enable row level security;
alter table public.site_settings          enable row level security;

-- profiles ------------------------------------------------------------------
drop policy if exists profiles_read       on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_admin_all  on public.profiles;

-- Deliberately NOT "or status = 'approved'": the table holds emails, phone
-- numbers and Discord handles. Public member info is served by the
-- public.members view instead.
create policy profiles_read on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy profiles_insert_own on public.profiles for insert
  with check (id = auth.uid());
-- the profiles_protect trigger strips role/status, so this is safe
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_all on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- semesters -----------------------------------------------------------------
drop policy if exists semesters_read on public.semesters;
drop policy if exists semesters_admin on public.semesters;
create policy semesters_read  on public.semesters for select using (true);
create policy semesters_admin on public.semesters for all
  using (public.is_admin()) with check (public.is_admin());

-- points_ledger: members read their own rows, only admins write ------------
drop policy if exists ledger_read_own on public.points_ledger;
drop policy if exists ledger_admin    on public.points_ledger;
create policy ledger_read_own on public.points_ledger for select
  using (member_id = auth.uid() or public.is_admin());
create policy ledger_admin on public.points_ledger for all
  using (public.is_admin()) with check (public.is_admin());

-- badges --------------------------------------------------------------------
drop policy if exists badges_read on public.badges;
drop policy if exists badges_admin on public.badges;
drop policy if exists member_badges_read on public.member_badges;
drop policy if exists member_badges_admin on public.member_badges;
create policy badges_read  on public.badges for select using (true);
create policy badges_admin on public.badges for all
  using (public.is_admin()) with check (public.is_admin());
create policy member_badges_read  on public.member_badges for select using (true);
create policy member_badges_admin on public.member_badges for all
  using (public.is_admin()) with check (public.is_admin());

-- events --------------------------------------------------------------------
drop policy if exists events_read  on public.events;
drop policy if exists events_admin on public.events;
create policy events_read on public.events for select
  using (status in ('published','archived') or public.is_admin());
create policy events_admin on public.events for all
  using (public.is_admin()) with check (public.is_admin());

-- event_registrations -------------------------------------------------------
drop policy if exists regs_read   on public.event_registrations;
drop policy if exists regs_insert on public.event_registrations;
drop policy if exists regs_update on public.event_registrations;
drop policy if exists regs_delete on public.event_registrations;
drop policy if exists regs_admin  on public.event_registrations;
create policy regs_read on public.event_registrations for select
  using (member_id = auth.uid() or public.is_admin());
create policy regs_insert on public.event_registrations for insert
  with check (
    member_id = auth.uid()
    and public.is_approved()
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.status = 'published' and e.ends_at > now()
    )
  );
create policy regs_update on public.event_registrations for update
  using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy regs_delete on public.event_registrations for delete
  using (member_id = auth.uid());
create policy regs_admin on public.event_registrations for all
  using (public.is_admin()) with check (public.is_admin());

-- event_attendance: inserted server-side only (HMAC token verified first) --
drop policy if exists attendance_read  on public.event_attendance;
drop policy if exists attendance_admin on public.event_attendance;
create policy attendance_read on public.event_attendance for select
  using (member_id = auth.uid() or public.is_admin());
create policy attendance_admin on public.event_attendance for all
  using (public.is_admin()) with check (public.is_admin());

-- hackathons ----------------------------------------------------------------
drop policy if exists hacks_read  on public.hackathons;
drop policy if exists hacks_admin on public.hackathons;
create policy hacks_read on public.hackathons for select
  using (status in ('published','closed','archived') or public.is_admin());
create policy hacks_admin on public.hackathons for all
  using (public.is_admin()) with check (public.is_admin());

-- hackathon_applications ----------------------------------------------------
drop policy if exists apps_read   on public.hackathon_applications;
drop policy if exists apps_insert on public.hackathon_applications;
drop policy if exists apps_update on public.hackathon_applications;
drop policy if exists apps_admin  on public.hackathon_applications;
create policy apps_read on public.hackathon_applications for select
  using (member_id = auth.uid() or public.is_admin());
create policy apps_insert on public.hackathon_applications for insert
  with check (
    member_id = auth.uid()
    and public.is_approved()
    and exists (
      select 1 from public.hackathons h
      where h.id = hackathon_id
        and h.status = 'published'
        and (h.apply_opens_at is null or now() >= h.apply_opens_at)
        and (h.apply_deadline is null or now() <= h.apply_deadline)
    )
  );
-- members may only withdraw their own pending application
create policy apps_update on public.hackathon_applications for update
  using (member_id = auth.uid() and status = 'pending')
  with check (member_id = auth.uid() and status in ('pending','withdrawn'));
create policy apps_admin on public.hackathon_applications for all
  using (public.is_admin()) with check (public.is_admin());

-- hackathon_winners (public — shown on the hackathon page) ------------------
drop policy if exists winners_read  on public.hackathon_winners;
drop policy if exists winners_admin on public.hackathon_winners;
create policy winners_read  on public.hackathon_winners for select using (true);
create policy winners_admin on public.hackathon_winners for all
  using (public.is_admin()) with check (public.is_admin());

-- certificates --------------------------------------------------------------
drop policy if exists certs_read  on public.certificates;
drop policy if exists certs_admin on public.certificates;
create policy certs_read on public.certificates for select
  using (member_id = auth.uid() or public.is_admin());
create policy certs_admin on public.certificates for all
  using (public.is_admin()) with check (public.is_admin());

-- polls ---------------------------------------------------------------------
drop policy if exists polls_read    on public.polls;
drop policy if exists polls_admin   on public.polls;
drop policy if exists options_read  on public.poll_options;
drop policy if exists options_admin on public.poll_options;
drop policy if exists ballots_read  on public.poll_ballots;
drop policy if exists ballots_admin on public.poll_ballots;
drop policy if exists votes_read          on public.poll_votes;
drop policy if exists votes_admin         on public.poll_votes;
drop policy if exists votes_no_direct_read on public.poll_votes;

create policy polls_read on public.polls for select
  using ((status = 'published' and public.is_approved()) or public.is_admin());
create policy polls_admin on public.polls for all
  using (public.is_admin()) with check (public.is_admin());

create policy options_read on public.poll_options for select
  using (exists (select 1 from public.polls p
                 where p.id = poll_id
                   and ((p.status = 'published' and public.is_approved()) or public.is_admin())));
create policy options_admin on public.poll_options for all
  using (public.is_admin()) with check (public.is_admin());

-- a member can see THAT they voted, never what anyone voted for
create policy ballots_read on public.poll_ballots for select
  using (voter_id = auth.uid());
create policy ballots_admin on public.poll_ballots for select
  using (public.is_admin());

-- Raw ballots are never readable by anyone, through any role. Aggregated
-- results come from poll_results(), which is SECURITY DEFINER.
create policy votes_no_direct_read on public.poll_votes for select using (false);

-- email_log -----------------------------------------------------------------
drop policy if exists email_admin on public.email_log;
create policy email_admin on public.email_log for all
  using (public.is_admin()) with check (public.is_admin());

-- site_settings -------------------------------------------------------------
drop policy if exists settings_read  on public.site_settings;
drop policy if exists settings_admin on public.site_settings;
create policy settings_read  on public.site_settings for select using (true);
create policy settings_admin on public.site_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. STORAGE BUCKETS
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('covers','covers',true), ('avatars','avatars',true), ('attachments','attachments',false)
on conflict (id) do nothing;

drop policy if exists covers_read        on storage.objects;
drop policy if exists covers_admin_write on storage.objects;
drop policy if exists avatars_read       on storage.objects;
drop policy if exists avatars_own_write  on storage.objects;
drop policy if exists attachments_admin  on storage.objects;

create policy covers_read on storage.objects for select
  using (bucket_id = 'covers');
create policy covers_admin_write on storage.objects for all
  using (bucket_id = 'covers' and public.is_admin())
  with check (bucket_id = 'covers' and public.is_admin());

create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars');
create policy avatars_own_write on storage.objects for all
  using (bucket_id = 'avatars' and owner = auth.uid())
  with check (bucket_id = 'avatars' and owner = auth.uid());

create policy attachments_admin on storage.objects for all
  using (bucket_id = 'attachments' and public.is_admin())
  with check (bucket_id = 'attachments' and public.is_admin());

-- ---------------------------------------------------------------------------
-- 8. SEED
-- ---------------------------------------------------------------------------

insert into public.badges (slug, name, description, icon, color) values
  ('first-steps', 'First Steps',   'Checked in to your first CODIHA event',  '👟', '#6ee7b7'),
  ('regular',     'Regular',       'Attended 5 or more events',              '🔥', '#fb923c'),
  ('hacker',      'Hacker',        'Accepted into a CODIHA hackathon',       '💻', '#60a5fa'),
  ('champion',    'Champion',      'Won a podium place at a hackathon',      '🏆', '#fbbf24'),
  ('mentor',      'Mentor',        'Ran a workshop or mentored members',     '🎓', '#c084fc'),
  ('founder',     'Founding Member','Was there from the beginning',          '🌱', '#34d399')
on conflict (slug) do nothing;

-- Scoring periods. One row per academic year: points accumulate from September
-- to August and only reset when a new year starts.
insert into public.semesters (name, starts_on, ends_on) values
  ('2024/2025', date '2024-09-01', date '2025-08-31'),
  ('2025/2026', date '2025-09-01', date '2026-08-31'),
  ('2026/2027', date '2026-09-01', date '2027-08-31'),
  ('2027/2028', date '2027-09-01', date '2028-08-31')
on conflict do nothing;

insert into public.site_settings (key, value)
values ('theme', '{"primary":"#294230","accent":"#fa9200"}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 9. MAKE YOURSELF ADMIN
--    Sign in once with Google/Discord, then run (with your own email):
--
--    update public.profiles
--       set role = 'admin', status = 'approved', approved_at = now(),
--           onboarded_at = coalesce(onboarded_at, now())
--     where email = 'you@example.com';
-- ---------------------------------------------------------------------------
