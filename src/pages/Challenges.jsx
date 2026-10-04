import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useProfileContext } from '../context/ProfileContext.jsx';
import { useChallenges } from '../hooks/useChallenges.js';
import { useToast } from '../context/ToastContext.jsx';
import DuelVersus from '../components/DuelVersus.jsx';
import StairsLoader from '../components/StairsLoader.jsx';

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

// One shared card shell for every duel, styled to this list's needs: a
// quiet border by default, and an accent border + soft glow only for the
// states that actually need attention (an incoming request, a duel that's
// live right now) - history fades back to quiet since it's already settled.
function DuelCard({ accent, children }) {
  const accentClass =
    accent === 'signal'
      ? 'border-signal/40 bg-signal/5'
      : accent === 'route'
        ? 'border-route/40 bg-route/5'
        : 'border-grid/60';
  return <li className={`card-surface flex items-center gap-4 border p-4 ${accentClass}`}>{children}</li>;
}

function OutcomeBadge({ outcome }) {
  const styles = {
    Won: 'bg-good/15 text-good',
    Lost: 'bg-bad/15 text-bad',
    Draw: 'bg-ink2/15 text-ink2',
    declined: 'bg-ink2/15 text-ink2',
    cancelled: 'bg-ink2/15 text-ink2'
  };
  const label = { declined: 'Declined', cancelled: 'Cancelled' }[outcome] ?? outcome;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[outcome] ?? 'bg-ink2/15 text-ink2'}`}>
      {label}
    </span>
  );
}

export default function Challenges() {
  const { user } = useAuth();
  const { profile: myProfile } = useProfileContext();
  const { incoming, outgoing, active, history, loading, error, respond, cancel } = useChallenges();
  const showToast = useToast();

  // Accepting a request (or, less likely, cancelling one) can fail here if
  // the 2-active-duel cap is hit in the meantime - e.g. another duel of
  // yours just started while this request sat waiting - so both go through
  // a toast rather than failing silently.
  async function handleRespond(id, accept) {
    const { error: err } = await respond(id, accept);
    if (err) showToast(err.message);
  }

  async function handleCancel(id) {
    const { error: err } = await cancel(id);
    if (err) showToast(err.message);
  }

  if (loading) return <StairsLoader />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Duels</h1>
        <p className="text-sm text-ink2">
          Challenge a friend to 1-7 days of applying - whoever submits more wins.
        </p>
        <p className="mt-1 text-xs text-ink2">You can be in up to 2 duels at the same time.</p>
      </div>

      {error && <p className="text-sm text-bad">{error}</p>}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink2">Duel requests</h2>
        {incoming.length === 0 ? (
          <p className="text-sm text-ink2">No one's challenged you right now.</p>
        ) : (
          <ul className="space-y-2">
            {incoming.map((c) => {
              const other = otherParty(c, user.id);
              return (
                <DuelCard key={c.id} accent="signal">
                  <DuelVersus leftUrl={myProfile?.avatar_url} rightUrl={other.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/friends/${other.id}`} className="font-medium hover:text-signal">
                      {other.full_name || other.username}
                    </Link>
                    <p className="text-xs text-ink2">
                      wants a {c.duration_days}-day duel
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <button onClick={() => handleRespond(c.id, true)} className="btn-primary text-xs">
                      Accept
                    </button>
                    <button onClick={() => handleRespond(c.id, false)} className="btn-secondary text-xs">
                      Decline
                    </button>
                  </div>
                </DuelCard>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink2">Awaiting response</h2>
        {outgoing.length === 0 ? (
          <p className="text-sm text-ink2">Nothing sent out right now.</p>
        ) : (
          <ul className="space-y-2">
            {outgoing.map((c) => {
              const other = otherParty(c, user.id);
              return (
                <DuelCard key={c.id}>
                  <DuelVersus leftUrl={myProfile?.avatar_url} rightUrl={other.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/friends/${other.id}`} className="font-medium hover:text-signal">
                      {other.full_name || other.username}
                    </Link>
                    <p className="text-xs text-ink2">
                      {c.duration_days}-day duel · waiting on them
                    </p>
                  </div>
                  <button onClick={() => handleCancel(c.id)} className="btn-secondary flex-shrink-0 text-xs">
                    Cancel
                  </button>
                </DuelCard>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink2">Live duels</h2>
        {active.length === 0 ? (
          <p className="text-sm text-ink2">Nothing in progress.</p>
        ) : (
          <ul className="space-y-2">
            {active.map((c) => {
              const other = otherParty(c, user.id);
              return (
                <DuelCard key={c.id} accent="route">
                  <DuelVersus leftUrl={myProfile?.avatar_url} rightUrl={other.avatar_url} />
                  <div className="min-w-0 flex-1">
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
                </DuelCard>
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
              const other = otherParty(c, user.id);
              const mine = c.challenger_id === user.id ? c.challenger_count : c.opponent_count;
              const theirs = c.challenger_id === user.id ? c.opponent_count : c.challenger_count;
              const outcome =
                c.status !== 'completed'
                  ? c.status
                  : c.winner_id === user.id
                    ? 'Won'
                    : c.winner_id === null
                      ? 'Draw'
                      : 'Lost';
              return (
                <DuelCard key={c.id}>
                  <DuelVersus leftUrl={myProfile?.avatar_url} rightUrl={other.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/friends/${other.id}`} className="font-medium hover:text-signal">
                      {other.full_name || other.username}
                    </Link>
                    {c.status === 'completed' && (
                      <p className="text-xs text-ink2">
                        {mine} - {theirs}
                      </p>
                    )}
                  </div>
                  <OutcomeBadge outcome={outcome} />
                </DuelCard>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
