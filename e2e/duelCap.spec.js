import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST_USER, TEST_USER2, TEST_USER3, TEST_USER4 } from './helpers.js';

// The final UI assertions reuse the session global-setup.js already saved
// for TEST_USER rather than a fresh login() - one less real sign-in call
// against Supabase Auth per run (see global-setup.js).
test.use({ storageState: 'e2e/.auth/user.json' });

// Exercises the 2-active-duel cap end to end with FOUR identities at once,
// which no single-browser click-path can set up quickly:
//
//   TEST_USER  (A) - sits at the 2-duel cap, duelling B and C
//   TEST_USER2 (B) - one of A's two active duels
//   TEST_USER3 (C) - A's other active duel
//   TEST_USER4 (D) - deliberately kept OUT of every duel, so it's free to
//                    send A a brand-new invite while A is capped
//
// The "arrange" step talks to Supabase directly via four separate
// server-side clients (one per account, each with its own session) instead
// of driving four browser contexts through the whole challenge/accept flow.
// Only the parts that actually matter go through the real browser: A
// failing to accept D's invite while capped, A forfeiting one of its two
// active duels (the real feature this test also exists to cover - see
// migration 016), and A then succeeding on the very same invite once a
// slot is free.
function client() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
}

async function userId(sbClient) {
  const { data } = await sbClient.auth.getUser();
  return data.user.id;
}

async function findDuel(sbClient, aId, bId, status) {
  const { data } = await sbClient
    .from('challenges')
    .select('id, status')
    .or(`and(challenger_id.eq.${aId},opponent_id.eq.${bId}),and(challenger_id.eq.${bId},opponent_id.eq.${aId})`)
    .eq('status', status)
    .limit(1)
    .maybeSingle();
  return data;
}

// Idempotent on repeat runs: an active duel can't be un-accepted (only
// forfeited or waited out), so re-running this suite the same day would
// otherwise fail trying to create a duplicate active duel between the same
// two people. If one's already active from an earlier run, reuse it.
async function ensureActiveDuel(challengerClient, opponentClient, challengerId, opponentId) {
  const existing = await findDuel(challengerClient, challengerId, opponentId, 'active');
  if (existing) return existing;

  const { data: duel, error: createErr } = await challengerClient.rpc('create_challenge', {
    p_opponent_id: opponentId,
    p_duration_days: 1
  });
  expect(createErr, 'create_challenge').toBeNull();
  const { error: acceptErr } = await opponentClient.rpc('respond_to_challenge', {
    p_challenge_id: duel.id,
    p_accept: true
  });
  expect(acceptErr, 'respond_to_challenge (accept)').toBeNull();
  return duel;
}

