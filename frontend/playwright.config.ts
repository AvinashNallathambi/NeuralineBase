import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Playwright E2E configuration for the Neuraline frontend.
 *
 * Prerequisites:
 *   - Backend (NestJS) running on http://localhost:4000
 *   - Frontend dev server running on http://localhost:5173 (or use the
 *     webServer config below to start it automatically).
 *   - PostgreSQL + Redis services running (see docker-compose.yml).
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',

  /* Run tests in files in parallel */
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI to avoid data races against the dev backend */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use */
  reporter: [['html', { outputFolder: './playwright-report' }], ['list']],

  /* Shared settings for all the projects below */
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    /* Collect console messages and page errors in test artifacts */
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /*
   * Playwright auto-starts the full dev stack (Vite frontend + NestJS backend)
   * via the root `npm run dev` script before running tests, then tears it down
   * afterwards. The health URL polls the backend liveness endpoint
   * (GET /api/v1/health) because the backend takes longer to boot than Vite —
   * once the backend responds, the frontend is already serving.
   *
   * Prerequisites: PostgreSQL + Redis must be running (the root `e2e` script
   * starts them via Docker automatically — see package.json `e2e`).
   *
   * reuseExistingServer: if you already have `npm run dev` running locally,
   * Playwright will reuse it instead of starting a second instance.
   */
  webServer: {
    command: 'cd .. && npm run dev',
    url: 'http://localhost:4000/api/v1/health',
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
  },

  globalSetup: path.resolve(__dirname, './e2e/global.setup.ts'),
});
