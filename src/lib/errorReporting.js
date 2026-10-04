// Error reporting/alerting - a no-op until VITE_SENTRY_DSN is set, so dev
// and CI never need a Sentry account. Once a DSN is set (staging and
// production should each have their own Sentry project, same split as
// their own Supabase projects), this:
//   1. Reports anything ErrorBoundary.jsx catches (a React render crash -
//      exactly the "blank white page" failure mode this app hit earlier
//      when .env was misconfigured; previously that gave you nothing to
//      go on but a blank tab)
//   2. Reports uncaught exceptions and unhandled promise rejections that
//      happen outside React's render cycle (a bad .then() chain, a stray
//      throw in an event handler)
//   3. Emails/Slacks you (configured in the Sentry dashboard, not here) on
//      the FIRST occurrence of a new error, and again if a resolved one
//      comes back - this is the actual "alert on critical errors" piece;
//      without it, a bug only surfaces when a user bothers to report it.
//
// Deliberately NOT wired into every try/catch in the app (login failures,
// a declined duel, etc.) - those are expected, user-facing error states
// already handled by ErrorBanner and friends. This is for the unexpected
// crashes nothing already catches.
let Sentry = null;

export function initErrorReporting() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  import('@sentry/react').then((module) => {
    Sentry = module;
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0 // errors only - no performance/tracing quota burned
    });
  });

  // Catches what ErrorBoundary can't: a throw or rejected promise outside
  // React's render cycle (an event handler, a .then() with no .catch()).
  window.addEventListener('error', (e) => reportError(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason));
}

export function reportError(error, context) {
  console.error(error);
  if (Sentry) Sentry.captureException(error, { extra: context });
}
