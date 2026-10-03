import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';
import { withRateLimit, RateLimitError } from '../lib/rateLimiter.js';
import Avatar from '../components/Avatar.jsx';

export default function Friends() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);
  const boxRef = useRef(null);

  async function loadFriends() {
    const { data } = await supabase
      .from('friendships')
      .select('id, status, requester_id, addressee_id, requester:requester_id(username, avatar_url), addressee:addressee_id(username, avatar_url)')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    const accepted = [];
    const incoming = [];
    for (const f of data ?? []) {
      const otherIsRequester = f.requester_id === user.id;
      const otherProfile = otherIsRequester ? f.addressee : f.requester;
      const otherId = otherIsRequester ? f.addressee_id : f.requester_id;
      if (f.status === 'accepted') {
        accepted.push({ id: otherId, ...otherProfile });
      } else if (f.status === 'pending' && f.addressee_id === user.id) {
        incoming.push({ friendshipId: f.id, id: otherId, ...otherProfile });
      }
    }
    setFriends(accepted);
    setPending(incoming);
  }

  useEffect(() => {
    loadFriends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Closes the dropdown on an outside click, same as any typeahead.
  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Live search as you type, debounced so each keystroke doesn't fire its
  // own query. Goes through the search_profiles RPC rather than a direct
  // `.from('profiles')` select - profile rows are RLS-gated to people
  // you're already friends with or following, so a plain select would
  // silently return nothing for anyone you haven't met yet. The RPC is a
  // deliberate, narrow exception: username/name/avatar only, for exactly
  // this directory-style search.
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const { data, error: searchErr } = await supabase.rpc('search_profiles', { p_query: query });
      if (searchErr) setError(searchErr.message);
      setResults(data ?? []);
      setSearching(false);
      setOpen(true);
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  async function sendRequest(addresseeId) {
    try {
      const { error: reqErr } = await withRateLimit(
        `friend_request:${user.id}`,
        { max: 15, windowMs: 60_000 }, // caps spammy mass friend-requesting
        () =>
          supabase.from('friendships').insert({
            requester_id: user.id,
            addressee_id: addresseeId,
            status: 'pending'
          })
      );
      if (reqErr) throw reqErr;
      setResults((r) => r.filter((p) => p.id !== addresseeId));
    } catch (err) {
      setError(err instanceof RateLimitError ? err.message : err.message);
    }
  }

  async function respond(friendshipId, status) {
    await supabase.from('friendships').update({ status }).eq('id', friendshipId);
    loadFriends();
  }

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
                  <li key={p.id} className="flex items-center gap-2 px-3 py-2 hover:bg-grid/40">
                    <Avatar url={p.avatar_url} size={28} />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {p.full_name || p.username}
                      <span className="ml-1 text-ink2">@{p.username}</span>
                    </span>
                    <button
                      onClick={() => sendRequest(p.id)}
                      className="btn-secondary flex-shrink-0 text-xs"
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-3 text-sm text-ink2">No users found matching "{query.trim()}".</p>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-bad">{error}</p>}

      {pending.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink2">Pending requests</h2>
          <ul className="space-y-2">
            {pending.map((p) => (
              <li key={p.friendshipId} className="card-surface flex items-center justify-between p-3">
                <span>{p.username}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => respond(p.friendshipId, 'accepted')}
                    className="btn-primary text-xs"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => respond(p.friendshipId, 'blocked')}
                    className="btn-secondary text-xs"
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink2">Your friends</h2>
        {friends.length === 0 ? (
          <p className="text-sm text-ink2">No friends yet — search above to add some.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {friends.map((f) => (
              <li key={f.id}>
                <Link
                  to={`/friends/${f.id}`}
                  className="card-surface block p-3 hover:border-signal"
                >
                  {f.username}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
