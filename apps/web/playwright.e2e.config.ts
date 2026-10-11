import { defineConfig, devices } from '@playwright/test'

/**
 * Browser E2E for role and service-type routing. API traffic is stubbed per
 * test with page.route, so only the Vite dev server is required.
 */

const PORT = 5174
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 90000,
  // The dev server compiles lazy route chunks on first hit, so the default 5s
  // assertion window is too short for a cold start. Assertions are unchanged.
  expect: { timeout: 20000 },

  use: {
    baseURL: BASE_URL,
    reducedMotion: 'reduce',
    timezoneId: 'Europe/London',
    locale: 'en-GB',
    actionTimeout: 15000,
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],

  webServer: {
    command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
