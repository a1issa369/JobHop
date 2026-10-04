import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useProfileContext } from '../context/ProfileContext.jsx';
import { useChallenges } from '../hooks/useChallenges.js';
import { useHeadToHead } from '../hooks/useHeadToHead.js';
import { useToast } from '../context/ToastContext.jsx';
import DuelVersus from './DuelVersus.jsx';

const DURATIONS = [1, 2, 3, 4, 5, 6, 7];

function timeLeft(endsAt) {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'ending…';
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${mins}m left`;
}

// All-time record as a proportional bar rather than bare digits - the
// relative size of each segment carries as much information as the
// numbers, the same way a progress bar says more than a percentage alone.
function RecordBar({ wins, draws, losses }) {
  const total = Math.max(1, wins + draws + losses);
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-grid/60">
        <div style={{ width: `${(wins / total) * 100}%` }} className="bg-good" />
        <div style={{ width: `${(draws / total) * 100}%` }} className="bg-ink2/40" />
        <div style={{ width: `${(losses / total) * 100}%` }} className="bg-bad" />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px]">
        <span className="font-semibold text-good">{wins}W</span>
        <span className="font-semibold text-ink2">{draws}D</span>
        <span className="font-semibold text-bad">{losses}L</span>
      </div>
    </div>
  );
}

// A live tug-of-war: whoever's ahead visibly pulls more of the bar to
// their color, same amber/violet split as the avatars above it.
function TugBar({ mine, theirs, theirName }) {
  const total = Math.max(1, mine + theirs);
  const minePct = (mine / total) * 100;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-grid/60">
        <div style={{ width: `${minePct}%` }} className="bg-signal transition-all duration-500" />
        <div style={{ width: `${100 - minePct}%` }} className="bg-route transition-all duration-500" />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-semibold">
        <span className="text-signal">You · {mine}</span>
        <span className="text-route">{theirName} · {theirs}</span>
      </div>
    </div>
  );
}

export default function ChallengeWidget({ targetId, targetName, targetAvatar }) {
  const { profile: myProfile } = useProfileContext();
  const { record, loading: recordLoading, refresh: refreshRecord } = useHeadToHead(targetId);
  const { challenges, loading: challengesLoading, sendChallenge, respond, cancel } = useChallenges();
  const [duration, setDuration] = useState(3);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const showToast = useToast();

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
    // Covers hitting the 2-active-duel cap (count_active_duels, enforced in
    // create_challenge) along with any other failure - a toast fits better
    // than a banner for something this transient.
    const { error: err } = await sendChallenge(targetId, duration);
    setBusy(false);
    if (err) showToast(err.message);
  }

  async function handleRespond(accept) {
    setBusy(true);
    // Same cap, re-checked for both sides at accept time in
    // respond_to_challenge - either participant may have started another
    // duel since this request was sent.
    const { error: err } = await respond(withOpponent.id, accept);
    setBusy(false);
    if (err) showToast(err.message);
    else refreshRecord();
  }

  async function handleCancel() {
    setBusy(true);
    const { error: err } = await cancel(withOpponent.id);
    setBusy(false);
    if (err) showToast(err.message);
  }

  const { wins, draws, losses } = record ?? { wins: 0, draws: 0, losses: 0 };
  const mine = progress
    ? withOpponent.challenger_id === targetId
      ? progress.opponent_count
      : progress.challenger_count
    : 0;
  const theirs = progress
    ? withOpponent.challenger_id === targetId
      ? progress.challenger_count
      : progress.opponent_count
    : 0;

  return (
    <div className="card-surface overflow-hidden p-0">
      <div className="flex items-center justify-between bg-grid/30 px-4 py-3">
        <h3 className="font-display text-sm font-semibold">Duel record</h3>
        <DuelVersus leftUrl={myProfile?.avatar_url} rightUrl={targetAvatar} size={32} />
      </div>

      <div className="space-y-4 p-4">
        <RecordBar wins={wins} draws={draws} losses={losses} />

        {!withOpponent && (
          <div className="space-y-2">
            <p className="text-xs text-ink2">Pick a duel length in days - most applications submitted wins.</p>
            <p className="text-xs text-ink2">You can be in up to 2 duels at the same time.</p>
            <div className="flex gap-1">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  title={`${d} day${d === 1 ? '' : 's'}`}
                  className={`h-7 w-7 flex-1 rounded-full text-xs font-semibold transition-colors ${
                    duration === d ? 'bg-signal text-ink' : 'bg-grid/50 text-ink2 hover:bg-grid'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <button onClick={handleSend} disabled={busy} className="btn-primary w-full text-xs">
              {busy ? 'Sending challenge…' : 'Start a duel'}
            </button>
          </div>
        )}

        {withOpponent?.status === 'pending' && withOpponent.challenger_id === targetId && (
          <div className="space-y-2 rounded-lg border border-signal/40 bg-signal/5 p-3">
            <p className="text-xs">
              <span className="font-semibold text-signal">{targetName}</span>{' '}
              <span className="text-ink2">
                wants to duel - {withOpponent.duration_days} day
                {withOpponent.duration_days === 1 ? '' : 's'}, most applications wins.
              </span>
            </p>
            <div className="flex gap-2">
              <button onClick={() => handleRespond(true)} disabled={busy} className="btn-primary flex-1 text-xs">
                Accept duel
              </button>
              <button onClick={() => handleRespond(false)} disabled={busy} className="btn-secondary flex-1 text-xs">
                Decline
              </button>
            </div>
          </div>
        )}

        {withOpponent?.status === 'pending' && withOpponent.opponent_id === targetId && (
          <div className="space-y-2">
            <p className="text-xs text-ink2">
              <span className="relative mr-1 inline-block h-1.5 w-1.5 rounded-full bg-route align-middle">
                <span className="absolute inset-0 animate-ping rounded-full bg-route" />
              </span>
              Duel request sent - waiting on {targetName}.
            </p>
            <button onClick={handleCancel} disabled={busy} className="btn-secondary w-full text-xs">
              Cancel
            </button>
          </div>
        )}

        {withOpponent?.status === 'active' && (
          <div className="space-y-2 rounded-lg border border-route/40 bg-route/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-route">
              <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-route">
                <span className="absolute inset-0 animate-ping rounded-full bg-route" />
              </span>
              Duel in progress · {timeLeft(withOpponent.ends_at)}
            </p>
            {progress && <TugBar mine={mine} theirs={theirs} theirName={targetName} />}
          </div>
        )}
      </div>
    </div>
  );
}
