/**
 * Architectural guard: the app must not hold a position subscription.
 *
 * The unit tests in `VisitScreen.test.tsx` prove that screen does not read
 * position until asked. This proves something stronger — that *no* screen can,
 * now or later, without anyone having to notice.
 *
 * A location subscription is the difference between checking where somebody is
 * and following them around. It is also the kind of change that looks
 * reasonable in review: "show the carer how far they still have to walk" is a
 * two-line diff and a real product improvement. Nothing about it fails a test
 * on its own. So the rule is pinned here instead, as a scan of the source.
 *
 * The three permitted calls are all one-shot reads behind a user action. Any
 * other position API fails this test.
 */
import * as fs from 'fs'
import * as path from 'path'

const SRC = path.join(__dirname, '..')

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full)
    if (!/\.(ts|tsx)$/.test(entry.name)) return []
    return [full]
  })
}

/** APIs that keep reading position on their own. Each one is continuous by construction. */
const SUBSCRIPTION_APIS = [
  'watchPositionAsync',
  'startLocationUpdatesAsync',
  'watchPositionImplAsync',
  'getBackgroundPermissionsAsync',
  'requestBackgroundPermissionsAsync',
]

describe('location capture', () => {
  const files = sourceFiles(SRC)

  it('has source files to scan, so an empty glob cannot pass silently', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it.each(SUBSCRIPTION_APIS)('never calls %s anywhere in the app', api => {
    const offenders = files.filter(file =>
      new RegExp(`\\b${api}\\s*\\(`).test(fs.readFileSync(file, 'utf8')),
    )
    expect(offenders).toEqual([])
  })

  it('only ever reads position through getVisitLocation', () => {
    // The one function permitted to ask the OS for a fix. Everything else must
    // go through it, so there is a single place to audit.
    const direct = files.filter(file => {
      const source = fs.readFileSync(file, 'utf8')
      return /\.getCurrentPositionAsync\s*\(/.test(source)
    })
    expect(direct).toEqual([path.join(SRC, 'services', 'location.ts')])
  })
})
