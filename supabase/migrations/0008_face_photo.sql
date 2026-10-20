-- ===========================================================================
-- 0008 - require a real photo of the member's face
--
-- Every OAuth signup already arrives with an avatar_url from Google or
-- Discord, so "has a picture" cannot be the test: that picture is often a
-- cartoon, a logo, or the provider's default. A separate flag records that we
-- have actually seen a face in the uploaded image.
--
-- Safe to re-run.
-- ===========================================================================

alter table public.profiles
  add column if not exists avatar_face_verified boolean not null default false,
  add column if not exists avatar_verified_at timestamptz;

comment on column public.profiles.avatar_face_verified is
  'A face was detected in the uploaded avatar, or an admin vouched for it.';

-- ---------------------------------------------------------------------------
-- Members must not be able to set the flag on themselves.
--
-- Detection runs in the browser, so it is a usability gate rather than a
-- security control, but the flag itself is written with the service-role key
-- after the upload. Letting a member PATCH it directly through PostgREST would
-- make the whole thing pointless.
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
    new.role                 := old.role;
    new.status               := old.status;
    new.approved_at          := old.approved_at;
    new.approved_by          := old.approved_by;
    new.reject_reason        := old.reject_reason;
    new.email                := old.email;
    new.avatar_face_verified := old.avatar_face_verified;
    new.avatar_verified_at   := old.avatar_verified_at;
    return new;
  end if;

  -- Admins and above may change roles, but never to a rank above their own,
  -- and never on somebody who already outranks them.
  if new.role is distinct from old.role then
    if public.role_rank(new.role) > v_rank or public.role_rank(old.role) > v_rank then
      raise exception 'Cannot assign a role above your own';
    end if;
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
