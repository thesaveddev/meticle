import { expect, type Page, type TestInfo } from '@playwright/test'

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
 * workspace and the auth screens differ from their `-light` twins by most of
 * the frame, and the marketing pages keep their light design — measured at
 * 7.2% (`home`) and 7.4% (`pricing`) of the frame, which is the dark ground
 * showing through. `docs/DESIGN_SYSTEM_AUDIT.md` §10 carries the numbers.
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

/**
 * Assert the page answered the seeded preference before it is photographed.
 *
 * This guards the failure that went unnoticed for weeks: the seeding is a line
 * of JavaScript, and if it stops running — a renamed storage key, a blocked
 * origin, a provider that writes `data-theme` from somewhere else — the `-dark`
 * projects return to photographing light pages while the comparison agrees with
 * a baseline set that is light too. That is a green gate measuring nothing, and
 * no screenshot comparison can catch it, because both sides move together: the
 * old set had every `-dark` file byte-identical to its `-light` twin.
 *
 * It reads the real signal rather than a test-only switch. `ThemeContext` writes
 * `document.documentElement.dataset.theme` from the same `localStorage` key a
 * person's Appearance choice lands in, so this asserts the app's own answer.
 * Measured on all four captured routes — `/`, `/pricing`, `/login` and the
 * authenticated workspace — it is the seeded value in both modes.
 */
export async function expectThemeApplied(page: Page, testInfo: TestInfo): Promise<void> {
  const expected = projectTheme(testInfo)
  const applied = await page.evaluate(() => document.documentElement.dataset.theme ?? null)
  expect(
    applied,
    `the ${testInfo.project.name} project seeded "${expected}" and the page answered "${applied}" — `
      + 'a capture taken now is of the wrong theme, whatever it is compared against'
  ).toBe(expected)
}
