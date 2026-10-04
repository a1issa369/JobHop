import { useEffect, useRef, useState } from 'react';
import { NavLink, useMatch, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useProfileContext } from '../context/ProfileContext.jsx';
import { useViewedProfile } from '../context/ViewedProfileContext.jsx';
import { useNotificationsContext } from '../context/NotificationsContext.jsx';
import DefaultAvatar from './DefaultAvatar.jsx';

const linkClass = ({ isActive }) =>
  `px-3.5 py-2 rounded text-base font-medium transition-colors ${
    isActive ? 'bg-signal text-ink' : 'text-ink2 hover:text-paper'
  }`;

// Own pages: Board / Friends / Duels point at your own areas.
function OwnNavLinks() {
  return (
    <>
      <NavLink to="/" className={linkClass} end>
        Board
      </NavLink>
      <NavLink to="/friends" className={linkClass}>
        Friends
      </NavLink>
      <NavLink to="/challenges" className={linkClass}>
        Duels
      </NavLink>
    </>
  );
}

// While a friend/stranger's profile is open (ViewedProfileContext is set),
// the same three tabs instead point at THEIR board/friends/duels - a
// read-only mirror of your own nav, scoped to whoever you're looking at.
function ViewedNavLinks({ friendId }) {
  return (
    <>
      <NavLink to={`/friends/${friendId}/board`} className={linkClass}>
        Board
      </NavLink>
      <NavLink to={`/friends/${friendId}/friends`} className={linkClass}>
        Friends
      </NavLink>
      <NavLink to={`/friends/${friendId}/duels`} className={linkClass}>
        Duels
      </NavLink>
    </>
  );
}

// The avatar ALWAYS opens a dropdown first, whether you're on your own
// pages or looking at someone else's - clicking it never jumps straight to
// a destination. "Your profile" is what doubles as the way back out of a
// viewed profile (navigating there unmounts the ViewedProfileLayout, which
// is what hands the sidebar/nav back to showing you).
function AvatarMenu() {
  const { profile } = useProfileContext();
  const { unreadCount } = useNotificationsContext();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function go(path) {
    setOpen(false);
    navigate(path);
  }

  return (
    <div ref={boxRef} className="relative ml-3">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Account menu"
        className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full ring-2 ring-transparent transition-all duration-150 hover:scale-110 hover:ring-route"
      >
        {/* overflow-hidden lives on this inner circle, not the button itself,
            so the unread dot below (a sibling, on the button) sits cleanly on
            the ring's edge instead of getting clipped into the photo by the
            same mask that keeps the avatar round. The count itself only
            shows up once you open the dropdown - this is just a "something's
            new" signal, not a second place to read the number. */}
        <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-panel">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <DefaultAvatar className="h-10 w-10" />
          )}
        </span>
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-bad ring-2 ring-ink" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-3 w-56 overflow-hidden rounded-lg border border-grid bg-panel shadow-lg">
          <button
            onClick={() => go('/profile')}
            className="block w-full px-4 py-2.5 text-left text-sm text-ink2 hover:bg-grid/40 hover:text-paper"
          >
            Your profile
          </button>
          <button
            onClick={() => go('/notifications')}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-ink2 hover:bg-grid/40 hover:text-paper"
          >
            Notifications
            {unreadCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => go('/settings')}
            className="block w-full px-4 py-2.5 text-left text-sm text-ink2 hover:bg-grid/40 hover:text-paper"
          >
            Profile settings
          </button>
          <button
            onClick={signOut}
            className="block w-full border-t border-grid px-4 py-2.5 text-left text-sm text-ink2 hover:bg-bad/10 hover:text-bad"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user } = useAuth();
  const { viewed } = useViewedProfile();
  // Derived from the URL, not from whether the profile fetch has finished -
  // otherwise the nav would briefly show your own Board/Friends/Duels links
  // for a moment on every click into someone else's page before flipping
  // over once their data arrives.
  const friendMatch = useMatch('/friends/:friendId/*');
  const viewingSomeoneElse = Boolean(friendMatch);

  return (
    // `relative z-20` here is what keeps the avatar dropdown (and anything
    // else absolutely positioned inside this header) painted above the page
    // content below it. Without an explicit z-index, `backdrop-blur` makes
    // the header establish its own stacking context, which traps the
    // dropdown's z-10 *inside* that context instead of letting it compete
    // with `main`'s content - so with no z-index of its own, the header
    // (and everything inside it, including an open dropdown) ends up
    // painted BEHIND `main` simply because `main` comes later in the DOM.
    // That's what caused a Board stage count to visibly show through the
    // open dropdown menu.
    <header className="relative z-20 border-b border-grid bg-panel/80 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          {/* A running figure (mid-stride, briefcase in hand) inside an
              open motion arc - "hopping" toward the next job, in the app's
              own palette rather than a literal copy of any one logo-maker
              export. */}
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
            <path
              d="M6 24a10 10 0 1 1 14-14"
              stroke="#9385D1"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="17" cy="9" r="3" fill="#F1ECFA" />
            <path
              d="M14 13l5 2 4-5"
              stroke="#F1ECFA"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M19 15l-3 4-5 2"
              stroke="#F1ECFA"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="21" y="9" width="6" height="5" rx="1" fill="#F2A63A" />
            <path d="M23 9v-1a1 1 0 0 1 1-1 1 1 0 0 1 1 1v1" stroke="#F2A63A" strokeWidth="1.2" />
          </svg>
          <span className="font-display text-xl font-semibold tracking-tight">JobHop</span>
          {viewingSomeoneElse && viewed?.profile && (
            <span className="ml-1 rounded-full bg-grid/50 px-2.5 py-1 text-[11px] font-medium text-ink2">
              Viewing {viewed.profile.full_name || viewed.profile.username}
            </span>
          )}
        </div>
        <nav className="flex items-center gap-3">
          {viewingSomeoneElse ? (
            <ViewedNavLinks friendId={friendMatch.params.friendId} />
          ) : (
            <OwnNavLinks />
          )}
          {user && <AvatarMenu />}
        </nav>
      </div>
    </header>
  );
}
