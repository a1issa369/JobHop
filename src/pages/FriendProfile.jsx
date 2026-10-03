import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';
import { useViewedProfile } from '../context/ViewedProfileContext.jsx';
import CalendarHeatmap from '../components/CalendarHeatmap.jsx';
import SankeyFlowChart from '../components/SankeyFlowChart.jsx';
import MonthlyStats from '../components/MonthlyStats.jsx';
import { getResumeSignedUrl } from '../utils/resume.js';

export default function FriendProfile() {
  const { friendId } = useParams();
  const { user } = useAuth();
  const { setViewed } = useViewedProfile();
  const [applications, setApplications] = useState([]);
  const [stageHistory, setStageHistory] = useState([]);
  const [unlocked, setUnlocked] = useState(false);
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

      // The public card (name, avatar, school, links) is visible for
      // anyone, found this way specifically so a total stranger clicked
      // from search still lands on a real page instead of an RLS error -
      // see get_public_profile. Whether you can also see their resume,
      // activity calendar, and pipeline chart is a separate question,
      // answered by checking for an accepted friendship or a follow.
      const [{ data: pubRows, error: pubErr }, { data: friendRow }, { count: followCount }] =
        await Promise.all([
          supabase.rpc('get_public_profile', { p_user_id: friendId }),
          supabase
            .from('friendships')
            .select('status')
            .or(
              `and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`
            )
            .eq('status', 'accepted')
            .maybeSingle(),
          supabase
            .from('follows')
            .select('follower_id', { count: 'exact', head: true })
            .eq('follower_id', user.id)
            .eq('followee_id', friendId)
        ]);

      const p = pubRows?.[0] ?? null;
      const isUnlocked = Boolean(friendRow) || (followCount ?? 0) > 0;

      if (cancelled) return;

      if (pubErr || !p) {
        setError(pubErr?.message || "Couldn't find this user.");
        setLoading(false);
        setViewed({ loading: false, error: pubErr?.message || "Couldn't find this user.", profile: null, resumeUrl: null });
        return;
      }

      setUnlocked(isUnlocked);

      if (!isUnlocked) {
        setApplications([]);
        setStageHistory([]);
        setLoading(false);
        setViewed({ loading: false, error: '', profile: p, resumeUrl: null });
        return;
      }

      // Unlocked: pull the stuff that's still gated behind the
      // friend/follow RLS policies (resume_url, applications, stage_history).
      const [{ data: priv }, { data: apps }, { data: history }] = await Promise.all([
        supabase.from('profiles').select('resume_url').eq('id', friendId).maybeSingle(),
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

      const resumeUrl = priv?.resume_url ? await getResumeSignedUrl(priv.resume_url) : null;

      if (cancelled) return;
      setApplications(apps ?? []);
      setStageHistory(history ?? []);
      setLoading(false);
      setViewed({ loading: false, error: '', profile: p, resumeUrl });
    }
    load();

    // Leaving the page hands the sidebar back to showing your own profile.
    return () => {
      cancelled = true;
      setViewed(null);
    };
  }, [friendId, user.id, setViewed]);

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

      {unlocked ? (
        <>
          <MonthlyStats applications={applications} />
          <CalendarHeatmap applicationsByDate={applicationsByDate} />
          <SankeyFlowChart applications={applications} stageHistory={stageHistory} />
        </>
      ) : (
        <div className="card-surface p-6 text-center text-sm text-ink2">
          Add them as a friend or follow them to see their activity calendar, resume, and
          application flow.
        </div>
      )}
    </div>
  );
}
