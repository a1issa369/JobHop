import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';
import CalendarHeatmap from '../components/CalendarHeatmap.jsx';
import SankeyFlowChart from '../components/SankeyFlowChart.jsx';
import MonthlyStats from '../components/MonthlyStats.jsx';
import { localDateKey, startOfLocalYearISO } from '../utils/date.js';

// Reached by clicking the avatar in the navbar - deliberately a separate
// page from the job-tracker board (Dashboard.jsx), not a tab bolted onto
// it. Your avatar, name, stats, and resume already live in the persistent
// left ProfileSidebar (see App.jsx), so this page only holds what's unique
// to it: the activity calendar, the pipeline flow, and this month's stats.
export default function Profile() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [stageHistory, setStageHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: apps }, { data: history }] = await Promise.all([
        supabase
          .from('applications')
          .select('id, created_at, stage')
          .eq('user_id', user.id)
          .gte('created_at', startOfLocalYearISO(new Date().getFullYear())),
        supabase
          .from('stage_history')
          .select('application_id, from_stage, to_stage, changed_at')
          .eq('user_id', user.id)
      ]);
      setApplications(apps ?? []);
      setStageHistory(history ?? []);
      setLoading(false);
    }
    load();
  }, [user.id]);

  if (loading) {
    return <p className="text-sm text-ink2">Loading…</p>;
  }

  const applicationsByDate = {};
  for (const a of applications) {
    const day = localDateKey(a.created_at);
    applicationsByDate[day] = (applicationsByDate[day] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Your profile</h1>
        <p className="text-sm text-ink2">Your activity and application flow for the year.</p>
      </div>

      <MonthlyStats applications={applications} own />

      <CalendarHeatmap applicationsByDate={applicationsByDate} />

      <SankeyFlowChart applications={applications} stageHistory={stageHistory} />
    </div>
  );
}
