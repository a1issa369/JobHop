import { useEffect, useState } from 'react';
import { useParams, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useViewedProfile } from '../context/ViewedProfileContext.jsx';
import { getResumeSignedUrl } from '../utils/resume.js';
import LanternLoader from '../components/LanternLoader.jsx';

// Layout for every /friends/:friendId* route (overview, board, friends,
// duels - see App.jsx). Profiles are fully public now, so this loads once
// per visit rather than once per tab: the profile card, resume link, and
// whether a duel is currently hiding activity data all live here and get
// handed down to whichever tab is active via the route's Outlet context,
// and into the left ProfileSidebar via ViewedProfileContext.
export default function FriendProfile() {
  const { friendId } = useParams();
  const { setViewed } = useViewedProfile();
  const [state, setState] = useState({ loading: true, error: '', profile: null, resumeUrl: null });
  const [isInActiveDuel, setIsInActiveDuel] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setViewed({ loading: true });
    setState({ loading: true, error: '', profile: null, resumeUrl: null });

    async function load() {
      const [{ data: profile, error: profileErr }, { data: duelFlag }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, school, linkedin_url, github_url, resume_url')
          .eq('id', friendId)
          .maybeSingle(),
        supabase.rpc('is_in_active_duel_with', { p_other_id: friendId })
      ]);

      if (cancelled) return;

      if (profileErr || !profile) {
        const message = profileErr?.message || "Couldn't find this user.";
        setState({ loading: false, error: message, profile: null, resumeUrl: null });
        setViewed({ loading: false, error: message, profile: null, resumeUrl: null });
        return;
      }

      const resumeUrl = profile.resume_url ? await getResumeSignedUrl(profile.resume_url) : null;
      if (cancelled) return;

      setIsInActiveDuel(Boolean(duelFlag));
      setState({ loading: false, error: '', profile, resumeUrl });
      setViewed({ loading: false, error: '', profile, resumeUrl });
    }
    load();

    // Leaving every /friends/:friendId* route hands the sidebar and navbar
    // back to showing your own profile - this only fires once, on the way
    // out of the whole viewed-profile area, not when switching tabs within it.
    return () => {
      cancelled = true;
      setViewed(null);
    };
  }, [friendId, setViewed]);

  if (state.loading) return <LanternLoader label="Loading profile" />;
  if (state.error) return <p className="text-bad">{state.error}</p>;

  // The back link itself lives on each tab, not here - "← Back to friends"
  // (to your own friends list) on the Overview tab, "← Back to profile" (to
  // this person's Overview) on Board/Friends/Duels, since that distinction
  // depends on which tab is active, which this layout doesn't track.
  return <Outlet context={{ profile: state.profile, isInActiveDuel }} />;
}
