import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for CrushTrack ERP.
 * Targets the local dev server at http://localhost:8083.
 * Screenshots and traces are captured on first retry to aid debugging.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,   // SPA with shared flat-file state — run serially
  retries: 1,             // One retry; trace captured on first retry
  workers: 1,
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:8083',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    // Generous navigation timeout for Vite cold-start
    navigationTimeout: 15_000,
    actionTimeout: 10_000,
  },
  outputDir: 'test-results',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Dev server is assumed to be started externally; see task instructions.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8083',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
