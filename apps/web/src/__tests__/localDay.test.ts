/**
 * A calendar day is a local idea. This stops the UTC slice coming back.
 *
 * ## What went wrong
 *
 * `new Date().toISOString().slice(0, 10)` reads like "today" and is not: it is
 * today in **UTC**. For a UK care provider under BST that is yesterday's date for
 * the first hour of every day — the hour a night shift writes its notes, does a
 * medication round and takes over from the early shift — and west of UTC it is
 * tomorrow's for the last hour of the evening. The forms it took here were
 * concrete, not theoretical:
 *
 * - A daily note recorded at 00:30 BST was filed against the previous day.
 * - The eMAR sheet highlighted yesterday's column, and the daily stock count and
 *   delivery dates defaulted to yesterday.
 * - The MAR grid and the whole call planner shifted a day, so Monday's calls sat
 *   under Sunday for the first hour of Monday.
 * - A manager's 7/14/30-day window ended yesterday, so this morning's incidents
 *   were missing from the briefing.
 * - A `datetime-local` field filled from a UTC slice showed a BST appointment an
 *   hour early and then saved that hour back, so every open-and-save drifted the
 *   booking by the browser's offset.
 *
 * None of it failed a test, because the suite runs on a UTC machine where the two
 * forms agree — the defect is invisible for the entire working day. That is why
 * the rule is a test and not a review habit.
 *
 * ## The rule
 *
 * `new Date()` with no argument may not be turned into a day string through ISO.
 * Use `apps/web/src/utils/dateFormat.ts`:
 *
 * - `localDate(date?)` / `localToday()` — a day in the reader's timezone
 * - `shiftDay(ymd, days)` / `addLocalDays(date, days)` — day arithmetic that stays local
 * - `formatDayOnly(ymd, options?, fallback?)` — a day as a label, never shifted
 * - `toLocalDateTimeInput(value)` — the value a `datetime-local` control expects
 *
 * A UTC **timestamp** is still right for an instant (audit rows, `created_at`,
 * `onboarding_dismissed_at`) — the ban is on naming a *day* from one. Converting a
 * server value that is already a `YYYY-MM-DD` date stays a string prefix
 * (`birth_date?.split('T')[0]`), which is neither form below.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/** The forms that mean "a day, according to UTC". */
const UTC_DAY_FORMS: Array<{ pattern: RegExp; use: string }> = [
  {
    pattern: /new Date\(\)\.toISOString\(\)\.(?:slice|substring)\(\s*0\s*,\s*10\s*\)/g,
    use: 'localDate() / localToday()',
  },
  {
    pattern: /new Date\(\)\.toISOString\(\)\.split\(\s*['"]T['"]\s*\)\[0\]/g,
    use: 'localDate() / localToday()',
  },
  {
    pattern: /new Date\(\)\.toISOString\(\)\.(?:slice|substring)\(\s*0\s*,\s*16\s*\)/g,
    use: 'toLocalDateTimeInput()',
  },
]

function sourceFiles(): string[] {
  const root = join(process.cwd(), 'src')
  if (!existsSync(root)) throw new Error(`local-day guard: expected source root ${root}`)
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue
        walk(p)
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        out.push(p)
      }
    }
  }
  walk(root)
  return out
}

/** Comments are stripped: the explanations of this defect quote the defect. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

const display = (p: string) => p.replace(/\\/g, '/').replace(/^.*\/src\//, 'src/')

describe('a day is never named through a UTC slice of now', () => {
  it('no file derives a day or a datetime-local value from toISOString()', () => {
    const offenders: string[] = []
    for (const file of sourceFiles()) {
      if (display(file).endsWith('utils/dateFormat.ts')) continue
      const code = stripComments(readFileSync(file, 'utf8'))
      for (const { pattern, use } of UTC_DAY_FORMS) {
        const found = code.match(pattern)
        if (found) offenders.push(`${display(file)}: ${found[0]} — use ${use}`)
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('finds the sources it is meant to be checking', () => {
    // A guard that silently walks an empty tree proves nothing.
    const files = sourceFiles()
    expect(files.length).toBeGreaterThan(100)
    expect(files.some(f => display(f).endsWith('utils/dateFormat.ts'))).toBe(true)
    expect(files.some(f => display(f).endsWith('pages/dashboard/DashboardPage.tsx'))).toBe(true)
  })
})
