import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useViewedProfile } from '../context/ViewedProfileContext.jsx';
import CalendarHeatmap from '../components/CalendarHeatmap.jsx';
import SankeyFlowChart from '../components/SankeyFlowChart.jsx';
import MonthlyStats from '../components/MonthlyStats.jsx';
import { getResumeSignedUrl } from '../utils/resume.js';

export default function FriendProfile() {
  const { friendId } = useParams();
  const { setViewed } = useViewedProfile();
  const [applications, setApplications] = useState([]);
  const [stageHistory, setStageHistory] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Puts the left ProfileSidebar into "viewing someone else" mode right
    // away (loading state) so it doesn't sit there showing YOUR card while
    // theirs is still being fetched.
    setViewed({ loading: true });

    async function load() {
      setLoading(true);
      // RLS on all three tables only allows this read if a friendship row
      // with status='accepted' exists between the viewer and friendId.
      const [{ data: p, error: pErr }, { data: apps, error: aErr }, { data: history, error: hErr }] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url, bio, school, linkedin_url, github_url, resume_url')
            .eq('id', friendId)
            .single(),
          supabase
            .from('applications')
            .select('id, created_at, stage')
            .eq('user_id', friendId)
            .gte('created_at', `${new Date().getFullYear()}-01-01`),
          supabase
            .from('stage_history')
            .select('application_id, from_stage, to_stage, changed_at')
            .eq('user_id', friendId)
        ]);

      const loadError = pErr
        ? 'Could not load this profile — you may not be friends yet.'
        : aErr?.message || hErr?.message || '';

      // resume_url is a private storage path, not a public link - resolve
      // it to a short-lived signed URL (RLS still governs whether this
      // succeeds, same as every other field here).
      const resumeUrl = p?.resume_url ? await getResumeSignedUrl(p.resume_url) : null;

      if (cancelled) return;
      setError(loadError);
      setApplications(apps ?? []);
      setStageHistory(history ?? []);
      setLoading(false);
      setViewed({ loading: false, error: loadError, profile: p ?? null, resumeUrl });
    }
    load();

    // Leaving the page hands the sidebar back to showing your own profile.
    return () => {
      cancelled = true;
      setViewed(null);
    };
  }, [friendId, setViewed]);

  if (loading) return <p className="text-ink2">Loading profile…</p>;
  if (error) return <p className="text-bad">{error}</p>;

  const applicationsByDate = {};
  for (const a of applications) {
    const day = a.created_at.slice(0, 10);
    applicationsByDate[day] = (applicationsByDate[day] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      <Link to="/friends" className="text-sm text-ink2 hover:text-signal">
        ← Back to friends
      </Link>

      <MonthlyStats applications={applications} />

      <CalendarHeatmap applicationsByDate={applicationsByDate} />

      <SankeyFlowChart applications={applications} stageHistory={stageHistory} />
    </div>
  );
}
