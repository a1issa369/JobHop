import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, isPast, parseISO } from 'date-fns';
import { STAGE_MAP } from '../utils/stageConfig';

export default function ApplicationCard({ application, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: application.id
  });

  const stage = STAGE_MAP[application.stage];
  const deadlineSoon =
    application.deadline && !isPast(parseISO(application.deadline)) &&
    new Date(application.deadline) - new Date() < 1000 * 60 * 60 * 24 * 3;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderLeftColor: stage?.color ?? '#5B8DB8'
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(application)}
      className="card-surface cursor-grab border-l-4 p-3 shadow-sm hover:border-y hover:border-r hover:border-grid active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-sm font-semibold leading-tight">{application.company}</p>
        {deadlineSoon && (
          <span className="rounded bg-bad/20 px-1.5 py-0.5 text-[10px] font-medium text-bad">
            due soon
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-ink2">{application.role}</p>

      {application.follow_up_date && (
        <p className="mt-2 text-[11px] text-ink2">
          Follow up: {format(parseISO(application.follow_up_date), 'MMM d')}
        </p>
      )}
    </div>
  );
}
