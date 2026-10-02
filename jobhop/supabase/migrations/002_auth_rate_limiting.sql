-- Run this in the Supabase SQL editor to add server-side rate limiting
-- for login and signup attempts (previously only friend requests had this).

create table if not exists rate_limit_log_anon (
  id bigint generated always as identity primary key,
  key text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_anon_lookup
  on rate_limit_log_anon (key, action, created_at);

alter table rate_limit_log_anon enable row level security;

drop policy if exists "rate_limit_log_anon_no_client_access" on rate_limit_log_anon;
create policy "rate_limit_log_anon_no_client_access"
  on rate_limit_log_anon for all
  using (false);

create or replace function check_rate_limit_by_key(p_key text, p_action text, p_max int, p_window_seconds int)
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

create or replace function prune_rate_limit_log()
returns void as $$
begin
  delete from rate_limit_log where created_at < now() - interval '1 day';
  delete from rate_limit_log_anon where created_at < now() - interval '1 day';
end;
$$ language plpgsql security definer;
