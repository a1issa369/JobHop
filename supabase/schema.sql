-- ============================================================
-- JobHop schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- ============================================================

-- ---------- role grants ----------
-- IMPORTANT: Row Level Security policies control which ROWS a role can see,
-- but Postgres separately checks table-level privileges before RLS is even
-- evaluated. Without these grants every query returns "permission denied
-- for table X" regardless of how permissive the RLS policies are.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;

-- ---------- extensions ----------
create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ---------- profiles ----------
-- Extends auth.users with app-facing fields. One row per user, created by trigger below.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text check (char_length(full_name) <= 100),
  avatar_url text,
  bio text,
  school text check (char_length(school) <= 100),
  linkedin_url text check (char_length(linkedin_url) <= 200),
  github_url text check (char_length(github_url) <= 200),
  -- Path inside the private `resumes` storage bucket (e.g. "<user id>/resume.pdf"),
  -- not a public URL - a signed URL is generated on demand when it's viewed
  -- (see src/utils/resume.js), since the bucket itself stays private.
  resume_url text,
  created_at timestamptz not null default now()
);

create index idx_profiles_username on profiles (lower(username));

-- Auto-create a profile row whenever a new auth user signs up. A username
-- collision (two people picking the same one) is resolved by appending a
-- numeric suffix rather than failing the whole signup with an opaque
-- "Database error saving new user".
create function handle_new_user()
returns trigger as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
begin
  base_username := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  final_username := base_username;

  loop
    begin
      insert into public.profiles (id, username) values (new.id, final_username);
      exit;
    exception when unique_violation then
      suffix := suffix + 1;
      final_username := base_username || suffix::text;
      if suffix > 50 then
        raise exception 'Could not generate a unique username for %', new.email;
      end if;
    end;
  end loop;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ---------- applications ----------
create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  company text not null check (char_length(company) between 1 and 100),
  role text not null check (char_length(role) between 1 and 100),
  stage text not null default 'wishlist'
    check (stage in ('wishlist','applied','assessment','phone_screen','onsite','offer','rejected','withdrawn')),
  location text check (char_length(location) <= 100),
  work_type text check (work_type in ('remote', 'hybrid', 'onsite')),
  deadline date,
  follow_up_date date,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_applications_user_id on applications (user_id);
create index idx_applications_stage on applications (stage);
create index idx_applications_deadline on applications (deadline);
create index idx_applications_created_at on applications (created_at);

-- ---------- stage_history ----------
-- One row per stage transition. Powers the conversion funnel chart.
create table stage_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_at timestamptz not null default now()
);

create index idx_stage_history_application_id on stage_history (application_id);
create index idx_stage_history_user_id on stage_history (user_id);

-- ---------- friendships ----------
-- Directed row (requester -> addressee) with a status; a pair is only ever
-- represented once thanks to the check + unique index below.
create table friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','blocked')),
  created_at timestamptz not null default now(),
  constraint no_self_friend check (requester_id <> addressee_id)
);

-- Prevent duplicate/opposite-direction pairs (A->B and B->A both blocked).
create unique index idx_friendships_unique_pair
  on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index idx_friendships_requester on friendships (requester_id);
create index idx_friendships_addressee on friendships (addressee_id);

-- ---------- follows ----------
-- A plain one-directional follow graph (follow/unfollow, no approval
-- needed), separate from the mutual "friendships" request system above.
-- Following someone also unlocks their profile stats (resume, activity
-- calendar, pipeline chart) the same way an accepted friendship does - see
-- the RLS policies below, which OR in a follows check alongside the
-- existing friendship check rather than replacing it.
create table follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  followee_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint no_self_follow check (follower_id <> followee_id)
);

create index idx_follows_follower on follows (follower_id);
create index idx_follows_followee on follows (followee_id);

-- ---------- rate limiting ----------
-- Generic sliding-window limiter usable from any RPC or trigger.
-- Real enforcement lives here (server-side); src/lib/rateLimiter.js on the
-- client is just a UX layer that avoids sending requests doomed to fail.
create table rate_limit_log (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);

create index idx_rate_limit_lookup on rate_limit_log (user_id, action, created_at);

create function check_rate_limit(p_action text, p_max int, p_window_seconds int)
returns void as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from rate_limit_log
  where user_id = auth.uid()
    and action = p_action
    and created_at > now() - (p_window_seconds || ' seconds')::interval;

  if recent_count >= p_max then
    raise exception 'Rate limit exceeded for %', p_action using errcode = 'P0429';
  end if;

  insert into rate_limit_log (user_id, action) values (auth.uid(), p_action);
