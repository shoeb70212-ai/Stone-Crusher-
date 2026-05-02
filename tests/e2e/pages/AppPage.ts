import { Page, expect } from '@playwright/test';

/**
 * Page Object Model for the main CrushTrack ERP application layout.
 *
 * The app is a single-page application — navigation switches React view state
 * rather than changing the browser URL. All navigation interactions go through
 * the sidebar (desktop) or the mobile bottom bar / More drawer (small screens).
 *
 * Auth bypass: set localStorage.erp_auth_token before loading the page to skip
 * the login form in tests that don't need to exercise authentication.
 */
export class AppPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ── Sidebar navigation buttons (desktop) ────────────────────────────────
  navButton(label: string) {
    // The sidebar renders nav items as <button> elements containing the label text.
    // We target the <aside> to avoid matching the mobile bottom bar.
    return this.page.locator('aside button', { hasText: label }).first();
  }

  get sidebar() {
    return this.page.locator('aside');
  }

  get header() {
    return this.page.locator('header');
  }

  get mainContent() {
    return this.page.locator('main');
  }

  get signOutButton() {
    // Both desktop sidebar and mobile More drawer have a Sign Out button
    return this.page.locator('button', { hasText: 'Sign Out' }).first();
  }

  get roleBadge() {
    // The role badge lives in the header on desktop
    return this.page.locator('header button', { hasText: /Admin|Partner|Manager/ }).first();
  }

  /**
   * Inject the auth token into localStorage and navigate to the app.
   * This bypasses the login form so most tests can start directly on the app.
   */
  async gotoAuthenticated(token = 'admin_session') {
    // First load the page so we can access localStorage
    await this.page.goto('/');
    await this.page.evaluate((t) => {
      localStorage.setItem('erp_auth_token', t);
      localStorage.setItem('erp_user_role', 'Admin');
    }, token);
    // Reload so the app picks up the token
    await this.page.reload();
    // Wait until the sidebar (main layout) is rendered
    await this.sidebar.waitFor({ state: 'visible', timeout: 15_000 });
  }

  /**
   * Click a sidebar navigation item and wait for the view to switch.
   * @param viewLabel - Exact label text as shown in the sidebar (e.g. "Customers")
   */
  async navigateTo(viewLabel: string) {
    await this.navButton(viewLabel).click();
    // Brief wait for lazy-loaded page chunk to render
    await this.page.waitForTimeout(400);
  }

  /**
   * Assert the sidebar is visible and contains the given nav label.
   */
  async assertSidebarContains(label: string) {
    await expect(this.sidebar).toBeVisible();
    await expect(this.navButton(label)).toBeVisible();
  }

  /**
   * Assert main content area contains the given heading or text.
   */
  async assertContentContains(text: string) {
    await expect(this.mainContent).toContainText(text, { timeout: 10_000 });
  }

  /**
   * Clear the auth token from localStorage and reload — simulates logout.
   */
  async logout() {
    await this.page.evaluate(() => {
      localStorage.removeItem('erp_auth_token');
    });
    await this.page.reload();
  }
}
