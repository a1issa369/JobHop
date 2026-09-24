import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';
import { withRateLimit, RateLimitError } from '../lib/rateLimiter.js';

export default function Friends() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [error, setError] = useState('');

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

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    const { data, error: searchErr } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .ilike('username', `%${query.trim()}%`)
      .neq('id', user.id)
      .limit(10);
    if (searchErr) setError(searchErr.message);
    setResults(data ?? []);
  }

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

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search by username"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn-secondary">Search</button>
      </form>

      {error && <p className="text-sm text-bad">{error}</p>}

      {results.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink2">Results</h2>
          <ul className="space-y-2">
            {results.map((p) => (
              <li key={p.id} className="card-surface flex items-center justify-between p-3">
                <span>{p.username}</span>
                <button onClick={() => sendRequest(p.id)} className="btn-secondary text-xs">
                  Add friend
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

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
