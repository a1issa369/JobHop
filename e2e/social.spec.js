import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST_USER, TEST_USER2 } from './helpers.js';

function client() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
}

// These need TWO separate logged-in sessions at once (challenger +
// opponent), so each gets its own browser context rather than reusing one
// page - a single context only holds one auth session. Both sessions come
// from the files global-setup.js already saved (TEST_USER / TEST_USER2),
// not a fresh login() here - see global-setup.js for why that matters.
test.describe('friend request + duel', () => {
  test('search, friend request, and starting/accepting a duel', async ({ browser }) => {
    test.skip(!TEST_USER2.username, 'Set TEST_USER2_USERNAME in .env.test to run this test.');

    // duelCap.spec.js runs earlier in the suite and deliberately puts
    // TEST_USER and TEST_USER2 into an active duel together (one of the
    // two it uses to fill TEST_USER's 2-duel cap) - and an active duel
    // doesn't go away on its own. Without clearing it first, "Start a
    // duel" below would never even be offered: the widget would show the
    // existing duel-in-progress card instead. Forfeit (or cancel, if it's
    // still only pending) whatever's there so this test starts clean.
    const a = client();
    const b = client();
    const [{ data: aAuth }, { data: bAuth }] = await Promise.all([
      a.auth.signInWithPassword(TEST_USER),
      b.auth.signInWithPassword(TEST_USER2)
    ]);
    const aId = aAuth.user.id;
    const bId = bAuth.user.id;

    const { data: existing } = await a
      .from('challenges')
      .select('id, status, challenger_id')
      .or(`and(challenger_id.eq.${aId},opponent_id.eq.${bId}),and(challenger_id.eq.${bId},opponent_id.eq.${aId})`)
      .in('status', ['pending', 'active']);

    for (const c of existing ?? []) {
      if (c.status === 'active') {
        await a.rpc('forfeit_challenge', { p_challenge_id: c.id });
      } else {
        // cancel_challenge only works for whichever side actually sent it.
        const sender = c.challenger_id === aId ? a : b;
        await sender.rpc('cancel_challenge', { p_challenge_id: c.id });
      }
    }

    const contextA = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const contextB = await browser.newContext({ storageState: 'e2e/.auth/user2.json' });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto('/');
    await pageA.getByRole('heading', { name: 'Your route' }).waitFor();
    await pageB.goto('/');
    await pageB.getByRole('heading', { name: 'Your route' }).waitFor();

    // User A finds user B by username and opens their profile.
    await pageA.goto('/friends');
    await pageA.getByPlaceholder('Search by username').fill(TEST_USER2.username);
    await pageA.getByText(`@${TEST_USER2.username}`).click();

    // Send a duel challenge at the default duration.
    await pageA.getByRole('button', { name: /start a duel/i }).click();
    await expect(pageA.getByText(/duel request sent/i)).toBeVisible();

    // User B accepts it from the global Duels page.
    await pageB.goto('/challenges');
    await pageB.getByRole('heading', { name: 'Duel requests' }).waitFor();
    await pageB.getByRole('button', { name: 'Accept' }).first().click();

    // Both sides should now see it under Live duels - the Forfeit button
    // only renders for an actually-active duel, so its presence (rather
    // than the "Live duels" heading, which is always rendered regardless)
    // is the real proof this landed. A may independently be in another
    // active duel too (e.g. from duelCap.spec.js, which runs earlier and
    // leaves A with up to 2 active duels of its own), so scope to the
    // specific card naming B rather than asserting on "a Forfeit button"
    // in general, which wouldn't be unique in that case.
    await expect(pageB.getByRole('button', { name: 'Forfeit' }).first()).toBeVisible();
    await pageA.goto('/challenges');
    const duelWithB = pageA.getByRole('listitem').filter({ hasText: TEST_USER2.username });
    await expect(duelWithB.getByRole('button', { name: 'Forfeit' })).toBeVisible();

    await contextA.close();
    await contextB.close();
  });
});
