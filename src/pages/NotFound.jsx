import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Catch-all for any path that doesn't match a route (App.jsx's final
// <Route path="*">). Works whether or not anyone's signed in - "Back to
// JobHop" sends a signed-in visitor to the dashboard and an anonymous one
// to login (handled by the "/" route itself), so this page doesn't need to
// know which.
export default function NotFound() {
  const { user } = useAuth();

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-lg border border-grid bg-panel p-8 text-center">
      <p className="font-display text-6xl font-semibold text-signal">404</p>
      <h1 className="mt-3 font-display text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-ink2">
        That link doesn't lead anywhere - the page may have moved, or the address might be off.
      </p>
      <Link to="/" className="btn-primary mt-6 inline-block w-full text-xs">
        {user ? 'Back to your board' : 'Back to login'}
      </Link>
    </div>
  );
}
