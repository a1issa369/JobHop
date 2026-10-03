-- Head-to-head "challenge" mode: one user challenges another to a 1-7 day
-- race on who submits more applications. If accepted, whoever applies to
-- more during the window wins (a tie is a draw); the running wins/draws/
-- losses record between any two users is shown chess.com-style ("Vs Shawn
-- 10-1-15") on a friend's profile card.
--
-- All writes except the initial challenge-creation insert go through
-- SECURITY DEFINER functions below, because responding to, resolving, or
-- checking progress on a challenge needs to safely read the OTHER
-- participant's application rows (which normal RLS would block) without
-- opening up direct client writes to arbitrary challenge rows - the same
-- pattern already used for rate_limit_log / check_rate_limit.

create table if not exists challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references profiles(id) on delete cascade,
  opponent_id uuid not null references profiles(id) on delete cascade,
  duration_days int not null check (duration_days between 1 and 7),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'declined', 'cancelled', 'completed')),
  starts_at timestamptz,
  ends_at timestamptz,
  challenger_count int not null default 0,
  opponent_count int not null default 0,
  winner_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint no_self_challenge check (challenger_id <> opponent_id)
);

create index if not exists idx_challenges_challenger on challenges (challenger_id);
create index if not exists idx_challenges_opponent on challenges (opponent_id);
create index if not exists idx_challenges_status on challenges (status);

alter table challenges enable row level security;

drop policy if exists "challenges_select_participant" on challenges;
create policy "challenges_select_participant"
  on challenges for select
  using (challenger_id = auth.uid() or opponent_id = auth.uid());

-- No direct inserts/updates from the client - everything goes through the
-- functions below, which run as the table owner and so bypass RLS, same as
-- rate_limit_log's functions-only pattern.
drop policy if exists "challenges_no_direct_insert" on challenges;
create policy "challenges_no_direct_insert"
  on challenges for insert
  with check (false);

drop policy if exists "challenges_no_direct_update" on challenges;
create policy "challenges_no_direct_update"
  on challenges for update
  using (false);

-- ---------- create_challenge ----------
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

  perform check_rate_limit('create_challenge', 10, 3600);

  insert into challenges (challenger_id, opponent_id, duration_days, status)
  values (auth.uid(), p_opponent_id, p_duration_days, 'pending')
  returning * into result;

  return result;
end;
$$ language plpgsql security definer;

-- ---------- respond_to_challenge ----------
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

-- ---------- cancel_challenge ----------
create or replace function cancel_challenge(p_challenge_id uuid)
returns challenges as $$
declare
  c challenges;
  result challenges;
begin
  select * into c from challenges where id = p_challenge_id;
  if c is null then
    raise exception 'Challenge not found';
  end if;
  if c.challenger_id <> auth.uid() then
    raise exception 'Only the challenger can cancel this';
  end if;
  if c.status <> 'pending' then
    raise exception 'Only a still-pending challenge can be cancelled';
  end if;

  update challenges set status = 'cancelled', responded_at = now()
    where id = p_challenge_id
    returning * into result;

  return result;
end;
$$ language plpgsql security definer;

-- ---------- resolve_challenge ----------
-- Either participant can call this once ends_at has passed; it tallies how
-- many applications each side created during [starts_at, ends_at] and
-- settles the winner. Safe to call more than once - a no-op once the
-- challenge is no longer 'active'.
create or replace function resolve_challenge(p_challenge_id uuid)
returns challenges as $$
declare
  c challenges;
  c_count int;
  o_count int;
  result challenges;
begin
  select * into c from challenges where id = p_challenge_id;
  if c is null then
    raise exception 'Challenge not found';
  end if;
  if auth.uid() not in (c.challenger_id, c.opponent_id) then
    raise exception 'Not a participant in this challenge';
  end if;
  if c.status <> 'active' then
    return c;
  end if;
  if now() < c.ends_at then
    raise exception 'This challenge has not ended yet';
  end if;

  select count(*) into c_count from applications
    where user_id = c.challenger_id and created_at >= c.starts_at and created_at <= c.ends_at;
  select count(*) into o_count from applications
    where user_id = c.opponent_id and created_at >= c.starts_at and created_at <= c.ends_at;

  update challenges
    set status = 'completed',
        challenger_count = c_count,
        opponent_count = o_count,
        winner_id = case
          when c_count > o_count then c.challenger_id
          when o_count > c_count then c.opponent_id
          else null
        end
    where id = p_challenge_id
    returning * into result;

  return result;
end;
$$ language plpgsql security definer;

-- ---------- challenge_progress ----------
-- Live running counts for an active challenge, visible to its two
-- participants only, without exposing either side's raw application rows.
create or replace function challenge_progress(p_challenge_id uuid)
returns table(challenger_count int, opponent_count int) as $$
declare
  c challenges;
begin
  select * into c from challenges where id = p_challenge_id;
  if c is null then
    raise exception 'Challenge not found';
  end if;
  if auth.uid() not in (c.challenger_id, c.opponent_id) then
    raise exception 'Not a participant in this challenge';
  end if;

  return query
    select
      (select count(*)::int from applications
        where user_id = c.challenger_id
          and created_at >= c.starts_at and created_at <= least(now(), coalesce(c.ends_at, now()))),
      (select count(*)::int from applications
        where user_id = c.opponent_id
          and created_at >= c.starts_at and created_at <= least(now(), coalesce(c.ends_at, now())));
end;
$$ language plpgsql security definer stable;

-- ---------- head_to_head ----------
-- All-time wins/draws/losses for the signed-in user against one other
-- user, from completed challenges only - this is what powers the
-- "Vs Shawn 10-1-15" line on a profile card.
create or replace function head_to_head(p_other_id uuid)
returns table(wins int, draws int, losses int) as $$
begin
  return query
    select
      count(*) filter (where winner_id = auth.uid())::int,
      count(*) filter (where winner_id is null)::int,
      count(*) filter (where winner_id = p_other_id)::int
    from challenges
    where status = 'completed'
      and ((challenger_id = auth.uid() and opponent_id = p_other_id)
        or (challenger_id = p_other_id and opponent_id = auth.uid()));
end;
$$ language plpgsql security definer stable;

grant execute on function create_challenge(uuid, int) to authenticated;
grant execute on function respond_to_challenge(uuid, boolean) to authenticated;
grant execute on function cancel_challenge(uuid) to authenticated;
grant execute on function resolve_challenge(uuid) to authenticated;
grant execute on function challenge_progress(uuid) to authenticated;
grant execute on function head_to_head(uuid) to authenticated;
