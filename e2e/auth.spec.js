import { test, expect } from '@playwright/test';
import { login, TEST_USER } from './helpers.js';

test.describe('auth', () => {
  test('rejects a weak password on signup', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Username').fill(`e2e_${Date.now()}`);
    await page.getByLabel('Email').fill(`e2e-${Date.now()}@example.com`);
    await page.getByLabel('Password').fill('weak');
    // The button itself stays disabled until the strength meter says
    // "Strong" - this is the real guard (see Signup.jsx canSubmit), so
    // asserting disabled is what actually proves weak passwords can't
    // get through, not just that an error message appears somewhere.
    await expect(page.getByRole('button', { name: /create account/i })).toBeDisabled();
  });

  test('logs in with valid credentials and reaches the board', async ({ page }) => {
    await login(page, TEST_USER);
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Your route' })).toBeVisible();
  });

  test('shows an error for wrong credentials without crashing', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(TEST_USER.email ?? 'nobody@example.com');
    await page.getByLabel('Password').fill('DefinitelyWrong1!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid|failed|incorrect/i)).toBeVisible();
  });
});
