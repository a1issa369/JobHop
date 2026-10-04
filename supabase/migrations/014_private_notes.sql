-- Everything about an application is public (company, role, stage,
-- location, deadline - part of the fully-public profile model from
-- migration 011) EXCEPT notes, which is where people tend to paste
-- recruiter contacts or private thoughts about a company. Notes should
-- only ever be visible to the application's own owner.
--
-- RLS policies are row-level only - they can't hide one COLUMN for some
-- viewers and show it to others on the same row. A view that masks the
-- column per-row is the standard way around that. `security_invoker`
-- keeps it running as the querying user, so the existing
-- applications_select_public_except_duel policy on the base table still
-- applies underneath this (an active duel opponent still can't see
-- anything here, same as today) - this view only adds the notes mask on
-- top of that existing row-level rule.
create or replace view applications_public
with (security_invoker = true) as
select
  id,
  user_id,
  company,
  role,
  stage,
  location,
  work_type,
  deadline,
  created_at,
  updated_at,
  case when user_id = auth.uid() then notes else null end as notes
from applications;

grant select on applications_public to anon, authenticated;
