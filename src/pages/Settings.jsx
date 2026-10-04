import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';
import { useProfileContext } from '../context/ProfileContext.jsx';
import { analyzePassword, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from '../utils/password.js';
import { uploadAvatar } from '../utils/avatar.js';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter.jsx';
import DefaultAvatar from '../components/DefaultAvatar.jsx';
import LanternLoader from '../components/LanternLoader.jsx';

const SECTIONS = [
  { key: 'profile', label: 'Profile' },
  { key: 'password', label: 'Password' },
  { key: 'danger', label: 'Danger zone' }
];

export default function Settings() {
  const [section, setSection] = useState('profile');

  return (
    <div className="flex gap-8">
      <nav className="w-40 flex-shrink-0 space-y-1">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`block w-full rounded px-3 py-2 text-left text-sm font-medium transition-colors ${
              section === s.key
                ? 'bg-panel text-paper'
                : 'text-ink2 hover:bg-panel/60 hover:text-paper'
            } ${s.key === 'danger' && section !== 'danger' ? 'hover:text-bad' : ''}`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1 max-w-lg">
        {section === 'profile' && <ProfileSection />}
        {section === 'password' && <PasswordSection />}
        {section === 'danger' && <DangerSection />}
      </div>
    </div>
  );
}

const profileSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be 20 characters or fewer')
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
  full_name: z.string().max(100).optional().or(z.literal('')),
  school: z.string().max(100).optional().or(z.literal('')),
  linkedin_url: z.string().max(200).optional().or(z.literal('')),
  github_url: z.string().max(200).optional().or(z.literal(''))
});

// A bare "linkedin.com/in/x" is fine to type but useless as an href - this
// normalizes it to an absolute URL before it's saved, so the sidebar's
// link always actually navigates instead of being treated as relative.
function normalizeUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function ProfileSection() {
  const { user } = useAuth();
  const { profile, loading, error: loadError, refresh } = useProfileContext();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const avatarInputRef = useRef(null);

  // Seed the editable form once the profile has loaded, without
  // clobbering in-progress edits on a later re-fetch.
  if (!form && profile) {
    setForm({
      username: profile.username ?? '',
      full_name: profile.full_name ?? '',
      school: profile.school ?? '',
      linkedin_url: profile.linkedin_url ?? '',
      github_url: profile.github_url ?? ''
    });
  }

  if (loading) return <LanternLoader />;

  if (loadError || !profile) {
    return (
      <div className="card-surface p-5">
        <p className="text-sm text-bad">Couldn't load your profile.</p>
        <p className="mt-1 text-xs text-ink2">{loadError?.message ?? 'Unknown error.'}</p>
        <button onClick={refresh} className="btn-secondary mt-3 text-xs">
          Try again
        </button>
      </div>
    );
  }

  if (!form) return <LanternLoader />;

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setAvatarBusy(true);
    setAvatarError('');
    const { error: uploadErr } = await uploadAvatar(user.id, file);
    setAvatarBusy(false);
    if (uploadErr) {
      setAvatarError(uploadErr.message);
      return;
    }
    refresh();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setBusy(true);
    const payload = {
      username: parsed.data.username,
      full_name: parsed.data.full_name || null,
      school: parsed.data.school || null,
      linkedin_url: parsed.data.linkedin_url ? normalizeUrl(parsed.data.linkedin_url) : null,
      github_url: parsed.data.github_url ? normalizeUrl(parsed.data.github_url) : null
    };
    const { error: updateErr } = await supabase.from('profiles').update(payload).eq('id', user.id);
    setBusy(false);

    if (updateErr) {
      setError(
        /unique/i.test(updateErr.message)
          ? 'That username is already taken.'
          : updateErr.message
      );
      return;
    }
    setSaved(true);
    refresh();
  }

  return (
    <div className="card-surface p-5">
      <h2 className="font-display text-sm font-semibold">Edit profile</h2>

      <div className="mt-4 flex items-center gap-4">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            className="h-16 w-16 flex-shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-panel">
            <DefaultAvatar className="h-10 w-10" />
          </span>
        )}
        <div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleAvatarChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarBusy}
            className="btn-secondary text-xs"
          >
            {avatarBusy ? 'Uploading…' : profile.avatar_url ? 'Change photo' : 'Upload photo'}
          </button>
          <p className="mt-1 text-[11px] text-ink2">JPG, PNG, WEBP, or GIF, up to 5MB.</p>
          {avatarError && <p className="mt-1 text-xs text-bad">{avatarError}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <Field label="Username">
          <input
            className="input"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </Field>
        <Field label="Full name">
          <input
            className="input"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </Field>
        <Field label="School">
          <input
            className="input"
            value={form.school}
            onChange={(e) => setForm({ ...form, school: e.target.value })}
          />
        </Field>
        <Field label="LinkedIn">
          <input
            className="input"
            placeholder="linkedin.com/in/you"
            value={form.linkedin_url}
            onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
          />
        </Field>
        <Field label="GitHub">
          <input
            className="input"
            placeholder="github.com/you"
            value={form.github_url}
            onChange={(e) => setForm({ ...form, github_url: e.target.value })}
          />
        </Field>

        {error && <p className="text-sm text-bad">{error}</p>}
        {saved && !error && <p className="text-sm text-good">Profile updated.</p>}

        <button disabled={busy} className="btn-primary">
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}

