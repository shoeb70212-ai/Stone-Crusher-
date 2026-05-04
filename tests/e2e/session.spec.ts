import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage';

/**
 * P1 — Session / Logout flows.
 *
 * Verifies that clearing the auth session correctly forces the user back
 * to the login screen and that Sign Out via the UI works.
 */

test.describe('Session management', () => {
  test('Sign Out button clears session and shows login', async ({ page }) => {
    const app = new AppPage(page);
    await app.gotoAuthenticated();
    await expect(app.sidebar).toBeVisible();

    // Click the Sign Out button in the sidebar
    const signOut = page.locator('aside button', { hasText: 'Sign Out' }).first();
    await signOut.click();

    // After sign-out the app reloads and should show the login form
    await expect(page.locator('#login-username')).toBeVisible({ timeout: 15_000 });
    // The Supabase session should be cleared from localStorage
    const session = await page.evaluate(() => localStorage.getItem('crushtrack-auth'));
    expect(session).toBeNull();
  });

  test('manually removing session and reloading shows login', async ({ page }) => {
    const app = new AppPage(page);
    await app.gotoAuthenticated();
    await expect(app.sidebar).toBeVisible();

    // Simulate token expiry or external logout by removing the Supabase session
    await page.evaluate(() => localStorage.removeItem('crushtrack-auth'));
    await page.reload();

    await expect(page.locator('#login-username')).toBeVisible({ timeout: 15_000 });
  });

  test('session persists across page reload when still valid', async ({ page }) => {
    const app = new AppPage(page);
    await app.gotoAuthenticated();
    await expect(app.sidebar).toBeVisible();

    // Reload without removing session
    await page.reload();

    // App should still be authenticated (sidebar visible, not login form)
    await expect(app.sidebar).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#login-username')).not.toBeVisible();
  });

  test('header role badge is visible after authentication', async ({ page }) => {
    const app = new AppPage(page);
    await app.gotoAuthenticated();
    // Role badge in header shows the user role
    const badge = page.locator('header button', { hasText: /Admin|Partner|Manager/ }).first();
    await expect(badge).toBeVisible({ timeout: 8_000 });
  });
});
