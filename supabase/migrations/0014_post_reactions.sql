-- ---------------------------------------------------------------------------
-- 0014 - reactions
--
-- A like could only say "I saw this and approved". A reaction says which of
-- those it was, which is most of the value for a feed of people's projects:
-- "that is funny" and "that is impressive" are different replies.
--
-- post_likes becomes post_reactions with an emoji column. One row per member
-- per post still, so reacting again changes your mind rather than stacking:
-- the primary key is the rule, as it was for likes.
-- ---------------------------------------------------------------------------

create table if not exists public.post_reactions (
  post_id    uuid not null references public.posts (id) on delete cascade,
  member_id  uuid not null references public.profiles (id) on delete cascade,
  -- Constrained to a known set so the column cannot fill with arbitrary text
  -- and the UI never has to render something it has no button for.
  emoji      text not null check (emoji in ('like', 'love', 'fire', 'clap', 'idea', 'funny')),
  created_at timestamptz not null default now(),
  primary key (post_id, member_id)
);
create index if not exists post_reactions_post on public.post_reactions (post_id);

-- Carry the existing likes over as 'like' so nothing is lost.
insert into public.post_reactions (post_id, member_id, emoji, created_at)
select post_id, member_id, 'like', created_at from public.post_likes
on conflict (post_id, member_id) do nothing;

alter table public.post_reactions enable row level security;

drop policy if exists post_reactions_read on public.post_reactions;
drop policy if exists post_reactions_own  on public.post_reactions;
create policy post_reactions_read on public.post_reactions for select
  using (public.is_approved());
create policy post_reactions_own on public.post_reactions for all
  using (member_id = auth.uid())
  with check (member_id = auth.uid() and public.is_verified_member());

-- The view has to go first: it still selects from post_likes, and Postgres
-- refuses to drop a table something depends on.
drop view if exists public.post_feed;

-- post_likes is retired. Dropping it also drops its policies and index.
drop table if exists public.post_likes;
create view public.post_feed as
select p.id,
       p.author_id,
       p.body,
       p.created_at,
       pr.full_name  as author_name,
       pr.avatar_url as author_avatar,
       pr.role       as author_role,
       (select count(*) from public.post_reactions r where r.post_id = p.id) as like_count,
       (select count(*) from public.post_comments  c where c.post_id = p.id) as comment_count
from public.posts p
join public.profiles pr on pr.id = p.author_id;

/*
 * Reactions for a page of posts, already tallied.
 *
 * Without this the feed would either run a query per post or ship every
 * individual reaction row to the server just to count them.
 */
create or replace function public.post_reaction_counts(p_posts uuid[])
returns table (post_id uuid, emoji text, n integer)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.post_id, r.emoji, count(*)::int
    from public.post_reactions r
   where r.post_id = any(p_posts)
   group by r.post_id, r.emoji;
$$;
