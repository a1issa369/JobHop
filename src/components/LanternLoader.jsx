// A small lantern that glows on and off on a loop, shown wherever a page
// is waiting on its first fetch (see index.css for the `lantern-glow`
// keyframes this relies on). On localhost that fetch resolves instantly
// and this barely gets a chance to appear, but once the site is actually
// deployed - a real network round trip to Supabase on every page - it's
// something better to look at than a blank beat of silence.
export default function LanternLoader({ label = 'Loading' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-ink2">
      <svg width="36" height="52" viewBox="0 0 36 52" fill="none" aria-hidden="true">
        <line x1="18" y1="0" x2="18" y2="7" stroke="#3D2C55" strokeWidth="2" />
        <rect x="12" y="5" width="12" height="4" rx="1.5" fill="#3D2C55" />
        <rect x="7" y="9" width="22" height="28" rx="7" fill="#241A38" stroke="#3D2C55" strokeWidth="2" />
        <circle cx="18" cy="23" r="7" className="lantern-flame" fill="#F2A63A" />
        <rect x="12" y="37" width="12" height="4" rx="1.5" fill="#3D2C55" />
        <line x1="18" y1="41" x2="18" y2="48" stroke="#3D2C55" strokeWidth="2" />
      </svg>
      <span>{label}…</span>
    </div>
  );
}
