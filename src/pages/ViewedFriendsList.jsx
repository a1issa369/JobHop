import { useEffect, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSocialGraph } from '../context/SocialGraphContext.jsx';
import FollowListPanel from '../components/FollowListPanel.jsx';
import Avatar from '../components/Avatar.jsx';

// The "Friends" tab for whoever's profile you're viewing: same inline
// followers/following panel your own Friends page uses, plus their
// (accepted-only - see migration 011) friends list. No search box and no
// pending-requests section here - those are private to the account owner.
export default function ViewedFriendsList() {
  const { profile } = useOutletContext();
  const [searchParams] = useSearchParams();
  const { version } = useSocialGraph();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id, requester:requester_id(id, username, full_name, avatar_url), addressee:addressee_id(id, username, full_name, avatar_url)')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`);
      if (cancelled) return;
      const list = (data ?? []).map((f) =>
        f.requester_id === profile.id ? f.addressee : f.requester
      ).filter(Boolean);
      setFriends(list);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [profile.id, version]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">{profile.full_name || profile.username}'s friends</h1>
      </div>

      <FollowListPanel userId={profile.id} initialTab={searchParams.get('tab') === 'following' ? 'following' : 'followers'} />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink2">Friends</h2>
        {loading ? (
          <p className="text-sm text-ink2">Loading…</p>
        ) : friends.length === 0 ? (
          <p className="text-sm text-ink2">No friends yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {friends.map((f) => (
              <li key={f.id}>
                <Link
                  to={`/friends/${f.id}`}
                  className="card-surface flex items-center gap-3 p-3 hover:border-signal"
                >
                  <Avatar url={f.avatar_url} size={36} />
                  <span className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight">{f.full_name || f.username}</p>
                    <p className="truncate text-xs text-ink2">@{f.username}</p>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
