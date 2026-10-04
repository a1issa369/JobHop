import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

// Loads .env.test (test account credentials) separately from the app's own
// .env, so `npm run dev` inside webServer below still picks up your normal
// Vite env vars while the test runner additionally gets TEST_USER_* into
// process.env for e2e/helpers.js.
config({ path: '.env.test' });

// Points at whatever `npm run dev` is already serving (localhost:5173) -
// run it against your STAGING Supabase project's .env, never production,
// since these tests create and delete real accounts/applications.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // these tests create/sign-in real accounts; serial avoids races
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
