import { useMemo, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import ApplicationCard from './ApplicationCard.jsx';
import { STAGES } from '../utils/stageConfig';

function Column({ stage, applications, onCardClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });

  return (
    <div className="flex w-64 flex-shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={`h-2.5 w-2.5 rounded-full ${stage.dot}`} />
        <h3 className="font-display text-sm font-semibold">{stage.label}</h3>
        <span className="ml-auto text-xs text-ink2">{applications.length}</span>
      </div>
      <div className="route-line mb-2" />
      <div
        ref={setNodeRef}
        className={`flex min-h-[120px] flex-1 flex-col gap-2 rounded-lg p-1 transition-colors ${
          isOver ? 'bg-grid/40' : ''
        }`}
      >
        <SortableContext
          items={applications.map((a) => a.id)}
          strategy={verticalListSortingStrategy}
        >
          {applications.map((app) => (
            <ApplicationCard key={app.id} application={app} onClick={onCardClick} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export default function KanbanBoard({ applications, onCardClick, onStageChange }) {
  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const byStage = useMemo(() => {
    const grouped = Object.fromEntries(STAGES.map((s) => [s.key, []]));
    for (const app of applications) {
      (grouped[app.stage] ?? grouped.wishlist).push(app);
    }
    return grouped;
  }, [applications]);

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const app = applications.find((a) => a.id === active.id);
    // `over.id` is either a column key (dropped on empty space) or another card's id.
    const targetStage = STAGES.some((s) => s.key === over.id)
      ? over.id
      : applications.find((a) => a.id === over.id)?.stage;

    if (app && targetStage && app.stage !== targetStage) {
      onStageChange(app.id, targetStage);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e) => setActiveId(e.active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <Column
            key={stage.key}
            stage={stage}
            applications={byStage[stage.key]}
            onCardClick={onCardClick}
          />
        ))}
      </div>
    </DndContext>
  );
}
