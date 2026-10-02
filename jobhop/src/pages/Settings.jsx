import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';

export default function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canDelete = confirmText.trim().toUpperCase() === 'DELETE';

  async function handleDelete() {
    if (!canDelete) return;
    setBusy(true);
    setError('');

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const { data, error: fnError } = await supabase.functions.invoke('delete-account', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (fnError || data?.error) {
      setError(fnError?.message ?? data?.error ?? 'Could not delete your account.');
      setBusy(false);
      return;
    }

    await signOut();
    navigate('/login');
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-ink2">Signed in as {user?.email}</p>
      </div>

      <div className="card-surface border-bad/40 p-5">
        <h2 className="font-display text-sm font-semibold text-bad">Delete account</h2>
        <p className="mt-2 text-sm text-ink2">
          This permanently deletes your account, every application card, your stage history, and
          removes you from any friendships. This cannot be undone.
        </p>

        <label className="mt-4 block text-xs text-ink2">
          Type <span className="font-semibold text-paper">DELETE</span> to confirm
          <input
            className="input mt-1"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
        </label>

        {error && <p className="mt-2 text-sm text-bad">{error}</p>}

        <button
          onClick={handleDelete}
          disabled={!canDelete || busy}
          className="mt-4 rounded bg-bad px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-40"
        >
          {busy ? 'Deleting…' : 'Permanently delete my account'}
        </button>
      </div>
    </div>
  );
}
