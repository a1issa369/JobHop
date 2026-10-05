import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useIsAdmin } from '../hooks/useIsAdmin.js';
import ErrorBanner from '../components/ErrorBanner.jsx';
import StairsLoader from '../components/StairsLoader.jsx';
import NotFound from './NotFound.jsx';

// Owner-only. Everything on this page comes from two places that the
// database itself locks to the owner (supabase/migrations/017): the
// get_site_stats() function, which returns aggregate counts only, and the
// feedback table. The check below only decides what to render - a non-owner
// who reaches this URL would get errors back from both, not data.

function Tile({ label, value, sub }) {
  return (
    <div className="card-surface p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink2">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold text-paper">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink2">{sub}</p>}
    </div>
  );
}

function WeeklyBars({ weekly }) {
  const max = Math.max(1, ...weekly.flatMap((w) => [w.signups, w.applications]));
  return (
    <div className="card-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold">Last 8 weeks</h2>
        <div className="flex gap-3 text-[11px] text-ink2">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-route" /> Sign-ups
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-signal" /> Applications
          </span>
        </div>
      </div>
      <ul className="space-y-2">
        {weekly.map((w) => (
          <li key={w.week} className="grid grid-cols-[4.5rem_1fr] items-center gap-3 text-xs">
            <span className="text-ink2">{w.week.slice(5)}</span>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div
                  className="h-2 rounded-sm bg-route"
                  style={{ width: `${(w.signups / max) * 100}%`, minWidth: w.signups ? 4 : 0 }}
                />
                <span className="text-ink2">{w.signups}</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="h-2 rounded-sm bg-signal"
                  style={{ width: `${(w.applications / max) * 100}%`, minWidth: w.applications ? 4 : 0 }}
                />
                <span className="text-ink2">{w.applications}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-ink2">Weeks start on Monday (UTC).</p>
    </div>
  );
}

function FeedbackInbox() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('open');

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('feedback')
      .select('id, category, message, page, status, created_at, profiles(username)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (err) setError(err.message);
    else setRows(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id, status) {
    setError('');
    const { error: err } = await supabase.from('feedback').update({ status }).eq('id', id);
    if (err) setError(err.message);
    else setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  async function remove(id) {
    setError('');
    const { error: err } = await supabase.from('feedback').delete().eq('id', id);
    if (err) setError(err.message);
    else setRows((rs) => rs.filter((r) => r.id !== id));
  }

  const shown = useMemo(
    () => (rows ?? []).filter((r) => (filter === 'open' ? r.status !== 'done' : true)),
    [rows, filter]
  );

  return (
    <div className="card-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold">Feedback inbox</h2>
        <div className="flex gap-1 text-xs">
          {['open', 'all'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-2.5 py-1 ${
                filter === f ? 'bg-signal text-ink' : 'text-ink2 hover:text-paper'
              }`}
            >
              {f === 'open' ? 'Open' : 'All'}
            </button>
          ))}
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {rows === null ? (
        <p className="text-sm text-ink2">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-ink2">Nothing here.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => (
            <li key={r.id} className="rounded border border-grid p-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink2">
                <span
                  className={`rounded px-1.5 py-0.5 font-semibold ${
                    r.category === 'bug' ? 'bg-bad/20 text-bad' : 'bg-route/20 text-route'
                  }`}
                >
                  {r.category}
                </span>
                {r.status === 'new' && <span className="font-semibold text-signal">new</span>}
                <span>@{r.profiles?.username ?? 'unknown'}</span>
                {r.page && <span>from {r.page}</span>}
                <span>{new Date(r.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-paper">{r.message}</p>
              <div className="mt-2 flex gap-3 text-xs">
                {r.status === 'new' && (
                  <button onClick={() => setStatus(r.id, 'seen')} className="text-ink2 hover:text-paper">
                    Mark seen
                  </button>
                )}
                {r.status !== 'done' ? (
                  <button onClick={() => setStatus(r.id, 'done')} className="text-good hover:underline">
                    Done
                  </button>
                ) : (
                  <button onClick={() => setStatus(r.id, 'new')} className="text-ink2 hover:text-paper">
                    Reopen
                  </button>
                )}
                <button onClick={() => remove(r.id)} className="text-ink2 hover:text-bad">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Admin() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [includeTest, setIncludeTest] = useState(false);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    setError('');
    const { data, error: err } = await supabase.rpc('get_site_stats', {
      p_exclude_flagged: !includeTest
    });
    if (err) setError(err.message);
    else setStats(data);
  }, [includeTest]);

  useEffect(() => {
    if (isAdmin) loadStats();
  }, [isAdmin, loadStats]);

  if (adminLoading) return <StairsLoader label="Loading" />;
  if (!isAdmin) return <NotFound />;

  const advancedPct =
    stats && stats.applications_total > 0
      ? `${Math.round((stats.applications_advanced / stats.applications_total) * 100)}%`
      : '-';

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Site stats</h1>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-ink2">
          <input
            type="checkbox"
            checked={includeTest}
            onChange={(e) => setIncludeTest(e.target.checked)}
          />
          Include my test accounts
          {stats && !includeTest && stats.excluded_accounts > 0 && (
            <span>({stats.excluded_accounts} left out)</span>
          )}
        </label>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {!stats && !error && <StairsLoader label="Loading stats" />}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Users" value={stats.users_total} sub={`${stats.users_7d} new in 7 days`} />
            <Tile label="Active (7 days)" value={stats.active_users_7d} sub="added or moved a card" />
            <Tile
              label="Applications"
              value={stats.applications_total}
              sub={`${stats.applications_7d} in 7 days`}
            />
            <Tile label="Reached interview+" value={advancedPct} sub="assessment, screen, onsite, offer" />
            <Tile
              label="Duels"
              value={stats.duels_completed}
              sub={`completed of ${stats.duels_total}`}
            />
            <Tile label="Follows" value={stats.follows_total} />
            <Tile label="Resumes uploaded" value={stats.resumes_uploaded} />
            <Tile label="New feedback" value={stats.feedback_new} />
          </div>

          <WeeklyBars weekly={stats.weekly} />

        </>
      )}

      <FeedbackInbox />
    </div>
  );
}
