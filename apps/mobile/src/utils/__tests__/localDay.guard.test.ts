/**
 * A calendar day is the carer's day. This stops the UTC slice coming back.
 *
 * The web app has the same guard (`apps/web/src/__tests__/localDay.test.ts`) for
 * the same reasons, and the mobile app had the same defects: a meal or an
 * incident logged at 00:30 on a night shift was filed against the previous day,
 * the pay and timesheet month windows started on the last day of the previous
 * month, and — the worst of them — `MileageScreen` sent full ISO timestamps to
 * `/homecare/my-earnings`, which accepts `YYYY-MM-DD` only, so every carer's pay
 * screen answered "No earnings data" while its own test rebuilt the same
 * timestamps and passed.
 *
 * Use `src/utils/localDay.ts`: `localDate`, `localToday`, `shiftDay`. A genuine
 * timestamp (`createdAt`, a queue entry, a check-in instant) is still a
 * timestamp — the ban is on naming a *day* from one.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const UTC_DAY_FORMS: Array<{ pattern: RegExp; use: string }> = [
  {
    pattern: /new Date\(\)\.toISOString\(\)\.(?:slice|substring)\(\s*0\s*,\s*10\s*\)/g,
    use: 'localToday() / localDate()',
  },
  {
    pattern: /new Date\(\)\.toISOString\(\)\.split\(\s*['"]T['"]\s*\)\[0\]/g,
    use: 'localToday() / localDate()',
  },
]

function sourceFiles(): string[] {
  const root = join(__dirname, '..', '..')
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

describe('a day is never named through a UTC slice of now (mobile)', () => {
  it('no screen derives a day from toISOString()', () => {
    const offenders: string[] = []
    for (const file of sourceFiles()) {
      if (display(file).endsWith('utils/localDay.ts')) continue
      const code = stripComments(readFileSync(file, 'utf8'))
      for (const { pattern, use } of UTC_DAY_FORMS) {
        const found = code.match(pattern)
        if (found) offenders.push(`${display(file)}: ${found[0]} — use ${use}`)
      }
    }
    // Joined rather than compared as an array so the failure names the files.
    expect(offenders.join('\n')).toBe('')
  })

  it('finds the sources it is meant to be checking', () => {
    const files = sourceFiles()
    expect(files.length).toBeGreaterThan(30)
    expect(files.some(f => display(f).endsWith('screens/MileageScreen.tsx'))).toBe(true)
    expect(files.some(f => display(f).endsWith('utils/localDay.ts'))).toBe(true)
  })
})
