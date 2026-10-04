// A dismissible version of the plain `{error && <div>...}` banner pattern
// used across the app. Two pages (Dashboard, Friends) previously set error
// state on failure but never cleared it anywhere, so a stale error sat on
// screen until a full page refresh - this fixes that two ways: a visible
// dismiss (x) the person can click immediately, and callers are expected
// to also clear it at the start of their next retried action (see
// Dashboard.jsx/Friends.jsx), so a fresh attempt replaces or clears a
// stale message on its own even without the click.
export default function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
      <span>{message}</span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        title="Dismiss"
        className="flex-shrink-0 rounded text-bad/70 transition-colors hover:text-bad"
      >
        ✕
      </button>
    </div>
  );
}
