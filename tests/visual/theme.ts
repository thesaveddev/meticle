import type { Page, TestInfo } from '@playwright/test'

/**
 * Make the `-dark` projects dark.
 *
 * Playwright's `colorScheme` option emulates `prefers-color-scheme`, and this
 * app does not read it: `ThemeContext` loads the mode from
 * `localStorage['theme-mode']` and falls back to light. So `desktop-dark` and
 * `mobile-dark` were capturing the light page — every one of the sixteen
 * baseline files had a byte-identical `-dark`/`-light` twin (same md5), which
 * is what gave it away, and it meant two thirds of the matrix was a duplicate
 * wearing the word "dark".
 *
 * Seeding the stored preference before any app code runs is the difference
 * between a project that requests dark and a project that renders it. The
 * preference is what the app itself writes when a person picks Dark in
 * Appearance, so this drives the real path rather than a test-only switch.
 *
 * Verifying a regeneration: the `-dark` captures of the authenticated
 * workspace and the auth screens should differ from their `-light` twins. The
 * marketing pages are light-only by design and may legitimately stay identical;
 * `docs/DESIGN_SYSTEM_AUDIT.md` §11 records which ones do.
 */
export function projectTheme(testInfo: TestInfo): 'light' | 'dark' {
  return testInfo.project.use.colorScheme === 'dark' ? 'dark' : 'light'
}

/**
 * Seed the stored theme. Call before the first `page.goto` — `addInitScript`
 * applies to every navigation from here on, but not to the one already in
 * flight.
 */
export async function seedTheme(page: Page, testInfo: TestInfo): Promise<void> {
  const mode = projectTheme(testInfo)
  await page.addInitScript((value) => {
    try {
      localStorage.setItem('theme-mode', value)
    } catch {
      // A blocked origin (storage disabled) leaves the app on its light
      // default, which is the same state this harness had before, so there is
      // nothing to fall back to and nothing to fail for.
    }
  }, mode)
}
