import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage';

/**
 * P0 — Role-based access control.
 *
 * Verifies that:
 *  - Admin can access all pages including Settings, Ledger, and Audit Log
 *  - Unauthenticated users are always redirected to the login form
 *
 * The SPA enforces role protection in Layout.tsx via a useEffect that resets
 * currentView to "dashboard" when a restricted view is accessed.
 */

test.describe('Admin role — full access', () => {
  let app: AppPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await app.gotoAuthenticated('Admin');
  });

  test('Admin sees Ledger nav item', async ({ page: _page }) => {
    await app.assertSidebarContains('Ledger');
  });

  test('Admin sees Settings nav item', async ({ page: _page }) => {
    await app.assertSidebarContains('Settings');
  });

  test('Admin sees Audit Log nav item', async ({ page: _page }) => {
    await app.assertSidebarContains('Audit Log');
  });

  test('Admin can open Ledger page', async ({ page }) => {
    await app.navigateTo('Ledger');
    // Should NOT see "Access Denied"
    await expect(page.locator('h2', { hasText: 'Access Denied' })).not.toBeVisible({ timeout: 5_000 });
    await expect(page.locator('h1, h2', { hasText: /Ledger/i }).first()).toBeVisible({ timeout: 8_000 });
  });

  test('Admin can open Settings page', async ({ page }) => {
    await app.navigateTo('Settings');
    await expect(page.locator('h2', { hasText: 'Access Denied' })).not.toBeVisible({ timeout: 5_000 });
    await expect(page.locator('h1, h2', { hasText: /Settings/i }).first()).toBeVisible({ timeout: 8_000 });
  });

  test('Admin can open Audit Log page', async ({ page }) => {
    await app.navigateTo('Audit Log');
    await expect(page.locator('h2', { hasText: 'Access Denied' })).not.toBeVisible({ timeout: 5_000 });
    await expect(page.locator('h1, h2', { hasText: /Audit Log/i }).first()).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Session protection — unauthenticated access', () => {
  test('visiting app without session shows login form', async ({ page }) => {
    // Navigate without injecting any session
    await page.goto('/');
    // Should land on login screen (no Supabase session = not authenticated)
    await expect(page.locator('#login-username')).toBeVisible({ timeout: 15_000 });
    // Sidebar (app layout) should NOT be visible
    await expect(page.locator('aside')).not.toBeVisible();
  });

  test('clearing session mid-session forces re-login', async ({ page }) => {
    // Start authenticated
    const app = new AppPage(page);
    await app.gotoAuthenticated();
    await expect(app.sidebar).toBeVisible();

    // Clear the Supabase session and reload (simulates tab refresh after logout elsewhere)
    await page.evaluate(() => localStorage.removeItem('crushtrack-auth'));
    await page.reload();

    // Should return to login screen
    await expect(page.locator('#login-username')).toBeVisible({ timeout: 15_000 });
  });
});