test.describe('2-active-duel cap', () => {
  test('a 4th account can only have its invite accepted once a slot frees up via forfeit', async ({ page }) => {
    test.skip(
      !TEST_USER3.email || !TEST_USER4.email,
      'Set TEST_USER3_EMAIL/PASSWORD and TEST_USER4_EMAIL/PASSWORD in .env.test to run this test.'
    );

    const a = client();
    const b = client();
    const c = client();
    const d = client();

    const [{ error: aErr }, { error: bErr }, { error: cErr }, { error: dErr }] = await Promise.all([
      a.auth.signInWithPassword(TEST_USER),
      b.auth.signInWithPassword(TEST_USER2),
      c.auth.signInWithPassword(TEST_USER3),
      d.auth.signInWithPassword(TEST_USER4)
    ]);
    expect(aErr, 'TEST_USER sign-in').toBeNull();
    expect(bErr, 'TEST_USER2 sign-in').toBeNull();
    expect(cErr, 'TEST_USER3 sign-in').toBeNull();
    expect(dErr, 'TEST_USER4 sign-in').toBeNull();

    const [aId, bId, cId, dId] = await Promise.all([userId(a), userId(b), userId(c), userId(d)]);

    // A's 2 active-duel slots may currently be held by whichever accounts
    // were still active at the end of a PREVIOUS run of this test - a run
    // that forfeits the B duel and accepts D's invite leaves A holding
    // {C, D}, not {B, C}, going into the next run. Rather than track which
    // pairing is live, just clear every active duel A currently has before
    // setting up B+C fresh each time - that keeps this test deterministic
    // and self-healing regardless of how the last run ended.
    const { data: aActive } = await a
      .from('challenges')
      .select('id')
      .or(`challenger_id.eq.${aId},opponent_id.eq.${aId}`)
      .eq('status', 'active');
    for (const duel of aActive ?? []) {
      await a.rpc('forfeit_challenge', { p_challenge_id: duel.id });
    }

    // Put A at the cap: active duels with both B and C. D stays untouched -
    // it must never be in an active or pending duel with A going into this.
    await ensureActiveDuel(a, b, aId, bId);
    await ensureActiveDuel(a, c, aId, cId);

    const { data: capped } = await a.rpc('count_active_duels', { p_user_id: aId });
    expect(capped).toBe(2);

    // D invites A. A brand-new challenge is still allowed to be CREATED
    // while A is capped (create_challenge only checks the caller's - D's -
    // own cap, not A's); it just can't be ACCEPTED yet, which is exactly
    // the case this test needs on the UI side. Reuse a leftover pending
    // invite from an aborted previous run instead of piling up duplicates.
    let pending = await findDuel(d, dId, aId, 'pending');
    if (!pending) {
      const { data: invite, error: inviteErr } = await d.rpc('create_challenge', {
        p_opponent_id: aId,
        p_duration_days: 1
      });
      expect(inviteErr, "D's invite to A").toBeNull();
      pending = invite;
    }

    // --- Real assertions, driven through the browser as A. ---
    // Already signed in via storageState above - just navigate.
    await page.goto('/challenges');

    // Capped: accepting D's request fails with a toast, and it stays put
    // in "Duel requests" instead of being promoted to "Live duels". (The
    // "Live duels" heading itself is a poor signal here - it's a static
    // section header that's always rendered, cap or no cap - so the real
    // assertions below check the toast and the Forfeit button count
    // instead of that heading's mere presence.)
    await page.getByRole('heading', { name: 'Duel requests' }).waitFor();
    await page.getByRole('button', { name: 'Accept' }).first().click();
    await expect(page.getByRole('alert')).toContainText(/2 duels/i);
    await expect(page.getByRole('heading', { name: 'Duel requests' })).toBeVisible();

    // Forfeit one of the two live duels (whichever the UI lists first) to
    // free a slot - the second click is the real confirm, matching the
    // Forfeit button's own arm-then-confirm behavior.
    await page.getByRole('heading', { name: 'Live duels' }).waitFor();
    await page.getByRole('button', { name: 'Forfeit' }).first().click();
    await page.getByRole('button', { name: 'Click again to forfeit' }).click();

    // Wait for the forfeit to actually land (RPC + the page's own refresh())
    // before moving on - only one Forfeit button should be left once it has.
    // Without this, the Accept click below can fire while A is still
    // sitting at the cap and silently fail the same way the first Accept
    // attempt was supposed to.
    await expect(page.getByRole('button', { name: 'Forfeit' })).toHaveCount(1);

    // A slot is open again: D's same invite can now actually be accepted -
    // it moves out of "Duel requests" and a second Forfeit button (for the
    // newly-active duel with D) appears in "Live duels" instead of
    // bouncing back with the cap toast.
    await page.getByRole('heading', { name: 'Duel requests' }).waitFor();
    await page.getByRole('button', { name: 'Accept' }).first().click();
    await expect(page.getByRole('button', { name: 'Forfeit' })).toHaveCount(2);

    const nowActive = await findDuel(a, aId, dId, 'active');
    expect(nowActive, "D's invite should now be an active duel").toBeTruthy();
  });
});
