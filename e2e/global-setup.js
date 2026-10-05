import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';
import path from 'path';
import { TEST_USER, TEST_USER2 } from './helpers.js';

// Every spec file that just needs to START signed in (not test the sign-in
// flow itself) used to call login() in its own beforeEach, which meant a
// real password-grant request to Supabase Auth per spec file, per run. Add
// that up across applications/social/validation and a single `npm run
// test:e2e` was making 7-8+ real sign-in attempts for the SAME account in
// under a minute - on top of the legitimate ones in auth.spec.js (which
// deliberately tests login) and the direct API sign-ins duelCap.spec.js
// needs for its 4-account arrangement. That's exactly the kind of burst
// Supabase's own Auth rate limiting (and its stricter throttling around
// failed-attempt patterns) is designed to catch, and once it trips, every
// later login in the same run hangs until its 30s timeout with no clear
// error - which is what the 7-test cascade after duelCap was.
//
// So: sign in ONCE per account here, before any test runs, and save each
// session (cookies + localStorage, which is where supabase-js keeps its
// session) to disk. Ordinary specs load that file via `test.use({
// storageState })` instead of calling login() - the page opens already
// authenticated, no further password-grant request involved. auth.spec.js
// is exempt on purpose: testing the login flow IS the point of that file.
const authDir = path.resolve('e2e/.auth');
const BASE_URL = 'http://localhost:5173';

async function saveSession(creds, outFile) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel('Email').fill(creds.email);
  await page.getByLabel('Password').fill(creds.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByRole('heading', { name: 'Your route' }).waitFor();
  await page.context().storageState({ path: outFile });
  await browser.close();
}

export default async function globalSetup() {
  mkdirSync(authDir, { recursive: true });

  if (TEST_USER.email) {
    await saveSession(TEST_USER, path.join(authDir, 'user.json'));
  }
  if (TEST_USER2.email) {
    await saveSession(TEST_USER2, path.join(authDir, 'user2.json'));
  }
}
