import { useMemo } from 'react';
import { eachDayOfInterval, endOfYear, format, getDay, startOfYear } from 'date-fns';

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
function buildWeeks(year, applicationsByDate) {
  const start = startOfYear(new Date(year, 0, 1));
  const end = endOfYear(start);
  const days = eachDayOfInterval({ start, end });
  const leadingBlanks = getDay(start); // pad so the first column still starts on Sunday

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

// Picks the first week column that contains the 1st of a new month, so
// each month name appears exactly once, roughly above where it begins.
function monthLabels(weeks) {
  const labels = [];
  let lastMonth = null;
  weeks.forEach((week, i) => {
    const firstRealDay = week.find((c) => c);
    if (!firstRealDay) return;
    const month = firstRealDay.date.getMonth();
    if (month !== lastMonth) {
      labels.push({ weekIndex: i, label: format(firstRealDay.date, 'MMM') });
      lastMonth = month;
    }
  });
  return labels;
}

export default function CalendarHeatmap({ applicationsByDate }) {
  // Always the real current year, computed fresh on every render.
  const year = new Date().getFullYear();
  const max = Math.max(1, ...Object.values(applicationsByDate));

  const weeks = useMemo(() => buildWeeks(year, applicationsByDate), [year, applicationsByDate]);
  const labels = useMemo(() => monthLabels(weeks), [weeks]);

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
