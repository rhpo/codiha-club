-- ===========================================================================
-- 0005 - role hierarchy
--
--   superadmin  50  everything, including reading any member's mailbox
--   admin       40  everything except other people's mailboxes
--   project_manager 30  CRUD events / hackathons / polls, award points
--   staff       20  accept or reject applications only
--   member      10  the default
--
-- Ranks are compared, never enumerated, so adding a tier later is one row in
-- role_rank() rather than an audit of every policy.
--
-- `is_admin()` is redefined as "rank >= admin" so the 34 existing policies
-- that call it keep their current meaning without being rewritten.
--
-- Safe to re-run.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Widen the allowed values
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('member','staff','project_manager','admin','superadmin'));

-- ---------------------------------------------------------------------------
-- 2. Rank helpers
-- ---------------------------------------------------------------------------
create or replace function public.role_rank(p_role text)
returns integer language sql immutable set search_path = public, pg_temp as $$
  select case p_role
    when 'superadmin'      then 50
    when 'admin'           then 40
    when 'project_manager' then 30
    when 'staff'           then 20
    when 'member'          then 10
    else 0
  end;
$$;

/** Rank of the signed-in member, 0 when signed out or not approved. */
create or replace function public.my_rank()
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    (select public.role_rank(p.role)
       from public.profiles p
      where p.id = auth.uid() and p.status = 'approved'),
    0);
$$;

create or replace function public.has_rank(p_min integer)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.my_rank() >= p_min;
$$;

-- Redefined, not replaced: every existing policy calls this one.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.my_rank() >= 40;
$$;

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.my_rank() >= 50;
$$;

/** Events, hackathons, polls, points. */
create or replace function public.can_manage_content()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.my_rank() >= 30;
$$;

/** Hackathon applications and membership approvals. */
create or replace function public.can_review_applications()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.my_rank() >= 20;
$$;

-- ---------------------------------------------------------------------------
-- 3. Privilege escalation guard
--
-- The existing profiles_protect trigger stops ordinary members editing their
-- own role. It is not enough once there are tiers: an admin could otherwise
-- promote themselves to superadmin, or demote one.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_rank integer := public.my_rank();
begin
  if auth.uid() is null then
    return new;                      -- service-role / trigger context
  end if;

  if v_rank < 40 then
    -- Not staff-level enough to change anyone's standing, including their own.
    new.role          := old.role;
    new.status        := old.status;
    new.approved_at   := old.approved_at;
    new.approved_by   := old.approved_by;
    new.reject_reason := old.reject_reason;
    new.email         := old.email;
    return new;
  end if;

  -- Admins and above may change roles, but never to a rank above their own,
  -- and never on somebody who already outranks them.
  if new.role is distinct from old.role then
    if public.role_rank(new.role) > v_rank or public.role_rank(old.role) > v_rank then
      raise exception 'Cannot assign a role above your own';
    end if;
    -- Demoting yourself out of superadmin would leave the club with none.
    if old.role = 'superadmin' and new.role <> 'superadmin'
       and (select count(*) from public.profiles where role = 'superadmin') <= 1 then
      raise exception 'The last superadmin cannot be demoted';
    end if;
  end if;

  new.email := old.email;            -- always provider-owned
  return new;
end $$;

drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ---------------------------------------------------------------------------
-- 4. Let the lower tiers actually do their jobs
--
-- The tables below previously admitted admins only. Nothing is taken away;
-- these widen the existing is_admin() policies to the right rank.
-- ---------------------------------------------------------------------------

-- project_manager: content + points
drop policy if exists events_manage on public.events;
create policy events_manage on public.events for all
  using (public.can_manage_content()) with check (public.can_manage_content());

drop policy if exists hackathons_manage on public.hackathons;
create policy hackathons_manage on public.hackathons for all
  using (public.can_manage_content()) with check (public.can_manage_content());

drop policy if exists polls_manage on public.polls;
create policy polls_manage on public.polls for all
  using (public.can_manage_content()) with check (public.can_manage_content());

