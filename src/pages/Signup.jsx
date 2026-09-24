import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext.jsx';
import { withRateLimit, RateLimitError } from '../lib/rateLimiter.js';
import { analyzePassword } from '../utils/password.js';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter.jsx';

const schema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be 20 characters or fewer')
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
  email: z.string().email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password needs at least one uppercase letter')
    .regex(/[a-z]/, 'Password needs at least one lowercase letter')
    .regex(/[^A-Za-z0-9]/, 'Password needs at least one special character')
});

export default function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const strength = analyzePassword(form.password);
  const canSubmit = strength.level === 'strong';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (!canSubmit) {
      setError('Choose a Strong password (green bar) before creating your account.');
      return;
    }

    setBusy(true);
    try {
      const { error: authError } = await withRateLimit(
        'signup',
        { max: 3, windowMs: 60_000 },
        () => signUp(form.email, form.password, form.username)
      );
      if (authError) throw authError;
      setDone(true);
    } catch (err) {
      setError(err instanceof RateLimitError ? err.message : err.message ?? 'Sign up failed.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto mt-16 max-w-sm rounded-lg border border-grid bg-panel p-8 text-center">
        <h1 className="font-display text-xl font-semibold">Check your inbox</h1>
        <p className="mt-2 text-sm text-ink2">
          We sent a confirmation link to {form.email}. Confirm it, then sign in.
        </p>
        <Link to="/login" className="mt-4 inline-block text-signal hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-lg border border-grid bg-panel p-8">
      <h1 className="font-display text-2xl font-semibold">Start your route</h1>
      <p className="mt-1 text-sm text-ink2">Create an account to trace your applications.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field label="Username">
          <input
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="input"
            autoComplete="username"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="input"
            autoComplete="email"
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="input"
            autoComplete="new-password"
          />
          <PasswordStrengthMeter password={form.password} />
        </Field>

        {error && <p className="text-sm text-bad">{error}</p>}

        <button disabled={busy || !canSubmit} className="btn-primary w-full">
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-4 text-sm text-ink2">
        Already have an account?{' '}
        <Link to="/login" className="text-signal hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-ink2">{label}</span>
      {children}
    </label>
  );
}
