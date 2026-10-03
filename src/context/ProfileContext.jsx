import { createContext, useContext } from 'react';
import { useOwnProfile } from '../hooks/useOwnProfile.js';

// Previously Navbar, ProfileSidebar, Settings, and Profile.jsx each called
// useOwnProfile() independently - four separate fetches, four separate
// pieces of state. That's why uploading a new avatar in Settings (which
// only refreshed ITS OWN copy) never showed up in the sidebar or navbar:
// they had no idea anything changed. This context fetches once and shares
// it, so any one of them calling refresh() updates everyone at once.
const ProfileContext = createContext(null);

export function ProfileProvider({ userId, children }) {
  const value = useOwnProfile(userId);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfileContext() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfileContext must be used within a ProfileProvider');
  }
  return ctx;
}
