-- ---------------------------------------------------------------------------
-- 0010 - issuing and verifying the membership certificate
--
-- 0009 added role_history, the 'membership' kind and the eligibility check.
-- This migration adds the two things the app actually calls:
--
--   * verify_certificate() now returns role / period_start / period_end, so
--     the PDF and the public verify page can say "served as X from A to B".
--   * issue_membership_certificate() lets a member claim their own, once the
--     eligibility rule in 0009 passes. It is SECURITY DEFINER because the RLS
--     policy on certificates only lets admins write.
-- ---------------------------------------------------------------------------

-- The OUT columns change, which create-or-replace cannot do.
drop function if exists public.verify_certificate(uuid);

create function public.verify_certificate(p_id uuid)
returns table (
  id uuid, code text, kind text, title text, place integer,
  issued_at timestamptz, revoked boolean, member_name text,
  member_university text, context_title text, context_date timestamptz,
  role text, period_start timestamptz, period_end timestamptz
)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.id, c.code, c.kind, c.title, c.place, c.issued_at,
         (c.revoked_at is not null) as revoked,
         p.full_name, p.university,
         coalesce(e.title, h.title),
         coalesce(e.starts_at, h.starts_at),
         c.role, c.period_start, c.period_end
  from public.certificates c
  join public.profiles p on p.id = c.member_id
  left join public.events e on e.id = c.event_id
  left join public.hackathons h on h.id = c.hackathon_id
  where c.id = p_id;
$$;

-- Mirrors ROLE_LABELS in src/lib/roles.js. 'superadmin' deliberately prints as
-- "Developer": the rank is not advertised anywhere in the product.
create or replace function public.role_label(p_role text)
returns text language sql immutable as $$
  select case p_role
    when 'superadmin'      then 'Developer'
    when 'admin'           then 'Admin'
    when 'project_manager' then 'Project manager'
    when 'staff'           then 'Staff'
    else 'Member'
  end;
$$;

/*
 * Claims (or refreshes) the caller's membership certificate.
 *
 * Re-running it is the documented way to get an up-to-date copy: the unique
 * partial index from 0009 means one row per member per role, so a member who
 * claims at 7 days and again a year later gets the same certificate id with a
 * refreshed period rather than a pile of near-duplicates.
 */
create or replace function public.issue_membership_certificate()
returns uuid
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_member uuid := auth.uid();
  v_status record;
  v_id     uuid;
begin
  if v_member is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select * into v_status from public.membership_certificate_status(v_member);

  -- No open role_history row means no role to certify.
  if v_status is null or v_status.role is null then
    raise exception 'No membership on record yet' using errcode = 'P0002';
  end if;

  if not v_status.eligible then
    raise exception 'Not eligible yet: % more day(s) in the club, or attend one workshop',
      v_status.days_remaining using errcode = 'P0001';
  end if;

  insert into public.certificates (member_id, kind, role, title, period_start, period_end)
  values (v_member, 'membership', v_status.role,
          'Certificate of Membership - ' || public.role_label(v_status.role),
          v_status.since, null)
  on conflict (member_id, role) where kind = 'membership'
  do update set period_start = excluded.period_start,
                title        = excluded.title,
                revoked_at   = null
  returning certificates.id into v_id;

  return v_id;
end;
$$;
