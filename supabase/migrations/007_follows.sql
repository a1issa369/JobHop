-- Adds a real one-directional follow graph (follow/unfollow, no approval
-- needed) alongside the existing mutual "friendships" request system,
-- which stays untouched for anyone still using the Friends page's
-- add/accept flow. Following someone now also unlocks their profile stats
-- (resume, activity calendar, pipeline chart) the same way an accepted
-- friendship already does - this migration extends those existing RLS
-- policies with an OR'd follows check rather than replacing them.

create table follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  followee_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint no_self_follow check (follower_id <> followee_id)
);

create index idx_follows_follower on follows (follower_id);
create index idx_follows_followee on follows (followee_id);

alter table follows enable row level security;

-- Follower/following lists are public-ish info (same as Instagram showing
-- anyone's followers list), so any signed-in user can read the whole
-- graph, not just their own edges.
create policy "follows_select_all"
  on follows for select
  using (true);

create policy "follows_insert_self"
  on follows for insert
  with check (follower_id = auth.uid());

create policy "follows_delete_self"
  on follows for delete
  using (follower_id = auth.uid());

-- ---------- extend existing visibility policies to also trust follows ----------

drop policy if exists "profiles_select_own_or_friend" on profiles;
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

drop policy if exists "applications_select_friend_heatmap" on applications;
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

drop policy if exists "stage_history_select_friend" on stage_history;
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

drop policy if exists "resumes_owner_or_friend_read" on storage.objects;
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
