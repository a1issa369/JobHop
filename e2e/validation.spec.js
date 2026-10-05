import { test, expect } from '@playwright/test';
import { TEST_USER, uniqueName } from './helpers.js';

// Coverage for tonight's toast-based validation: a past deadline, an
// oversized/wrong-type resume, a malformed profile link, and the
// change-password button's gating logic. These all go through the toast
// (role="alert", auto-dismissing) rather than a banner, so every assertion
// below targets that instead of a static error paragraph.
//
// Starts already signed in via the session global-setup.js saved, instead
// of a fresh login() per test - see global-setup.js for why. The last test
// below still makes its own real signInWithPassword calls (right/wrong
// current-password checks), since that verification IS the feature being
// tested - that part can't be avoided, and isn't new.
test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('input validation (toasts)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'Your route' }).waitFor();
  });

  test('blocks a past deadline and keeps the card unsaved', async ({ page }) => {
    const company = uniqueName('PastDeadline Co');

    await page.getByRole('button', { name: /new application/i }).click();
    await page.getByLabel('Company').fill(company);
    await page.getByLabel('Role').fill('Intern');
    // Always in the past regardless of when this runs, so there's no
    // "today" edge case to get flaky about.
    await page.getByLabel('Deadline').fill('2020-01-01');
    await page.getByRole('button', { name: /add card/i }).click();

    await expect(page.getByRole('alert')).toContainText(/past/i);
    // The modal must still be open (save was blocked) - the card never
    // made it onto the board.
    await expect(page.getByRole('button', { name: /add card/i })).toBeVisible();
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByText(company, { exact: true })).not.toBeVisible();
  });

  test('rejects a resume over 2MB', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept*="pdf"]');
    await fileInput.setInputFiles({
      name: 'big-resume.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(2.5 * 1024 * 1024)
    });
    await expect(page.getByRole('alert')).toContainText(/2MB/i);
  });

  test('rejects a non-PDF resume', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept*="pdf"]');
    await fileInput.setInputFiles({
      name: 'resume.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a pdf')
    });
    await expect(page.getByRole('alert')).toContainText(/pdf/i);
  });

  test('rejects a GitHub link that is not actually a GitHub link', async ({ page }) => {
    await page.goto('/settings');
    await page.getByLabel('GitHub').fill('definitely not a url');
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByRole('alert')).toContainText(/github/i);
  });

  test('change-password button only enables once every rule is satisfied', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Password' }).click();

    const changeBtn = page.getByRole('button', { name: /change password/i });
    const current = page.getByLabel('Current password');
    // getByLabel does a substring match by default, and "Retype new
    // password" contains "new password" as a substring of its own name -
    // so an unanchored getByLabel('New password') resolves to BOTH fields
    // and throws a strict-mode violation. Anchor to the start so it only
    // ever matches the actual "New password" field.
    const newPassword = page.getByLabel(/^New password/i);

    // Wrong current password: verified against Supabase on blur, stays
    // disabled, and says so.
    await current.fill('DefinitelyWrongPassword1!');
    await current.blur();
    await expect(page.getByText("That's not your current password.")).toBeVisible();
    await expect(changeBtn).toBeDisabled();

    // Correct current password, but a weak new one - still disabled.
    await current.fill(TEST_USER.password);
    await current.blur();
    await expect(page.getByText('Verified.')).toBeVisible();
    await newPassword.fill('weak');
    await expect(changeBtn).toBeDisabled();

    // Strong new password, but the retype doesn't match - still disabled.
    // Both fields cap at 15 chars (MAX_PASSWORD_LENGTH) - 'Str0ng!Password'
    // is exactly 15, so a longer "mismatched" value here gets silently
    // truncated by the input's own maxLength back down to the same 15
    // characters, making it equal after all and never triggering the
    // mismatch hint. Use two same-length, genuinely different values
    // instead so the truncation can't accidentally erase the mismatch.
    await newPassword.fill('Str0ngPass1!');
    await page.getByLabel('Retype new password').fill('Str0ngPass2!');
    await expect(page.getByText("Doesn't match the new password above.")).toBeVisible();
    await expect(changeBtn).toBeDisabled();

    // Deliberately NOT filling in a matching retype and submitting here -
    // this suite reuses the same TEST_USER account across every run, and
    // actually changing its password (which also signs it out everywhere)
    // would break every other test. This test only proves the gating
    // logic, not the full successful-change flow.
  });
});
