import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// All-time wins/draws/losses between the signed-in user and one other user,
// from completed challenges - powers the chess.com-style "Vs Shawn
// 10-1-15" line shown on a friend's profile card.
export function useHeadToHead(otherUserId) {
  const [record, setRecord] = useState(null); // { wins, draws, losses }
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!otherUserId) return;
    setLoading(true);
    const { data } = await supabase.rpc('head_to_head', { p_other_id: otherUserId });
    const row = Array.isArray(data) ? data[0] : data;
    setRecord(row ? { wins: row.wins, draws: row.draws, losses: row.losses } : { wins: 0, draws: 0, losses: 0 });
    setLoading(false);
  }, [otherUserId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { record, loading, refresh };
}
