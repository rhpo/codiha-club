-- ---------------------------------------------------------------------------
-- 0012 - member posts
--
-- A feed where members show what they have built. Posting is limited to
-- members who passed the face check: the club's answer to "who is this?" is
-- a verified photo, and a feed is exactly where that matters.
--
-- Comments are one level deep. A reply to a reply is still a reply to the
-- same comment, which keeps rendering to a single indent and avoids threads
-- nobody can follow on a phone.
-- ---------------------------------------------------------------------------

create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (length(btrim(body)) between 1 and 4000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists posts_recent on public.posts (created_at desc);
create index if not exists posts_author on public.posts (author_id);

-- Images live in their own table rather than an array column so each one can
-- be removed individually and ordered.
create table if not exists public.post_images (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  url        text not null,
  position   smallint not null default 0 check (position between 0 and 3),
  created_at timestamptz not null default now(),
  unique (post_id, position)
);
create index if not exists post_images_post on public.post_images (post_id);

/*
 * Four images per post, enforced here as well as in the form.
 *
 * The unique (post_id, position) index with positions 0..3 already caps it,
 * but only if the caller numbers them correctly. This catches the case where
 * somebody posts four images twice with the same positions, or writes to the
 * table directly.
 */
create or replace function public.posts_image_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.post_images where post_id = new.post_id) >= 4 then
    raise exception 'A post can have at most 4 images';
  end if;
  return new;
end;
$$;

drop trigger if exists post_images_cap on public.post_images;
create trigger post_images_cap before insert on public.post_images
  for each row execute function public.posts_image_limit();

-- One like per member per post; the primary key is the whole rule.
create table if not exists public.post_likes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  member_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, member_id)
);
create index if not exists post_likes_post on public.post_likes (post_id);

create table if not exists public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  -- Null for a top-level comment. A reply to a reply is stored against the
  -- same parent, so the tree is never deeper than one indent.
  parent_id  uuid references public.post_comments (id) on delete cascade,
  body       text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post on public.post_comments (post_id, created_at);

/*
 * Flattens any reply-to-a-reply onto its top-level ancestor, so the display
 * never has to recurse and a long argument cannot indent off the screen.
 */
create or replace function public.post_comments_flatten()
returns trigger language plpgsql as $$
declare
  grandparent uuid;
begin
  if new.parent_id is not null then
    select parent_id into grandparent from public.post_comments where id = new.parent_id;
    if grandparent is not null then
      new.parent_id := grandparent;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists post_comments_one_level on public.post_comments;
create trigger post_comments_one_level before insert on public.post_comments
  for each row execute function public.post_comments_flatten();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.posts         enable row level security;
alter table public.post_images   enable row level security;
alter table public.post_likes    enable row level security;
alter table public.post_comments enable row level security;

/* Only a member who passed the face check may put something in the feed. */
create or replace function public.is_verified_member()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and status = 'approved'
       and (avatar_face_verified or role = 'superadmin')
  );
$$;

drop policy if exists posts_read   on public.posts;
drop policy if exists posts_write  on public.posts;
drop policy if exists posts_modify on public.posts;
create policy posts_read on public.posts for select using (public.is_approved());
create policy posts_write on public.posts for insert
  with check (author_id = auth.uid() and public.is_verified_member());
-- Authors edit and delete their own; admins can remove anything.
create policy posts_modify on public.posts for all
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

drop policy if exists post_images_read  on public.post_images;
drop policy if exists post_images_write on public.post_images;
create policy post_images_read on public.post_images for select using (public.is_approved());
create policy post_images_write on public.post_images for all
  using (exists (select 1 from public.posts p
                  where p.id = post_id and (p.author_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.posts p
                       where p.id = post_id and (p.author_id = auth.uid() or public.is_admin())));

drop policy if exists post_likes_read on public.post_likes;
drop policy if exists post_likes_own  on public.post_likes;
create policy post_likes_read on public.post_likes for select using (public.is_approved());
create policy post_likes_own on public.post_likes for all
  using (member_id = auth.uid())
  with check (member_id = auth.uid() and public.is_verified_member());

drop policy if exists post_comments_read   on public.post_comments;
drop policy if exists post_comments_write  on public.post_comments;
drop policy if exists post_comments_modify on public.post_comments;
create policy post_comments_read on public.post_comments for select using (public.is_approved());
create policy post_comments_write on public.post_comments for insert
  with check (author_id = auth.uid() and public.is_verified_member());
-- A comment can be removed by whoever wrote it, by the post's author, or by
-- an admin: the author of a post has to be able to clear their own replies.
create policy post_comments_modify on public.post_comments for delete
  using (
    author_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

drop policy if exists post_images_public on storage.objects;
drop policy if exists post_images_owner  on storage.objects;
create policy post_images_public on storage.objects for select
  using (bucket_id = 'post-images');
create policy post_images_owner on storage.objects for all
  using (bucket_id = 'post-images' and owner = auth.uid())
  with check (bucket_id = 'post-images' and owner = auth.uid());

-- ---------------------------------------------------------------------------
-- Feed view: one row per post with its counts already summed, so the list
-- does not fire a count query per post.
-- ---------------------------------------------------------------------------
drop view if exists public.post_feed;
create view public.post_feed as
select p.id,
       p.author_id,
       p.body,
       p.created_at,
       pr.full_name  as author_name,
       pr.avatar_url as author_avatar,
       pr.role       as author_role,
       (select count(*) from public.post_likes    l where l.post_id = p.id) as like_count,
       (select count(*) from public.post_comments c where c.post_id = p.id) as comment_count
from public.posts p
join public.profiles pr on pr.id = p.author_id;
