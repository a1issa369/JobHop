import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext.jsx';
import { withRateLimit, RateLimitError } from '../lib/rateLimiter.js';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setBusy(true);
    try {
      // Max 5 login attempts per minute per browser session — slows down
      // credential-stuffing loops without punishing a normal typo-and-retry.
      const { error: authError } = await withRateLimit(
        'login',
        { max: 5, windowMs: 60_000 },
        () => signIn(form.email, form.password)
      );
      if (authError) throw authError;
      navigate('/');
    } catch (err) {
      setError(err instanceof RateLimitError ? err.message : err.message ?? 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-lg border border-grid bg-panel p-8">
      <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
      <p className="mt-1 text-sm text-ink2">Sign in to keep tracing your applications.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
            autoComplete="current-password"
          />
        </Field>

        {error && <p className="text-sm text-bad">{error}</p>}

        <button disabled={busy} className="btn-primary w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-4 text-sm text-ink2">
        New here?{' '}
        <Link to="/signup" className="text-signal hover:underline">
          Create an account
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
