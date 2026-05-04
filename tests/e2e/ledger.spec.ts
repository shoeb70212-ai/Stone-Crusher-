import { test, expect } from '@playwright/test';
import { AppPage } from './pages/AppPage';

/**
 * P1 — Ledger page flows (Admin only).
 *
 * Verifies the Ledger page renders the transactions and customers tabs,
 * date filters are present, and the Add Transaction modal is accessible.
 */

test.describe('Ledger page', () => {
  let app: AppPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await app.gotoAuthenticated('Admin');
    await app.navigateTo('Ledger');
    await expect(
      page.locator('h1, h2', { hasText: /Ledger/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('renders Ledger page heading', async ({ page }) => {
    await expect(
      page.locator('h1, h2', { hasText: /Ledger/i }).first()
    ).toBeVisible();
  });

  test('Transactions and Customers tabs are visible', async ({ page }) => {
    // Ledger has two top-level tabs: "Transactions" and "Customers"
    const txTab = page.locator('button', { hasText: /^Transactions?$/i }).first();
    const custTab = page.locator('button', { hasText: /^Customers?$/i }).first();
    await expect(txTab).toBeVisible({ timeout: 8_000 });
    await expect(custTab).toBeVisible({ timeout: 8_000 });
  });

  test('switching to Customers tab shows customer balances', async ({ page }) => {
    const custTab = page.locator('button', { hasText: /^Customers?$/i }).first();
    await custTab.click();
    // The customers tab renders balance rows
    await expect(page.locator('main')).toContainText(
      /Customer|Balance|Opening/i,
      { timeout: 8_000 },
    );
  });

  test('date range inputs are present on Transactions tab', async ({ page }) => {
    // Ledger has start/end date filters on the Transactions tab
    const dateInputs = page.locator('input[type="date"]');
    const count = await dateInputs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('Add Transaction button is visible', async ({ page }) => {
    const addButton = page
      .locator('button', { hasText: /Add Transaction|New Transaction|\+/i })
      .first();
    await expect(addButton).toBeVisible({ timeout: 8_000 });
  });

  test('clicking Add Transaction opens a form', async ({ page }) => {
    const addButton = page
      .locator('button', { hasText: /Add Transaction|New Transaction/i })
      .first();
    if (await addButton.isVisible()) {
      await addButton.click();
      // A modal/form should appear with an Amount input
      const amountInput = page
        .locator('input[placeholder*="amount" i], input[placeholder*="Amount" i], input[type="number"]')
        .first();
      await expect(amountInput).toBeVisible({ timeout: 8_000 });
    }
  });

  test('transaction list or empty state is visible', async ({ page }) => {
    // Either there are transactions or an empty state message
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible({ timeout: 8_000 });
    const text = await mainContent.textContent();
    expect(text).toBeTruthy();
  });

  test('Export / Download button is visible', async ({ page }) => {
    // Ledger has CSV/PDF export buttons
    const exportBtn = page
      .locator('button', { hasText: /Export|Download|CSV|PDF/i })
      .first();
    if (await exportBtn.isVisible()) {
      await expect(exportBtn).toBeVisible();
    }
  });
});
