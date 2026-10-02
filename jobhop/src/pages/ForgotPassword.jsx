import { useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext.jsx';
import { withRateLimit } from '../lib/rateLimiter.js';

const schema = z.object({ email: z.string().email('Enter a valid email') });

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setBusy(true);
    try {
      await withRateLimit('password_reset', { max: 3, windowMs: 60_000 }, () =>
        requestPasswordReset(email)
      );
    } catch {
      // Deliberately swallowed - whether this failed because the email has
      // no account, the rate limit was hit, or the request itself failed,
      // the user sees the exact same confirmation below either way. That's
      // what stops this form from being usable to find out which emails
      // are registered.
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto mt-16 max-w-sm rounded-lg border border-grid bg-panel p-8 text-center">
        <h1 className="font-display text-xl font-semibold">Check your inbox</h1>
        <p className="mt-2 text-sm text-ink2">
          If an account exists for {email}, a link to reset its password is on its way. It
          expires soon and can only be used once.
        </p>
        <Link to="/login" className="mt-4 inline-block text-signal hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-lg border border-grid bg-panel p-8">
      <h1 className="font-display text-2xl font-semibold">Reset your password</h1>
      <p className="mt-1 text-sm text-ink2">
        Enter the email on your account and we'll send a link to reset it.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm text-ink2">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            autoComplete="email"
          />
        </label>

        {error && <p className="text-sm text-bad">{error}</p>}

        <button disabled={busy} className="btn-primary w-full">
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="mt-4 text-sm text-ink2">
        <Link to="/login" className="text-signal hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
