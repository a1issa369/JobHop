// "Add friend" glyph - a person with a plus at the shoulder - matching
// DefaultAvatar's plain currentColor-fill style rather than pulling in an
// icon library for one icon.
export default function IconUserPlus({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="10" cy="8" r="4" />
      <path d="M2 20c0-4.418 3.582-8 8-8s8 3.582 8 8v1H2v-1z" />
      <path
        d="M19 4v4m-2-2h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
