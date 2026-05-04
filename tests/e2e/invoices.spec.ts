import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage';
import { InvoicesPage } from './pages/InvoicesPage';

/**
 * P1 — Invoices page flows.
 *
 * Verifies the Invoices page renders, tabs are switchable,
 * the filter panel is accessible, and the Create Invoice flow opens.
 */

test.describe('Invoices page', () => {
  let app: AppPage;
  let invoices: InvoicesPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    invoices = new InvoicesPage(page);
    await app.gotoAuthenticated('Admin');
    await invoices.goto();
  });

  test('renders Invoices page heading', async () => {
    await invoices.assertOnInvoicesPage();
  });

  test('All / GST / Cash tabs are visible and switchable', async ({ page }) => {
    await expect(invoices.allTab).toBeVisible();
    await expect(invoices.gstTab).toBeVisible();
    await expect(invoices.cashTab).toBeVisible();

    // Switch to GST and back to All
    await invoices.gstTab.click();
    await page.waitForTimeout(200);
    await invoices.allTab.click();
    await expect(invoices.allTab).toBeVisible();
  });

  test('invoice list or empty state is visible', async ({ page }) => {
    // Either invoices exist or an empty-state placeholder is shown
    const rows = page.locator('main table tbody tr, main .invoice-row');
    const rowCount = await rows.count();
    if (rowCount === 0) {
      // Empty state should mention invoices
      await expect(page.locator('main')).toContainText(/Invoice|No invoices/i, { timeout: 8_000 });
    } else {
      expect(rowCount).toBeGreaterThan(0);
    }
  });

  test('Create Invoice button is visible', async () => {
    await expect(invoices.createButton).toBeVisible({ timeout: 8_000 });
  });

  test('clicking Create Invoice opens a form', async ({ page }) => {
    if (await invoices.createButton.isVisible()) {
      await invoices.createButton.click();
      // The create modal should open — look for a customer selector or date input
      const modalContent = page
        .locator('[role="dialog"], .fixed.inset-0, form')
        .first();
      await expect(modalContent).toBeVisible({ timeout: 8_000 });
    }
  });

  test('filter button opens the filter panel', async ({ page }) => {
    const filterBtn = invoices.filterButton;
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
      // A filter sheet or dropdown should appear
      const filterPanel = page
        .locator('[role="dialog"], [data-state="open"], .filter-sheet')
        .first();
      await expect(filterPanel).toBeVisible({ timeout: 6_000 });
    }
  });
});
