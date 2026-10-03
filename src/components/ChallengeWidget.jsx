import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useChallenges } from '../hooks/useChallenges.js';
import { useHeadToHead } from '../hooks/useHeadToHead.js';

function timeLeft(endsAt) {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'ending…';
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${mins}m left`;
}

// chess.com-style head-to-head: "Vs <name>   W-D-L" with wins in green,
// draws in grey, losses in red - plus whatever action is live between the
// viewer and this profile right now (send a challenge, respond to one
// that's pending, or watch an active one tick down).
export default function ChallengeWidget({ targetId, targetName }) {
  const { record, loading: recordLoading, refresh: refreshRecord } = useHeadToHead(targetId);
  const { challenges, loading: challengesLoading, sendChallenge, respond, cancel, refresh } =
    useChallenges();
  const [duration, setDuration] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);

  const withOpponent = challenges.find(
    (c) =>
      ['pending', 'active'].includes(c.status) &&
      (c.challenger_id === targetId || c.opponent_id === targetId)
  );

  useEffect(() => {
    let cancelled = false;
    if (withOpponent?.status === 'active') {
      supabase.rpc('challenge_progress', { p_challenge_id: withOpponent.id }).then(({ data }) => {
        if (!cancelled) setProgress(Array.isArray(data) ? data[0] : data);
      });
    } else {
      setProgress(null);
    }
    return () => {
      cancelled = true;
    };
  }, [withOpponent?.id, withOpponent?.status]);

  if (recordLoading || challengesLoading) return null;

  async function handleSend() {
    setBusy(true);
    setError('');
    const { error: err } = await sendChallenge(targetId, duration);
    setBusy(false);
    if (err) setError(err.message);
  }

  async function handleRespond(accept) {
    setBusy(true);
    setError('');
    const { error: err } = await respond(withOpponent.id, accept);
    setBusy(false);
    if (err) setError(err.message);
    else refreshRecord();
  }

  async function handleCancel() {
    setBusy(true);
    setError('');
    const { error: err } = await cancel(withOpponent.id);
    setBusy(false);
    if (err) setError(err.message);
  }

  const { wins, draws, losses } = record ?? { wins: 0, draws: 0, losses: 0 };

  return (
    <div className="card-surface p-4">
      <h3 className="font-display text-sm font-semibold">Head-to-head</h3>
      <p className="mt-2 text-sm">
        <span className="text-ink2">Vs {targetName}</span>{' '}
        <span className="font-mono font-semibold">
          <span className="text-good">{wins}</span>
          <span className="text-ink2">-</span>
          <span className="text-ink2">{draws}</span>
          <span className="text-ink2">-</span>
          <span className="text-bad">{losses}</span>
        </span>
      </p>

      {error && <p className="mt-2 text-xs text-bad">{error}</p>}

      {!withOpponent && (
        <div className="mt-3 flex items-center gap-2">
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="input text-xs"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <option key={d} value={d}>
                {d} day{d === 1 ? '' : 's'}
              </option>
            ))}
          </select>
          <button onClick={handleSend} disabled={busy} className="btn-primary flex-1 text-xs">
            {busy ? 'Sending…' : 'Challenge'}
          </button>
        </div>
      )}

      {withOpponent?.status === 'pending' && withOpponent.challenger_id === targetId && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-ink2">
            {targetName} challenged you - {withOpponent.duration_days} day
            {withOpponent.duration_days === 1 ? '' : 's'}, most applications wins.
          </p>
          <div className="flex gap-2">
            <button onClick={() => handleRespond(true)} disabled={busy} className="btn-primary flex-1 text-xs">
              Accept
            </button>
            <button onClick={() => handleRespond(false)} disabled={busy} className="btn-secondary flex-1 text-xs">
              Decline
            </button>
          </div>
        </div>
      )}

      {withOpponent?.status === 'pending' && withOpponent.opponent_id === targetId && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-ink2">Waiting on {targetName} to respond.</p>
          <button onClick={handleCancel} disabled={busy} className="btn-secondary w-full text-xs">
            Cancel challenge
          </button>
        </div>
      )}

      {withOpponent?.status === 'active' && (
        <div className="mt-3 space-y-1">
          <p className="text-xs text-ink2">{timeLeft(withOpponent.ends_at)}</p>
          {progress && (
            <p className="text-xs">
              You <span className="font-semibold">
                {withOpponent.challenger_id === targetId ? progress.opponent_count : progress.challenger_count}
              </span>{' '}
              — <span className="font-semibold">
                {withOpponent.challenger_id === targetId ? progress.challenger_count : progress.opponent_count}
              </span>{' '}
              {targetName}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
