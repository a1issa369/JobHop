// Shared helpers for the e2e suite. These tests run against whatever
// Supabase project your .env points at while `npm run dev` is running -
// ALWAYS point that at a staging project (see README), never production,
// since these tests create, edit and delete real rows.
//
// Signup requires confirming an email before you can log in, which
// Playwright can't do without an inbox-reading step. Rather than add that
// complexity, these tests log in with two PRE-SEEDED, already-confirmed
// test accounts you create once by hand (sign up normally in the app,
// confirm the email yourself, then put the credentials here):
//
//   TEST_USER_EMAIL / TEST_USER_PASSWORD   - primary test account
//   TEST_USER2_EMAIL / TEST_USER2_PASSWORD - second account, for
//                                            friend/duel flows that need
//                                            two people
//
// Set these in a local .env.test (gitignored, same pattern as .env) and
// they're read via process.env below.

export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL,
  password: process.env.TEST_USER_PASSWORD
};

export const TEST_USER2 = {
  email: process.env.TEST_USER2_EMAIL,
  password: process.env.TEST_USER2_PASSWORD,
  // Needed to search for this account from TEST_USER's session in the
  // friend/duel tests - email alone isn't searchable in the app.
  username: process.env.TEST_USER2_USERNAME
};

// Only needed for the 2-active-duel-cap test (duelCap.spec.js), which needs
// FOUR accounts: TEST_USER duels TEST_USER2 and TEST_USER3 to reach the cap,
// and TEST_USER4 is kept out of every duel so it can send TEST_USER a fresh
// pending invite while TEST_USER is capped - set all three
// TEST_USER3_*/TEST_USER4_* pairs to run it; it's skipped otherwise, same
// pattern as the duel/friend test skipping without TEST_USER2_USERNAME.
export const TEST_USER3 = {
  email: process.env.TEST_USER3_EMAIL,
  password: process.env.TEST_USER3_PASSWORD
};

export const TEST_USER4 = {
  email: process.env.TEST_USER4_EMAIL,
  password: process.env.TEST_USER4_PASSWORD
};

export async function login(page, { email, password }) {
  if (!email || !password) {
    throw new Error(
      'Missing test account credentials - set TEST_USER_EMAIL/TEST_USER_PASSWORD ' +
        '(and TEST_USER2_* for duel/friend tests) in .env.test. See e2e/helpers.js.'
    );
  }
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  // Board is the post-login landing page - its heading is the signal that
  // auth actually succeeded, rather than racing a fixed timeout.
  await page.getByRole('heading', { name: 'Your route' }).waitFor();
}

// A per-run-unique company name so parallel/repeat test runs never collide
// on "find the card I just made" - every test that creates data should tag
// it with this rather than a fixed literal string.
export function uniqueName(label) {
  return `${label} ${Date.now()}`;
}
