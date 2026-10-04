-- Caps how many duels (challenges) a user can have ACTIVE at once, to 2.
-- "Active" here means status = 'active' - an already-running duel with a
-- clock on it - not merely pending. A user can still have any number of
-- pending (sent-but-not-yet-answered) challenges sitting around; the cap
-- only stops a THIRD one from starting, whether that's the challenger
-- sending it or the opponent accepting it. This matches the two points
-- where a duel actually starts: create_challenge (which only runs for the
-- challenger) and respond_to_challenge (accepting, which the opponent
-- does, but checked against both participants so neither side can end up
-- with 3 active duels).

create or replace function count_active_duels(p_user_id uuid)
returns int as $$
  select count(*)::int from challenges
    where status = 'active'
      and (challenger_id = p_user_id or opponent_id = p_user_id);
$$ language sql stable;

grant execute on function count_active_duels(uuid) to authenticated;

-- ---------- create_challenge ----------
-- Sending a challenge doesn't itself start a duel (it's just 'pending'
-- until the opponent responds), but if the challenger is already at the
-- cap there's no point letting them pile up a challenge they can't accept
-- consequences of anyway, so this is checked here too, using the same
-- message that respond_to_challenge raises on accept.
create or replace function create_challenge(p_opponent_id uuid, p_duration_days int)
returns challenges as $$
declare
  result challenges;
begin
  if p_opponent_id = auth.uid() then
    raise exception 'You cannot challenge yourself';
  end if;
  if p_duration_days < 1 or p_duration_days > 7 then
    raise exception 'Duration must be between 1 and 7 days';
  end if;
  if count_active_duels(auth.uid()) >= 2 then
    raise exception 'You can only be in 2 duels at a time - finish or wait out one first';
  end if;

  perform check_rate_limit('create_challenge', 10, 3600);

  insert into challenges (challenger_id, opponent_id, duration_days, status)
  values (auth.uid(), p_opponent_id, p_duration_days, 'pending')
  returning * into result;

  return result;
end;
$$ language plpgsql security definer;

-- ---------- respond_to_challenge ----------
-- Re-checks the cap at accept time (not just when the challenge was
-- created) for both sides, since either participant may have started
-- other duels in the meantime: the opponent (accepting now) and the
-- challenger (whose duel count could also have changed since they sent
-- this one).
create or replace function respond_to_challenge(p_challenge_id uuid, p_accept boolean)
returns challenges as $$
declare
  c challenges;
  result challenges;
begin
  select * into c from challenges where id = p_challenge_id;
  if c is null then
    raise exception 'Challenge not found';
  end if;
  if c.opponent_id <> auth.uid() then
    raise exception 'Only the challenged user can respond to this';
  end if;
  if c.status <> 'pending' then
    raise exception 'This challenge has already been resolved';
  end if;

  if p_accept then
    if count_active_duels(c.opponent_id) >= 2 then
      raise exception 'You can only be in 2 duels at a time - finish or wait out one first';
    end if;
    if count_active_duels(c.challenger_id) >= 2 then
      raise exception 'The challenger is already in 2 duels right now - try again later';
    end if;

    update challenges
      set status = 'active',
          starts_at = now(),
          ends_at = now() + (c.duration_days || ' days')::interval,
          responded_at = now()
      where id = p_challenge_id
      returning * into result;
  else
    update challenges
      set status = 'declined', responded_at = now()
      where id = p_challenge_id
      returning * into result;
  end if;

  return result;
end;
$$ language plpgsql security definer;

grant execute on function create_challenge(uuid, int) to authenticated;
grant execute on function respond_to_challenge(uuid, boolean) to authenticated;
