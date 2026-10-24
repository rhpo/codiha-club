-- ---------------------------------------------------------------------------
-- 0013 - a gallery the board can actually edit
--
-- The gallery was a markdown string in src/lib/data/articles.js pointing at
-- files in static/, so adding a photo from last night's workshop meant a code
-- change and a deploy. It is now rows.
--
-- Sections are a plain text column rather than an albums table: the only
-- thing the club does with them is group and title a run of photos, and a
-- second table would buy nothing but joins.
-- ---------------------------------------------------------------------------

create table if not exists public.gallery_items (
  id          uuid primary key default gen_random_uuid(),
  url         text not null,
  caption     text,
  -- Heading this photo sits under. Empty means the untitled run at the top.
  section     text not null default '',
  -- Ordering within the section; sections themselves sort by their lowest.
  position    integer not null default 0,
  kind        text not null default 'image' check (kind in ('image', 'video')),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists gallery_order on public.gallery_items (section, position);

alter table public.gallery_items enable row level security;

/* Staff and above maintain it. Everyone else, including signed-out visitors,
   can look: the gallery is the club's shop window. */
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and status = 'approved'
       and role in ('staff', 'project_manager', 'admin', 'superadmin')
  );
$$;

drop policy if exists gallery_read  on public.gallery_items;
drop policy if exists gallery_write on public.gallery_items;
create policy gallery_read on public.gallery_items for select using (true);
create policy gallery_write on public.gallery_items for all
  using (public.is_staff()) with check (public.is_staff());

insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

drop policy if exists gallery_public on storage.objects;
drop policy if exists gallery_staff  on storage.objects;
create policy gallery_public on storage.objects for select
  using (bucket_id = 'gallery');
create policy gallery_staff on storage.objects for all
  using (bucket_id = 'gallery' and public.is_staff())
  with check (bucket_id = 'gallery' and public.is_staff());

-- ---------------------------------------------------------------------------
-- Carry over what the hardcoded gallery already showed, so switching the page
-- to the database does not empty it. These files are in static/ and stay
-- there; only the list of them moves.
-- ---------------------------------------------------------------------------
insert into public.gallery_items (url, section, position, kind)
values
  ('/images/hackiha.png',          'Club introduction',     0, 'image'),
  ('/videos/hackiha-ramy.mp4',     'Club introduction',     1, 'video'),
  ('/images/members-shot-1.jpg',   'Cybersecurity workshop', 0, 'image'),
  ('/images/members-shot-2.jpg',   'Cybersecurity workshop', 1, 'image'),
  ('/images/post-svelte.png',      'Workshop sessions',     0, 'image'),
  ('/images/post-usa-2.png',       'Workshop sessions',     1, 'image'),
  ('/images/post-challenge.png',   'Workshop sessions',     2, 'image'),
  ('/images/post-cs.png',          'Workshop sessions',     3, 'image'),
  ('/images/members.jpg',          'Our members',           0, 'image'),
  ('/images/members-2.jpg',        'Our members',           1, 'image'),
  ('/images/members-shot-3.png',   'Our members',           2, 'image'),
  ('/images/members-3.png',        'Our members',           3, 'image')
on conflict do nothing;
