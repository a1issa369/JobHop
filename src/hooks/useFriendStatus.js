import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocialGraph } from '../context/SocialGraphContext.jsx';
import { withRateLimit, RateLimitError } from '../lib/rateLimiter.js';

// Friendship state between the signed-in user and one other user - 'none',
// 'pending_sent' (you asked, they haven't answered), 'pending_received',
// or 'accepted'. friendships_select_participant already lets either party
// read a row they're in regardless of its status, so this works for a
// total stranger too, not just existing friends.
//
// Re-fetches on every SocialGraphContext `version` bump, so accepting or
// declining a request from the Friends page immediately clears the
// Accept/Decline block shown on this person's profile card too, without
// needing a page refresh.
export function useFriendStatus(targetId) {
  const { user } = useAuth();
  const { version, bump } = useSocialGraph();
  const [status, setStatus] = useState('none');
  const [friendshipId, setFriendshipId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!user || !targetId || targetId === user.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('friendships')
      .select('id, status, requester_id, addressee_id')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${user.id})`
      )
      .maybeSingle();

    if (!data) {
      setStatus('none');
      setFriendshipId(null);
    } else if (data.status === 'accepted') {
      setStatus('accepted');
      setFriendshipId(data.id);
    } else if (data.requester_id === user.id) {
      setStatus('pending_sent');
      setFriendshipId(data.id);
    } else {
      setStatus('pending_received');
      setFriendshipId(data.id);
    }
    setLoading(false);
  }, [user, targetId]);

  useEffect(() => {
    refresh();
  }, [refresh, version]);

  async function sendRequest() {
    setBusy(true);
    setError('');
    try {
      const { error: reqErr } = await withRateLimit(
        `friend_request:${user.id}`,
        { max: 15, windowMs: 60_000 },
        () => supabase.from('friendships').insert({ requester_id: user.id, addressee_id: targetId, status: 'pending' })
      );
      if (reqErr) throw reqErr;
      await refresh();
      bump();
    } catch (err) {
      setError(err instanceof RateLimitError ? err.message : err.message);
    }
    setBusy(false);
  }

  async function respond(accept) {
    if (!friendshipId) return;
    setBusy(true);
    await supabase
      .from('friendships')
      .update({ status: accept ? 'accepted' : 'blocked' })
      .eq('id', friendshipId);
    await refresh();
    bump();
    setBusy(false);
  }

  return { status, loading, busy, error, sendRequest, respond };
}
