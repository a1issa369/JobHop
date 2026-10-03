import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';
import DefaultAvatar from './DefaultAvatar.jsx';

// Instagram-style followers/following modal: two clickable tabs with
// counts, a client-side username search that narrows whichever list is
// showing, and a per-row Follow/Unfollow button that always reflects the
// CURRENT VIEWER's own relationship to that row - not the profile owner's -
// so e.g. looking at a friend's "Following" list still lets you follow
// people straight from there. Clicking a row (not the button) navigates to
// that person's profile and closes the modal.
export default function FollowersModal({ userId, initialTab = 'followers', onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState(initialTab);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [myFollowing, setMyFollowing] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      const [{ data: followerRows, error: fErr }, { data: followingRows, error: gErr }, { data: mineRows }] =
        await Promise.all([
          supabase
            .from('follows')
            .select('follower:profiles!follows_follower_id_fkey(id, username, full_name, avatar_url)')
            .eq('followee_id', userId),
          supabase
            .from('follows')
            .select('followee:profiles!follows_followee_id_fkey(id, username, full_name, avatar_url)')
            .eq('follower_id', userId),
          user
            ? supabase.from('follows').select('followee_id').eq('follower_id', user.id)
            : Promise.resolve({ data: [] })
        ]);
      if (cancelled) return;
      if (fErr || gErr) {
        setError(fErr?.message || gErr?.message || 'Could not load this list.');
        setLoading(false);
        return;
      }
      setFollowers((followerRows ?? []).map((r) => r.follower).filter(Boolean));
      setFollowing((followingRows ?? []).map((r) => r.followee).filter(Boolean));
      setMyFollowing(new Set((mineRows ?? []).map((r) => r.followee_id)));
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, user]);

  const list = tab === 'followers' ? followers : following;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) => p.username?.toLowerCase().includes(q) || p.full_name?.toLowerCase().includes(q)
    );
  }, [list, query]);

  function goToProfile(personId) {
    onClose();
    navigate(personId === user?.id ? '/profile' : `/friends/${personId}`);
  }

  async function toggleFollow(personId) {
    if (!user || personId === user.id) return;
    setBusyId(personId);
    if (myFollowing.has(personId)) {
      const { error: delErr } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('followee_id', personId);
      if (!delErr) {
        setMyFollowing((prev) => {
          const next = new Set(prev);
          next.delete(personId);
          return next;
        });
      }
    } else {
      const { error: insErr } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, followee_id: personId });
      if (!insErr) {
        setMyFollowing((prev) => new Set(prev).add(personId));
      }
    }
    setBusyId(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="card-surface flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex border-b border-grid">
          <button
            onClick={() => setTab('followers')}
            className={`flex-1 py-3 text-sm font-semibold ${
              tab === 'followers' ? 'border-b-2 border-signal text-paper' : 'text-ink2'
            }`}
          >
            {followers.length} follower{followers.length === 1 ? '' : 's'}
          </button>
          <button
            onClick={() => setTab('following')}
            className={`flex-1 py-3 text-sm font-semibold ${
              tab === 'following' ? 'border-b-2 border-signal text-paper' : 'text-ink2'
            }`}
          >
            {following.length} following
          </button>
          <button onClick={onClose} className="px-4 text-ink2 hover:text-paper" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="border-b border-grid p-3">
          <input
            className="input w-full text-sm"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="p-5 text-center text-sm text-ink2">Loading…</p>}
          {!loading && error && <p className="p-5 text-center text-sm text-bad">{error}</p>}
          {!loading && !error && filtered.length === 0 && (
            <p className="p-5 text-center text-sm text-ink2">
              {query ? 'No matches.' : tab === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
            </p>
          )}
          {!loading &&
            !error &&
            filtered.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-panel/60">
                <button
                  onClick={() => goToProfile(p.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="h-10 w-10 flex-shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-panel">
                      <DefaultAvatar className="h-6 w-6" />
                    </span>
                  )}
                  <span className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight">
                      {p.full_name || p.username}
                    </p>
                    <p className="truncate text-xs text-ink2">@{p.username}</p>
                  </span>
                </button>

                {user && p.id !== user.id && (
                  <button
                    onClick={() => toggleFollow(p.id)}
                    disabled={busyId === p.id}
                    className={myFollowing.has(p.id) ? 'btn-secondary text-xs' : 'btn-primary text-xs'}
                  >
                    {myFollowing.has(p.id) ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