drop policy if exists poll_options_manage on public.poll_options;
create policy poll_options_manage on public.poll_options for all
  using (public.can_manage_content()) with check (public.can_manage_content());

drop policy if exists ledger_manage on public.points_ledger;
create policy ledger_manage on public.points_ledger for all
  using (public.can_manage_content()) with check (public.can_manage_content());

-- staff: decide on applications, nothing else
drop policy if exists applications_review on public.hackathon_applications;
create policy applications_review on public.hackathon_applications for update
  using (public.can_review_applications()) with check (public.can_review_applications());

drop policy if exists applications_review_read on public.hackathon_applications;
create policy applications_review_read on public.hackathon_applications for select
  using (member_id = auth.uid() or public.can_review_applications());

-- ---------------------------------------------------------------------------
-- 5. Mail is superadmin-only, never plain admin
-- ---------------------------------------------------------------------------
create or replace function public.owns_mail_account(p_account uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.mail_accounts a
     where a.id = p_account
       -- deliberately is_superadmin(), not is_admin(): an admin can run the
       -- club but cannot read the president's correspondence.
       and (a.member_id = auth.uid() or public.is_superadmin())
  );
$$;

drop policy if exists mail_accounts_read  on public.mail_accounts;
drop policy if exists mail_accounts_admin on public.mail_accounts;
create policy mail_accounts_read on public.mail_accounts for select
  using (member_id = auth.uid() or public.is_superadmin());
create policy mail_accounts_admin on public.mail_accounts for all
  using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists mail_attachments_storage on storage.objects;
create policy mail_attachments_storage on storage.objects for all
  using (bucket_id = 'mail-attachments' and public.is_superadmin())
  with check (bucket_id = 'mail-attachments' and public.is_superadmin());

-- ---------------------------------------------------------------------------
-- 6. Daily send quota
--
-- null means unlimited, which is how the president gets an exemption without
-- hardcoding a role: it is a property of the mailbox, not of the hierarchy.
-- ---------------------------------------------------------------------------
alter table public.mail_accounts
  add column if not exists daily_send_limit integer default 5;

comment on column public.mail_accounts.daily_send_limit is
  'Outbound messages per UTC day. NULL = unlimited (president, shared inboxes).';

create or replace function public.mail_quota(p_account uuid)
returns table (used integer, send_limit integer, remaining integer)
language sql stable security definer set search_path = public, pg_temp as $$
  select u.used,
         a.daily_send_limit,
         case when a.daily_send_limit is null then null
              else greatest(0, a.daily_send_limit - u.used) end
  from public.mail_accounts a
  cross join lateral (
    select count(*)::int as used
      from public.mail_messages m
     where m.account_id = a.id
       and m.direction = 'out'
       and m.sent_at >= date_trunc('day', now() at time zone 'utc')
  ) u
  where a.id = p_account
    and (a.member_id = auth.uid() or public.is_superadmin());
$$;

-- Every mailbox, with today's usage. Admins get to watch the quota even though
-- they cannot read the messages themselves.
drop view if exists public.mail_quota_overview;
create view public.mail_quota_overview as
select a.id as account_id,
       a.address,
       a.member_id,
       p.full_name,
       a.daily_send_limit,
       (select count(*)::int from public.mail_messages m
         where m.account_id = a.id
           and m.direction = 'out'
           and m.sent_at >= date_trunc('day', now() at time zone 'utc')) as used_today
from public.mail_accounts a
left join public.profiles p on p.id = a.member_id
where a.is_active;

revoke all on public.mail_quota_overview from anon, authenticated;

create or replace function public.mail_quota_report()
returns setof public.mail_quota_overview
language sql stable security definer set search_path = public, pg_temp as $$
  select * from public.mail_quota_overview where public.is_admin() order by address;
$$;

-- ---------------------------------------------------------------------------
-- 7. Bootstrap: the founding admin becomes superadmin
-- ---------------------------------------------------------------------------
update public.profiles
   set role = 'superadmin'
 where role = 'admin'
   and not exists (select 1 from public.profiles where role = 'superadmin');
