import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';
import { withRateLimit } from '../lib/rateLimiter.js';
import { SUPPORT_EMAIL } from '../utils/site.js';
import ErrorBanner from '../components/ErrorBanner.jsx';

const MIN_LEN = 5;
const MAX_LEN = 2000;

const CATEGORIES = [
  { key: 'bug', label: 'Something is broken' },
  { key: 'idea', label: 'Idea or request' },
  { key: 'other', label: 'Other' }
];

// Only the top-level section ("/friends", "/settings") is kept, not the full
// path - that's enough to know where someone was when something went wrong,
// without recording which profile they happened to be looking at.
function sectionOf(pathname) {
  const first = (pathname || '/').split('/')[1];
  return first ? `/${first}` : '/';
}

export default function Feedback() {
  const { user } = useAuth();
  const location = useLocation();
  const [category, setCategory] = useState('bug');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const trimmed = message.trim();
  const tooShort = trimmed.length < MIN_LEN;

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy || tooShort) return;
    setBusy(true);
    setError('');
    try {
      const { error: rpcErr } = await withRateLimit(
        `feedback:${user.id}`,
        { max: 5, windowMs: 3_600_000 },
        () =>
          supabase.rpc('submit_feedback', {
            p_category: category,
            p_message: trimmed,
            p_page: sectionOf(location.state?.from)
          })
      );
      if (rpcErr) throw rpcErr;
      setSent(true);
      setMessage('');
    } catch (err) {
      setError(err.message || 'Could not send that. Please try again.');
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-xl pb-16">
      <div className="card-surface p-6 sm:p-8">
        <h1 className="font-display text-2xl font-semibold">Feedback &amp; bug reports</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink2">
          JobHop is a solo student project, so a note about what broke (or what would make it
          better) genuinely helps. It goes straight to the person who builds it.
        </p>

        {!user ? (
          <p className="mt-6 rounded-lg border border-grid bg-ink/40 p-3 text-sm text-ink2">
            <Link to="/login" className="text-signal hover:underline">
              Sign in
            </Link>{' '}
            to send feedback from here, or email {SUPPORT_EMAIL}.
          </p>
        ) : sent ? (
          <div className="mt-6 rounded-lg border border-good/40 bg-good/10 p-4 text-sm text-paper">
            <p className="font-semibold">Thanks, that was sent.</p>
            <button onClick={() => setSent(false)} className="btn-secondary mt-3 text-xs">
              Send another
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <ErrorBanner message={error} onDismiss={() => setError('')} />

            <fieldset>
              <legend className="mb-2 text-xs font-medium text-ink2">What kind of note is it?</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <label
                    key={c.key}
                    className={`cursor-pointer rounded border px-3 py-1.5 text-xs transition-colors ${
                      category === c.key
                        ? 'border-signal bg-signal/10 text-paper'
                        : 'border-grid text-ink2 hover:text-paper'
                    }`}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={c.key}
                      checked={category === c.key}
                      onChange={() => setCategory(c.key)}
                      className="sr-only"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="feedback-message" className="mb-1 block text-xs font-medium text-ink2">
                {category === 'bug' ? 'What happened, and what did you expect?' : 'Tell me more'}
              </label>
              <textarea
                id="feedback-message"
                className="input min-h-[140px]"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={MAX_LEN}
                placeholder={
                  category === 'bug'
                    ? 'e.g. On my phone the profile card is missing on someone’s page.'
                    : ''
                }
              />
              <p className="mt-1 text-right text-[11px] text-ink2">
                {trimmed.length}/{MAX_LEN}
              </p>
            </div>

            <p className="text-[11px] leading-relaxed text-ink2">
              This is saved with your account and the section of the site you came from (like
              &ldquo;/friends&rdquo;), so it can be followed up on. Please don&rsquo;t include
              passwords or anything sensitive.
            </p>

            <button type="submit" disabled={busy || tooShort} className="btn-primary">
              {busy ? 'Sending…' : 'Send'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
