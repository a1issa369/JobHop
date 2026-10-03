import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import CalendarHeatmap from '../components/CalendarHeatmap.jsx';
import SankeyFlowChart from '../components/SankeyFlowChart.jsx';
import MonthlyStats from '../components/MonthlyStats.jsx';

// The index route for /friends/:friendId - what you land on after clicking
// a name anywhere in the app (search, a friend card, a duel). Same stats +
// activity calendar + pipeline chart every profile shows for itself, minus
// the "Challenges won" tile (that one's always about the signed-in viewer,
// not whoever's page this is - see MonthlyStats). The one thing that can
// still be missing is application data for someone you're currently
// dueling - the RLS policy returns zero rows for that case, so `isInActiveDuel`
// (from the layout) is only used to pick the right empty-state message.
export default function ViewedOverview() {
  const { profile, isInActiveDuel } = useOutletContext();
  const [applications, setApplications] = useState([]);
  const [stageHistory, setStageHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [{ data: apps }, { data: history }] = await Promise.all([
        supabase
          .from('applications')
          .select('id, created_at, stage')
          .eq('user_id', profile.id)
          .gte('created_at', `${new Date().getFullYear()}-01-01`),
        supabase
          .from('stage_history')
          .select('application_id, from_stage, to_stage, changed_at')
          .eq('user_id', profile.id)
      ]);
      if (cancelled) return;
      setApplications(apps ?? []);
      setStageHistory(history ?? []);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [profile.id]);

  const backLink = (
    <Link to="/friends" className="text-sm text-ink2 hover:text-signal">
      ← Back to friends
    </Link>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {backLink}
        <p className="text-sm text-ink2">Loading…</p>
      </div>
    );
  }

  if (applications.length === 0 && isInActiveDuel) {
    return (
      <div className="space-y-6">
        {backLink}
        <div className="card-surface p-6 text-center text-sm text-ink2">
          Activity is hidden for the duration of your duel - check back once it ends.
        </div>
      </div>
    );
  }

  const applicationsByDate = {};
  for (const a of applications) {
    const day = a.created_at.slice(0, 10);
    applicationsByDate[day] = (applicationsByDate[day] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      {backLink}
      <MonthlyStats applications={applications} />
      <CalendarHeatmap applicationsByDate={applicationsByDate} />
      <SankeyFlowChart applications={applications} stageHistory={stageHistory} />
    </div>
  );
}
