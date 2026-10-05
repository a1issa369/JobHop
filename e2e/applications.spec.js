import { test, expect } from '@playwright/test';
import { uniqueName } from './helpers.js';

// Starts already signed in via the session global-setup.js saved, instead
// of a fresh login() per test - see global-setup.js for why.
test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('application CRUD + kanban', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'Your route' }).waitFor();
  });

  test('creates, edits, and deletes an application', async ({ page }) => {
    const company = uniqueName('Acme Corp');

    await page.getByRole('button', { name: /new application/i }).click();
    await page.getByLabel('Company').fill(company);
    await page.getByLabel('Role').fill('Software Engineer Intern');
    await page.getByLabel('Stage').selectOption('applied');
    await page.getByRole('button', { name: /add card/i }).click();

    // The modal closing + the card showing up on the board is the real
    // assertion that the write actually landed, not just that the button
    // click didn't throw.
    const card = page.getByText(company, { exact: true });
    await expect(card).toBeVisible();

    // Edit: open the card, change role, save, confirm the change stuck.
    await card.click();
    await page.getByLabel('Role').fill('Senior Software Engineer Intern');
    await page.getByRole('button', { name: /save changes/i }).click();
    await card.click();
    await expect(page.getByLabel('Role')).toHaveValue('Senior Software Engineer Intern');

    // Delete card has no confirm step (deletes immediately) - confirm the
    // card is actually gone from the board after, not just that the modal
    // closed.
    await page.getByRole('button', { name: /delete card/i }).click();
    await expect(card).not.toBeVisible();
  });

  test('moving a card to a new stage persists after reload', async ({ page }) => {
    const company = uniqueName('Globex Inc');

    await page.getByRole('button', { name: /new application/i }).click();
    await page.getByLabel('Company').fill(company);
    await page.getByLabel('Role').fill('Backend Intern');
    await page.getByLabel('Stage').selectOption('wishlist');
    await page.getByRole('button', { name: /add card/i }).click();

    const card = page.getByText(company, { exact: true });
    await card.click();
    await page.getByLabel('Stage').selectOption('applied');
    await page.getByRole('button', { name: /save changes/i }).click();

    // Dashboard's handleSave only closes the modal AFTER the Supabase write
    // actually succeeds (it's deliberately not optimistic for the close
    // itself, see Dashboard.jsx) - so waiting for the modal to disappear is
    // what proves the write landed, not just that the click fired. Without
    // this wait, the reload below can race ahead of the in-flight request
    // and fetch the pre-save data, which is what was actually making this
    // test flaky (not pagination - that fix stays too, since it's still a
    // real issue once the write has landed).
    await expect(page.getByRole('button', { name: /save changes/i })).not.toBeVisible();

    // Reload to prove this round-tripped through the database rather than
    // only updating local React state.
    await page.reload();
    await page.getByRole('button', { name: /^applied/i }).click();

    // The board sorts oldest-first and paginates 12 per page, so the card
    // just created - the newest one in this stage - lands on the LAST
    // page, not necessarily page 1. That's invisible with a clean account,
    // but any stray cards left behind by an earlier interrupted run push
    // it further out, which is exactly what made this flaky. Walk forward
    // until "Next" is disabled instead of assuming page 1.
    const nextBtn = page.getByRole('button', { name: 'Next' });
    while (await nextBtn.isEnabled()) {
      await nextBtn.click();
    }
    await expect(page.getByText(company, { exact: true })).toBeVisible();

    // Cleanup so repeat runs don't pile up stray test cards.
    await page.getByText(company, { exact: true }).click();
    await page.getByRole('button', { name: /delete card/i }).click();
  });
});
