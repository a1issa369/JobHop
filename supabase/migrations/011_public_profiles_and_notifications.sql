-- Two changes bundled together since they're both the fallout of the same
-- decision: profiles go fully public (resume, activity calendar, pipeline
-- chart, board, friends list, duel history all visible to any signed-in
-- user, not just friends/followers) with ONE narrow exception - two users
-- currently dueling each other can't see each other's application activity
-- for the duration of that duel, so neither can watch the other's live
-- count and game the race. Friends/follows stop being an access-control
-- mechanism and become purely a notification/social-graph feature instead.

-- ---------- helper: are these two users mid-duel right now? ----------
create or replace function in_active_duel(p_other_id uuid)
returns boolean as $$
  select exists (
    select 1 from challenges
    where status = 'active'
      and ((challenger_id = auth.uid() and opponent_id = p_other_id)
        or (challenger_id = p_other_id and opponent_id = auth.uid()))
  );
$$ language sql security definer stable;

-- Same thing as a plain callable boolean, for the client to decide which
-- empty-state message to show ("hidden during your duel" vs "nothing yet").
create or replace function is_in_active_duel_with(p_other_id uuid)
returns boolean as $$
begin
  return in_active_duel(p_other_id);
end;
$$ language plpgsql security definer stable;

grant execute on function in_active_duel(uuid) to authenticated;
grant execute on function is_in_active_duel_with(uuid) to authenticated;

-- ---------- profiles: fully public ----------
drop policy if exists "profiles_select_own_or_friend" on profiles;
drop policy if exists "profiles_select_all" on profiles;
create policy "profiles_select_all"
  on profiles for select
  using (true);

-- ---------- applications: public, except to your current duel opponent ----------
drop policy if exists "applications_select_friend_heatmap" on applications;
drop policy if exists "applications_select_public_except_duel" on applications;
create policy "applications_select_public_except_duel"
  on applications for select
  using (
    user_id = auth.uid()
    or not in_active_duel(user_id)
  );

-- ---------- stage_history: same rule, it's what draws the pipeline chart ----------
drop policy if exists "stage_history_select_friend" on stage_history;
drop policy if exists "stage_history_select_public_except_duel" on stage_history;
create policy "stage_history_select_public_except_duel"
  on stage_history for select
  using (
    user_id = auth.uid()
    or not in_active_duel(user_id)
  );

