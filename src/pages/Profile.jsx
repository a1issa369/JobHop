import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';
import { useOwnProfile } from '../hooks/useOwnProfile.js';
import { getResumeSignedUrl } from '../utils/resume.js';
import CalendarHeatmap from '../components/CalendarHeatmap.jsx';
import SankeyFlowChart from '../components/SankeyFlowChart.jsx';
import DefaultAvatar from '../components/DefaultAvatar.jsx';
import { computeMonthlyScore } from '../utils/score.js';

// Reached by clicking the avatar in the navbar - deliberately a separate
// page from the job-tracker board (Dashboard.jsx), not a tab bolted onto
// it. It's built the same way FriendProfile.jsx renders a friend's public
// view, just pointed at your own account, so what you see here is exactly
// what a friend sees when they look you up.
export default function Profile() {
  const { user } = useAuth();
  const {
    profile,
    followers,
    following,
    loading: profileLoading,
    error: profileError,
    refresh: refreshProfile
  } = useOwnProfile(user.id);
  const [resumeUrl, setResumeUrl] = useState(null);
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
          .gte('created_at', `${new Date().getFullYear()}-01-01`),
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

  useEffect(() => {
    if (profile?.resume_url) {
      getResumeSignedUrl(profile.resume_url).then(setResumeUrl);
    } else {
      setResumeUrl(null);
    }
  }, [profile?.resume_url]);

  if (profileLoading || loading) {
    return <p className="text-sm text-ink2">Loading profile…</p>;
  }

  if (profileError || !profile) {
    return (
      <div className="card-surface p-5">
        <p className="text-sm text-bad">Couldn't load your profile.</p>
        <p className="mt-1 text-xs text-ink2">{profileError?.message ?? 'Unknown error.'}</p>
        <button onClick={refreshProfile} className="btn-secondary mt-3 text-xs">
          Try again
        </button>
      </div>
    );
  }

  const applicationsByDate = {};
  for (const a of applications) {
    const day = a.created_at.slice(0, 10);
    applicationsByDate[day] = (applicationsByDate[day] ?? 0) + 1;
  }

  const now = new Date();
  const thisMonthApps = applications.filter((a) => {
    const d = new Date(a.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const score = computeMonthlyScore(thisMonthApps);
  const displayName = profile.full_name || profile.username;

  return (
    <div className="space-y-6">
      <div className="card-surface flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex items-start gap-4">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-panel">
              <DefaultAvatar className="h-10 w-10" />
            </span>
          )}
          <div>
            <h1 className="font-display text-2xl font-semibold">{displayName}</h1>
            <p className="text-sm text-ink2">@{profile.username}</p>
            {profile.school && <p className="mt-1 text-sm text-ink2">{profile.school}</p>}
            {profile.bio && <p className="mt-1 text-sm text-ink2">{profile.bio}</p>}

            <div className="mt-2 flex gap-4 text-sm">
              <Link to="/friends" className="text-ink2 hover:text-signal">
                <span className="font-semibold text-paper">{followers}</span> follower
                {followers === 1 ? '' : 's'}
              </Link>
              <Link to="/friends" className="text-ink2 hover:text-signal">
                <span className="font-semibold text-paper">{following}</span> following
              </Link>
            </div>

            {(profile.linkedin_url || profile.github_url) && (
              <div className="mt-2 flex gap-3 text-xs">
                {profile.linkedin_url && (
                  <a href={profile.linkedin_url} target="_blank" rel="noreferrer" className="text-signal hover:underline">
                    LinkedIn
                  </a>
                )}
                {profile.github_url && (
                  <a href={profile.github_url} target="_blank" rel="noreferrer" className="text-signal hover:underline">
                    GitHub
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-ink2">This month's score</p>
            <p className="font-display text-3xl font-bold text-signal">{score}</p>
          </div>
          <Link to="/settings" className="btn-secondary text-xs">
            Edit profile
          </Link>
        </div>
      </div>

      <CalendarHeatmap applicationsByDate={applicationsByDate} />

      <SankeyFlowChart applications={applications} stageHistory={stageHistory} />

      <div className="card-surface p-5">
        <h3 className="font-display text-sm font-semibold">Resume</h3>
        {resumeUrl ? (
          <a
            href={resumeUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-sm text-signal hover:underline"
          >
            View resume →
          </a>
        ) : (
          <p className="mt-2 text-sm text-ink2">
            No resume on file yet — upload one from the card on the left.
          </p>
        )}
      </div>
    </div>
  );
}
