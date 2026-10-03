import { useMemo } from 'react';
import {
  eachDayOfInterval,
  endOfYear,
  format,
  getDay,
  getMonth,
  startOfYear
} from 'date-fns';

// Restricted to the current year, per spec: Jan 1 -> Dec 31 of this year only.
function buildYearGrid() {
  const year = new Date().getFullYear();
  const start = startOfYear(new Date(year, 0, 1));
  const end = endOfYear(new Date(year, 0, 1));
  const days = eachDayOfInterval({ start, end });

  // Pad the front so the grid starts on a Sunday column, GitHub-style.
  const leadingBlanks = getDay(start);
  return { days, leadingBlanks, year };
}

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

export default function CalendarHeatmap({ applicationsByDate }) {
  // Recomputed on every render from `new Date()` inside buildYearGrid, so
  // this always reflects whatever year it actually is - Jan 1 of the
  // current year through Dec 31, never a fixed/hardcoded year.
  const { days, leadingBlanks, year } = useMemo(() => buildYearGrid(), []);

  const max = Math.max(1, ...Object.values(applicationsByDate));

  const weeks = useMemo(() => {
    const cells = [
      ...Array(leadingBlanks).fill(null),
      ...days.map((d) => {
        const key = format(d, 'yyyy-MM-dd');
        return { date: d, count: applicationsByDate[key] ?? 0 };
      })
    ];
    const result = [];
    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7));
    }
    return result;
  }, [days, leadingBlanks, applicationsByDate]);

  // One label per week column, shown only on the week a new month actually
  // starts - without this a bare grid of squares reads as "a wall of
  // nothing" rather than a calendar, which was the real complaint.
  const monthLabels = useMemo(() => {
    let lastMonth = -1;
    return weeks.map((week) => {
      const firstRealDay = week.find((c) => c);
      if (!firstRealDay) return '';
      const month = getMonth(firstRealDay.date);
      if (month !== lastMonth) {
        lastMonth = month;
        return format(firstRealDay.date, 'MMM');
      }
      return '';
    });
  }, [weeks]);

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

      <div className="mt-4 overflow-x-auto pb-2">
        <div className="flex gap-1">
          {monthLabels.map((label, i) => (
            <div
              key={i}
              className="w-3 flex-shrink-0 overflow-visible whitespace-nowrap text-[10px] leading-3 text-ink2"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((cell, di) =>
                cell ? (
                  <div
                    key={di}
                    title={`${format(cell.date, 'MMM d, yyyy')}: ${cell.count} application${
                      cell.count === 1 ? '' : 's'
                    }`}
                    className={`h-3 w-3 rounded-sm ${LEVEL_COLORS[levelFor(cell.count, max)]}`}
                  />
                ) : (
                  <div key={di} className="h-3 w-3" />
                )
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
