import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage';

/**
 * P1 — Session / Logout flows.
 *
 * Verifies that clearing the auth token correctly forces the user back
 * to the login screen and that Sign Out via the UI works.
 */

test.describe('Session management', () => {
  test('Sign Out button clears session and shows login', async ({ page }) => {
    const app = new AppPage(page);
    await app.gotoAuthenticated('admin_session');
    await expect(app.sidebar).toBeVisible();

    // Click the Sign Out button in the sidebar
    const signOut = page.locator('aside button', { hasText: 'Sign Out' }).first();
    await signOut.click();

    // The page reloads (window.location.reload()) and the token is gone
    // We should land back on the login screen
    await expect(page.locator('#login-username')).toBeVisible({ timeout: 15_000 });
    // Token should be removed
    const token = await page.evaluate(() => localStorage.getItem('erp_auth_token'));
    expect(token).toBeNull();
  });

  test('manually removing token and reloading shows login', async ({ page }) => {
    const app = new AppPage(page);
    await app.gotoAuthenticated('admin_session');
    await expect(app.sidebar).toBeVisible();

    // Simulate token expiry or external logout
    await page.evaluate(() => localStorage.removeItem('erp_auth_token'));
    await page.reload();

    await expect(page.locator('#login-username')).toBeVisible({ timeout: 15_000 });
  });

  test('token persists across page reload when still valid', async ({ page }) => {
    const app = new AppPage(page);
    await app.gotoAuthenticated('admin_session');
    await expect(app.sidebar).toBeVisible();

    // Reload without removing token
    await page.reload();

    // App should still be authenticated (sidebar visible, not login form)
    await expect(app.sidebar).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#login-username')).not.toBeVisible();
  });

  test('header role badge is visible after authentication', async ({ page }) => {
    const app = new AppPage(page);
    await app.gotoAuthenticated('admin_session');
    // Role badge in header shows the user role
    const badge = page.locator('header button', { hasText: /Admin|Partner|Manager/ }).first();
    await expect(badge).toBeVisible({ timeout: 8_000 });
  });
});
