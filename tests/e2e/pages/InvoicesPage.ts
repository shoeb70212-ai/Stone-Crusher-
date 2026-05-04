import { Page, expect } from '@playwright/test';
import { AppPage } from './AppPage';

/**
 * Page Object Model for the Invoices page.
 * Accessible via the sidebar "Invoicing" nav item.
 */
export class InvoicesPage {
  readonly page: Page;
  readonly app: AppPage;

  constructor(page: Page) {
    this.page = page;
    this.app = new AppPage(page);
  }

  get heading() {
    return this.page.locator('h1, h2', { hasText: /Invoicing|Invoice/i }).first();
  }

  get createButton() {
    return this.page
      .locator('button', { hasText: /Create Invoice|New Invoice|\+/i })
      .first();
  }

  get filterButton() {
    return this.page.locator('button', { hasText: /Filter/i }).first();
  }

  get allTab() {
    return this.page.locator('button', { hasText: /^All$/i }).first();
  }

  get gstTab() {
    return this.page.locator('button', { hasText: /^GST$/i }).first();
  }

  get cashTab() {
    return this.page.locator('button', { hasText: /^Cash$/i }).first();
  }

  /** Navigate to the Invoices view from within the authenticated app. */
  async goto() {
    await this.app.navigateTo('Invoicing');
    await this.heading.waitFor({ state: 'visible', timeout: 10_000 });
  }

  /** Assert the Invoices page heading is visible. */
  async assertOnInvoicesPage() {
    await expect(this.heading).toBeVisible({ timeout: 8_000 });
  }
}
