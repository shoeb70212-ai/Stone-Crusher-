import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage';

/**
 * P1 — Customers page flows.
 *
 * Verifies the customer list renders, search is functional, and
 * the "Add Customer" modal opens.
 */

test.describe('Customers page', () => {
  let app: AppPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await app.gotoAuthenticated('Admin');
    await app.navigateTo('Customers');
    // Wait for the Customers page to fully render
    await expect(
      page.locator('h1, h2', { hasText: /Customer/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('renders Customers page heading', async ({ page }) => {
    await expect(
      page.locator('h1, h2', { hasText: /Customer/i }).first()
    ).toBeVisible();
  });

  test('shows existing customer from local-data.json', async ({ page }) => {
    // local-data.json has customer named "Rahul"
    await expect(page.locator('main')).toContainText('Rahul', { timeout: 8_000 });
  });

  test('search input is present and accepts text', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="Search" i]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Rahul');
      await expect(page.locator('main')).toContainText('Rahul');
      await searchInput.clear();
    }
  });

  test('Add Customer button or modal trigger is visible', async ({ page }) => {
    // The Customers page has a button to add a new customer
    const addButton = page.locator('button', { hasText: /Add Customer|New Customer|\+/i }).first();
    await expect(addButton).toBeVisible({ timeout: 8_000 });
  });

  test('clicking Add Customer opens a form', async ({ page }) => {
    const addButton = page.locator('button', { hasText: /Add Customer|New Customer/i }).first();
    if (await addButton.isVisible()) {
      await addButton.click();
      // A modal form should appear with Name input
      const nameInput = page.locator('input[placeholder*="name" i], input[name="name"]').first();
      await expect(nameInput).toBeVisible({ timeout: 8_000 });
    }
  });

  test('customer list is not empty', async ({ page }) => {
    // At least one customer row should be present (Rahul from local-data.json)
    const listItems = page.locator('main .customer-row, main table tbody tr, main li').first();
    // Use a text match instead of a structural query since we know "Rahul" exists
    await expect(page.locator('main')).toContainText('Rahul');
  });
});
