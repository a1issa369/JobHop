import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useProfileContext } from '../context/ProfileContext.jsx';
import { useViewedProfile } from '../context/ViewedProfileContext.jsx';
import { useFollowStats } from '../hooks/useFollowStats.js';
import { getResumeSignedUrl, uploadResume } from '../utils/resume.js';
import ChallengeWidget from './ChallengeWidget.jsx';
import DefaultAvatar from './DefaultAvatar.jsx';
import FollowersModal from './FollowersModal.jsx';

// Small shared row: "123 followers" / "456 following" as two buttons that
// open the followers/following modal scoped to whichever profile this
// sidebar is showing - used by both the own-profile and viewed-profile cards
// so the same Instagram-style browsing works either way.
function FollowCounts({ userId, followers, following }) {
  const [modal, setModal] = useState(null); // 'followers' | 'following' | null
  return (
    <>
      <div className="mt-3 flex justify-center gap-4 border-y border-grid py-2.5 text-sm">
        <button onClick={() => setModal('followers')} className="hover:underline">
          <span className="font-semibold text-paper">{followers}</span>{' '}
          <span className="text-ink2">follower{followers === 1 ? '' : 's'}</span>
        </button>
        <button onClick={() => setModal('following')} className="hover:underline">
          <span className="font-semibold text-paper">{following}</span>{' '}
          <span className="text-ink2">following</span>
        </button>
      </div>
      {modal && <FollowersModal userId={userId} initialTab={modal} onClose={() => setModal(null)} />}
    </>
  );
}

const ASIDE_CLASS = 'hidden w-96 flex-shrink-0 lg:block';

// Stays mounted alongside the routed page content (see App.jsx) rather than
// living inside any one page, so it's present - and keeps its own state -
// across every screen instead of re-fetching each time you navigate.
//
// Normally shows YOUR OWN profile. But while a friend's profile page is
// open, ViewedProfileContext is set to their data, and this renders a
// read-only card for THEM instead - so the card on the left always matches
// whoever's page you're actually looking at.
export default function ProfileSidebar() {
  const { viewed } = useViewedProfile();
  if (viewed) return <ViewedProfileCard viewed={viewed} />;
  return <OwnProfileCard />;
}

function ViewedProfileCard({ viewed }) {
  if (viewed.loading) {
    return (
      <aside className={ASIDE_CLASS}>
        <div className="sticky top-20 card-surface p-5 text-sm text-ink2">Loading profile…</div>
      </aside>
    );
  }

  if (viewed.error || !viewed.profile) {
    return (
      <aside className={ASIDE_CLASS}>
        <div className="sticky top-20 card-surface p-5 text-sm">
          <p className="text-bad">Couldn't load this profile.</p>
          {viewed.error && <p className="mt-1 text-xs text-ink2">{viewed.error}</p>}
        </div>
      </aside>
    );
  }

  const { profile, resumeUrl } = viewed;
  const displayName = profile.full_name || profile.username;
  const { user } = useAuth();
  const { followers, following, amFollowing, loading: statsLoading, busy, follow, unfollow } =
    useFollowStats(profile.id);
  const isSelf = user?.id === profile.id;

  return (
    <aside className={ASIDE_CLASS}>
      <div className="sticky top-20 space-y-4">
        <div className="card-surface p-5 text-center">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="mx-auto h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-panel">
              <DefaultAvatar className="h-10 w-10" />
            </span>
          )}

          <p className="mt-3 font-display text-lg font-semibold leading-tight">{displayName}</p>
          <p className="text-sm text-ink2">@{profile.username}</p>
          {profile.school && <p className="mt-1 text-xs text-ink2">{profile.school}</p>}

          <FollowCounts userId={profile.id} followers={followers} following={following} />

          {!isSelf && (
            <button
              onClick={() => (amFollowing ? unfollow() : follow())}
              disabled={statsLoading || busy}
              className={amFollowing ? 'btn-secondary mt-3 w-full text-xs' : 'btn-primary mt-3 w-full text-xs'}
            >
              {busy ? '…' : amFollowing ? 'Following' : 'Follow'}
            </button>
          )}

          {(profile.linkedin_url || profile.github_url) && (
            <div className="mt-3 flex justify-center gap-3 text-xs">
              {profile.linkedin_url && (
                <a
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-signal hover:underline"
                >
                  LinkedIn
                </a>
              )}
              {profile.github_url && (
                <a
                  href={profile.github_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-signal hover:underline"
                >
                  GitHub
                </a>
              )}
            </div>
          )}
        </div>

        {!isSelf && <ChallengeWidget targetId={profile.id} targetName={displayName} />}

        {/* Entirely absent (not even a placeholder) if they haven't
            uploaded a resume - nothing to show, so nothing is shown. */}
        {resumeUrl && (
          <div className="card-surface p-5">
            <h3 className="font-display text-sm font-semibold">Resume</h3>
            <a
              href={resumeUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block text-sm text-signal hover:underline"
            >
              View resume →
            </a>
          </div>
        )}
      </div>
    </aside>
  );
}

