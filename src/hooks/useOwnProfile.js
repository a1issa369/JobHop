import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const PROFILE_FIELDS =
  'id, username, full_name, avatar_url, bio, school, linkedin_url, github_url, resume_url';

// Shared by the right-hand ProfileSidebar and the Settings "Edit profile"
// form, so both stay in sync on one query shape. Follower/following counts
// are derived from the friendships table's existing requester/addressee
// direction rather than a separate "follow" table - see Navbar/ProfileSidebar
// comments for why that mapping was chosen.
export function useOwnProfile(userId) {
  const [profile, setProfile] = useState(null);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [loading, setLoading] = useState(true);
  // Distinct from "still loading" - set when the profile select itself came
  // back with an error (e.g. a migration hasn't been run yet and a selected
  // column doesn't exist), so consumers can show a real error instead of
  // treating a failed fetch as a permanent loading state.
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [{ data: p, error: pErr }, { count: followingCount }, { count: followerCount }] =
      await Promise.all([
        supabase.from('profiles').select(PROFILE_FIELDS).eq('id', userId).single(),
        supabase
          .from('friendships')
          .select('id', { count: 'exact', head: true })
          .eq('requester_id', userId)
          .eq('status', 'accepted'),
        supabase
          .from('friendships')
          .select('id', { count: 'exact', head: true })
          .eq('addressee_id', userId)
          .eq('status', 'accepted')
      ]);
    setProfile(p ?? null);
    setError(pErr ?? null);
    setFollowing(followingCount ?? 0);
    setFollowers(followerCount ?? 0);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profile, followers, following, loading, error, refresh };
}
