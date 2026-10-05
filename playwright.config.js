import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

// Loads .env.test (test account credentials) separately from the app's own
// .env, so `npm run dev` inside webServer below still picks up your normal
// Vite env vars while the test runner additionally gets TEST_USER_* into
// process.env for e2e/helpers.js.
config({ path: '.env.test' });
// Also load the app's own .env - a few tests (duel-cap setup) talk to
// Supabase directly from Node to arrange state quickly, and need
// VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY for that.
config({ path: '.env' });

// Points at whatever `npm run dev` is already serving (localhost:5173) -
// run it against your STAGING Supabase project's .env, never production,
// since these tests create and delete real accounts/applications.
export default defineConfig({
  testDir: './e2e',
  // Signs TEST_USER/TEST_USER2 in once up front and saves their sessions to
  // e2e/.auth/*.json - most spec files reuse that via storageState instead
  // of each doing their own real login, which is what was burning through
  // Supabase's sign-in rate limit (see global-setup.js for the full story).
  globalSetup: './e2e/global-setup.js',
  fullyParallel: false, // these tests create/sign-in real accounts; serial avoids races
  // fullyParallel:false only serializes tests WITHIN one file - different
  // spec files still ran on separate workers by default, which meant
  // several files logging in as the same TEST_USER within the same second
  // or two. That burst tripped Supabase Auth's own sign-in rate limiting
  // (separate from this app's custom check_rate_limit, which only guards
  // specific RPCs) and every concurrent login just hung until the
  // beforeEach hook's 30s timeout. Forcing a single worker makes every
  // file run strictly one after another, so logins never overlap.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
});
