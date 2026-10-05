import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';

// Asks the database whether the signed-in user is the site owner
// (supabase/migrations/017). This only decides what the UI shows - the
// stats and feedback data themselves are protected server-side, so a
// non-owner who types /admin gets nothing even if they get past this check.
// Any error (including the migration not having been run yet) just means
// "not an admin", so the rest of the app is unaffected.
export function useIsAdmin() {
  const { user } = useAuth();
  const [state, setState] = useState({ isAdmin: false, loading: true });

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setState({ isAdmin: false, loading: false });
      return undefined;
    }
    setState((s) => ({ ...s, loading: true }));
    supabase.rpc('is_site_admin').then(({ data, error }) => {
      if (!cancelled) setState({ isAdmin: !error && data === true, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return state;
}
