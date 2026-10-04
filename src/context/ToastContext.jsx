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

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = 'error') => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`pointer-events-auto flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm shadow-lg animate-toast-in ${
              t.type === 'success'
                ? 'border-good/40 bg-good/10 text-good'
                : 'border-bad/40 bg-bad/10 text-bad'
            }`}
          >
            <span>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="flex-shrink-0 opacity-70 hover:opacity-100"
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
