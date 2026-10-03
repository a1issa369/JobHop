-- Clicking a stranger from search needs to land on a real page, not an
-- RLS-blocked error - but their resume, activity calendar, and pipeline
-- chart should still stay gated behind a friendship/follow, same as
-- before. This splits "public card" info (name, avatar, school, links)
-- out into its own narrow lookup, same pattern as search_profiles:
-- anyone signed in can see these fields for anyone, nothing sensitive
-- (resume_url, bio) is included.
create or replace function get_public_profile(p_user_id uuid)
returns table(
  id uuid, username text, full_name text, avatar_url text,
  school text, linkedin_url text, github_url text
) as $$
begin
  return query
    select p.id, p.username, p.full_name, p.avatar_url, p.school, p.linkedin_url, p.github_url
    from profiles p
    where p.id = p_user_id;
end;
$$ language plpgsql security definer stable;

grant execute on function get_public_profile(uuid) to authenticated;
