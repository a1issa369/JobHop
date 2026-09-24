import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import CalendarHeatmap from '../components/CalendarHeatmap.jsx';
import { computeMonthlyScore } from '../utils/score.js';

export default function FriendProfile() {
  const { friendId } = useParams();
  const [profile, setProfile] = useState(null);
  const [applications, setApplications] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      // RLS on both tables only allows this read if a friendship row
      // with status='accepted' exists between the viewer and friendId.
      const [{ data: p, error: pErr }, { data: apps, error: aErr }] = await Promise.all([
        supabase.from('profiles').select('id, username, bio, resume_url').eq('id', friendId).single(),
        supabase
          .from('applications')
          .select('id, created_at, stage')
          .eq('user_id', friendId)
          .gte('created_at', `${new Date().getFullYear()}-01-01`)
      ]);
      if (pErr) setError('Could not load this profile — you may not be friends yet.');
      if (aErr) setError(aErr.message);
      setProfile(p ?? null);
      setApplications(apps ?? []);
      setLoading(false);
    }
    load();
  }, [friendId]);

  if (loading) return <p className="text-ink2">Loading profile…</p>;
  if (error) return <p className="text-bad">{error}</p>;
  if (!profile) return <p className="text-ink2">Profile not found.</p>;

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

  return (
    <div className="space-y-6">
      <Link to="/friends" className="text-sm text-ink2 hover:text-signal">
        ← Back to friends
      </Link>

      <div className="card-surface flex items-center justify-between p-5">
        <div>
          <h1 className="font-display text-2xl font-semibold">{profile.username}</h1>
          {profile.bio && <p className="mt-1 text-sm text-ink2">{profile.bio}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-ink2">This month's score</p>
          <p className="font-display text-3xl font-bold text-signal">{score}</p>
        </div>
      </div>

      <CalendarHeatmap applicationsByDate={applicationsByDate} />

      <div className="card-surface p-5">
        <h3 className="font-display text-sm font-semibold">Resume</h3>
        {profile.resume_url ? (
          <a
            href={profile.resume_url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-sm text-signal hover:underline"
          >
            View resume →
          </a>
        ) : (
          <p className="mt-2 text-sm text-ink2">{profile.username} hasn't added a resume yet.</p>
        )}
      </div>
    </div>
  );
}
