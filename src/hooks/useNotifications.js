import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';

const ACTOR_FIELDS = 'id, username, full_name, avatar_url';

// Polled rather than realtime-subscribed - this is a portfolio project, not
// a chat app, and a 25s poll keeps the unread badge fresh enough without
// adding a websocket channel lifecycle to manage. Every row already carries
// who caused it (actor) and a small data blob (company name, challenge id,
// etc.) so the notifications page never needs a second round trip per item.
const POLL_MS = 25_000;

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data, error: fetchErr } = await supabase
      .from('notifications')
      .select(`id, type, actor_id, data, read, created_at, actor:actor_id(${ACTOR_FIELDS})`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (fetchErr) {
      setError(fetchErr.message);
    } else {
      setError('');
      setNotifications(data ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  async function markRead(id) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  }

  async function markAllRead() {
    if (!user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, loading, error, refresh, markRead, markAllRead };
}
