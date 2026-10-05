-- Lets either participant end an ACTIVE duel early as a forfeit - an
-- automatic loss for whoever forfeits, a win for the other side - instead
-- of waiting out its natural multi-day window. Two real uses: a person who
-- wants to bow out of a duel they're not going to finish (the account
-- getting ahead stays ahead, the other one just stops dragging it out),
-- and e2e tests that need to free up a duel slot (the 2-active-duel cap
-- from migration 015) without actually waiting days for one to end.
create or replace function forfeit_challenge(p_challenge_id uuid)
returns challenges as $$
declare
  c challenges;
  result challenges;
  c_count int;
  o_count int;
begin
  select * into c from challenges where id = p_challenge_id;
  if c is null then
    raise exception 'Challenge not found';
  end if;
  if auth.uid() not in (c.challenger_id, c.opponent_id) then
    raise exception 'Not a participant in this challenge';
  end if;
  if c.status <> 'active' then
    raise exception 'Only an active duel can be forfeited';
  end if;

  -- Record whatever tally had actually accumulated up to the moment of
  -- forfeiting, same counting window resolve_challenge uses - the forfeiter
  -- still loses regardless of the count (that's the point of forfeiting),
  -- but the final score shown in history should be real, not zeroed out.
  select count(*) into c_count from applications
    where user_id = c.challenger_id and created_at >= c.starts_at and created_at <= now();
  select count(*) into o_count from applications
    where user_id = c.opponent_id and created_at >= c.starts_at and created_at <= now();

  update challenges
    set status = 'completed',
        ends_at = now(),
        challenger_count = c_count,
        opponent_count = o_count,
        winner_id = case when auth.uid() = c.challenger_id then c.opponent_id else c.challenger_id end
    where id = p_challenge_id
    returning * into result;

  return result;
end;
$$ language plpgsql security definer;

grant execute on function forfeit_challenge(uuid) to authenticated;
