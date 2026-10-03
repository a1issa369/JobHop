import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { ProfileProvider } from './context/ProfileContext.jsx';
import { ViewedProfileProvider } from './context/ViewedProfileContext.jsx';
import { NotificationsProvider } from './context/NotificationsContext.jsx';
import Navbar from './components/Navbar.jsx';
import ProfileSidebar from './components/ProfileSidebar.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Friends from './pages/Friends.jsx';
import FriendProfile from './pages/FriendProfile.jsx';
import ViewedOverview from './pages/ViewedOverview.jsx';
import ViewedBoard from './pages/ViewedBoard.jsx';
import ViewedFriendsList from './pages/ViewedFriendsList.jsx';
import ViewedDuels from './pages/ViewedDuels.jsx';
import Profile from './pages/Profile.jsx';
import Challenges from './pages/Challenges.jsx';
import Settings from './pages/Settings.jsx';
import Notifications from './pages/Notifications.jsx';

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
    </Routes>
  );

  if (!showChrome) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto flex max-w-[1600px] gap-6 px-6 py-6">
          <div className="min-w-0 flex-1">{routes}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <ViewedProfileProvider>
        <ProfileProvider userId={user.id}>
          <NotificationsProvider>
            <Navbar />
            <main className="mx-auto flex max-w-[1600px] gap-6 px-6 py-6">
              <ProfileSidebar />
              <div className="min-w-0 flex-1">{routes}</div>
            </main>
          </NotificationsProvider>
        </ProfileProvider>
      </ViewedProfileProvider>
    </div>
  );
}
