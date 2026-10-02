import { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';

// The friendships table stores a directed request (requester -> addressee),
// not a separate "follow" concept, so follower/following counts are derived
// from that existing direction rather than a new table: rows this user
// requested-and-got-accepted count as "following", rows where someone else
// requested this user-and-was-accepted count as "followers".
function useProfileSummary(userId) {
  const [summary, setSummary] = useState({ username: '', avatar_url: null, followers: 0, following: 0 });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [{ data: profile }, { count: following }, { count: followers }] = await Promise.all([
        supabase.from('profiles').select('username, avatar_url').eq('id', userId).single(),
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
      if (!cancelled) {
        setSummary({
          username: profile?.username ?? '',
          avatar_url: profile?.avatar_url ?? null,
          following: following ?? 0,
          followers: followers ?? 0
        });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return summary;
}

function ProfileBadge({ userId }) {
  const { username, avatar_url, followers, following } = useProfileSummary(userId);
  const initial = username ? username[0].toUpperCase() : '?';

  return (
    <Link
      to="/settings"
      className="flex items-center gap-2.5 rounded-full border border-grid bg-ink/40 py-1 pl-1 pr-3 transition-colors hover:border-route/60"
    >
      {avatar_url ? (
        <img src={avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
      ) : (
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-route/30 text-xs font-semibold text-paper">
          {initial}
        </span>
      )}
      <div className="leading-tight">
        <p className="text-xs font-semibold text-paper">{username || '…'}</p>
        <p className="text-[10px] text-ink2">
          {followers} follower{followers === 1 ? '' : 's'} · {following} following
        </p>
      </div>
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
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
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
          <NavLink to="/settings" className={linkClass}>
            Settings
          </NavLink>
          <button
            onClick={signOut}
            className="mr-1 rounded px-3 py-1.5 text-sm font-medium text-ink2 hover:text-bad"
          >
            Sign out
          </button>
          {user && <ProfileBadge userId={user.id} />}
        </nav>
      </div>
    </header>
  );
}
