-- ===========================================================================
-- 0007 - keep the board competitive, and a public member directory
--
--  * The leaderboard is for members competing with each other. Admins and
--    developers award the points, so ranking them alongside everyone else is
--    both odd and an invitation to game it. Staff and project managers stay:
--    they still take part.
--  * member_directory backs the grid on the landing page: every approved
--    member, with their points, and nothing private.
--
-- Safe to re-run.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Leaderboard excludes rank >= admin
-- ---------------------------------------------------------------------------
drop view if exists public.leaderboard;
create view public.leaderboard as
with totals as (
  select p.id, p.full_name, p.university, p.field, p.year, p.avatar_url,
         public.semester_points(p.id) as points
  from public.profiles p
  where p.status = 'approved'
    -- role_rank() is the single source of truth for the hierarchy, so a new
    -- tier added later lands on the right side of this automatically.
    and public.role_rank(p.role) < 40
)
select t.*,
       rank() over (order by t.points desc, t.full_name asc)::int as rank,
       (select count(*) from public.member_badges mb where mb.member_id = t.id)::int as badge_count
from totals t;

grant select on public.leaderboard to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Public directory: everyone approved, including the board
--
-- Deliberately wider than the leaderboard. The grid is "who is in this club",
-- not "who is winning", so the people running it belong in it.
-- ---------------------------------------------------------------------------
drop view if exists public.member_directory;
create view public.member_directory as
select p.id,
       p.full_name,
       p.avatar_url,
       p.university,
       p.field,
       p.year,
       public.role_rank(p.role) >= 20 as is_board,
       public.semester_points(p.id) as points,
       p.created_at
from public.profiles p
where p.status = 'approved';

grant select on public.member_directory to anon, authenticated;
