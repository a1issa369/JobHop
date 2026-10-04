// Four ascending bars - echoing the app's own logo - that rise into view
// one at a time, left to right, then fade and loop. Shown wherever a page
// is waiting on its first fetch (see index.css for the `stair-step`
// keyframes this relies on, staggered per bar via animationDelay below).
// Replaces the earlier lantern-flame loader.
export default function StairsLoader({ label = 'Loading' }) {
  const bars = [
    { x: 2, y: 26, height: 12 },
    { x: 16, y: 18, height: 20 },
    { x: 30, y: 10, height: 28 },
    { x: 44, y: 2, height: 36 }
  ];

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-ink2">
      <svg width="56" height="40" viewBox="0 0 56 40" fill="none" aria-hidden="true">
        {bars.map((bar, i) => (
          <rect
            key={bar.x}
            x={bar.x}
            y={bar.y}
            width="10"
            height={bar.height}
            rx="2"
            fill="#9385D1"
            className="stair-step"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </svg>
      <span>{label}…</span>
    </div>
  );
}
