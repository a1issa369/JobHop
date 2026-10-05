import { createContext, useCallback, useContext, useRef, useState } from 'react';

// For small, transient user-input mistakes (a past deadline, an oversized
// resume, hitting the duel cap) - pops up, auto-dismisses after 4s, and
// can also be dismissed by hand. This is deliberately separate from
// ErrorBanner: that one is for a page-level failure (a save that actually
// failed, a fetch that broke) that stays on screen until the user does
// something about it. A toast is for "you mistyped something," not for
// "something is actually broken."
const ToastContext = createContext(null);

const AUTO_DISMISS_MS = 4000;
// How long the exit transition runs before the toast is actually removed
// from state - must match the `duration-300` class below.
const EXIT_MS = 300;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  // Two-phase removal: first flag the toast as `leaving` so its exit
  // transition (opacity + a further drift downward) can play, then drop it
  // from state once that transition has had time to finish. Dismissing by
  // hand (the ✕ button) goes through this same path, so it animates out
  // the same way an auto-dismiss does rather than vanishing instantly.
  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, EXIT_MS);
  }, []);

  const showToast = useCallback(
    (message, type = 'error') => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, type, leaving: false }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {/* Top-center rather than a corner, so a toast reads as it dropping in
          from the middle of the screen and settling, not sliding in from an
          edge - see the toast-in/toast-out keyframes in index.css. */}
      <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`pointer-events-auto flex w-full max-w-sm items-start justify-between gap-3 rounded-lg border-l-4 bg-panel/95 px-4 py-3 text-sm text-paper shadow-lg backdrop-blur-sm transition-all duration-300 ease-in animate-toast-in ${
              t.leaving ? 'translate-y-3 opacity-0' : 'translate-y-0 opacity-100'
            } ${t.type === 'success' ? 'border-good' : 'border-route'}`}
          >
            <span>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="flex-shrink-0 text-ink2 opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Returns a `showToast(message, type?)` function. type is 'error'
// (default) or 'success'.
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
