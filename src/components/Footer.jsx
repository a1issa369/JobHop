import { Link } from 'react-router-dom';

// Deliberately tiny and out of the way - this exists so the independent-
// project/no-affiliation disclaimer (see Terms.jsx) has a presence on every
// page, not just for someone who happens to click into Terms, without
// competing for attention with the actual app above it.
export default function Footer() {
  return (
    <footer className="mx-auto max-w-[1600px] px-6 pb-6 pt-2 text-center text-[11px] text-ink2/70">
      <p>
        JobHop is an independent, student-built project - not affiliated with, sponsored by, or
        endorsed by any third-party company or platform.{' '}
        <Link to="/terms" className="hover:text-ink2 hover:underline">
          Terms
        </Link>{' '}
        ·{' '}
        <Link to="/privacy" className="hover:text-ink2 hover:underline">
          Privacy
        </Link>
      </p>
    </footer>
  );
}
