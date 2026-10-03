import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useChallenges } from '../hooks/useChallenges.js';

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

function Row({ children }) {
  return <li className="card-surface flex items-center justify-between gap-3 p-3">{children}</li>;
}

export default function Challenges() {
  const { user } = useAuth();
  const { incoming, outgoing, active, history, loading, error, respond, cancel } = useChallenges();

  if (loading) return <p className="text-sm text-ink2">Loading…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Challenges</h1>
        <p className="text-sm text-ink2">
          Race a friend over 1-7 days - whoever submits more applications wins.
        </p>
      </div>

      {error && <p className="text-sm text-bad">{error}</p>}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink2">Incoming requests</h2>
        {incoming.length === 0 ? (
          <p className="text-sm text-ink2">No pending challenges from anyone.</p>
        ) : (
          <ul className="space-y-2">
            {incoming.map((c) => {
              const other = otherParty(c, user.id);
              return (
                <Row key={c.id}>
                  <Link to={`/friends/${other.id}`} className="font-medium hover:text-signal">
                    {other.full_name || other.username}
                  </Link>
                  <span className="text-xs text-ink2">
                    {c.duration_days} day{c.duration_days === 1 ? '' : 's'}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => respond(c.id, true)} className="btn-primary text-xs">
                      Accept
                    </button>
                    <button onClick={() => respond(c.id, false)} className="btn-secondary text-xs">
                      Decline
                    </button>
                  </div>
                </Row>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink2">Sent, waiting on a response</h2>
        {outgoing.length === 0 ? (
          <p className="text-sm text-ink2">Nothing pending.</p>
        ) : (
          <ul className="space-y-2">
            {outgoing.map((c) => {
              const other = otherParty(c, user.id);
              return (
                <Row key={c.id}>
                  <Link to={`/friends/${other.id}`} className="font-medium hover:text-signal">
                    {other.full_name || other.username}
                  </Link>
                  <span className="text-xs text-ink2">
                    {c.duration_days} day{c.duration_days === 1 ? '' : 's'}
                  </span>
                  <button onClick={() => cancel(c.id)} className="btn-secondary text-xs">
                    Cancel
                  </button>
                </Row>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink2">Active</h2>
        {active.length === 0 ? (
          <p className="text-sm text-ink2">No challenges in progress.</p>
        ) : (
          <ul className="space-y-2">
            {active.map((c) => {
              const other = otherParty(c, user.id);
              return (
                <Row key={c.id}>
                  <Link to={`/friends/${other.id}`} className="font-medium hover:text-signal">
                    {other.full_name || other.username}
                  </Link>
                  <span className="text-xs text-ink2">{timeLeft(c.ends_at)}</span>
                </Row>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink2">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-ink2">No finished challenges yet.</p>
        ) : (
          <ul className="space-y-2">
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
              const color =
                outcome === 'Won' ? 'text-good' : outcome === 'Lost' ? 'text-bad' : 'text-ink2';
              return (
                <Row key={c.id}>
                  <Link to={`/friends/${other.id}`} className="font-medium hover:text-signal">
                    {other.full_name || other.username}
                  </Link>
                  {c.status === 'completed' && (
                    <span className="text-xs text-ink2">
                      {mine} - {theirs}
                    </span>
                  )}
                  <span className={`text-xs font-semibold ${color}`}>{outcome}</span>
                </Row>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
