import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';
import { analyzePassword, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from '../utils/password.js';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter.jsx';

// Reached only by clicking the link Supabase emails from the Forgot
// Password flow. That link carries a one-time, short-lived recovery token;
// supabase-js exchanges it for a temporary session automatically on load
// and announces it via the PASSWORD_RECOVERY auth event below. If that
// event (or an existing recovery session) never shows up, the form below
// never renders - there's no path on this page that lets anyone call
// updatePassword() without having presented a valid token for this exact
// account first, which is what keeps this safe from "reset a password
// using any random email."
export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking'); // 'checking' | 'ready' | 'invalid'
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStatus('ready');
    });

    // Covers the case where the event fired before this component mounted.
    supabase.auth.getSession().then(({ data }) => {
      setStatus((s) => (s === 'checking' ? (data.session ? 'ready' : 'invalid') : s));
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const strength = analyzePassword(password);
  const canSubmit = strength.level === 'strong';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) {
      setError('Choose a Strong password (green bar) before continuing.');
      return;
    }
    setBusy(true);
    setError('');
    const { error: updateErr } = await updatePassword(password);
    setBusy(false);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setDone(true);
  }

  if (status === 'checking') {
    return <CenteredCard title="Checking your link…" body="One moment." />;
  }

  if (status === 'invalid') {
    return (
      <CenteredCard
        title="This link isn't valid"
        body="Reset links expire after a short time and only work once. Request a new one from the sign-in page."
      >
        <Link to="/forgot-password" className="mt-4 inline-block text-signal hover:underline">
          Request a new link
        </Link>
      </CenteredCard>
    );
  }

  if (done) {
    return (
      <CenteredCard title="Password updated" body="Sign in with your new password.">
        <button onClick={() => navigate('/login')} className="btn-primary mt-4">
          Back to sign in
        </button>
      </CenteredCard>
    );
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-lg border border-grid bg-panel p-8">
      <h1 className="font-display text-2xl font-semibold">Choose a new password</h1>
      <p className="mt-1 text-sm text-ink2">This replaces your current password.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm text-ink2">New password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={MAX_PASSWORD_LENGTH}
          />
          <p className="mt-1 text-[11px] text-ink2">
            {MIN_PASSWORD_LENGTH}–{MAX_PASSWORD_LENGTH} characters, with uppercase, lowercase, and
            a special character.
          </p>
          <PasswordStrengthMeter password={password} />
        </label>

        {error && <p className="text-sm text-bad">{error}</p>}

        <button disabled={busy || !canSubmit} className="btn-primary w-full">
          {busy ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}

function CenteredCard({ title, body, children }) {
  return (
    <div className="mx-auto mt-16 max-w-sm rounded-lg border border-grid bg-panel p-8 text-center">
      <h1 className="font-display text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-ink2">{body}</p>
      {children}
    </div>
  );
}
