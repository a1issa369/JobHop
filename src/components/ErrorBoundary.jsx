import { Component } from 'react';
import { reportError } from '../lib/errorReporting.js';

// Catches a React render crash anywhere below it in the tree - without
// this, a thrown error during render unmounts the whole app and leaves a
// blank white page with nothing in the UI to explain why (the exact
// failure mode this app hit earlier from a misconfigured .env, except
// that one at least logged to the console - a crash deeper in a
// component tree might not even do that). Reports to Sentry (see
// errorReporting.js) if configured, then shows a plain-language fallback
// instead of silence.
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    reportError(error, { componentStack: info.componentStack });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="mx-auto mt-16 max-w-sm rounded-lg border border-bad/40 bg-panel p-8 text-center">
        <h1 className="font-display text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink2">
          This page hit an unexpected error. It's been reported - try reloading.
        </p>
        <button onClick={() => window.location.reload()} className="btn-primary mt-4 w-full">
          Reload
        </button>
      </div>
    );
  }
}
