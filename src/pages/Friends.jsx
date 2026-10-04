import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocialGraph } from '../context/SocialGraphContext.jsx';
import { withRateLimit, RateLimitError } from '../lib/rateLimiter.js';
import Avatar from '../components/Avatar.jsx';
import FollowListPanel from '../components/FollowListPanel.jsx';
import IconUserPlus from '../components/IconUserPlus.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';

export default function Friends() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { version, bump } = useSocialGraph();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState([]);
  // id -> 'pending' | 'accepted' | 'blocked' for everyone with ANY existing
  // friendship row with you, in either direction - used to hide the
  // add-friend button in search results for someone you already have a
  // relationship with (previously showed unconditionally, even for an
  // already-accepted friend or a request already sent/received).
  const [relationships, setRelationships] = useState({});
  const [error, setError] = useState('');
  const debounceRef = useRef(null);
  const boxRef = useRef(null);
  // Synchronous in-flight guard: a Set checked and updated BEFORE any state
  // or network call, so a fast double-click can't fire two concurrent
  // requests for the same person/friendship. React state (e.g. `busy`) only
  // disables a button after a re-render, which is too late to stop a second
  // click that lands in the same tick.
  const inFlightRef = useRef(new Set());

  async function loadFriends() {
    const { data } = await supabase
      .from('friendships')
      .select('id, status, requester_id, addressee_id, requester:requester_id(username, full_name, avatar_url), addressee:addressee_id(username, full_name, avatar_url)')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    const incoming = [];
    const relMap = {};
    for (const f of data ?? []) {
      const otherIsRequester = f.requester_id === user.id;
      const otherProfile = otherIsRequester ? f.addressee : f.requester;
      const otherId = otherIsRequester ? f.addressee_id : f.requester_id;
      relMap[otherId] = f.status;
      if (f.status === 'pending' && f.addressee_id === user.id) {
        incoming.push({ friendshipId: f.id, id: otherId, ...otherProfile });
      }
    }
    setPending(incoming);
    setRelationships(relMap);
  }

  // Also re-fetches on every social graph `version` bump, so accepting or
  // declining a request from the viewed-profile sidebar (not just from this
  // page) updates the Pending requests list here too.
  useEffect(() => {
    loadFriends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

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

  async function sendRequest(addresseeId) {
    if (inFlightRef.current.has(addresseeId)) return;
    inFlightRef.current.add(addresseeId);
    setError('');
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
      bump();
    } catch (err) {
      // A duplicate request blocked by the DB's unique constraint lands
      // here too - still worth surfacing rather than silently doing nothing.
      setError(err instanceof RateLimitError ? err.message : err.message);
    } finally {
      inFlightRef.current.delete(addresseeId);
    }
  }

  async function respond(friendshipId, status) {
    if (inFlightRef.current.has(friendshipId)) return;
    inFlightRef.current.add(friendshipId);
    setError('');
    try {
      const { error: respondErr } = await supabase
        .from('friendships')
        .update({ status })
        .eq('id', friendshipId);
      if (respondErr) throw respondErr;
      await loadFriends();
      bump();
    } catch (err) {
      setError(err.message);
    } finally {
      inFlightRef.current.delete(friendshipId);
    }
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
                    {!relationships[p.id] && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          sendRequest(p.id);
                        }}
                        title="Add friend"
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-grid/50 text-ink2 transition-colors hover:bg-grid hover:text-paper"
                      >
                        <IconUserPlus className="h-3.5 w-3.5" />
                      </button>
                    )}
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

      {pending.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink2">Pending requests</h2>
          <ul className="space-y-2">
            {pending.map((p) => (
              <li key={p.friendshipId} className="card-surface flex items-center gap-3 p-3">
                <Avatar url={p.avatar_url} size={32} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.full_name || p.username}</span>
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
    </div>
  );
}
