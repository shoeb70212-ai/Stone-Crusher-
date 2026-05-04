import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage';

/**
 * P0 — Navigation flows.
 *
 * Verifies that sidebar navigation correctly switches views in the SPA.
 * Tests inject the auth token via localStorage to bypass the login form.
 */

test.describe('Sidebar navigation', () => {
  let app: AppPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await app.gotoAuthenticated('Admin');
  });

  test('app layout renders sidebar and header', async ({ page }) => {
    await expect(app.sidebar).toBeVisible();
    await expect(app.header).toBeVisible();
    await expect(app.mainContent).toBeVisible();
  });

  test('default view is Dashboard', async ({ page }) => {
    // After initial load the dashboard is the default view
    await expect(app.mainContent).toContainText(/Dashboard|Today|slips|revenue/i, { timeout: 10_000 });
  });

  test('navigates to Dispatch page', async ({ page }) => {
    await app.navigateTo('Dispatch (Slips)');
    // The Dispatch page shows a "Dispatch" heading and a New Slip button
    await expect(page.locator('h1, h2', { hasText: /Dispatch|Slips/i }).first()).toBeVisible({ timeout: 8_000 });
  });

  test('navigates to Customers page', async ({ page }) => {
    await app.navigateTo('Customers');
    await expect(page.locator('h1, h2', { hasText: /Customers/i }).first()).toBeVisible({ timeout: 8_000 });
  });

  test('navigates to Daybook page', async ({ page }) => {
    await app.navigateTo('Daybook');
    await expect(page.locator('h1, h2', { hasText: /Daybook|Transactions/i }).first()).toBeVisible({ timeout: 8_000 });
  });

  test('navigates to Invoices page', async ({ page }) => {
    await app.navigateTo('Invoicing');
    // The Invoices page uses "Invoicing" as the page heading
    await expect(page.locator('main')).toContainText(/Invoicing|Invoice/i, { timeout: 8_000 });
  });

  test('navigates to Vehicles page', async ({ page }) => {
    await app.navigateTo('Vehicles');
    await expect(page.locator('h1, h2', { hasText: /Vehicle/i }).first()).toBeVisible({ timeout: 8_000 });
  });

  test('navigates to Ledger page', async ({ page }) => {
    await app.navigateTo('Ledger');
    await expect(page.locator('h1, h2', { hasText: /Ledger/i }).first()).toBeVisible({ timeout: 8_000 });
  });

  test('navigates to Settings page', async ({ page }) => {
    await app.navigateTo('Settings');
    await expect(page.locator('h1, h2', { hasText: /Settings/i }).first()).toBeVisible({ timeout: 8_000 });
  });

  test('navigates to Audit Log page', async ({ page }) => {
    await app.navigateTo('Audit Log');
    await expect(page.locator('h1, h2', { hasText: /Audit Log/i }).first()).toBeVisible({ timeout: 8_000 });
  });

  test('can navigate back to Dashboard after visiting another page', async ({ page }) => {
    await app.navigateTo('Dispatch (Slips)');
    await app.navigateTo('Dashboard');
    await expect(app.mainContent).toContainText(/Dashboard|Today|slips|revenue/i, { timeout: 10_000 });
  });

  test('sidebar shows current role label', async ({ page }) => {
    // The sidebar bottom section shows "Role: Admin"
    await expect(app.sidebar).toContainText(/Admin/i);
  });
});