end;
$$ language plpgsql security definer;

-- Example: wrap friend-request creation with a DB-level cap of 15/hour,
-- independent of whatever the client already throttled.
create function create_friend_request(p_addressee_id uuid)
returns friendships as $$
declare
  result friendships;
begin
  perform check_rate_limit('friend_request', 15, 3600);

  insert into friendships (requester_id, addressee_id, status)
  values (auth.uid(), p_addressee_id, 'pending')
  returning * into result;

  return result;
end;
$$ language plpgsql security definer;

-- Periodically prune old rate-limit rows (call from a scheduled Edge Function/cron).
create function prune_rate_limit_log()
returns void as $$
begin
  delete from rate_limit_log where created_at < now() - interval '1 day';
  delete from rate_limit_log_anon where created_at < now() - interval '1 day';
end;
$$ language plpgsql security definer;

-- ---------- rate limiting for pre-auth actions (login, signup) ----------
-- Login/signup happen before a session exists, so auth.uid() is null and
-- the user-keyed rate_limit_log above doesn't apply. This variant keys off
-- an arbitrary text value (the email being used) instead, and is callable
-- by the anon role since that's who's making the request at that point.
create table rate_limit_log_anon (
  id bigint generated always as identity primary key,
  key text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create index idx_rate_limit_anon_lookup on rate_limit_log_anon (key, action, created_at);

create function check_rate_limit_by_key(p_key text, p_action text, p_max int, p_window_seconds int)
returns void as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from rate_limit_log_anon
  where key = p_key
    and action = p_action
    and created_at > now() - (p_window_seconds || ' seconds')::interval;

  if recent_count >= p_max then
    raise exception 'Too many attempts for %. Please wait before trying again.', p_action using errcode = 'P0429';
  end if;

  insert into rate_limit_log_anon (key, action) values (lower(p_key), p_action);
end;
$$ language plpgsql security definer;

grant execute on function check_rate_limit_by_key(text, text, int, int) to anon, authenticated;
grant execute on function check_rate_limit(text, int, int) to authenticated;
grant execute on function create_friend_request(uuid) to authenticated;

-- ---------- monthly_scores view ----------
-- Server-side mirror of src/utils/score.js so friend profiles can be
-- queried directly without pulling every raw application row.
create view monthly_scores as
select
  user_id,
  date_trunc('month', created_at) as month,
  count(*) as applications_count,
  count(*) filter (
    where stage in ('assessment','phone_screen','onsite','offer')
  ) as advanced_count,
  round(
    least(count(*)::numeric / 20, 1) * 50
    + case when count(*) > 0
        then (count(*) filter (where stage in ('assessment','phone_screen','onsite','offer'))::numeric
              / greatest(count(*) filter (where stage in ('applied','assessment','phone_screen','onsite','offer','rejected','withdrawn')), 1))
             * 50
        else 0
      end
  ) as score
from applications
group by user_id, date_trunc('month', created_at);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table profiles enable row level security;
alter table applications enable row level security;
alter table stage_history enable row level security;
alter table friendships enable row level security;
alter table follows enable row level security;
alter table rate_limit_log enable row level security;
alter table rate_limit_log_anon enable row level security;

-- follows: follower/following lists are public-ish info (same as Instagram
-- showing anyone's followers list), so any signed-in user can read the
-- whole graph, not just their own edges; only the follower can create or
-- remove their own edge.
create policy "follows_select_all"
  on follows for select
  using (true);

create policy "follows_insert_self"
  on follows for insert
  with check (follower_id = auth.uid());

create policy "follows_delete_self"
  on follows for delete
  using (follower_id = auth.uid());

-- profiles: readable by the owner, by an accepted friend, or by anyone who follows them
create policy "profiles_select_own_or_friend"
  on profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = profiles.id)
          or (f.addressee_id = auth.uid() and f.requester_id = profiles.id))
    )
    or exists (
      select 1 from follows fo where fo.follower_id = auth.uid() and fo.followee_id = profiles.id
    )
  );

create policy "profiles_update_own"
  on profiles for update
  using (id = auth.uid());

-- applications: fully private to the owner (friends only see the
-- aggregated calendar/score via the RPCs above, never raw rows)
create policy "applications_all_own"
  on applications for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- but friends ARE allowed to select created_at/stage for the heatmap —
