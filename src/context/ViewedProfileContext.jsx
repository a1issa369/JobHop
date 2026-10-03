import { createContext, useContext, useState } from 'react';

// The left ProfileSidebar is normally "yours" everywhere. But on a friend's
// profile page, seeing your own card on the left while reading THEIR stats
// on the right is backwards - you want to be looking at their card while
// you look at their page. FriendProfile.jsx sets this to the friend's data
// while it's mounted (and clears it on unmount), and ProfileSidebar renders
// that instead of your own profile whenever it's set.
const ViewedProfileContext = createContext(null);

export function ViewedProfileProvider({ children }) {
  const [viewed, setViewed] = useState(null);
  return (
    <ViewedProfileContext.Provider value={{ viewed, setViewed }}>
      {children}
    </ViewedProfileContext.Provider>
  );
}

export function useViewedProfile() {
  const ctx = useContext(ViewedProfileContext);
  if (!ctx) {
    throw new Error('useViewedProfile must be used within a ViewedProfileProvider');
  }
  return ctx;
}
