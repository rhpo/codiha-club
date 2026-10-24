-- ---------------------------------------------------------------------------
-- 0011 - alumni
--
-- Somebody who has left the club is not the same as somebody who was turned
-- away at the door. 'rejected' says "we did not take you"; 'alumni' says "you
-- were one of us". The difference matters to the person, and it keeps their
-- points, certificates and history intact instead of deleting them.
--
-- Nothing else needs changing: is_member() and is_admin() both require
-- status = 'approved', and the members view and leaderboard filter on it, so
-- an alumnus loses access and drops out of the public lists on the same
-- update.
-- ---------------------------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check
  check (status in ('pending', 'approved', 'rejected', 'alumni'));

comment on column public.profiles.status is
  'pending: awaiting review. approved: an active member. rejected: turned down '
  'at application. alumni: was a member, no longer active - history kept.';
