-- Two owner-facing tools for a solo project:
--   1. get_site_stats(): aggregate counts only (users, applications, duels,
--      weekly growth) so the owner can see how the site is doing and pull
--      real numbers for a resume. It never returns anyone's emails, names, or
--      application contents - just counts.
--   2. An in-app feedback / bug-report inbox (feedback table + submit_feedback).
--
-- "Owner" is whoever has a row in site_admins. That table has RLS on and NO
-- policies, so nothing in the browser can read or change it - rows are added
-- by hand in the Supabase SQL editor (see the bottom of this file), which
-- keeps the owner's account id out of the repo.

create table if not exists site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table site_admins enable row level security;

-- Accounts to leave out of the stats (the owner's own and test accounts), so
-- the numbers reflect real people. Same deal: no policies, SQL editor only.
create table if not exists stats_exclusions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table stats_exclusions enable row level security;

create or replace function is_site_admin()
returns boolean as $$
  select exists (select 1 from site_admins where user_id = auth.uid());
$$ language sql security definer stable set search_path = public;

grant execute on function is_site_admin() to authenticated;

-- ---------- feedback ----------
-- on delete cascade so deleting your account also deletes what you sent,
-- matching what the Privacy Policy promises.
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  category text not null check (category in ('bug', 'idea', 'other')),
  message text not null check (char_length(message) between 5 and 2000),
  page text check (char_length(page) <= 200),
  status text not null default 'new' check (status in ('new', 'seen', 'done')),
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_status_created on feedback (status, created_at desc);

alter table feedback enable row level security;

-- Only the owner can read or triage feedback. There is deliberately no
-- insert policy: writes go through submit_feedback() below so they're
-- rate-limited and validated in one place.
drop policy if exists "feedback_select_admin" on feedback;
create policy "feedback_select_admin" on feedback
  for select using (is_site_admin());
drop policy if exists "feedback_update_admin" on feedback;
create policy "feedback_update_admin" on feedback
  for update using (is_site_admin()) with check (is_site_admin());
drop policy if exists "feedback_delete_admin" on feedback;
create policy "feedback_delete_admin" on feedback
  for delete using (is_site_admin());

create or replace function submit_feedback(p_category text, p_message text, p_page text default null)
returns void as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to send feedback';
  end if;
  perform check_rate_limit('feedback', 5, 3600);
  insert into feedback (user_id, category, message, page)
  values (auth.uid(), p_category, btrim(p_message), left(p_page, 200));
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function submit_feedback(text, text, text) to authenticated;

-- ---------- stats ----------
create or replace function get_site_stats(p_exclude_flagged boolean default true)
returns jsonb as $$
declare
  result jsonb;
begin
  if not is_site_admin() then
    raise exception 'Not authorized';
  end if;

  with
    u as (
      select id, created_at, resume_url from profiles
      where not (p_exclude_flagged and id in (select user_id from stats_exclusions))
    ),
    a as (select * from applications where user_id in (select id from u)),
    sh as (select * from stage_history where user_id in (select id from u)),
    active as (
      select user_id from a where created_at > now() - interval '7 days'
      union
      select user_id from sh where changed_at > now() - interval '7 days'
    ),
    advanced as (
      select id as application_id from a
        where stage in ('assessment', 'phone_screen', 'onsite', 'offer')
      union
      select application_id from sh
        where to_stage in ('assessment', 'phone_screen', 'onsite', 'offer')
    ),
    ch as (
      select * from challenges
      where challenger_id in (select id from u) and opponent_id in (select id from u)
    ),
    weeks as (
      select generate_series(
        date_trunc('week', now()) - interval '7 weeks',
        date_trunc('week', now()),
        interval '1 week'
      ) as wk
    )
  select jsonb_build_object(
    'generated_at', now(),
    'users_total', (select count(*) from u),
    'users_7d', (select count(*) from u where created_at > now() - interval '7 days'),
    'users_30d', (select count(*) from u where created_at > now() - interval '30 days'),
    'active_users_7d', (select count(*) from active),
    'applications_total', (select count(*) from a),
    'applications_7d', (select count(*) from a where created_at > now() - interval '7 days'),
    'applications_advanced', (select count(*) from advanced),
    'offers_now', (select count(*) from a where stage = 'offer'),
    'stage_counts', (
      select coalesce(jsonb_object_agg(stage, n), '{}'::jsonb)
      from (select stage, count(*) as n from a group by stage) s
    ),
    'duels_total', (select count(*) from ch),
    'duels_completed', (select count(*) from ch where status = 'completed'),
    'follows_total', (
      select count(*) from follows
      where follower_id in (select id from u) and followee_id in (select id from u)
    ),
    'resumes_uploaded', (select count(*) from u where resume_url is not null),
    'excluded_accounts', (select count(*) from stats_exclusions),
    'feedback_new', (select count(*) from feedback where status = 'new'),
    'weekly', (
      select jsonb_agg(
        jsonb_build_object(
          'week', to_char(wk, 'YYYY-MM-DD'),
          'signups', (select count(*) from u where date_trunc('week', u.created_at) = wk),
          'applications', (select count(*) from a where date_trunc('week', a.created_at) = wk)
        ) order by wk
      )
      from weeks
    )
  ) into result;

  return result;
end;
$$ language plpgsql security definer stable set search_path = public;

grant execute on function get_site_stats(boolean) to authenticated;

-- ---------- ONE-TIME SETUP (run by hand in the SQL editor, not committed) ----------
-- Make yourself the owner and leave your own/test accounts out of the stats.
-- Swap in your own emails; they stay in the SQL editor, not in this repo.
--
--   insert into site_admins (user_id)
--     select id from auth.users where email = 'YOU@example.com'
--     on conflict do nothing;
--
--   insert into stats_exclusions (user_id)
--     select id from auth.users where email in ('you@example.com', 'test1@example.com')
--     on conflict do nothing;
