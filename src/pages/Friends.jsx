import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from '../components/Avatar.jsx';
import FollowListPanel from '../components/FollowListPanel.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';

export default function Friends() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);
  const boxRef = useRef(null);

  // Closes the dropdown on an outside click, same as any typeahead.
  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Live search as you type, debounced so each keystroke doesn't fire its
  // own query. Goes through the search_profiles RPC (narrow, username/name/
  // avatar only) rather than a direct `.from('profiles')` select, purely
  // because it's a nicer ilike-ranked lookup - profiles themselves are
  // fully public now, so this isn't working around RLS the way it used to.
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setSearching(true);
    setError('');
    debounceRef.current = setTimeout(async () => {
      const { data, error: searchErr } = await supabase.rpc('search_profiles', { p_query: query });
      if (searchErr) setError(searchErr.message);
      setResults(data ?? []);
      setSearching(false);
      setOpen(true);
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Friends</h1>
        <p className="text-sm text-ink2">Find people and follow their progress.</p>
      </div>

      <div ref={boxRef} className="relative max-w-xs">
        <input
          className="input w-full"
          placeholder="Search by username"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setOpen(true)}
          autoComplete="off"
        />

        {open && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-grid bg-panel shadow-lg">
            {searching ? (
              <p className="p-3 text-sm text-ink2">Searching…</p>
            ) : results.length > 0 ? (
              <ul className="max-h-72 overflow-y-auto">
                {results.map((p) => (
                  <li
                    key={p.id}
                    onClick={() => {
                      setOpen(false);
                      navigate(`/friends/${p.id}`);
                    }}
                    className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-grid/40"
                  >
                    <Avatar url={p.avatar_url} size={28} />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {p.full_name || p.username}
                      <span className="ml-1 text-ink2">@{p.username}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-3 text-sm text-ink2">No users found matching "{query.trim()}".</p>
            )}
          </div>
        )}
      </div>

      <ErrorBanner message={error} onDismiss={() => setError('')} />

      <FollowListPanel userId={user.id} initialTab={searchParams.get('tab') === 'following' ? 'following' : 'followers'} />
    </div>
  );
}
