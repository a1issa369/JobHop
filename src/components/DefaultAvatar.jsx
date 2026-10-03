// A generic grey silhouette, shown whenever a profile has no avatar_url yet
// (i.e. the person hasn't set one in Settings) instead of a colored
// initial-letter circle. Used by ProfileSidebar, Navbar's AvatarLink, and
// the Profile page so "no edits made yet" looks the same everywhere.
export default function DefaultAvatar({ className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`text-ink2/60 ${className}`}
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8v1H4v-1z" />
    </svg>
  );
}
