-- Server-side version of the stage rule in src/utils/stageConfig.js, so it
-- holds even if something bypasses the UI:
--   * a new card can only start in Wishlist or Applied
--   * a Wishlist card can only move to Applied (it can stay in Wishlist)
--   * from anywhere else, any stage is fine
--
-- Why: the Sankey chart is built from stage changes and starts at Applied. A
-- card created straight into, say, Phone Screen (or moved there from
-- Wishlist) never passes through Applied, so it never shows up in the chart.
--
-- Only affects NEW writes. Cards already in the table are left as they are.

create or replace function enforce_application_stage_rules()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.stage not in ('wishlist', 'applied') then
      raise exception 'New cards can only start in Wishlist or Applied';
    end if;
  elsif new.stage is distinct from old.stage
        and old.stage = 'wishlist'
        and new.stage <> 'applied' then
    raise exception 'A Wishlist card can only move to Applied first';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_application_stage_rules on applications;
create trigger trg_enforce_application_stage_rules
  before insert or update of stage on applications
  for each row execute procedure enforce_application_stage_rules();
