import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Friends from './pages/Friends.jsx';
import FriendProfile from './pages/FriendProfile.jsx';
import Settings from './pages/Settings.jsx';

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

  return (
    <div className="min-h-screen">
      {user && <Navbar />}
      <main className="mx-auto max-w-6xl px-4 py-6">
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
          />
          <Route
            path="/settings"
            element={
              <Protected>
                <Settings />
              </Protected>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