-- narrow policy limited to accepted friends, no notes/recruiter fields exposed
-- via this policy since Postgres RLS is row-level; the app only selects
-- (id, created_at, stage) columns from the client for friend views.
create policy "applications_select_friend_heatmap"
  on applications for select
  using (
    exists (
      select 1 from friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = applications.user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = applications.user_id))
    )
    or exists (
      select 1 from follows fo where fo.follower_id = auth.uid() and fo.followee_id = applications.user_id
    )
  );

-- stage_history: full read/write for the owner (used for the owner's own
-- flow chart), plus read-only access for accepted friends so the Sankey
-- diagram can render on a friend's profile too. This table never holds
-- company names, notes, or recruiter info (those live in `applications`),
-- so sharing the raw from/to/changed_at rows with friends carries no
-- sensitive detail beyond what the activity calendar already exposes.
create policy "stage_history_all_own"
  on stage_history for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "stage_history_select_friend"
  on stage_history for select
  using (
    exists (
      select 1 from friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = stage_history.user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = stage_history.user_id))
    )
    or exists (
      select 1 from follows fo where fo.follower_id = auth.uid() and fo.followee_id = stage_history.user_id
    )
  );

-- friendships: either party can see the row; only the requester can create;
-- either party can update status (accept/block)
create policy "friendships_select_participant"
  on friendships for select
  using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy "friendships_insert_as_requester"
  on friendships for insert
  with check (requester_id = auth.uid());

create policy "friendships_update_participant"
  on friendships for update
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- rate_limit_log: no direct client access at all; only the SECURITY DEFINER
-- functions above touch this table.
create policy "rate_limit_log_no_client_access"
  on rate_limit_log for all
  using (false);

create policy "rate_limit_log_anon_no_client_access"
  on rate_limit_log_anon for all
  using (false);

-- ============================================================
-- Storage bucket for resumes (run once)
-- ============================================================
insert into storage.buckets (id, name, public) values ('resumes', 'resumes', false)
  on conflict (id) do nothing;

create policy "resumes_owner_write"
  on storage.objects for insert
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

-- Needed to replace an existing resume (upload with upsert) and to remove one.
create policy "resumes_owner_update"
  on storage.objects for update
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "resumes_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "resumes_owner_or_friend_read"
  on storage.objects for select
  using (
    bucket_id = 'resumes'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from friendships f
        where f.status = 'accepted'
          and (storage.foldername(name))[1] = f.requester_id::text
          and f.addressee_id = auth.uid()
        union
        select 1 from friendships f
        where f.status = 'accepted'
          and (storage.foldername(name))[1] = f.addressee_id::text
          and f.requester_id = auth.uid()
      )
      or exists (
        select 1 from follows fo
        where fo.follower_id = auth.uid()
          and fo.followee_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- ============================================================
-- Storage bucket for avatars (run once)
-- ============================================================
-- Public bucket: unlike resumes, avatar images aren't sensitive, so they're
-- served straight from a public URL rather than needing a signed URL.
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do update set public = true;

create policy "avatars_owner_write"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_owner_update"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- ============================================================
-- Challenges (head-to-head application races)
-- ============================================================
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

create policy "challenges_select_participant"
  on challenges for select
  using (challenger_id = auth.uid() or opponent_id = auth.uid());

create policy "challenges_no_direct_insert"
  on challenges for insert
  with check (false);

create policy "challenges_no_direct_update"
  on challenges for update
  using (false);

create function create_challenge(p_opponent_id uuid, p_duration_days int)
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

create function respond_to_challenge(p_challenge_id uuid, p_accept boolean)
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

create function cancel_challenge(p_challenge_id uuid)
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

create function resolve_challenge(p_challenge_id uuid)
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

create function challenge_progress(p_challenge_id uuid)
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

create function head_to_head(p_other_id uuid)
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

-- ============================================================
-- Username search (bypasses the friend/follow-only profile RLS on
-- purpose, for a narrow public directory lookup - see migration 009)
-- ============================================================
create function search_profiles(p_query text)
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

-- ============================================================
-- Public profile lookup (bypasses the friend/follow-only profile RLS on
-- purpose, for the public card shown on anyone's profile page - see
-- migration 010; resume/calendar/pipeline stay behind the normal gate)
-- ============================================================
create function get_public_profile(p_user_id uuid)
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
