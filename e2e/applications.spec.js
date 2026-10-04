import { test, expect } from '@playwright/test';
import { login, TEST_USER, uniqueName } from './helpers.js';

test.describe('application CRUD + kanban', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USER);
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

    // Reload to prove this round-tripped through the database rather than
    // only updating local React state.
    await page.reload();
    await page.getByRole('button', { name: /^applied/i }).click();
    await expect(page.getByText(company, { exact: true })).toBeVisible();

    // Cleanup so repeat runs don't pile up stray test cards.
    await page.getByText(company, { exact: true }).click();
    await page.getByRole('button', { name: /delete card/i }).click();
  });
});
