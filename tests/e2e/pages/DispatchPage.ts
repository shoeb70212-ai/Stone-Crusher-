import { Page, expect } from '@playwright/test';
import { AppPage } from './AppPage';

/**
 * Page Object Model for the Dispatch (Slips) page.
 * Dispatch is accessible via the sidebar "Dispatch (Slips)" nav item.
 */
export class DispatchPage {
  readonly page: Page;
  readonly app: AppPage;

  constructor(page: Page) {
    this.page = page;
    this.app = new AppPage(page);
  }

  get newSlipButton() {
    // The create button is labelled "+ Create Slip" in the Dispatch page header
    return this.page.locator('button', { hasText: /Create Slip|New Slip/i }).first();
  }

  get slipModal() {
    // The CreateSlipForm is wrapped in a MobileModal; we wait for the form heading
    return this.page.locator('[role="dialog"], .fixed.inset-0').first();
  }

  get slipFormVehicleInput() {
    // Vehicle number combobox trigger or input inside the slip form
    return this.page.locator('input[placeholder*="vehicle" i], input[placeholder*="Vehicle" i]').first();
  }

  get slipsList() {
    // Rows in the slips table / card list
    return this.page.locator('main table tbody tr, main .slip-card');
  }

  /** Navigate to the Dispatch view from within the authenticated app. */
  async goto() {
    await this.app.navigateTo('Dispatch (Slips)');
    await this.page.waitForTimeout(300);
  }

  /** Click the "New Slip" button and wait for the modal/form to appear. */
  async openNewSlipForm() {
    await this.newSlipButton.click();
    // Wait for any form input to appear inside the modal
    await this.page.locator('input, select, textarea').nth(1).waitFor({ state: 'visible', timeout: 8_000 });
  }

  /** Assert that the Dispatch page heading is visible. */
  async assertOnDispatchPage() {
    await expect(
      this.page.locator('h1, h2', { hasText: /dispatch|slips/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  }
}
