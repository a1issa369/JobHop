import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import ApplicationCard from './ApplicationCard.jsx';
import { STAGES, STAGE_MAP } from '../utils/stageConfig';

const PAGE_SIZE = 12; // 3 rows x 4 columns

// The stage strip is its own row of bordered boxes, deliberately separate
// from the card grid below it - previously the stage header lived inside
// each column and ate into the same horizontal space as the cards. Now it
// never competes with the cards for room no matter how many there are.
//
// Clicking a box selects which stage's cards are shown below (with its own
// pop/border animation). Dragging a card onto a box is the only way to move
// it to that stage - dropping highlights the box while hovering, then plays
// a short pop/ring animation once released (a literal 360° spin reads oddly
// on a box full of text, so this is the "something else that fits" option).
function StageBox({ stage, count, active, justDropped, onClick }) {
  const isDroppable = stage.key !== 'all';
  const { setNodeRef, isOver } = useDroppable({
    id: stage.key,
    disabled: !isDroppable
  });

  return (
    <button
      ref={isDroppable ? setNodeRef : undefined}
      onClick={onClick}
      onAnimationEnd={(e) => e.currentTarget.classList.remove('stage-box-dropped')}
      style={{
        '--drop-ring-color': stage.color ? `${stage.color}99` : undefined,
        borderColor: active || isOver ? stage.color ?? '#9385D1' : undefined
      }}
      className={`flex flex-shrink-0 items-center gap-2 rounded-lg border-2 px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-panel text-paper shadow-sm'
          : 'border-grid bg-ink/40 text-ink2 hover:-translate-y-0.5 hover:text-paper'
      } ${isOver ? 'scale-105 bg-panel' : ''} ${justDropped ? 'stage-box-dropped' : ''}`}
    >
      {stage.color && (
        <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
      )}
      {stage.label}
      <span className="text-xs opacity-70">{count}</span>
    </button>
  );
}

export default function KanbanBoard({ applications, onCardClick, onStageChange }) {
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const [activeDragId, setActiveDragId] = useState(null);
  const [justDroppedStage, setJustDroppedStage] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
  const activeDragApp = activeDragId ? applications.find((a) => a.id === activeDragId) : null;

  // Reset to page 1 whenever the selected stage changes, or when the
  // current page is left dangling by cards moving out of the stage.
  useEffect(() => setPage(1), [activeTab]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over) return;

    const app = applications.find((a) => a.id === active.id);
    const targetStage = over.id;
    if (!STAGE_MAP[targetStage] || !app || app.stage === targetStage) return;

    onStageChange(app.id, targetStage);
    setJustDroppedStage(targetStage);
    setTimeout(() => setJustDroppedStage(null), 550);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveDragId(e.active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragId(null)}
    >
      <div>
        <div className="flex flex-wrap gap-2">
          <StageBox
            stage={{ key: 'all', label: 'All' }}
            count={applications.length}
            active={activeTab === 'all'}
            onClick={() => setActiveTab('all')}
          />
          {STAGES.map((stage) => (
            <StageBox
              key={stage.key}
              stage={stage}
              count={byStage[stage.key].length}
              active={activeTab === stage.key}
              justDropped={justDroppedStage === stage.key}
              onClick={() => setActiveTab(stage.key)}
            />
          ))}
        </div>

        {pageItems.length === 0 ? (
          <p className="mt-6 text-sm text-ink2">No applications in this stage yet.</p>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pageItems.map((app) => (
              <ApplicationCard key={app.id} application={app} onClick={onCardClick} />
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
      </div>

      <DragOverlay>
        {activeDragApp && (
          <div
            className="card-surface flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium shadow-lg"
            style={{ borderColor: STAGE_MAP[activeDragApp.stage]?.color ?? '#9385D1' }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: STAGE_MAP[activeDragApp.stage]?.color }}
            />
            {activeDragApp.company} · {activeDragApp.role}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