function OwnProfileCard() {
  const { user } = useAuth();
  const { profile, followers, following, loading, error, refresh } = useProfileContext();
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const fileInputRef = useRef(null);

  // "Still fetching" and "fetch failed" are different states - conflating
  // them is what made this sidebar get stuck on "Loading profile..."
  // forever when the query errored (e.g. a migration hadn't been run yet).
  if (loading) {
    return (
      <aside className={ASIDE_CLASS}>
        <div className="sticky top-20 card-surface p-5 text-sm text-ink2">Loading profile…</div>
      </aside>
    );
  }

  if (error || !profile) {
    return (
      <aside className={ASIDE_CLASS}>
        <div className="sticky top-20 card-surface p-5 text-sm">
          <p className="text-bad">Couldn't load your profile.</p>
          <p className="mt-1 text-xs text-ink2">{error?.message ?? 'Unknown error.'}</p>
          <button onClick={refresh} className="btn-secondary mt-3 w-full text-xs">
            Try again
          </button>
        </div>
      </aside>
    );
  }

  const displayName = profile.full_name || profile.username;

  async function handleResumeChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setResumeBusy(true);
    setResumeError('');
    const { error: uploadErr } = await uploadResume(user.id, file);
    setResumeBusy(false);
    if (uploadErr) {
      setResumeError(uploadErr.message);
      return;
    }
    refresh();
  }

  async function handleViewResume() {
    const url = await getResumeSignedUrl(profile.resume_url);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <aside className={ASIDE_CLASS}>
      <div className="sticky top-20 space-y-4">
        <div className="card-surface p-5 text-center">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="mx-auto h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-panel">
              <DefaultAvatar className="h-10 w-10" />
            </span>
          )}

          <p className="mt-3 font-display text-lg font-semibold leading-tight">{displayName}</p>
          <p className="text-sm text-ink2">@{profile.username}</p>
          {profile.school && <p className="mt-1 text-xs text-ink2">{profile.school}</p>}

          <FollowCounts userId={user.id} followers={followers} following={following} />

          {(profile.linkedin_url || profile.github_url) && (
            <div className="mt-3 flex justify-center gap-3 text-xs">
              {profile.linkedin_url && (
                <a
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-signal hover:underline"
                >
                  LinkedIn
                </a>
              )}
              {profile.github_url && (
                <a
                  href={profile.github_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-signal hover:underline"
                >
                  GitHub
                </a>
              )}
            </div>
          )}

          <Link to="/settings" className="btn-secondary mt-4 block w-full text-xs">
            Edit profile
          </Link>
        </div>

        <div className="card-surface p-5">
          <h3 className="font-display text-sm font-semibold">Resume</h3>
          <p className="mt-1 text-xs text-ink2">PDF only, up to 8MB.</p>

          {profile.resume_url && (
            <button
              onClick={handleViewResume}
              className="mt-3 block text-sm text-signal hover:underline"
            >
              View resume →
            </button>
          )}

          {resumeError && <p className="mt-2 text-xs text-bad">{resumeError}</p>}

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleResumeChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={resumeBusy}
            className="btn-secondary mt-3 w-full text-xs"
          >
            {resumeBusy ? 'Uploading…' : profile.resume_url ? 'Replace resume' : 'Upload resume'}
          </button>
        </div>
      </div>
    </aside>
  );
}
