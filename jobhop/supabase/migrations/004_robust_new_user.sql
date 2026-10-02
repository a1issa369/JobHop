-- The original handle_new_user() trigger did a plain insert into profiles.
-- Since username is unique, any collision (two people choosing the same
-- username, or a retried signup after a partial failure) threw a Postgres
-- unique_violation INSIDE the trigger, which fails the whole auth.users
-- insert and surfaces to the client as a generic "Database error saving
-- new user" with no indication of why. This replaces it with a version
-- that detects that specific collision and appends a numeric suffix
-- (ahissa, ahissa1, ahissa2, ...) instead of failing outright. Any other
-- error still propagates normally.
create or replace function handle_new_user()
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
