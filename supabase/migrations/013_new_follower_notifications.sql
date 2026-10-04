-- A plain "X started following you" notification. This is intentionally
-- separate from the friend-request flow - no request to accept/decline,
-- just a heads up, since follows are already one-directional and
-- unapproved by design (see 007_follows.sql).

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check check (type in (
  'friend_request', 'friend_accepted',
  'duel_invite', 'duel_accepted', 'duel_declined', 'duel_completed',
  'friend_application', 'new_follower'
));

create or replace function notify_new_follower()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, type, actor_id, data)
  values (new.followee_id, 'new_follower', new.follower_id, '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists trg_notify_new_follower on follows;
create trigger trg_notify_new_follower
  after insert on follows
  for each row execute procedure notify_new_follower();
