import { Page, expect } from '@playwright/test';

/**
 * Page Object Model for the CrushTrack Login screen.
 * The login form is a React component that validates credentials
 * against companySettings.users (or falls back to admin@admin.com / admin123).
 */
export class LoginPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Locators — prefer stable id/aria selectors over brittle CSS. */
  get usernameInput() {
    return this.page.locator('#login-username');
  }

  get passwordInput() {
    return this.page.locator('#login-password');
  }

  get submitButton() {
    return this.page.locator('button[type="submit"]');
  }

  get errorAlert() {
    return this.page.locator('.bg-rose-50');
  }

  get fieldErrorAlerts() {
    return this.page.locator('[role="alert"]');
  }

  /** Navigate to the app root and wait for the login form to appear. */
  async goto() {
    await this.page.goto('/');
    await this.usernameInput.waitFor({ state: 'visible' });
  }

  /**
   * Fill and submit the login form.
   * @param email - Username or email address
   * @param password - Plaintext password
   */
  async login(email: string, password: string) {
    await this.usernameInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /**
   * Assert that the user has been redirected to the main app layout after login.
   * The Dashboard heading is a reliable post-login landmark.
   */
  async assertLoggedIn() {
    // After login the sidebar should be visible with "CrushTrack" branding
    await expect(this.page.locator('aside')).toBeVisible({ timeout: 10_000 });
  }

  /** Assert the error banner is visible with a message containing the given text. */
  async assertError(text: string) {
    await expect(this.errorAlert).toBeVisible();
    await expect(this.errorAlert).toContainText(text);
  }
}
