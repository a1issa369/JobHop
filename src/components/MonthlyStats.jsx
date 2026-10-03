import { FUNNEL_ORDER } from '../utils/stageConfig';
import { useAuth } from '../context/AuthContext.jsx';
import { useChallenges } from '../hooks/useChallenges.js';

// Replaces the old single "this month's score" number - a 0-100 figure
// blending volume and conversion rate with no explanation on screen - with
// a few plain counts that don't need a tooltip to understand. `own` gates
// the challenge-wins tile, which always reflects the SIGNED-IN viewer's
// challenge history (useChallenges has no concept of "someone else's
// challenges") - showing it on a friend's page would silently be about you,
// not them, so it only renders on your own profile.
export default function MonthlyStats({ applications, own = false }) {
  const now = new Date();
  const thisMonth = applications.filter((a) => {
    const d = new Date(a.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const total = thisMonth.length;
  const advanced = thisMonth.filter(
    (a) => FUNNEL_ORDER.indexOf(a.stage) > FUNNEL_ORDER.indexOf('applied')
  ).length;
  const interviews = thisMonth.filter((a) => ['phone_screen', 'onsite'].includes(a.stage)).length;
  const offers = thisMonth.filter((a) => a.stage === 'offer').length;
  const responseRate = total > 0 ? Math.round((advanced / total) * 100) : 0;

  const { user } = useAuth();
  // Always calls the hook (no conditional hook calls) - useChallenges is
  // cheap to leave idle, and `own` just decides whether the result is used.
  const { history } = useChallenges();
  const challengesWon = own
    ? history.filter((c) => {
        if (c.status !== 'completed' || c.winner_id !== user.id) return false;
        const d = new Date(c.ends_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length
    : 0;

  const stats = [
    { label: 'Applications', value: total },
    { label: 'Advanced past Applied', value: advanced },
    { label: 'Interviews', value: interviews },
    { label: 'Offers', value: offers },
    { label: 'Response rate', value: `${responseRate}%` }
  ];
  if (own) stats.push({ label: 'Challenges won', value: challengesWon });

  return (
    <div className="card-surface p-4">
      <h3 className="font-display text-sm font-semibold">
        This month - {now.toLocaleString('default', { month: 'long' })}
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded border border-grid/60 p-3 text-center">
            <p className="font-display text-2xl font-bold text-signal">{s.value}</p>
            <p className="mt-1 text-[11px] text-ink2">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
