/**
 * Re-check the screenshots already on disk.
 *
 * ## Why this exists separately from the capture script
 *
 * `capture-store-screenshots.mjs` runs the same checks at the end of a capture,
 * but only over the files it just wrote, and only if you have a device attached.
 * `store-assets/` is gitignored, so nothing else ever looks at the images
 * again — which is how a set of seven byte-identical frames sat in the folder
 * with `capture-manifest.json` recording `playFormat.ok: true`.
 *
 * The duplicate check that catches it was added in 4edcf31 ("make the capture
 * gate stop lying"), *after* that capture. The gate was fixed; the artefacts
 * were never recaptured, and nothing in the repository could tell you so.
 *
 * This script is that "nothing". Run it before uploading anything, and after
 * pulling this repo onto a machine that already has a capture in `store-assets/`.
 *
 *   npm run store:verify-screenshots
 *   npm run store:verify-screenshots -- --platform ios
 *
 * Exits non-zero if the set is not uploadable. A green format check is still not
 * evidence the screenshots are good — open them. That rule is in the runbook and
 * this script does not replace it.
 */
import { readdirSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { conformScreenshot, checkScreenshotSet, formatReport } from '../apps/mobile/scripts/play-screenshot-spec.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const args = process.argv.slice(2)
const platformFlag = args.indexOf('--platform')
const platforms = platformFlag === -1
  ? ['android', 'ios']
  : [args[platformFlag + 1]]

let failed = false
let checkedAny = false

for (const platform of platforms) {
  if (!['android', 'ios'].includes(platform)) {
    console.error(`--platform must be android or ios, got "${platform}"`)
    process.exit(2)
  }

  const dir = join(REPO_ROOT, 'store-assets', 'screenshots', platform)
  console.log(`\n  ${platform} — ${dir.replace(`${REPO_ROOT}/`, '')}`)

  if (!existsSync(dir)) {
    console.log('    no capture here')
    continue
  }

  const files = readdirSync(dir)
    .filter(name => name.endsWith('.png'))
    .sort()
    .map(name => join(dir, name))

  if (files.length === 0) {
    console.log('    no PNG files here')
    continue
  }

  checkedAny = true
  // `conformScreenshot` rewrites an RGBA capture to 24-bit RGB, which is what
  // the upload needs. It is idempotent, so re-running this is safe.
  const results = files.map(file => conformScreenshot(file))
  const set = checkScreenshotSet(results)

  console.log(formatReport(results, set).join('\n'))
  console.log(`\n    ${set.ok ? 'UPLOADABLE' : 'NOT UPLOADABLE'}`)
  if (!set.ok) failed = true
}

if (!checkedAny) {
  console.log('\n  Nothing to check. Capture screenshots first — see docs/STORE_RELEASE_RUNBOOK.md §2.')
  console.log('  (store-assets/ is gitignored, so a fresh clone starts empty.)\n')
} else if (failed) {
  console.log('\n  Do not upload this set. The runbook\'s rule: a green format check is not')
  console.log('  evidence the screenshots are good — open them.\n')
}

process.exit(failed ? 1 : 0)
