import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';

const PARTICIPANT_FIELDS =
  'id, username, full_name, avatar_url';

// All challenges (any status) the signed-in user is part of, either side.
// Pulls in both participants' basic profile info so the UI can show names
// without a second round trip. Any 'active' challenge whose window has
// already closed is resolved (via the resolve_challenge RPC) the moment
// it's seen here, so there's no server cron needed - whichever
// participant's client notices first settles it for both.
export function useChallenges() {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error: fetchErr } = await supabase
      .from('challenges')
      .select(
        `id, challenger_id, opponent_id, duration_days, status, starts_at, ends_at,
         challenger_count, opponent_count, winner_id, created_at,
         challenger:profiles!challenges_challenger_id_fkey(${PARTICIPANT_FIELDS}),
         opponent:profiles!challenges_opponent_id_fkey(${PARTICIPANT_FIELDS})`
      )
      .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (fetchErr) {
      setError(fetchErr.message);
      setLoading(false);
      return;
    }

    const rows = data ?? [];
    const expired = rows.filter((c) => c.status === 'active' && new Date(c.ends_at) <= new Date());
    if (expired.length > 0) {
      await Promise.all(expired.map((c) => supabase.rpc('resolve_challenge', { p_challenge_id: c.id })));
      const { data: refreshed } = await supabase
        .from('challenges')
        .select(
          `id, challenger_id, opponent_id, duration_days, status, starts_at, ends_at,
           challenger_count, opponent_count, winner_id, created_at,
           challenger:profiles!challenges_challenger_id_fkey(${PARTICIPANT_FIELDS}),
           opponent:profiles!challenges_opponent_id_fkey(${PARTICIPANT_FIELDS})`
        )
        .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
      setChallenges(refreshed ?? rows);
    } else {
      setChallenges(rows);
    }
    setError('');
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function sendChallenge(opponentId, durationDays) {
    const { data, error: err } = await supabase.rpc('create_challenge', {
      p_opponent_id: opponentId,
      p_duration_days: durationDays
    });
    if (!err) refresh();
    return { data, error: err };
  }

  async function respond(challengeId, accept) {
    const { data, error: err } = await supabase.rpc('respond_to_challenge', {
      p_challenge_id: challengeId,
      p_accept: accept
    });
    if (!err) refresh();
    return { data, error: err };
  }

  async function cancel(challengeId) {
    const { data, error: err } = await supabase.rpc('cancel_challenge', {
      p_challenge_id: challengeId
    });
    if (!err) refresh();
    return { data, error: err };
  }

  const incoming = challenges.filter((c) => c.status === 'pending' && c.opponent_id === user?.id);
  const outgoing = challenges.filter((c) => c.status === 'pending' && c.challenger_id === user?.id);
  const active = challenges.filter((c) => c.status === 'active');
  const history = challenges.filter((c) => ['completed', 'declined', 'cancelled'].includes(c.status));

  return {
    challenges,
    incoming,
    outgoing,
    active,
    history,
    loading,
    error,
    refresh,
    sendChallenge,
    respond,
    cancel
  };
}
