import DefaultAvatar from './DefaultAvatar.jsx';

// Small reusable circular avatar with the default-icon fallback, used
// anywhere two people need to be shown side by side (duel cards, the
// followers modal) without re-deriving the same markup each time.
export default function Avatar({ url, size = 36, ring = '' }) {
  const dim = { width: size, height: size };
  return url ? (
    <img src={url} alt="" style={dim} className={`flex-shrink-0 rounded-full object-cover ${ring}`} />
  ) : (
    <span
      style={dim}
      className={`flex flex-shrink-0 items-center justify-center rounded-full bg-panel ${ring}`}
    >
      <DefaultAvatar className="h-[60%] w-[60%]" />
    </span>
  );
}
