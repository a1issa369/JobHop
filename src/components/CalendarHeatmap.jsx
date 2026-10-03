import { useMemo } from 'react';
import { differenceInCalendarDays, eachDayOfInterval, endOfYear, format, getDay, startOfYear } from 'date-fns';

function levelFor(count, max) {
  if (count === 0) return 0;
  if (max <= 1) return 4;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

const LEVEL_COLORS = [
  'bg-grid/40', // 0 - no applications
  'bg-signal/25',
  'bg-signal/50',
  'bg-signal/75',
  'bg-signal'
];

// All sizing in real pixels, not Tailwind gap classes - the column spacing
// has to match EXACTLY between the cell grid and the month labels above
// it, and a mismatch there (14px cells with a 4px Tailwind gap, against
// labels positioned assuming 16px) is what made the whole strip drift out
// of alignment by the time it reached the later months.
const CELL = 14;
const GAP = 3;
const MONTH_GAP = 9; // extra breathing room between one month's columns and the next
const PITCH = CELL + GAP;

// Classic GitHub-style contribution graph: one column per week (Sunday on
// top, Saturday on the bottom) running across the whole current year, with
// a small gap opening up between months so it's visually obvious where one
// ends and the next begins, not just the label to go on.
function buildWeeks(year, leadingBlanks, applicationsByDate) {
  const start = startOfYear(new Date(year, 0, 1));
  const end = endOfYear(start);
  const days = eachDayOfInterval({ start, end });

  const cells = [
    ...Array(leadingBlanks).fill(null),
    ...days.map((d) => {
      const key = format(d, 'yyyy-MM-dd');
      return { date: d, count: applicationsByDate[key] ?? 0 };
    })
  ];

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// The week-column index that contains a given month's 1st, found by date
// arithmetic rather than by scanning each week's first cell - scanning got
// this wrong whenever a month started mid-week, since the label only
// advanced once a column's TOP (Sunday) row crossed into the new month.
function monthStartIndices(year, leadingBlanks) {
  const jan1 = startOfYear(new Date(year, 0, 1));
  return Array.from({ length: 12 }, (_, m) => {
    const firstOfMonth = new Date(year, m, 1);
    const dayIndex = differenceInCalendarDays(firstOfMonth, jan1);
    return { weekIndex: Math.floor((dayIndex + leadingBlanks) / 7), label: format(firstOfMonth, 'MMM') };
  });
}

// Every week column's left pixel offset, walking left to right and adding
// an extra MONTH_GAP right before whichever column starts a new month -
// labels and cells are both positioned from this one array, so they can
// never drift apart from each other.
function columnPositions(weekCount, monthStarts) {
  const startSet = new Set(monthStarts.map((m) => m.weekIndex));
  const positions = [];
  let x = 0;
  for (let i = 0; i < weekCount; i++) {
    if (i > 0) x += PITCH + (startSet.has(i) ? MONTH_GAP : 0);
    positions.push(x);
  }
  return positions;
}

export default function CalendarHeatmap({ applicationsByDate }) {
  // Always the real current year, computed fresh on every render.
  const year = new Date().getFullYear();
  const max = Math.max(1, ...Object.values(applicationsByDate));

  const leadingBlanks = getDay(startOfYear(new Date(year, 0, 1))); // pad so the first column starts on Sunday
  const weeks = useMemo(
    () => buildWeeks(year, leadingBlanks, applicationsByDate),
    [year, leadingBlanks, applicationsByDate]
  );
  const monthStarts = useMemo(() => monthStartIndices(year, leadingBlanks), [year, leadingBlanks]);
  const positions = useMemo(() => columnPositions(weeks.length, monthStarts), [weeks.length, monthStarts]);
  const totalWidth = (positions.at(-1) ?? 0) + CELL;

  return (
    <div className="card-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold">Activity — {year}</h3>
        <div className="flex items-center gap-1 text-[10px] text-ink2">
          <span>Less</span>
          {LEVEL_COLORS.map((c, i) => (
            <span key={i} className={`h-3 w-3 rounded-sm ${c}`} />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="relative" style={{ width: totalWidth }}>
          <div className="relative h-4">
            {monthStarts.map((m) => (
              <span
                key={m.label}
                className="absolute top-0 whitespace-nowrap text-[10px] text-ink2"
                style={{ left: positions[m.weekIndex] }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <div className="relative mt-1" style={{ height: 7 * PITCH - GAP }}>
            {weeks.map((week, wi) => (
              <div key={wi} className="absolute top-0" style={{ left: positions[wi], width: CELL }}>
                {week.map((cell, di) =>
                  cell ? (
                    <div
                      key={di}
                      title={`${format(cell.date, 'MMM d, yyyy')}: ${cell.count} application${
                        cell.count === 1 ? '' : 's'
                      }`}
                      className={`rounded-sm ${LEVEL_COLORS[levelFor(cell.count, max)]}`}
                      style={{ position: 'absolute', top: di * PITCH, width: CELL, height: CELL }}
                    />
                  ) : null
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
