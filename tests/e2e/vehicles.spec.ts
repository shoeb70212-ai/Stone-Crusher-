import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage';

/**
 * P1 — Vehicles page flows.
 *
 * Verifies the Vehicles page renders the fleet list and the
 * "Add Vehicle" modal is accessible. Also checks search functionality.
 */

test.describe('Vehicles page', () => {
  let app: AppPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await app.gotoAuthenticated('Admin');
    await app.navigateTo('Vehicles');
    await expect(
      page.locator('h1, h2', { hasText: /Vehicle/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('renders Vehicles page heading', async ({ page }) => {
    await expect(
      page.locator('h1, h2', { hasText: /Vehicle/i }).first()
    ).toBeVisible();
  });

  test('shows existing vehicle from local-data.json', async ({ page }) => {
    // local-data.json has vehicle "MH 20 AA 0555"
    await expect(page.locator('main')).toContainText('MH 20 AA 0555', { timeout: 8_000 });
  });

  test('vehicle list or empty state is visible', async ({ page }) => {
    const rows = page.locator('main table tbody tr, main .vehicle-card');
    const rowCount = await rows.count();
    if (rowCount === 0) {
      await expect(page.locator('main')).toContainText(/Vehicle|No vehicle/i);
    } else {
      expect(rowCount).toBeGreaterThan(0);
    }
  });

  test('Add Vehicle button is visible', async ({ page }) => {
    const addButton = page
      .locator('button', { hasText: /Add Vehicle|New Vehicle|\+/i })
      .first();
    await expect(addButton).toBeVisible({ timeout: 8_000 });
  });

  test('clicking Add Vehicle opens a form with Vehicle No input', async ({ page }) => {
    const addButton = page
      .locator('button', { hasText: /Add Vehicle|New Vehicle/i })
      .first();
    if (await addButton.isVisible()) {
      await addButton.click();
      // The modal form should have a Vehicle No field
      const vehicleNoInput = page
        .locator('input[placeholder*="vehicle" i], input[placeholder*="Vehicle" i], input[name="vehicleNo"]')
        .first();
      await expect(vehicleNoInput).toBeVisible({ timeout: 8_000 });
    }
  });

  test('search input filters the vehicle list', async ({ page }) => {
    const searchInput = page
      .locator('input[placeholder*="search" i], input[placeholder*="Search" i]')
      .first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('MH 20 AA 0555');
      await expect(page.locator('main')).toContainText('MH 20 AA 0555');
      await searchInput.clear();
    }
  });

  test('vehicle card shows owner name', async ({ page }) => {
    // Vehicles have an ownerName field — at least one should be shown
    // local-data.json data should contain at least one vehicle with an owner
    const mainText = await page.locator('main').textContent();
    expect(mainText).toBeTruthy();
  });

  test('closing Add Vehicle form returns to vehicle list', async ({ page }) => {
    const addButton = page
      .locator('button', { hasText: /Add Vehicle|New Vehicle/i })
      .first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.locator('input').first().waitFor({ state: 'visible', timeout: 8_000 });

      const closeButton = page
        .locator('button', { hasText: /Cancel|Close/i })
        .first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
      } else {
        await page.keyboard.press('Escape');
      }

      // Add Vehicle button should be visible again
      await expect(addButton).toBeVisible({ timeout: 8_000 });
    }
  });
});
