import Avatar from './Avatar.jsx';

// Two avatars facing off across a VS badge. Amber (signal) always marks
// "your" side and violet (route) always marks the opponent's - the same
// two colors carry through the record bar and the tug-of-war progress bar
// below, so a duel reads the same way at a glance everywhere it appears.
export default function DuelVersus({ leftUrl, rightUrl, size = 40 }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar url={leftUrl} size={size} ring="ring-2 ring-signal" />
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-grid font-display text-[9px] font-bold text-paper">
        VS
      </span>
      <Avatar url={rightUrl} size={size} ring="ring-2 ring-route" />
    </div>
  );
}
