import { test, expect } from '@playwright/test';
import { login, TEST_USER, TEST_USER2 } from './helpers.js';

// These need TWO separate logged-in sessions at once (challenger +
// opponent), so each gets its own browser context rather than reusing one
// page - a single context only holds one auth session.
test.describe('friend request + duel', () => {
  test('search, friend request, and starting/accepting a duel', async ({ browser }) => {
    test.skip(!TEST_USER2.username, 'Set TEST_USER2_USERNAME in .env.test to run this test.');

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await login(pageA, TEST_USER);
    await login(pageB, TEST_USER2);

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

    // Both sides should now see it under Live duels.
    await pageB.goto('/challenges');
    await expect(pageB.getByRole('heading', { name: 'Live duels' })).toBeVisible();
    await pageA.goto('/challenges');
    await expect(pageA.getByRole('heading', { name: 'Live duels' })).toBeVisible();

    await contextA.close();
    await contextB.close();
  });
});
