import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';

// Follow stats for an arbitrary PROFILE BEING VIEWED (a friend's/other
// user's page) - how many followers/following they have, and whether the
// currently signed-in viewer follows them. Separate from useOwnProfile,
// which only ever describes the logged-in user's own counts.
export function useFollowStats(targetUserId) {
  const { user } = useAuth();
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [amFollowing, setAmFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    const [{ count: followerCount }, { count: followingCount }, { data: mine }] =
      await Promise.all([
        supabase
          .from('follows')
          .select('follower_id', { count: 'exact', head: true })
          .eq('followee_id', targetUserId),
        supabase
          .from('follows')
          .select('follower_id', { count: 'exact', head: true })
          .eq('follower_id', targetUserId),
        user
          ? supabase
              .from('follows')
              .select('follower_id')
              .eq('follower_id', user.id)
              .eq('followee_id', targetUserId)
              .maybeSingle()
          : Promise.resolve({ data: null })
      ]);
    setFollowers(followerCount ?? 0);
    setFollowing(followingCount ?? 0);
    setAmFollowing(!!mine);
    setLoading(false);
  }, [targetUserId, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function follow() {
    if (!user || !targetUserId || user.id === targetUserId) return;
    setBusy(true);
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: user.id, followee_id: targetUserId });
    setBusy(false);
    if (!error) {
      setAmFollowing(true);
      setFollowers((f) => f + 1);
    }
    return { error };
  }

  async function unfollow() {
    if (!user || !targetUserId) return;
    setBusy(true);
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('followee_id', targetUserId);
    setBusy(false);
    if (!error) {
      setAmFollowing(false);
      setFollowers((f) => Math.max(0, f - 1));
    }
    return { error };
  }

  return { followers, following, amFollowing, loading, busy, refresh, follow, unfollow };
}
