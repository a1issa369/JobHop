import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import FollowListPanel from '../components/FollowListPanel.jsx';

// The "Friends" tab for whoever's profile you're viewing: just the same
// inline followers/following panel your own Friends page uses. There used
// to be a second "Friends" list underneath (their accepted friendships),
// but that was a near-duplicate of the Following tab above it, so it's
// gone - the followers/following panel is the one source of truth here.
// No search box and no pending-requests section either - those are
// private to the account owner.
export default function ViewedFriendsList() {
  const { profile } = useOutletContext();
  const [searchParams] = useSearchParams();

  return (
    <div className="space-y-6">
      <Link to={`/friends/${profile.id}`} className="text-sm text-ink2 hover:text-signal">
        ← Back to profile
      </Link>

      <div>
        <h1 className="font-display text-2xl font-semibold">{profile.full_name || profile.username}'s friends</h1>
      </div>

      <FollowListPanel userId={profile.id} initialTab={searchParams.get('tab') === 'following' ? 'following' : 'followers'} />
    </div>
  );
}
