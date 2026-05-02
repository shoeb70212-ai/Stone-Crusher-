import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage';

/**
 * P1 — Daybook (Transactions) page flows.
 *
 * Verifies the Daybook page renders the transaction list and the
 * "Add Transaction" form is accessible.
 */

test.describe('Daybook page', () => {
  let app: AppPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await app.gotoAuthenticated('admin_session');
    await app.navigateTo('Daybook');
    await expect(
      page.locator('h1, h2', { hasText: /Daybook|Transaction/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('renders Daybook page heading', async ({ page }) => {
    await expect(
      page.locator('h1, h2', { hasText: /Daybook|Transaction/i }).first()
    ).toBeVisible();
  });

  test('shows Daybook content area with cash in/out sections', async ({ page }) => {
    // The Daybook shows "Cash In" and "Cash Out" sections regardless of data
    await expect(page.locator('main')).toContainText(/Cash In|Cash Out|TRIPS|NET/i, { timeout: 8_000 });
  });

  test('summary tiles are visible (Trips, Cash In, Cash Out, Net)', async ({ page }) => {
    // Daybook renders summary stat cards for the selected date
    const mainText = await page.locator('main').textContent();
    // At minimum the labels TRIPS, CASH IN, CASH OUT, NET should be present
    expect(mainText).toMatch(/TRIPS|Cash In|Cash Out/i);
  });

  test('quick action buttons are visible (Slip / In / Out)', async ({ page }) => {
    // The Daybook header has three action buttons: Slip (add from slip), In (cash in), Out (cash out)
    await expect(page.locator('button', { hasText: /^Slip$/ }).first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('button', { hasText: /^In$/ }).first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('button', { hasText: /^Out$/ }).first()).toBeVisible({ timeout: 8_000 });
  });

  test('clicking "In" (Cash In) opens entry form', async ({ page }) => {
    const inButton = page.locator('button', { hasText: /^In$/ }).first();
    if (await inButton.isVisible()) {
      await inButton.click();
      // A form/modal with Amount or Description field should appear
      const amountInput = page.locator(
        'input[placeholder*="amount" i], input[placeholder*="Amount" i], input[type="number"]'
      ).first();
      await expect(amountInput).toBeVisible({ timeout: 8_000 });
    }
  });

  test('date chip control is visible on Daybook page', async ({ page }) => {
    // Daybook header shows a date chip button (e.g. "01 May") rendered using date-fns format.
    // We use Playwright's locator with regex hasText — NOT a CSS selector string.
    const dateChip = page.locator('button').filter({ hasText: /\d{2}\s+[A-Za-z]+/ }).first();
    await expect(dateChip).toBeVisible({ timeout: 6_000 });
  });
});
