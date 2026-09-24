import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';
import KanbanBoard from '../components/KanbanBoard.jsx';
import ApplicationModal from '../components/ApplicationModal.jsx';
import ConversionChart from '../components/ConversionChart.jsx';
import { withRateLimit, RateLimitError } from '../lib/rateLimiter.js';

export default function Dashboard() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [stageHistory, setStageHistory] = useState([]);
  const [modalState, setModalState] = useState(null); // null | 'new' | application object
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: apps, error: appsErr }, { data: history, error: histErr }] = await Promise.all([
      supabase.from('applications').select('*').eq('user_id', user.id).order('created_at'),
      supabase
        .from('stage_history')
        .select('application_id, to_stage, from_stage, changed_at')
        .eq('user_id', user.id)
    ]);
    if (appsErr) setError(appsErr.message);
    if (histErr) setError(histErr.message);
    setApplications(apps ?? []);
    setStageHistory(history ?? []);
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleStageChange(applicationId, newStage) {
    const previous = applications;
    // Optimistic update so the drag feels instant...
    setApplications((prev) =>
      prev.map((a) => (a.id === applicationId ? { ...a, stage: newStage } : a))
    );

    const app = applications.find((a) => a.id === applicationId);
    const { error: updateErr } = await supabase
      .from('applications')
      .update({ stage: newStage, updated_at: new Date().toISOString() })
      .eq('id', applicationId);

    if (updateErr) {
      // ...and rolled back if the server rejects it (RLS, network, etc.)
      setApplications(previous);
      setError('Could not move that card — it snapped back. ' + updateErr.message);
      return;
    }

    await supabase.from('stage_history').insert({
      application_id: applicationId,
      user_id: user.id,
      from_stage: app?.stage,
      to_stage: newStage
    });
    loadData();
  }

  async function handleSave(values) {
    try {
      if (values.id) {
        const { error: updateErr } = await withRateLimit(
          `update_app:${user.id}`,
          { max: 40, windowMs: 60_000 },
          () => supabase.from('applications').update(values).eq('id', values.id)
        );
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await withRateLimit(
          `create_app:${user.id}`,
          { max: 20, windowMs: 60_000 },
          () => supabase.from('applications').insert({ ...values, user_id: user.id })
        );
        if (insertErr) throw insertErr;
      }
      setModalState(null);
      loadData();
    } catch (err) {
      setError(err instanceof RateLimitError ? err.message : err.message);
    }
  }

  async function handleDelete(id) {
    const { error: delErr } = await supabase.from('applications').delete().eq('id', id);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    setModalState(null);
    loadData();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Your route</h1>
          <p className="text-sm text-ink2">Drag cards between stages as things move.</p>
        </div>
        <button onClick={() => setModalState('new')} className="btn-primary">
          + New application
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-ink2">Loading board…</p>
      ) : (
        <>
          <KanbanBoard
            applications={applications}
            onCardClick={(app) => setModalState(app)}
            onStageChange={handleStageChange}
          />
          <div className="mt-6">
            <ConversionChart applications={applications} stageHistory={stageHistory} />
          </div>
        </>
      )}

      {modalState && (
        <ApplicationModal
          initial={modalState === 'new' ? null : modalState}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  );
}
