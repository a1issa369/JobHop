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

// Classic GitHub-style contribution graph: one column per week (Sunday on
// top, Saturday on the bottom) running across the whole current year, with
// a month label over the column where that month starts. Back to this
// layout (rather than a 12-block month grid) since it's the one that
// actually fit cleanly in the page.
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

// Places each month's label directly over the column that contains that
// month's 1st, found by date arithmetic rather than by scanning each
// week's first cell. Scanning the first cell got this wrong whenever a
// month started mid-week: the label only advanced once a column's TOP
// (Sunday) row crossed into the new month, so e.g. December's label
// showed up a column later than December 1st actually sat, out of step
// with the cells underneath it.
function monthLabels(year, leadingBlanks) {
  const jan1 = startOfYear(new Date(year, 0, 1));
  return Array.from({ length: 12 }, (_, m) => {
    const firstOfMonth = new Date(year, m, 1);
    const dayIndex = differenceInCalendarDays(firstOfMonth, jan1);
    const weekIndex = Math.floor((dayIndex + leadingBlanks) / 7);
    return { weekIndex, label: format(firstOfMonth, 'MMM') };
  });
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
  const labels = useMemo(() => monthLabels(year, leadingBlanks), [year, leadingBlanks]);

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
        <div className="relative" style={{ width: weeks.length * 16 }}>
          <div className="relative h-4">
            {labels.map((l) => (
              <span
                key={l.weekIndex}
                className="absolute top-0 whitespace-nowrap text-[10px] text-ink2"
                style={{ left: l.weekIndex * 16 }}
              >
                {l.label}
              </span>
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
                      className={`h-3.5 w-3.5 rounded-sm ${LEVEL_COLORS[levelFor(cell.count, max)]}`}
                    />
                  ) : (
                    <div key={di} className="h-3.5 w-3.5" />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