const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH)
  .max(MAX_PASSWORD_LENGTH)
  .regex(/[A-Z]/)
  .regex(/[a-z]/)
  .regex(/[^A-Za-z0-9]/);

function PasswordSection() {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const strength = analyzePassword(newPassword);
  const canSubmit = Boolean(currentPassword) && strength.level === 'strong';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!passwordSchema.safeParse(newPassword).success) {
      setError('Choose a Strong new password (green bar) before continuing.');
      return;
    }

    setBusy(true);
    const { error: changeErr } = await changePassword(currentPassword, newPassword);
    if (changeErr) {
      setBusy(false);
      setError(changeErr.message);
      return;
    }

    // Per spec: a successful change signs the account out everywhere this
    // browser knows about it, so the next sign-in has to use the new
    // password - nothing keeps using the old session unnoticed.
    await supabase.auth.signOut();
    navigate('/login');
  }

  return (
    <div className="card-surface p-5">
      <h2 className="font-display text-sm font-semibold">Change password</h2>
      <p className="mt-1 text-xs text-ink2">Signed in as {user?.email}</p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <Field label="Current password">
          <input
            type="password"
            className="input"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <Field label="New password">
          <input
            type="password"
            className="input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={MAX_PASSWORD_LENGTH}
          />
          <p className="mt-1 text-[11px] text-ink2">
            {MIN_PASSWORD_LENGTH}–{MAX_PASSWORD_LENGTH} characters, with uppercase, lowercase, and
            a special character.
          </p>
          <PasswordStrengthMeter password={newPassword} />
        </Field>

        {error && <p className="text-sm text-bad">{error}</p>}

        <button disabled={busy || !canSubmit} className="btn-primary">
          {busy ? 'Updating…' : 'Change password'}
        </button>
      </form>
    </div>
  );
}

function DangerSection() {
  return (
    <div className="space-y-6">
      <DeleteAllCardsCard />
      <DeleteAccountCard />
    </div>
  );
}

// Wipes every application (and, via the cascade on stage_history's foreign
// key, every stage transition tied to them) without touching the account
// itself - for starting the tracker over without re-signing-up. Requires
// re-entering the account password first, the same re-authentication
// pattern the "Change password" form uses, since this can't be undone.
function DeleteAllCardsCard() {
  const { user, verifyPassword } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const canDelete = confirmText.trim().toUpperCase() === 'DELETE ALL' && password.length > 0;

  async function handleDelete() {
    if (!canDelete) return;
    setBusy(true);
    setError('');
    setDone(false);

    const { error: pwErr } = await verifyPassword(password);
    if (pwErr) {
      setBusy(false);
      setError(pwErr.message);
      return;
    }

    const { error: delErr } = await supabase.from('applications').delete().eq('user_id', user.id);
    setBusy(false);

    if (delErr) {
      setError(delErr.message);
      return;
    }
    setConfirmText('');
    setPassword('');
    setDone(true);
  }

  return (
    <div className="card-surface border-bad/40 p-5">
      <h2 className="font-display text-sm font-semibold text-bad">Delete all cards</h2>
      <p className="mt-2 text-sm text-ink2">
        Permanently deletes every application card and its stage history. Your account, profile,
        and friends stay intact. This cannot be undone.
      </p>

      <label className="mt-4 block text-xs text-ink2">
        Type <span className="font-semibold text-paper">DELETE ALL</span> to confirm
        <input
          className="input mt-1"
          value={confirmText}
          onChange={(e) => {
            setConfirmText(e.target.value);
            setDone(false);
          }}
        />
      </label>

      <label className="mt-3 block text-xs text-ink2">
        Your password
        <input
          type="password"
          className="input mt-1"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setDone(false);
          }}
          autoComplete="current-password"
        />
      </label>

      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      {done && <p className="mt-2 text-sm text-good">All cards deleted.</p>}

      <button
        onClick={handleDelete}
        disabled={!canDelete || busy}
        className="mt-4 rounded bg-bad px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-40"
      >
        {busy ? 'Deleting…' : 'Permanently delete all cards'}
      </button>
    </div>
  );
}

function DeleteAccountCard() {
  const { signOut } = useAuth();
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
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-ink2">{label}</span>
      {children}
    </label>
  );
}
