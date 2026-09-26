/**
 * The password-reset pages were unreadable in dark mode, and nothing caught it.
 *
 * The "Check your inbox" confirmation was a hand-built `div` with
 * `bgcolor: 'success.light'` and a hardcoded `#166534` label on top. This app
 * persists a dark mode — `ThemeContext` writes `mode` to localStorage and the
 * palette swaps to slate backgrounds — so the page stayed light while the rest
 * of the application went dark, and the notice a carer is asked to trust
 * rendered dark forest-green text on a mid-saturated green. The page also forced
 * `bgcolor: 'white'` and `#111827` headings on every route, so the whole flow
 * was a white flash in a dark application.
 *
 * MUI's `Alert` derives its background, text and icon from the active palette,
 * which is the fix; the theme tokens (`background.default`, `divider`,
 * `text.primary`) are the same. This test exists so the hardcoded values cannot
 * come back through a copy-paste from another page — LoginPage was correct
 * throughout, and the two password pages had diverged from it silently.
 *
 * It reads the source rather than rendering, because the failure is a colour
 * value in a `sx` prop; asserting on rendered output would not name the cause.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const AUTH_DIR = join(process.cwd(), 'src/pages/auth')

/** The pages a carer passes through to regain access to an account. */
const RESET_FLOW_PAGES = ['ForgotPasswordPage.tsx', 'ResetPasswordPage.tsx']

/** Removes `/* *\/` and JSX `{/* *\/}` comments plus `//` lines. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[^\S\n]*\/\/[^\n]*$/gm, '')
}

/** Light-mode-only values that have no meaning once the palette swaps. */
const LIGHT_ONLY_VALUES: Record<string, string> = {
  "'white'": "use 'background.default' or 'background.paper'",
  "'grey.50'": "use a theme token such as 'background.paper' or 'action.hover'",
  '#E5E7EB': "use 'divider'",
  '#111827': "use 'text.primary'",
  '#991B1B': 'Alert severity="error" derives this from the active palette',
  '#BBF7D0': 'Alert severity="success" derives its border from the active palette',
  '#166534': 'Alert severity="success" derives its text from the active palette',
  '#15803D': 'Alert severity="success" derives its text from the active palette',
  '#FECACA': 'Alert severity="error" derives its border from the active palette',
}

describe('password reset flow respects the active colour mode', () => {
  for (const file of RESET_FLOW_PAGES) {
    it(`${file} hardcodes no light-mode-only colour`, () => {
      const source = readFileSync(join(AUTH_DIR, file), 'utf8')
      // Comments quote the old values deliberately, to explain why they went.
      // Only executable code is asserted, so both comment styles are stripped.
      const code = stripComments(source)

      const found: string[] = []
      for (const [value, advice] of Object.entries(LIGHT_ONLY_VALUES)) {
        if (code.includes(value)) found.push(`${value} — ${advice}`)
      }
      expect(found, `${file} reintroduces light-only colours:\n  ${found.join('\n  ')}`).toEqual([])
    })
  }

  it('both pages follow the LoginPage background convention', () => {
    // LoginPage is the reference implementation and has been correct
    // throughout. The reset pages had inverted it: light form on white with a
    // grey marketing panel, where Login has a tinted form on a white panel.
    for (const file of RESET_FLOW_PAGES) {
      const source = readFileSync(join(AUTH_DIR, file), 'utf8')
      expect(source, `${file} should ground itself on the theme background`).toContain(
        "bgcolor: 'background.default'",
      )
    }
  })
})
