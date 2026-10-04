import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';
import KanbanBoard from '../components/KanbanBoard.jsx';
import ApplicationModal from '../components/ApplicationModal.jsx';
import ConversionChart from '../components/ConversionChart.jsx';
import SankeyFlowChart from '../components/SankeyFlowChart.jsx';
import { withRateLimit, RateLimitError } from '../lib/rateLimiter.js';
import StairsLoader from '../components/StairsLoader.jsx';

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
    const app = applications.find((a) => a.id === applicationId);
    if (!app) return;

    // Optimistic update so dropping a card on a stage box feels instant...
    setApplications((prev) =>
      prev.map((a) => (a.id === applicationId ? { ...a, stage: newStage } : a))
    );

    const { error: updateErr } = await supabase
      .from('applications')
      .update({ stage: newStage, updated_at: new Date().toISOString() })
      .eq('id', applicationId);

    if (updateErr) {
      // ...and rolled back if the server rejects it (RLS, network, etc.)
      setApplications(previous);
      setError('Could not move that card - it snapped back. ' + updateErr.message);
      return;
    }

    await supabase.from('stage_history').insert({
      application_id: applicationId,
      user_id: user.id,
      from_stage: app.stage,
      to_stage: newStage
    });
    loadData();
  }

  async function handleSave(values) {
    const previous = applications;
    const existing = values.id ? applications.find((a) => a.id === values.id) : null;
    const stageChanged = Boolean(existing) && existing.stage !== values.stage;

    // Optimistic update so editing a card (including moving its stage from
    // the Stage field) feels instant; rolled back below if the write fails.
    if (values.id) {
      setApplications((prev) =>
        prev.map((a) => (a.id === values.id ? { ...a, ...values } : a))
      );
    }

    try {
      if (values.id) {
        const { error: updateErr } = await withRateLimit(
          `update_app:${user.id}`,
          { max: 40, windowMs: 60_000 },
          () => supabase.from('applications').update(values).eq('id', values.id)
        );
        if (updateErr) throw updateErr;

        // Stage changes now happen through this form (there's no drag
        // target to log a transition from anymore), so this is the only
        // place stage_history gets written - and it's what feeds the
        // Sankey chart's Applied → Assessment/Interview/Offer/Rejected flow.
        if (stageChanged) {
          await supabase.from('stage_history').insert({
            application_id: values.id,
            user_id: user.id,
            from_stage: existing.stage,
            to_stage: values.stage
          });
        }
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
      if (values.id) setApplications(previous);
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
          <p className="text-sm text-ink2">
            Click a stage to browse its cards, or drag a card onto a stage to move it.
          </p>
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
        <StairsLoader label="Loading board" />
      ) : (
        <>
          <KanbanBoard
            applications={applications}
            onCardClick={(app) => setModalState(app)}
            onStageChange={handleStageChange}
          />
          <div className="mt-6 space-y-6">
            <SankeyFlowChart applications={applications} stageHistory={stageHistory} />
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
