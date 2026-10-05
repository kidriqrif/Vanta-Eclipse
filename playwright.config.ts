import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke tests against the dev server (npm run e2e). Mobile portrait viewport.
 * PW_CHROMIUM lets a machine point at a pre-installed browser instead of `npx playwright install`.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    ...devices['Pixel 7'],
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
