import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { ProfileProvider } from './context/ProfileContext.jsx';
import { ViewedProfileProvider } from './context/ViewedProfileContext.jsx';
import { NotificationsProvider } from './context/NotificationsContext.jsx';
import { SocialGraphProvider } from './context/SocialGraphContext.jsx';
import Navbar from './components/Navbar.jsx';
import ProfileSidebar from './components/ProfileSidebar.jsx';

// Route-level code splitting: each page only downloads once someone
// actually navigates there, instead of every page (plus chart.js, pulled in
// by the Dashboard/Profile/ViewedOverview charts) shipping in one bundle
// that even an anonymous visitor on the Login page has to fetch first.
const Login = lazy(() => import('./pages/Login.jsx'));
const Signup = lazy(() => import('./pages/Signup.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Friends = lazy(() => import('./pages/Friends.jsx'));
const FriendProfile = lazy(() => import('./pages/FriendProfile.jsx'));
const ViewedOverview = lazy(() => import('./pages/ViewedOverview.jsx'));
const ViewedBoard = lazy(() => import('./pages/ViewedBoard.jsx'));
const ViewedFriendsList = lazy(() => import('./pages/ViewedFriendsList.jsx'));
const ViewedDuels = lazy(() => import('./pages/ViewedDuels.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Challenges = lazy(() => import('./pages/Challenges.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const Terms = lazy(() => import('./pages/Terms.jsx'));

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <CenteredNote text="Loading..." />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function CenteredNote({ text }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-ink2">{text}</div>
  );
}

export default function App() {
  const { user } = useAuth();
  const location = useLocation();

  // /reset-password is reachable with `user` already truthy (a valid
  // recovery link signs the browser into a temporary session), but that's
  // mid-flow, not a real signed-in visit - so the normal signed-in chrome
  // (nav bar, profile sidebar) stays hidden there too.
  const showChrome = Boolean(user) && location.pathname !== '/reset-password';

  const routes = (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/signup" element={user ? <Navigate to="/" replace /> : <Signup />} />
      <Route
        path="/forgot-password"
        element={user ? <Navigate to="/" replace /> : <ForgotPassword />}
      />
      {/* Not gated on `user` like the routes above: clicking a valid
          reset link signs the browser into a temporary recovery
          session, so `user` is already truthy by the time this page
          loads - redirecting to "/" here would skip the reset form
          entirely and strand the person on the dashboard. */}
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Not gated on `user` either way - these need to be readable before
          signing up (that's the whole point of a terms/privacy link on the
          signup form) and by an already-signed-in visitor who just wants
          to re-check them later. */}
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route
        path="/"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />
      <Route
        path="/friends"
        element={
          <Protected>
            <Friends />
          </Protected>
        }
      />
      <Route
        path="/friends/:friendId"
        element={
          <Protected>
            <FriendProfile />
          </Protected>
        }
      >
        <Route index element={<ViewedOverview />} />
        <Route path="board" element={<ViewedBoard />} />
        <Route path="friends" element={<ViewedFriendsList />} />
        <Route path="duels" element={<ViewedDuels />} />
      </Route>
      <Route
        path="/profile"
        element={
          <Protected>
            <Profile />
          </Protected>
        }
      />
      <Route
        path="/challenges"
        element={
          <Protected>
            <Challenges />
          </Protected>
        }
      />
      <Route
        path="/settings"
        element={
          <Protected>
            <Settings />
          </Protected>
        }
      />
      <Route
        path="/notifications"
        element={
          <Protected>
            <Notifications />
          </Protected>
        }
      />
      {/* Catch-all - must stay last. Unauthenticated-but-unmatched paths
          still render this directly rather than bouncing to /login, since
          "page doesn't exist" is a different, more honest message than
          "please sign in". */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );

  // Covers the brief gap while a lazy-loaded page's chunk is still
  // downloading - same "Loading..." treatment Protected already uses below
  // for the auth check, so switching pages doesn't introduce a visually
  // different loading state from switching auth state.
  const suspendedRoutes = <Suspense fallback={<CenteredNote text="Loading..." />}>{routes}</Suspense>;

  if (!showChrome) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto flex max-w-[1600px] gap-6 px-6 py-6">
          <div className="min-w-0 flex-1">{suspendedRoutes}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SocialGraphProvider>
        <ViewedProfileProvider>
          <ProfileProvider userId={user.id}>
            <NotificationsProvider>
              <Navbar />
              <main className="mx-auto flex max-w-[1600px] gap-6 px-6 py-6">
                <ProfileSidebar />
                <div className="min-w-0 flex-1">{suspendedRoutes}</div>
              </main>
            </NotificationsProvider>
          </ProfileProvider>
        </ViewedProfileProvider>
      </SocialGraphProvider>
    </div>
  );
}
