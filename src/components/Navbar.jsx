import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useProfileContext } from '../context/ProfileContext.jsx';
import DefaultAvatar from './DefaultAvatar.jsx';

// A small hover-highlighted avatar, separate from the left-hand
// ProfileSidebar - clicking it opens the full Profile page (stats,
// activity, resume) rather than anything about the job-tracker board, so
// the two stay clearly separate destinations. Reads from the same shared
// ProfileContext as the sidebar, so a new avatar uploaded in Settings
// shows up here immediately too.
function AvatarLink() {
  const { profile } = useProfileContext();

  return (
    <Link
      to="/profile"
      title="View your profile"
      className="ml-2 flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-panel ring-2 ring-transparent transition-all duration-150 hover:scale-110 hover:ring-route"
    >
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <DefaultAvatar className="h-7 w-7" />
      )}
    </Link>
  );
}

export default function Navbar() {
  const { signOut, user } = useAuth();

  const linkClass = ({ isActive }) =>
    `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
      isActive ? 'bg-signal text-ink' : 'text-ink2 hover:text-paper'
    }`;

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
        </div>
        <nav className="flex items-center gap-2">
          <NavLink to="/" className={linkClass} end>
            Board
          </NavLink>
          <NavLink to="/friends" className={linkClass}>
            Friends
          </NavLink>
          <NavLink to="/challenges" className={linkClass}>
            Challenges
          </NavLink>
          <NavLink to="/settings" className={linkClass}>
            Settings
          </NavLink>
          <button
            onClick={signOut}
            className="ml-2 rounded px-3 py-1.5 text-sm font-medium text-ink2 hover:text-bad"
          >
            Sign out
          </button>
          {user && <AvatarLink />}
        </nav>
      </div>
    </header>
  );
}
