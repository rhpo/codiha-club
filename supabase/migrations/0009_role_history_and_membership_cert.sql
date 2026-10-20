-- ===========================================================================
-- 0009 - role history, and a certificate for holding a role
--
--  * role_history records who held which role and for how long, so a
--    certificate can say "served as Project manager from X to Y" truthfully
--    rather than guessing from the current row.
--  * certificates gains a 'membership' kind that belongs to a person and a
--    period rather than to an event or a hackathon.
--
-- Safe to re-run.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Role history
-- ---------------------------------------------------------------------------
create table if not exists public.role_history (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.profiles (id) on delete cascade,
  role       text not null,
  started_at timestamptz not null default now(),
  -- null means "still holds it". Exactly one open row per member.
  ended_at   timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists role_history_member_idx
  on public.role_history (member_id, started_at desc);
create unique index if not exists role_history_one_open
  on public.role_history (member_id) where ended_at is null;

alter table public.role_history enable row level security;

drop policy if exists role_history_read  on public.role_history;
drop policy if exists role_history_admin on public.role_history;
-- Members read their own history (it is what their certificate is built from);
-- staff and above read everyone's.
create policy role_history_read on public.role_history for select
  using (member_id = auth.uid() or public.can_review_applications());
create policy role_history_admin on public.role_history for all
  using (public.is_admin()) with check (public.is_admin());

-- Close the open row and open a new one whenever the role actually changes.
create or replace function public.track_role_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    insert into public.role_history (member_id, role, started_at)
    values (new.id, new.role, coalesce(new.created_at, now()))
    on conflict do nothing;
    return new;
  end if;

  if new.role is distinct from old.role then
    update public.role_history
       set ended_at = now()
     where member_id = new.id and ended_at is null;

    insert into public.role_history (member_id, role, started_at)
    values (new.id, new.role, now())
    on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists profiles_role_history on public.profiles;
create trigger profiles_role_history
  after insert or update of role on public.profiles
  for each row execute function public.track_role_change();

-- Backfill: everybody currently holding a role has held it since they joined.
insert into public.role_history (member_id, role, started_at)
select p.id, p.role, coalesce(p.approved_at, p.created_at, now())
from public.profiles p
where not exists (
  select 1 from public.role_history h where h.member_id = p.id and h.ended_at is null
);

-- ---------------------------------------------------------------------------
-- 2. Membership / role certificates
-- ---------------------------------------------------------------------------
alter table public.certificates drop constraint if exists certificates_kind_check;
alter table public.certificates add constraint certificates_kind_check
  check (kind in ('participation','winner','membership'));

-- The original constraint demanded an event or a hackathon. A membership
-- certificate belongs to neither.
alter table public.certificates drop constraint if exists certificates_check;
alter table public.certificates add constraint certificates_context_check
  check (kind = 'membership' or event_id is not null or hackathon_id is not null);

alter table public.certificates
  add column if not exists role text,
  add column if not exists period_start timestamptz,
  add column if not exists period_end timestamptz;

comment on column public.certificates.role is
  'For kind = membership: the role served, frozen at issue time.';

-- One membership certificate per member per role, so re-issuing refreshes
-- rather than piling up.
create unique index if not exists certificates_membership_key
  on public.certificates (member_id, role) where kind = 'membership';

-- ---------------------------------------------------------------------------
-- 3. Eligibility: seven days in the club, or one event attended
-- ---------------------------------------------------------------------------
create or replace function public.membership_certificate_status(p_member uuid)
returns table (
  eligible boolean,
  days_held integer,
  days_remaining integer,
  events_attended integer,
  role text,
  since timestamptz
)
language sql stable security definer set search_path = public, pg_temp as $$
  with h as (
    select rh.role, rh.started_at
      from public.role_history rh
     where rh.member_id = p_member and rh.ended_at is null
     limit 1
  ),
  a as (
    select count(*)::int as n
      from public.event_attendance ea
     where ea.member_id = p_member
  )
  select
    (floor(extract(epoch from (now() - h.started_at)) / 86400)::int >= 7 or a.n >= 1),
    floor(extract(epoch from (now() - h.started_at)) / 86400)::int,
    greatest(0, 7 - floor(extract(epoch from (now() - h.started_at)) / 86400)::int),
    a.n,
    h.role,
    h.started_at
  from h cross join a;
$$;
