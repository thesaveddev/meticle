import { defineConfig, devices } from '@playwright/test'

/**
 * Visual regression for the marketing and authenticated app surfaces.
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
      // Both numbers are measured against a runner-rendered set, and they can be
      // this tight for one reason: the baselines and the comparison come from the
      // same runner. Two independent regenerations of one commit returned
      // byte-identical PNGs in all sixteen files — a zero-pixel noise floor. The
      // old 1% was paying for cross-platform rasterisation this harness does not
      // have, because `npm run visual:update` never runs on a workstation (a
      // Windows render of the same page sits 4.7% of the frame away).
      //
      // What that allowance hid is the reason for tightening it. The default
      // `threshold` of 0.2 is 1,408 units of squared-YIQ distance, and the
      // retired brand blue -> the current one (#2F80ED -> #0164C8) measures 625,
      // so a whole palette moved under a gate whose job is to notice that. 0.1 is
      // 352 units: below any brand-colour change, above sub-perceptual noise.
      threshold: 0.1,
      // ~345 pixels at mobile, ~2,600 at desktop. Room for a stray caret or one
      // glyph edge, and far below the ~0.17% header regression that once passed
      // unnoticed for a week.
      maxDiffPixelRatio: 0.001,
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