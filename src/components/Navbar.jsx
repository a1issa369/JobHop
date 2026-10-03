import { useEffect, useRef, useState } from 'react';
import { NavLink, useMatch, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useProfileContext } from '../context/ProfileContext.jsx';
import { useViewedProfile } from '../context/ViewedProfileContext.jsx';
import { useNotificationsContext } from '../context/NotificationsContext.jsx';
import DefaultAvatar from './DefaultAvatar.jsx';

const linkClass = ({ isActive }) =>
  `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
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

// The avatar on your own pages opens a small dropdown (your profile,
// notifications with an unread badge, settings, sign out) rather than
// navigating straight to one destination - there's no single obvious place
// for it to go now that Settings isn't its own nav link anymore.
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
    <div ref={boxRef} className="relative ml-2">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Account menu"
        className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-panel ring-2 ring-transparent transition-all duration-150 hover:scale-110 hover:ring-route"
      >
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <DefaultAvatar className="h-7 w-7" />
        )}
        {unreadCount > 0 && (
          <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-52 overflow-hidden rounded-lg border border-grid bg-panel shadow-lg">
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
              <span className="rounded-full bg-signal px-1.5 py-0.5 text-[10px] font-bold text-ink">
                {unreadCount}
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

// While viewing someone else, there's nothing to open a menu for - the
// avatar is just "take me back to my own profile", shown as your OWN
// picture (not theirs) so it reads as a way out, not a way further in.
function BackToOwnProfile() {
  const { profile } = useProfileContext();
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate('/profile')}
      title="Back to your profile"
      className="ml-2 flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-panel ring-2 ring-transparent transition-all duration-150 hover:scale-110 hover:ring-route"
    >
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <DefaultAvatar className="h-7 w-7" />
      )}
    </button>
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
    <header className="border-b border-grid bg-panel/80 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="4" cy="20" r="2" fill="#F2A63A" />
            <path
              d="M4 20 C 8 14, 10 10, 20 4"
              stroke="#9385D1"
              strokeWidth="2"
              strokeDasharray="1 5"
              strokeLinecap="round"
            />
            <circle cx="20" cy="4" r="2" fill="#4CAF7D" />
          </svg>
          <span className="font-display text-lg font-semibold tracking-tight">JobHop</span>
          {viewingSomeoneElse && viewed?.profile && (
            <span className="ml-1 rounded-full bg-grid/50 px-2.5 py-1 text-[11px] font-medium text-ink2">
              Viewing {viewed.profile.full_name || viewed.profile.username}
            </span>
          )}
        </div>
        <nav className="flex items-center gap-2">
          {viewingSomeoneElse ? (
            <ViewedNavLinks friendId={friendMatch.params.friendId} />
          ) : (
            <OwnNavLinks />
          )}
          {user && (viewingSomeoneElse ? <BackToOwnProfile /> : <AvatarMenu />)}
        </nav>
      </div>
    </header>
  );
}
