import { Page, expect } from '@playwright/test';

/**
 * Page Object Model for the main CrushTrack ERP application layout.
 *
 * The app is a single-page application — navigation switches React view state
 * rather than changing the browser URL. All navigation interactions go through
 * the sidebar (desktop) or the mobile bottom bar / More drawer (small screens).
 *
 * Auth bypass: inject a fake Supabase session into localStorage under the
 * `crushtrack-auth` key before the page loads. The app reads it via
 * `supabase.auth.getSession()` which reads from the storageKey.
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
   * Inject a fake Supabase session into localStorage and navigate to the app.
   *
   * The Supabase JS client stores the session under the `storageKey` value
   * (`crushtrack-auth`). We write a minimal valid-shaped session object so
   * `supabase.auth.getSession()` parses it as a live session and the app
   * renders the authenticated layout instead of the login form.
   *
   * App.tsx explicitly removes `erp_auth_token` on every mount (L65), so
   * injecting the legacy key has no effect — only `crushtrack-auth` works.
   */
  async gotoAuthenticated(role: 'Admin' | 'Partner' | 'Manager' = 'Admin') {
    // Build a minimal Supabase session object. The SDK reads this from
    // localStorage and calls `getSession()` which resolves it synchronously.
    const fakeSession = {
      access_token: 'e2e-fake-access-token',
      refresh_token: 'e2e-fake-refresh-token',
      expires_in: 3600,
      // expires_at is a Unix timestamp — set far in the future
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: {
        id: 'e2e-user-id',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'e2e@crushtrack.test',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        app_metadata: { provider: 'email' },
        user_metadata: {},
      },
    };

    await this.page.addInitScript(
      ({ sessionKey, session, userRole }: { sessionKey: string; session: object; userRole: string }) => {
        // Write the session before any JS runs so Supabase picks it up on init.
        localStorage.setItem(sessionKey, JSON.stringify(session));
        localStorage.setItem('erp_user_role', userRole);
      },
      { sessionKey: 'crushtrack-auth', session: fakeSession, userRole: role },
    );

    await this.page.goto('/');
    // Wait until the sidebar (main layout) is rendered
    await this.sidebar.waitFor({ state: 'visible', timeout: 20_000 });
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
   * Sign out via the sidebar Sign Out button.
   */
  async logout() {
    await this.signOutButton.click();
  }
}
