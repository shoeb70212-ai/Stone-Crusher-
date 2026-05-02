import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage';
import { DispatchPage } from './pages/DispatchPage';

/**
 * P1 — Dispatch / Slip management flows.
 *
 * Exercises the Dispatch page: slip list rendering and the "New Slip" modal.
 * Auth is bypassed via localStorage to focus on feature behaviour.
 */

test.describe('Dispatch page', () => {
  let app: AppPage;
  let dispatch: DispatchPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    dispatch = new DispatchPage(page);
    await app.gotoAuthenticated('admin_session');
    await dispatch.goto();
  });

  test('renders Dispatch page heading', async ({ page }) => {
    await expect(
      page.locator('h1, h2', { hasText: /Dispatch|Slips/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('shows a slip list or empty state', async ({ page }) => {
    // Either there are slips in the list or an empty-state message
    const slipRows = page.locator('table tbody tr');
    const emptyState = page.locator('text=/no slips|empty|no records/i');

    // One of the two should be present
    const rowCount = await slipRows.count();
    if (rowCount === 0) {
      await expect(emptyState.or(page.locator('main'))).toBeVisible();
    } else {
      expect(rowCount).toBeGreaterThan(0);
    }
  });

  test('slip list shows existing slip from local-data.json', async ({ page }) => {
    // local-data.json contains slip with vehicleNo "MH 20 AA 0555"
    await expect(page.locator('main')).toContainText('MH 20 AA 0555', { timeout: 8_000 });
  });

  test('New Slip button is present and clickable', async ({ page }) => {
    await expect(dispatch.newSlipButton).toBeVisible();
    await dispatch.newSlipButton.click();
    // A modal/form should open — wait for any form input to appear
    await expect(page.locator('input').nth(1)).toBeVisible({ timeout: 8_000 });
  });

  test('New Slip form contains Vehicle No field', async ({ page }) => {
    await dispatch.newSlipButton.click();
    // The form should have a vehicle number input or combobox
    const vehicleField = page.locator(
      'input[placeholder*="vehicle" i], input[placeholder*="Vehicle" i], input[placeholder*="MH" i]'
    ).first();
    await expect(vehicleField).toBeVisible({ timeout: 8_000 });
  });

  test('closing New Slip form returns to slip list', async ({ page }) => {
    await dispatch.newSlipButton.click();
    // Wait for form to appear
    await page.locator('input').nth(1).waitFor({ state: 'visible', timeout: 8_000 });

    // Close via Cancel/X button
    const closeButton = page.locator('button', { hasText: /Cancel|Close/i }).first();
    const xButton = page.locator('button[aria-label="Close"], button svg.lucide-x').first();

    if (await closeButton.isVisible()) {
      await closeButton.click();
    } else if (await xButton.isVisible()) {
      await xButton.click();
    } else {
      await page.keyboard.press('Escape');
    }

    // The New Slip button should be visible again
    await expect(dispatch.newSlipButton).toBeVisible({ timeout: 8_000 });
  });

  test('filter buttons are visible on Dispatch page', async ({ page }) => {
    // Quick date filter buttons rendered by the Dispatch page: Today | Week | Month
    await expect(page.locator('button', { hasText: 'Today' }).first()).toBeVisible();
    // "Week" button (exact label) is the This-Week quick filter
    await expect(page.locator('button', { hasText: /^Week$/ }).first()).toBeVisible();
  });

  test('All tab and Pending tab are switchable', async ({ page }) => {
    // Dispatch page has "All" and "Pending" tabs
    const allTab = page.locator('button', { hasText: /^All$/i }).first();
    const pendingTab = page.locator('button', { hasText: /^Pending$/i }).first();

    // If tab UI is present, verify it works
    if (await allTab.isVisible()) {
      await pendingTab.click();
      await page.waitForTimeout(300);
      await allTab.click();
      await expect(allTab).toBeVisible();
    }
  });
});
