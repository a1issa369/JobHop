import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { format, isPast, parseISO } from 'date-fns';
import { supabase } from '../lib/supabaseClient';
import { STAGES, STAGE_MAP, WORK_TYPE_MAP } from '../utils/stageConfig';

const PAGE_SIZE = 12;

// A plain, non-draggable read-only version of ApplicationCard - deliberately
// not the real one, which calls useDraggable() and expects a DndContext
// ancestor. There's no drag-and-drop here at all, just browsing.
function ReadOnlyCard({ application, onClick }) {
  const stage = STAGE_MAP[application.stage];
  const deadlineSoon =
    application.deadline &&
    !isPast(parseISO(application.deadline)) &&
    new Date(application.deadline) - new Date() < 1000 * 60 * 60 * 24 * 3;

  return (
    <button
      onClick={() => onClick(application)}
      style={{ borderColor: `${stage?.color ?? '#5B8DB8'}66` }}
      className="card-surface flex flex-col gap-2 border p-4 text-left shadow-sm transition-colors hover:border-y"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-base font-semibold leading-tight">{application.company}</p>
          <p className="mt-0.5 text-xs text-ink2">{application.role}</p>
          {(application.location || application.work_type) && (
            <p className="mt-0.5 text-[11px] text-ink2/80">
              {[application.location, WORK_TYPE_MAP[application.work_type]?.label]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
        <span
          className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: `${stage?.color}26`, color: stage?.color }}
        >
          {stage?.label}
        </span>
      </div>

      {application.deadline && (
        <div className="mt-1 flex items-center gap-2 border-t border-grid pt-2 text-[11px] text-ink2">
          <span>Deadline: {format(parseISO(application.deadline), 'MMM d')}</span>
          {deadlineSoon && (
            <span className="rounded bg-bad/20 px-1.5 py-0.5 font-medium text-bad">due soon</span>
          )}
        </div>
      )}
    </button>
  );
}

// Read-only detail popup - same fields as ApplicationModal shows, no form,
// no Save/Delete.
function ReadOnlyDetail({ application, onClose }) {
  const stage = STAGE_MAP[application.stage];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card-surface w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{application.company}</h2>
          <button onClick={onClose} className="text-ink2 hover:text-paper" aria-label="Close">
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-ink2">{application.role}</p>
        <span
          className="mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ backgroundColor: `${stage?.color}26`, color: stage?.color }}
        >
          {stage?.label}
        </span>
        <div className="mt-4 space-y-2 text-sm">
          {(application.location || application.work_type) && (
            <p className="text-ink2">
              {[application.location, WORK_TYPE_MAP[application.work_type]?.label].filter(Boolean).join(' · ')}
            </p>
          )}
          {application.deadline && (
            <p className="text-ink2">Deadline: {format(parseISO(application.deadline), 'MMM d, yyyy')}</p>
          )}
          {application.notes && <p className="whitespace-pre-wrap text-ink2">{application.notes}</p>}
        </div>
      </div>
    </div>
  );
}

// Read-only mirror of your own Board (Dashboard.jsx) for whoever's profile
// you're viewing - same stage tabs and pagination, no drag, no edit, no
// "+ New application". Empty + isInActiveDuel means the RLS policy is the
// one actually hiding the rows (you're mid-duel with this person), not that
// they have no applications - different message for that case.
export default function ViewedBoard() {
  const { profile, isInActiveDuel } = useOutletContext();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at');
      if (!cancelled) {
        setApplications(data ?? []);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [profile.id]);

  const byStage = useMemo(() => {
    const grouped = Object.fromEntries(STAGES.map((s) => [s.key, []]));
    for (const app of applications) {
      (grouped[app.stage] ?? grouped.wishlist).push(app);
    }
    return grouped;
  }, [applications]);

  const visible = activeTab === 'all' ? applications : byStage[activeTab] ?? [];
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [activeTab]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (loading) return <p className="text-sm text-ink2">Loading board…</p>;

  if (applications.length === 0 && isInActiveDuel) {
    return (
      <div className="card-surface p-6 text-center text-sm text-ink2">
        This board is hidden for the duration of your duel - check back once it ends.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-semibold">
          {(profile.full_name || profile.username)}'s board
        </h1>
        <p className="text-sm text-ink2">Read-only - click a card to see its details.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex flex-shrink-0 items-center gap-2 rounded-lg border-2 px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
            activeTab === 'all' ? 'bg-panel text-paper shadow-sm' : 'border-grid bg-ink/40 text-ink2 hover:-translate-y-0.5 hover:text-paper'
          }`}
        >
          All <span className="text-xs opacity-70">{applications.length}</span>
        </button>
        {STAGES.map((stage) => (
          <button
            key={stage.key}
            onClick={() => setActiveTab(stage.key)}
            style={{ borderColor: activeTab === stage.key ? stage.color : undefined }}
            className={`flex flex-shrink-0 items-center gap-2 rounded-lg border-2 px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
              activeTab === stage.key ? 'bg-panel text-paper shadow-sm' : 'border-grid bg-ink/40 text-ink2 hover:-translate-y-0.5 hover:text-paper'
            }`}
          >
            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
            {stage.label} <span className="text-xs opacity-70">{byStage[stage.key].length}</span>
          </button>
        ))}
      </div>

      {pageItems.length === 0 ? (
        <p className="mt-6 text-sm text-ink2">No applications in this stage.</p>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {pageItems.map((app) => (
            <ReadOnlyCard key={app.id} application={app} onClick={setDetail} />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-ink2">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            className="btn-secondary px-3 py-1 text-xs"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <button
            className="btn-secondary px-3 py-1 text-xs"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>

      {detail && <ReadOnlyDetail application={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
