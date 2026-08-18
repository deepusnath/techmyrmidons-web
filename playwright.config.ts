import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

/**
 * Set BASE_URL to run the same suite against a deployed preview instead of the
 * local export, e.g.
 *   BASE_URL=https://deepusnath.github.io/techmyrmidons-web npx playwright test
 */
const EXTERNAL = process.env.BASE_URL;

/**
 * Tests run against the built static export, not the dev server, so they
 * exercise the artifact that actually gets deployed.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: EXTERNAL ?? `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: EXTERNAL
    ? undefined
    : {
        command: `node scripts/serve-static.ts --port ${PORT}`,
        port: PORT,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
});