-- ---------- resumes: public read (same spirit - it's part of the now-public profile) ----------
drop policy if exists "resumes_owner_or_friend_read" on storage.objects;
drop policy if exists "resumes_public_read" on storage.objects;
create policy "resumes_public_read"
  on storage.objects for select
  using (bucket_id = 'resumes');

-- ---------- friendships: accepted friendships are public (so anyone can
-- see anyone's friends list); a still-pending or blocked row stays visible
-- only to the two people involved ----------
drop policy if exists "friendships_select_participant" on friendships;
drop policy if exists "friendships_select_accepted_or_participant" on friendships;
create policy "friendships_select_accepted_or_participant"
  on friendships for select
  using (
    status = 'accepted'
    or requester_id = auth.uid()
    or addressee_id = auth.uid()
  );

-- ---------- challenges: a live or finished duel is public (so anyone can
-- see anyone's duel record/history); a still-pending invite or a declined/
-- cancelled one stays visible only to the two participants ----------
drop policy if exists "challenges_select_participant" on challenges;
drop policy if exists "challenges_select_public_history_or_participant" on challenges;
create policy "challenges_select_public_history_or_participant"
  on challenges for select
  using (
    status in ('active', 'completed')
    or challenger_id = auth.uid()
    or opponent_id = auth.uid()
  );

-- ============================================================
-- Notifications
-- ============================================================
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade, -- recipient
  type text not null check (type in (
    'friend_request', 'friend_accepted',
    'duel_invite', 'duel_accepted', 'duel_declined', 'duel_completed',
    'friend_application'
  )),
  actor_id uuid references profiles(id) on delete set null, -- who caused it
  data jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on notifications (user_id, created_at desc);

alter table notifications enable row level security;

drop policy if exists "notifications_select_own" on notifications;
create policy "notifications_select_own"
  on notifications for select
  using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on notifications;
create policy "notifications_update_own"
  on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Client never inserts/deletes directly - only the trigger functions below
-- (SECURITY DEFINER, bypass RLS) create rows, and nothing removes them.
drop policy if exists "notifications_no_direct_insert" on notifications;
create policy "notifications_no_direct_insert"
  on notifications for insert
  with check (false);

drop policy if exists "notifications_no_direct_delete" on notifications;
create policy "notifications_no_direct_delete"
  on notifications for delete
  using (false);

-- ---------- friend request sent / accepted ----------
create or replace function notify_friend_request()
returns trigger as $$
begin
  if new.status = 'pending' then
    insert into notifications (user_id, type, actor_id, data)
    values (new.addressee_id, 'friend_request', new.requester_id, jsonb_build_object('friendship_id', new.id));
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_friend_request on friendships;
create trigger trg_notify_friend_request
  after insert on friendships
  for each row execute procedure notify_friend_request();

create or replace function notify_friend_accepted()
returns trigger as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into notifications (user_id, type, actor_id, data)
    values (new.requester_id, 'friend_accepted', new.addressee_id, jsonb_build_object('friendship_id', new.id));
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_friend_accepted on friendships;
create trigger trg_notify_friend_accepted
  after update on friendships
  for each row execute procedure notify_friend_accepted();

-- ---------- duel invite / accepted / declined / completed ----------
create or replace function notify_duel_invite()
returns trigger as $$
begin
  insert into notifications (user_id, type, actor_id, data)
  values (new.opponent_id, 'duel_invite', new.challenger_id,
    jsonb_build_object('challenge_id', new.id, 'duration_days', new.duration_days));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_duel_invite on challenges;
create trigger trg_notify_duel_invite
  after insert on challenges
  for each row execute procedure notify_duel_invite();

create or replace function notify_duel_status_change()
returns trigger as $$
begin
  if new.status = 'active' and old.status = 'pending' then
    insert into notifications (user_id, type, actor_id, data)
    values (new.challenger_id, 'duel_accepted', new.opponent_id, jsonb_build_object('challenge_id', new.id));
  elsif new.status = 'declined' and old.status = 'pending' then
    insert into notifications (user_id, type, actor_id, data)
    values (new.challenger_id, 'duel_declined', new.opponent_id, jsonb_build_object('challenge_id', new.id));
  elsif new.status = 'completed' and old.status = 'active' then
    insert into notifications (user_id, type, actor_id, data)
    values (
      new.challenger_id, 'duel_completed', new.opponent_id,
      jsonb_build_object(
        'challenge_id', new.id,
        'won', new.winner_id = new.challenger_id,
        'draw', new.winner_id is null
      )
    );
    insert into notifications (user_id, type, actor_id, data)
    values (
      new.opponent_id, 'duel_completed', new.challenger_id,
      jsonb_build_object(
        'challenge_id', new.id,
        'won', new.winner_id = new.opponent_id,
        'draw', new.winner_id is null
      )
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_duel_status_change on challenges;
create trigger trg_notify_duel_status_change
  after update on challenges
  for each row execute procedure notify_duel_status_change();

-- ---------- friend/follower activity feed: "X applied to Y" ----------
-- Fires for every accepted friend and every follower of the applicant,
-- skipping anyone currently dueling the applicant (the whole point of
-- hiding applications during a duel is that your opponent can't watch your
-- live count - a notification would defeat that just as much as a query would).
create or replace function notify_friends_of_application()
returns trigger as $$
begin
  insert into notifications (user_id, type, actor_id, data)
  select r.recipient_id, 'friend_application', new.user_id,
    jsonb_build_object('application_id', new.id, 'company', new.company, 'role', new.role)
  from (
    select case when f.requester_id = new.user_id then f.addressee_id else f.requester_id end as recipient_id
    from friendships f
    where f.status = 'accepted'
      and (f.requester_id = new.user_id or f.addressee_id = new.user_id)
    union
    select fo.follower_id as recipient_id
    from follows fo
    where fo.followee_id = new.user_id
  ) r
  where not exists (
    select 1 from challenges c
    where c.status = 'active'
      and ((c.challenger_id = new.user_id and c.opponent_id = r.recipient_id)
        or (c.challenger_id = r.recipient_id and c.opponent_id = new.user_id))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_friends_of_application on applications;
create trigger trg_notify_friends_of_application
  after insert on applications
  for each row execute procedure notify_friends_of_application();
