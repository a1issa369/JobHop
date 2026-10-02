-- Run this in the Supabase SQL editor to let accepted friends read your
-- stage_history rows (needed for the Sankey flow chart to render on a
-- friend's profile). stage_history never holds company names, notes, or
-- recruiter info - those live in `applications` - so this doesn't expose
-- anything more sensitive than the activity calendar already does.

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
  );
