import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSocialGraph } from '../context/SocialGraphContext.jsx';
import DuelVersus from '../components/DuelVersus.jsx';

const PARTICIPANT_FIELDS = 'id, username, full_name, avatar_url';

function otherParty(challenge, userId) {
  return challenge.challenger_id === userId ? challenge.opponent : challenge.challenger;
}

function timeLeft(endsAt) {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'ending…';
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${mins}m left`;
}

function OutcomeBadge({ outcome }) {
  const styles = {
    Won: 'bg-good/15 text-good',
    Lost: 'bg-bad/15 text-bad',
    Draw: 'bg-ink2/15 text-ink2'
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[outcome] ?? 'bg-ink2/15 text-ink2'}`}>
      {outcome}
    </span>
  );
}

// Read-only duel history for whoever's profile you're viewing. Only 'active'
// and 'completed' duels are visible to a non-participant (see migration
// 011) - a still-pending invite stays private between the two people
// involved, same as a friend request would.
export default function ViewedDuels() {
  const { profile } = useOutletContext();
  const { version } = useSocialGraph();
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);

  // Also re-fetches on every social graph `version` bump - unfollowing
  // someone mid-duel now auto-completes that duel as a loss for whoever
  // unfollowed (see migration 012), so this needs to reflect that right
  // away rather than only after a page refresh.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('challenges')
        .select(
          `id, challenger_id, opponent_id, duration_days, status, starts_at, ends_at,
           challenger_count, opponent_count, winner_id, created_at,
           challenger:profiles!challenges_challenger_id_fkey(${PARTICIPANT_FIELDS}),
           opponent:profiles!challenges_opponent_id_fkey(${PARTICIPANT_FIELDS})`
        )
        .in('status', ['active', 'completed'])
        .or(`challenger_id.eq.${profile.id},opponent_id.eq.${profile.id}`)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      setChallenges(data ?? []);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [profile.id, version]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Link to={`/friends/${profile.id}`} className="text-sm text-ink2 hover:text-signal">
          ← Back to profile
        </Link>
        <p className="text-sm text-ink2">Loading…</p>
      </div>
    );
  }

  const active = challenges.filter((c) => c.status === 'active');
  const history = challenges.filter((c) => c.status === 'completed');
  const displayName = profile.full_name || profile.username;

  return (
    <div className="space-y-8">
      <Link to={`/friends/${profile.id}`} className="text-sm text-ink2 hover:text-signal">
        ← Back to profile
      </Link>

      <div>
        <h1 className="font-display text-2xl font-semibold">{displayName}'s duels</h1>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink2">Live duels</h2>
        {active.length === 0 ? (
          <p className="text-sm text-ink2">Nothing in progress.</p>
        ) : (
          <ul className="space-y-2">
            {active.map((c) => {
              const other = otherParty(c, profile.id);
              return (
                <li key={c.id} className="card-surface flex items-center gap-4 border border-route/40 bg-route/5 p-4">
                  <DuelVersus leftUrl={profile.avatar_url} rightUrl={other.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{displayName}</span>{' '}
                    <span className="text-ink2">vs</span>{' '}
                    <Link to={`/friends/${other.id}`} className="font-medium hover:text-signal">
                      {other.full_name || other.username}
                    </Link>
                    <p className="flex items-center gap-1.5 text-xs text-route">
                      <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-route">
                        <span className="absolute inset-0 animate-ping rounded-full bg-route" />
                      </span>
                      {timeLeft(c.ends_at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink2">Past duels</h2>
        {history.length === 0 ? (
          <p className="text-sm text-ink2">No finished duels yet.</p>
        ) : (
          <ul className="space-y-2 opacity-90">
            {history.map((c) => {
              const other = otherParty(c, profile.id);
              const theirCount = c.challenger_id === profile.id ? c.challenger_count : c.opponent_count;
              const otherCount = c.challenger_id === profile.id ? c.opponent_count : c.challenger_count;
              const outcome = c.winner_id === profile.id ? 'Won' : c.winner_id === null ? 'Draw' : 'Lost';
              return (
                <li key={c.id} className="card-surface flex items-center gap-4 border border-grid/60 p-4">
                  <DuelVersus leftUrl={profile.avatar_url} rightUrl={other.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/friends/${other.id}`} className="font-medium hover:text-signal">
                      {other.full_name || other.username}
                    </Link>
                    <p className="text-xs text-ink2">
                      {theirCount} - {otherCount}
                    </p>
                  </div>
                  <OutcomeBadge outcome={outcome} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
