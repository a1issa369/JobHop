-- The Friends page search was silently returning nothing for anyone who
-- isn't already a friend/follow - not a frontend bug, but RLS working
-- exactly as designed: profiles_select_own_or_friend only lets you read a
-- profile row you already have a relationship with, so a stranger's
-- profile is invisible to a plain `select * from profiles` no matter how
-- the search box itself is built. Finding NEW people to friend needs a
-- narrow, explicit exception: a SECURITY DEFINER function that returns
-- only the handful of fields that are safe for anyone to see in a
-- directory search (id, username, display name, avatar) - never bio,
-- school, resume_url, or links - for everyone except the fields that stay
-- behind the normal friend/follow gate.
create or replace function search_profiles(p_query text)
returns table(id uuid, username text, full_name text, avatar_url text) as $$
begin
  if coalesce(trim(p_query), '') = '' then
    return;
  end if;
  return query
    select p.id, p.username, p.full_name, p.avatar_url
    from profiles p
    where p.username ilike '%' || trim(p_query) || '%'
      and p.id <> auth.uid()
    order by p.username
    limit 10;
end;
$$ language plpgsql security definer stable;

grant execute on function search_profiles(text) to authenticated;
