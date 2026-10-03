import { createContext, useContext, useEffect, useRef } from 'react';
import { useOwnProfile } from '../hooks/useOwnProfile.js';
import { useSocialGraph } from './SocialGraphContext.jsx';

// Previously Navbar, ProfileSidebar, Settings, and Profile.jsx each called
// useOwnProfile() independently - four separate fetches, four separate
// pieces of state. That's why uploading a new avatar in Settings (which
// only refreshed ITS OWN copy) never showed up in the sidebar or navbar:
// they had no idea anything changed. This context fetches once and shares
// it, so any one of them calling refresh() updates everyone at once.
const ProfileContext = createContext(null);

export function ProfileProvider({ userId, children }) {
  const value = useOwnProfile(userId);
  const { version } = useSocialGraph();
  // Also re-fetches your own follower/following counts whenever the shared
  // social graph signal bumps (a follow/unfollow or friend-request action
  // anywhere on the page) - skips the very first render, since useOwnProfile
  // already fetches on mount and refetching again at version 0 would just
  // be a redundant extra query.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    value.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfileContext() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfileContext must be used within a ProfileProvider');
  }
  return ctx;
}
