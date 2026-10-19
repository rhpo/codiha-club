-- ===========================================================================
-- 0002 — site settings (theme palette) + year-long points period
--
-- Safe to run on a database that already has schema.sql applied. It is also
-- idempotent, so re-running it is a no-op.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Site settings: a tiny key/value store. Public read (the palette has to be
--    applied for anonymous visitors too), admin write.
-- ---------------------------------------------------------------------------
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.site_settings enable row level security;

drop policy if exists settings_read  on public.site_settings;
drop policy if exists settings_admin on public.site_settings;
create policy settings_read  on public.site_settings for select using (true);
create policy settings_admin on public.site_settings for all
  using (public.is_admin()) with check (public.is_admin());

insert into public.site_settings (key, value)
values ('theme', '{"primary":"#294230","accent":"#fa9200"}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Points now run over a whole academic year instead of a single semester.
--    The `semesters` table is just a "scoring period" table, so the change is
--    data-only: widen the rows to September → August.
-- ---------------------------------------------------------------------------
delete from public.semesters;

insert into public.semesters (name, starts_on, ends_on) values
  ('2024/2025', date '2024-09-01', date '2025-08-31'),
  ('2025/2026', date '2025-09-01', date '2026-08-31'),
  ('2026/2027', date '2026-09-01', date '2027-08-31'),
  ('2027/2028', date '2027-09-01', date '2028-08-31')
on conflict (name) do nothing;

-- The UI labels the board with the period name, so return it too. The return
-- type changes, which `create or replace` cannot do on its own.
drop function if exists public.semester_bounds();
create function public.semester_bounds()
returns table (name text, starts_on date, ends_on date)
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(max(s.name), 'All time'),
         coalesce(min(s.starts_on), date '1970-01-01'),
         coalesce(max(s.ends_on),   date '2999-01-01')
  from public.semesters s
  where current_date between s.starts_on and s.ends_on;
$$;
