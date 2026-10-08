/**
 * The password-reset pages were unreadable in dark mode, and nothing caught it.
 *
 * The "Check your inbox" confirmation was a hand-built `div` with
 * `bgcolor: 'success.light'` and a hardcoded `#087A55` label on top. This app
 * persists a dark mode — `ThemeContext` writes `mode` to localStorage and the
 * palette swaps to slate backgrounds — so the page stayed light while the rest
 * of the application went dark, and the notice a carer is asked to trust
 * rendered dark forest-green text on a mid-saturated green. The page also forced
 * `bgcolor: 'white'` and `#17202A` headings on every route, so the whole flow
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
  "'#F8FAFC'": "use a theme token such as 'background.paper' or 'action.hover'",
  '#E6EAF0': "use 'divider'",
  '#17202A': "use 'text.primary'",
  '#B42318': 'Alert severity="error" derives this from the active palette',
  '#EAFBF5': 'Alert severity="success" derives its border from the active palette',
  '#087A55': 'Alert severity="success" derives its text from the active palette',
  '#087A55': 'Alert severity="success" derives its text from the active palette',
  '#FEF0F0': 'Alert severity="error" derives its border from the active palette',
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

  it('every reset-flow page renders inside the shared AuthLayout shell', () => {
    // The ground moved from "each page sets its own theme background" to "the
    // shared shell sets it once" (apps/web/src/components/auth/AuthLayout.tsx).
    // Pages must compose that shell — a page that rolls its own Box ground is
    // exactly the copy-paste drift this test exists to catch.
    for (const file of RESET_FLOW_PAGES) {
      const source = readFileSync(join(AUTH_DIR, file), 'utf8')
      expect(source, `${file} should compose the shared AuthLayout shell`).toContain(
        "from '../../components/auth/AuthLayout'",
      )
    }
  })

  it('the shared AuthLayout grounds on the dark-mode-swapped tokens', () => {
    // AuthLayout's ground must be a var() token that the [data-theme="dark"]
    // block redefines — that is what keeps the shell dark-safe. And the dark
    // block must keep redefining it, or every auth page silently regresses to
    // a light flash inside a dark application.
    const layout = readFileSync(
      join(process.cwd(), 'src/components/auth/AuthLayout.tsx'),
      'utf8',
    )
    expect(layout, 'AuthLayout should ground on var(--mc-background)').toContain(
      "bgcolor: 'var(--mc-background)'",
    )

    const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')
    const darkStart = css.indexOf('[data-theme="dark"]')
    expect(darkStart, 'index.css should have a dark theme block').toBeGreaterThan(-1)
    const darkBlock = css.slice(darkStart)
    expect(darkBlock, 'dark block should redefine --mc-background').toContain('--mc-background:')
    expect(darkBlock, 'dark block should redefine --mc-surface').toContain('--mc-surface:')
  })
})
