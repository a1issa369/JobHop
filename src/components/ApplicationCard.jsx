import { useDraggable } from '@dnd-kit/core';
import { format, isPast, parseISO } from 'date-fns';
import { STAGE_MAP, WORK_TYPE_MAP } from '../utils/stageConfig';

export default function ApplicationCard({ application, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: application.id,
    data: { stage: application.stage }
  });

  const stage = STAGE_MAP[application.stage];
  const deadlineSoon =
    application.deadline &&
    !isPast(parseISO(application.deadline)) &&
    new Date(application.deadline) - new Date() < 1000 * 60 * 60 * 24 * 3;

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.4 : 1,
    borderColor: `${stage?.color ?? '#5B8DB8'}66`
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onClick(application)}
      className="card-surface flex cursor-grab flex-col gap-2 border p-4 text-left shadow-sm transition-colors hover:border-y active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-base font-semibold leading-tight">
            {application.company}
          </p>
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

      {(application.follow_up_date || deadlineSoon) && (
        <div className="mt-1 flex items-center gap-2 border-t border-grid pt-2 text-[11px] text-ink2">
          {application.follow_up_date && (
            <span>Follow up: {format(parseISO(application.follow_up_date), 'MMM d')}</span>
          )}
          {deadlineSoon && (
            <span className="rounded bg-bad/20 px-1.5 py-0.5 font-medium text-bad">due soon</span>
          )}
        </div>
      )}
    </button>
  );
}
