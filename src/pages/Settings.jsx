import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';
import { useProfileContext } from '../context/ProfileContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { analyzePassword, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from '../utils/password.js';
import { uploadAvatar } from '../utils/avatar.js';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter.jsx';
import DefaultAvatar from '../components/DefaultAvatar.jsx';
import StairsLoader from '../components/StairsLoader.jsx';

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

        <div className="mt-4 space-y-1 border-t border-grid pt-3">
          <Link
            to="/terms"
            className="block rounded px-3 py-1.5 text-xs text-ink2 hover:text-paper"
          >
            Terms
          </Link>
          <Link
            to="/privacy"
            className="block rounded px-3 py-1.5 text-xs text-ink2 hover:text-paper"
          >
            Privacy Policy
          </Link>
          <Link
            to="/feedback"
            state={{ from: '/settings' }}
            className="block rounded px-3 py-1.5 text-xs text-ink2 hover:text-paper"
          >
            Send feedback
          </Link>
        </div>
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

// Catches the two most common mistakes - pasting something that isn't a
// URL at all, or pasting the right kind of thing on the wrong field (a
// GitHub link in the LinkedIn box) - without being so strict about the
// rest of the URL that a real profile link gets rejected.
function isValidProfileUrl(value, domain) {
  if (!value) return true; // empty is fine, this field is optional
  let url;
  try {
    url = new URL(normalizeUrl(value));
  } catch {
    return false;
  }
  return url.hostname.toLowerCase().endsWith(domain);
}

function ProfileSection() {
  const { user } = useAuth();
  const { profile, loading, error: loadError, refresh } = useProfileContext();
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef(null);
  const showToast = useToast();

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

  if (loading) return <StairsLoader />;

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

  if (!form) return <StairsLoader />;

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setAvatarBusy(true);
    const { error: uploadErr } = await uploadAvatar(user.id, file);
    setAvatarBusy(false);
    if (uploadErr) {
      showToast(uploadErr.message);
      return;
    }
    refresh();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaved(false);
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      showToast(parsed.error.issues[0].message);
      return;
    }
    if (!isValidProfileUrl(parsed.data.linkedin_url, 'linkedin.com')) {
      showToast("That doesn't look like a LinkedIn link.");
      return;
    }
    if (!isValidProfileUrl(parsed.data.github_url, 'github.com')) {
      showToast("That doesn't look like a GitHub link.");
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
      showToast(
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
            alt="Your current profile photo"
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

        {saved && <p className="text-sm text-good">Profile updated.</p>}

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
  const { user, changePassword, verifyPassword } = useAuth();
  const navigate = useNavigate();
  const showToast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  // 'idle' (not checked yet, or stale after an edit) | 'checking' |
  // 'valid' | 'invalid' - re-authenticates against Supabase on blur (not
  // every keystroke) so the button itself can reflect whether the typed
  // current password is actually correct, not just non-empty.
  const [currentCheck, setCurrentCheck] = useState('idle');
  const checkTokenRef = useRef(0);

  const strength = analyzePassword(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit =
    currentCheck === 'valid' && strength.level === 'strong' && passwordsMatch;

  async function handleCurrentBlur() {
    if (!currentPassword) {
      setCurrentCheck('idle');
      return;
    }
    const token = ++checkTokenRef.current;
    setCurrentCheck('checking');
    const { error: err } = await verifyPassword(currentPassword);
    if (token !== checkTokenRef.current) return; // a newer check superseded this one
    setCurrentCheck(err ? 'invalid' : 'valid');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (currentCheck !== 'valid') {
      showToast('Enter your current password correctly before continuing.');
      return;
    }
    if (!passwordSchema.safeParse(newPassword).success) {
      showToast('Choose a Strong new password (green bar) before continuing.');
      return;
    }
    if (!passwordsMatch) {
      showToast("The retyped password doesn't match.");
      return;
    }

    setBusy(true);
    const { error: changeErr } = await changePassword(currentPassword, newPassword);
    if (changeErr) {
      setBusy(false);
      showToast(changeErr.message);
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
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              setCurrentCheck('idle'); // any edit invalidates the last check
            }}
            onBlur={handleCurrentBlur}
            autoComplete="current-password"
            maxLength={MAX_PASSWORD_LENGTH}
          />
          {currentCheck === 'checking' && (
            <p className="mt-1 text-[11px] text-ink2">Checking…</p>
          )}
          {currentCheck === 'valid' && (
            <p className="mt-1 text-[11px] text-good">Verified.</p>
          )}
          {currentCheck === 'invalid' && (
            <p className="mt-1 text-[11px] text-bad">That's not your current password.</p>
          )}
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
        <Field label="Retype new password">
          <input
            type="password"
            className="input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            maxLength={MAX_PASSWORD_LENGTH}
          />
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="mt-1 text-[11px] text-bad">Doesn't match the new password above.</p>
          )}
        </Field>

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
  const showToast = useToast();
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const canDelete = confirmText.trim().toUpperCase() === 'DELETE ALL' && password.length > 0;

  async function handleDelete() {
    if (!canDelete) return;
    setBusy(true);
    setDone(false);

    const { error: pwErr } = await verifyPassword(password);
    if (pwErr) {
      setBusy(false);
      showToast(pwErr.message);
      return;
    }

    const { error: delErr } = await supabase.from('applications').delete().eq('user_id', user.id);
    setBusy(false);

    if (delErr) {
      showToast(delErr.message);
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
          maxLength={MAX_PASSWORD_LENGTH}
        />
      </label>

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

// Same re-authentication-before-destroying-anything pattern as
// "Delete all cards" - this one didn't ask for the account password at
// all before, which meant anyone at an already-signed-in, unlocked
// browser could wipe the whole account with nothing but the DELETE text.
function DeleteAccountCard() {
  const { signOut, verifyPassword } = useAuth();
  const navigate = useNavigate();
  const showToast = useToast();
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const canDelete = confirmText.trim().toUpperCase() === 'DELETE' && password.length > 0;

  async function handleDelete() {
    if (!canDelete) return;
    setBusy(true);

    const { error: pwErr } = await verifyPassword(password);
    if (pwErr) {
      setBusy(false);
      showToast(pwErr.message);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const { data, error: fnError } = await supabase.functions.invoke('delete-account', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (fnError || data?.error) {
      showToast(fnError?.message ?? data?.error ?? 'Could not delete your account.');
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

      <label className="mt-3 block text-xs text-ink2">
        Your password
        <input
          type="password"
          className="input mt-1"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          maxLength={MAX_PASSWORD_LENGTH}
        />
      </label>

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
