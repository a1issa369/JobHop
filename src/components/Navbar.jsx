import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { signOut } = useAuth();

  const linkClass = ({ isActive }) =>
    `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
      isActive ? 'bg-signal text-ink' : 'text-ink2 hover:text-paper'
    }`;

  return (
    <header className="border-b border-grid bg-panel/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="4" cy="20" r="2" fill="#F2A63A" />
            <path
              d="M4 20 C 8 14, 10 10, 20 4"
              stroke="#5B8DB8"
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
          <button
            onClick={signOut}
            className="ml-2 rounded px-3 py-1.5 text-sm font-medium text-ink2 hover:text-bad"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
