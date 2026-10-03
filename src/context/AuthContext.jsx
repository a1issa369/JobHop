import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Wraps the server-side rate-limit RPC so a broken/unreachable database
  // (paused Supabase project, migration not yet run, offline, etc.) surfaces
  // a clear message instead of a bare "TypeError: Failed to fetch". Rate
  // limiting still fails CLOSED - if the check can't be verified, the
  // request is blocked rather than silently let through, since that's the
  // only safe default for a rate limiter.
  async function checkAuthRateLimit(email, action, max, windowSeconds) {
    try {
      const { error } = await supabase.rpc('check_rate_limit_by_key', {
        p_key: email.trim().toLowerCase(),
        p_action: action,
        p_max: max,
        p_window_seconds: windowSeconds
      });
      if (error) {
        // Function missing (migration not run) - Postgres error 42883, or
        // PostgREST's "not found in schema cache" wording.
        if (error.code === '42883' || /schema cache|does not exist/i.test(error.message ?? '')) {
          return {
            message:
              'The database is missing a required update. Run supabase/migrations/002_auth_rate_limiting.sql in your Supabase SQL editor, then try again.'
          };
        }
        // Actual rate limit hit (P0429 from check_rate_limit_by_key).
        return { message: error.message };
      }
      return null;
    } catch {
      // The fetch itself failed - most commonly a paused Supabase project
      // (free tier auto-pauses after ~1 week idle) or no internet.
      return {
        message:
          "Could not reach the database. If you're on Supabase's free tier, check your project dashboard - it may have auto-paused from inactivity and need to be resumed."
      };
    }
  }

  // Wraps a Supabase Auth call (signUp / signInWithPassword) the same way -
  // a raw fetch-level failure here (Auth service down, paused project,
  // offline) previously had no safety net and surfaced as a bare
  // "TypeError: Failed to fetch" even though the rate-limit check right
  // before it succeeded fine. Different Supabase services (REST/PostgREST
  // vs. the Auth/GoTrue service) can go down independently, so passing the
  // rate-limit check does not guarantee the Auth call will succeed too.
  async function callAuth(fn) {
    try {
      return await fn();
    } catch {
      return {
        error: {
          message:
            "Could not reach Supabase's authentication service. Check status.supabase.com for an ongoing incident, or check your project dashboard in case it's paused."
        }
      };
    }
  }

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    signUp: async (email, password, username) => {
      const rlError = await checkAuthRateLimit(email, 'signup', 3, 3600);
      if (rlError) return { error: rlError };
      return callAuth(() =>
        supabase.auth.signUp({ email, password, options: { data: { username } } })
      );
    },
    signIn: async (email, password) => {
      const rlError = await checkAuthRateLimit(email, 'login', 5, 900);
      if (rlError) return { error: rlError };
      return callAuth(() => supabase.auth.signInWithPassword({ email, password }));
    },
    signOut: () => supabase.auth.signOut(),

    // Sends a password-reset email. This never reveals whether the email
    // belongs to an account - the caller (ForgotPassword.jsx) always shows
    // the same "check your inbox" message either way, so this form can't be
    // used to probe which emails are registered. Rate-limited by email so
    // it also can't be used to spam someone's inbox with reset mail.
    requestPasswordReset: async (email) => {
      const rlError = await checkAuthRateLimit(email, 'password_reset', 3, 3600);
      if (rlError) return { error: rlError };
      return callAuth(() =>
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        })
      );
    },

    // Only succeeds if the caller is holding a session - and the only way
    // to be holding a session on the /reset-password page is to have
    // clicked the one-time, short-lived link Supabase emailed to the real
    // address on the account (see ResetPassword.jsx). There is no code
    // path here that accepts an email + new password directly, which is
    // exactly what would let someone change another user's password.
    updatePassword: (newPassword) => callAuth(() => supabase.auth.updateUser({ password: newPassword })),

    // Used by the "Change password" form on Settings, where the caller
    // already has a normal session and knows the account's current
    // password. updateUser() alone would let anyone holding an open,
    // unattended browser session change the password without proving they
    // know the old one - signInWithPassword() here re-verifies it first
    // (this is the same credential check login itself uses), and only
    // proceeds to actually change the password if that succeeds.
    changePassword: async (currentPassword, newPassword) => {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData?.user?.email;
      if (!email) return { error: { message: 'No active session.' } };

      const reauth = await callAuth(() =>
        supabase.auth.signInWithPassword({ email, password: currentPassword })
      );
      if (reauth.error) return { error: { message: 'Current password is incorrect.' } };

      return callAuth(() => supabase.auth.updateUser({ password: newPassword }));
    },

    // Same re-authentication pattern as changePassword, pulled out standalone
    // for any other destructive action that should require re-proving the
    // account password first (e.g. bulk-deleting every card) without also
    // changing it.
    verifyPassword: async (password) => {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData?.user?.email;
      if (!email) return { error: { message: 'No active session.' } };

      const reauth = await callAuth(() => supabase.auth.signInWithPassword({ email, password }));
      if (reauth.error) return { error: { message: 'Password is incorrect.' } };
      return { error: null };
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
