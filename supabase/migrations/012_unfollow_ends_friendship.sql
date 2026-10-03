-- Unfollowing someone now also ends any friendship between the two of you,
-- and if you're mid-duel with them, you take an automatic loss. Both are
-- handled in a single AFTER DELETE trigger on `follows` so this applies no
-- matter which UI path the unfollow comes through (profile sidebar, the
-- followers/following panel, anywhere else later), and both are written to
-- be race-safe if both sides unfollow each other at effectively the same
-- moment - see the comments inside handle_unfollow() for how.

create or replace function handle_unfollow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge record;
  v_c_count int;
  v_o_count int;
begin
  -- A clean break, not a demotion: delete any friendship row between these
  -- two users, in either direction and whatever its status (pending,
  -- accepted, or blocked). A fresh follow + friend request afterwards then
  -- starts brand new rows, which is what lets the existing
  -- trg_notify_friend_request trigger (an AFTER INSERT) fire again for a
  -- new pending-request notification, instead of silently hitting a
  -- leftover row from the old friendship.
  --
  -- This DELETE is itself race-safe: if both sides unfollow each other in
  -- the same instant, two separate `follows` deletes each fire this
  -- trigger and each try this same DELETE. Whichever transaction's DELETE
  -- actually runs first removes the row; the other's DELETE then matches
  -- zero rows and is a harmless no-op, not an error.
  delete from friendships
  where (requester_id = old.follower_id and addressee_id = old.followee_id)
     or (requester_id = old.followee_id and addressee_id = old.follower_id);

  -- If they're mid-duel, whoever unfollowed the other person first takes
  -- the automatic loss, regardless of the application counts so far.
  for v_challenge in
    select id, challenger_id, opponent_id, starts_at
    from challenges
    where status = 'active'
      and ((challenger_id = old.follower_id and opponent_id = old.followee_id)
        or (challenger_id = old.followee_id and opponent_id = old.follower_id))
  loop
    select count(*) into v_c_count from applications
      where user_id = v_challenge.challenger_id
        and created_at >= v_challenge.starts_at and created_at <= now();
    select count(*) into v_o_count from applications
      where user_id = v_challenge.opponent_id
        and created_at >= v_challenge.starts_at and created_at <= now();

    -- The "and status = 'active'" predicate is what makes this race-safe
    -- for simultaneous unfollows: if both sides unfollow at once, two
    -- transactions both reach this UPDATE for the same challenge row.
    -- Postgres serializes them with a row lock, and whichever one
    -- actually acquires it first flips the status to 'completed' and
    -- decides the winner (the OTHER person, i.e. old.followee_id from
    -- its own point of view). The second transaction's UPDATE then finds
    -- status is no longer 'active' and matches zero rows, so it can
    -- neither double-apply nor overturn an outcome that's already
    -- settled - there's no scenario where both end up losing, both end
    -- up winning, or the result flips after the fact.
    update challenges
      set status = 'completed',
          ends_at = now(),
          challenger_count = v_c_count,
          opponent_count = v_o_count,
          winner_id = old.followee_id
      where id = v_challenge.id
        and status = 'active';
  end loop;

  return old;
end;
$$;

drop trigger if exists trg_handle_unfollow on follows;
create trigger trg_handle_unfollow
  after delete on follows
  for each row execute procedure handle_unfollow();
