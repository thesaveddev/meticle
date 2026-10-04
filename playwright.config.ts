import { defineConfig, devices } from '@playwright/test'

/**
 * Visual regression for the marketing surface.
 *
 * This exists because nothing else noticed that the design system had drifted.
 * Unit tests cannot tell you a shade of navy moved. These can.
 *
 * Determinism is the whole game here — a flaky snapshot baseline gets ignored,
 * and then it catches nothing:
 *
 *  - reducedMotion: 'reduce' kills the framer-motion entrances and the pulsing
 *    "Live" dot, which would otherwise be captured mid-animation.
 *  - animations: 'disabled' on every assertion does the same belt-and-braces.
 *  - fonts are awaited before capture; Inter falling back to Arial mid-run
 *    would diff every single pixel.
 *  - timezone and locale are pinned so any date rendering is stable.
 *
 * Baselines live in tests/visual/__screenshots__ and are committed. Review them
 * as images, not as a diff percentage.
 */

const PORT = 5173
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './tests/visual',
  // `{testDir}` is only expanded in snapshotPathTemplate; using it in
  // outputDir below created a literal `{testDir}` folder at the repo root.
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  outputDir: 'tests/visual/__results__',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // The dev server compiles on first hit of each route, and this box is not
  // fast. Generous, but bounded so a genuine hang still fails.
  timeout: 90000,

  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      // Not zero: font rasterisation differs very slightly across platforms,
      // and a harness that fails on antialiasing noise gets switched off. This
      // still fails hard on any real colour, spacing or layout change.
      maxDiffPixelRatio: 0.01,
    },
  },

  use: {
    baseURL: BASE_URL,
    reducedMotion: 'reduce',
    timezoneId: 'Europe/London',
    locale: 'en-GB',
    // The pages call the API for content; without this a slow response would
    // be captured as a loading skeleton and diff against the real thing.
    actionTimeout: 15000,
  },

  projects: [
    {
      name: 'desktop-light',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, colorScheme: 'light' },
    },
    {
      name: 'desktop-dark',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, colorScheme: 'dark' },
    },
    {
      name: 'mobile-light',
      use: { ...devices['Pixel 7'], colorScheme: 'light' },
    },
    {
      name: 'mobile-dark',
      use: { ...devices['Pixel 7'], colorScheme: 'dark' },
    },
  ],

  webServer: {
    command: 'npm run dev -w @meticle/web -- --port 5173 --strictPort',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})