-- ---------------------------------------------------------------------------
-- 0016 - who reacted
--
-- The counts were already public to members; the names behind them were not
-- reachable, because profiles deliberately does not let one member read
-- another's row - it holds emails, phone numbers and Discord handles.
--
-- So this returns the same three things the feed already shows about a post's
-- author, and nothing else. The approved check is inside the function because
-- a SECURITY DEFINER runs as its owner: without it, this would hand the whole
-- reactor list to anybody who could call it.
-- ---------------------------------------------------------------------------

create or replace function public.post_reactors(p_post uuid)
returns table (member_id uuid, full_name text, avatar_url text, emoji text, reacted_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_approved() then
    raise exception 'Only approved members can see who reacted';
  end if;

  return query
    select r.member_id, p.full_name, p.avatar_url, r.emoji, r.created_at
      from public.post_reactions r
      join public.profiles p on p.id = r.member_id
     where r.post_id = p_post
     order by r.created_at desc;
end $$;
