import { createContext, useCallback, useContext, useState } from 'react';

// Follow/unfollow and friend-request send/accept/decline each touch a row
// that several different components independently fetch and display: the
// left ProfileSidebar's follower/following counts, the Friends page's own
// counts + pending requests + friends list, a viewed profile's followers/
// following panel and friends list, and the friend-status buttons on a
// profile card. Those were all separate queries with no way to know when
// one of the others changed the underlying data, which is why following
// someone from the followers list didn't move the count shown elsewhere on
// the same page until a hard refresh.
//
// Rather than wiring every pair of components together directly, anything
// that WRITES a follow or friendship row calls bump() right after a
// successful mutation, and anything that READS follow/friend data watches
// `version` in its fetch effect - so one click anywhere re-syncs every
// other place on screen showing the same relationship.
const SocialGraphContext = createContext(null);

export function SocialGraphProvider({ children }) {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  return (
    <SocialGraphContext.Provider value={{ version, bump }}>
      {children}
    </SocialGraphContext.Provider>
  );
}

export function useSocialGraph() {
  const ctx = useContext(SocialGraphContext);
  if (!ctx) {
    throw new Error('useSocialGraph must be used within a SocialGraphProvider');
  }
  return ctx;
}
