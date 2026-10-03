import { useMemo } from 'react';
import { eachDayOfInterval, endOfMonth, format, getDay, startOfMonth } from 'date-fns';

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

const WEEKDAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// One real month-shaped grid per month (Sun...Sat column headers, weeks as
// rows underneath) rather than one continuous GitHub-style strip - laid
// out like a page-per-month wall calendar instead of a year-long ribbon.
function buildMonthWeeks(year, monthIndex, applicationsByDate) {
  const start = startOfMonth(new Date(year, monthIndex, 1));
  const end = endOfMonth(start);
  const days = eachDayOfInterval({ start, end });
  const leadingBlanks = getDay(start);

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

export default function CalendarHeatmap({ applicationsByDate }) {
  // Always the real current year, computed fresh on every render - never a
  // fixed/hardcoded year.
  const year = new Date().getFullYear();
  const max = Math.max(1, ...Object.values(applicationsByDate));

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        index: i,
        label: format(new Date(year, i, 1), 'MMMM'),
        weeks: buildMonthWeeks(year, i, applicationsByDate)
      })),
    [year, applicationsByDate]
  );

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

      <div className="mt-4 grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {months.map((m) => (
          <div key={m.index}>
            <p className="mb-2 text-xs font-semibold text-ink2">{m.label}</p>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAY_HEADERS.map((h, i) => (
                <div key={i} className="text-center text-[9px] leading-3 text-ink2/70">
                  {h}
                </div>
              ))}
              {m.weeks.flatMap((week, wi) =>
                week.map((cell, di) =>
                  cell ? (
                    <div
                      key={`${wi}-${di}`}
                      title={`${format(cell.date, 'MMM d, yyyy')}: ${cell.count} application${
                        cell.count === 1 ? '' : 's'
                      }`}
                      className={`h-3.5 w-3.5 rounded-sm ${LEVEL_COLORS[levelFor(cell.count, max)]}`}
                    />
                  ) : (
                    <div key={`${wi}-${di}`} className="h-3.5 w-3.5" />
                  )
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
