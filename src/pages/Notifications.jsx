import { Link } from 'react-router-dom';
import { useNotificationsContext } from '../context/NotificationsContext.jsx';
import Avatar from '../components/Avatar.jsx';
import StairsLoader from '../components/StairsLoader.jsx';

// Human-readable line + where clicking it should go, purely a function of
// the notification's type and its small `data` payload - keeps every row's
// rendering logic in one place instead of scattered conditionals in JSX.
function describe(n) {
  const name = n.actor?.full_name || n.actor?.username || 'Someone';
  switch (n.type) {
    case 'new_follower':
      return {
        text: `@${n.actor?.username || 'someone'} started following you.`,
        to: `/friends/${n.actor_id}`
      };
    case 'friend_request':
      return { text: `${name} sent you a friend request.`, to: '/friends' };
    case 'friend_accepted':
      return { text: `${name} accepted your friend request.`, to: `/friends/${n.actor_id}` };
    case 'duel_invite':
      return {
        text: `${name} challenged you to a ${n.data.duration_days}-day duel.`,
        to: '/challenges'
      };
    case 'duel_accepted':
      return { text: `${name} accepted your duel.`, to: '/challenges' };
    case 'duel_declined':
      return { text: `${name} declined your duel.`, to: '/challenges' };
    case 'duel_completed':
      return {
        text: n.data.draw
          ? `Your duel with ${name} ended in a draw.`
          : n.data.won
            ? `You won your duel with ${name}!`
            : `${name} won your duel.`,
        to: '/challenges'
      };
    case 'friend_application':
      return {
        text: `${name} applied to ${n.data.company} · ${n.data.role}.`,
        to: `/friends/${n.actor_id}/board`
      };
    default:
      return { text: 'Something happened.', to: '/' };
  }
}

function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Notifications() {
  const { notifications, unreadCount, loading, error, markRead, markAllRead } = useNotificationsContext();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-ink2">New followers, friend requests, duel activity, and what your friends are applying to.</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-secondary text-xs">
            Mark all as read
          </button>
        )}
      </div>

      {error && <p className="text-sm text-bad">{error}</p>}

      {loading ? (
        <StairsLoader />
      ) : notifications.length === 0 ? (
        <p className="text-sm text-ink2">Nothing yet - this is where friend requests, duel updates, and friend activity will show up.</p>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => {
            const { text, to } = describe(n);
            return (
              <li key={n.id}>
                <Link
                  to={to}
                  onClick={() => !n.read && markRead(n.id)}
                  className={`card-surface flex items-center gap-3 border p-3.5 transition-colors hover:border-signal ${
                    n.read ? 'border-grid/60' : 'border-signal/40 bg-signal/5'
                  }`}
                >
                  <Avatar url={n.actor?.avatar_url} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{text}</p>
                    <p className="mt-0.5 text-xs text-ink2">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-signal" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
