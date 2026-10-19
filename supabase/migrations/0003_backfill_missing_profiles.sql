-- ===========================================================================
-- 0003 - backfill profiles for accounts created before the trigger existed
--
-- Anyone who signed in while public.profiles did not exist (or while
-- on_auth_user_created was missing) has an auth.users row and no profile. The
-- app used to bounce them between /onboarding, /pending and /login forever,
-- because the onboarding UPDATE matched zero rows and PostgREST does not treat
-- that as an error.
--
-- Safe to re-run: the insert skips anyone who already has a row.
-- ===========================================================================

insert into public.profiles (id, email, full_name, avatar_url)
select u.id,
       u.email,
       coalesce(
         u.raw_user_meta_data->>'full_name',
         u.raw_user_meta_data->>'name',
         split_part(coalesce(u.email, ''), '@', 1),
         ''
       ),
       coalesce(
         u.raw_user_meta_data->>'avatar_url',
         u.raw_user_meta_data->>'picture'
       )
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
