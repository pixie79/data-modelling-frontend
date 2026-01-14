import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for e2e tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',

  /* Only match .spec.ts files (pure Playwright tests), not .test.ts (Vitest/RTL tests) */
  testMatch: '**/*.spec.ts',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use */
  reporter: [['html', { open: 'never' }], ['list']],

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    /* Use port 5174 for tests to avoid conflicts with dev server on 5173 */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5174',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video recording */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to add more browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /* Run local dev server before starting the tests */
  webServer: {
    command: 'npm run dev -- --port 5174',
    url: 'http://localhost:5174',
    /* Always start fresh server for tests to avoid stale cache issues */
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },

  /* Test timeout */
  timeout: 60 * 1000,

  /* Expect timeout */
  expect: {
    timeout: 10 * 1000,
  },
});
