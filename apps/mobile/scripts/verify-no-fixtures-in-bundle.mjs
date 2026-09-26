#!/usr/bin/env node
/**
 * Proves the invented capture fixtures are not in a store bundle.
 *
 * The claim in `src/capture/mode.ts` used to be that a build without
 * EXPO_PUBLIC_CAPTURE_MODE "compiles the whole capture path down to dead code".
 * That was true of the *code* and false of the *data*: a real AAB built from that
 * commit contained a client called Eileen, a full care plan, a medication list,
 * and the fixture route table, all unreachable but all shipped. Invented care
 * records inside a published care app read badly in a store review or a security
 * questionnaire, so this treats their presence as a build failure.
 *
 * A unit test cannot check this, because Jest imports the modules it is testing
 * and would see the data regardless of what Metro does. The only honest check
 * bundles the app the way a release does and looks at the bytes, which is what
 * this does. It is slow, so it is a separate script rather than part of `verify`
 * and it runs in CI.
 *
 *   node scripts/verify-no-fixtures-in-bundle.mjs
 *   node scripts/verify-no-fixtures-in-bundle.mjs --keep   # leave the bundle for inspection
 */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const keepBundle = process.argv.includes('--keep')

/**
 * Strings that can only come from the capture fixtures. Each is deliberately
 * distinctive: `GET /homecare/my-visits` looks like a real route, but the
 * fixtures key their table with the method inline and the API does not, so a hit
 * is unambiguous.
 */
const FIXTURE_MARKERS = [
  'Eileen',
  'cap-visit',
  'cap-person',
  'cap-staff',
  'cap-channel',
  'No capture fixture for',
  'GET /homecare/my-visits',
  'capture-step.json',
]

function fail(message) {
  console.error(`\n  ${message}\n`)
  process.exit(1)
}

/** Hermes bytecode keeps its string table, so a byte scan is sufficient. */
function findBundle(directory) {
  const jsDir = join(directory, '_expo', 'static', 'js', 'android')
  let entries
  try {
    entries = readdirSync(jsDir)
  } catch {
    fail(`No JavaScript bundle under ${jsDir}. Did the export succeed?`)
  }
  const bundle = entries.find(name => name.endsWith('.hbc') || name.endsWith('.js'))
  if (!bundle) fail(`No .hbc or .js bundle in ${jsDir}. Found: ${entries.join(', ') || '(empty)'}`)
  return join(jsDir, bundle)
}

function scan(bundlePath) {
  // Hermes string data is plain bytes, so a Buffer search is both correct and
  // far faster than decoding 4 MB as UTF-8.
  const bytes = readFileSync(bundlePath)
  return FIXTURE_MARKERS.filter(marker => bytes.includes(Buffer.from(marker, 'utf8')))
}

function main() {
  const outDir = mkdtempSync(join(tmpdir(), 'meticle-bundle-check-'))
  console.log(`\n  Building a production bundle to inspect (${outDir})`)
  console.log('  This takes a minute or two.\n')

  try {
    // Resolve the local expo CLI entry directly rather than going through
    // `npx`: spawning npx.cmd with piped stdio fails on Windows with EINVAL,
    // and this script has to work on the machine doing the release.
    const expoBin = require.resolve('expo/bin/cli')
    execFileSync(
      process.execPath,
      [expoBin, 'export', '--platform', 'android', '--output-dir', outDir, '--no-minify'],
      {
        cwd: APP_ROOT,
        stdio: 'pipe',
        // An empty value must read as "not set", so the Metro substitution and
        // the inlined flag agree that this is a normal build.
        env: { ...process.env, EXPO_PUBLIC_CAPTURE_MODE: '' },
      },
    )
  } catch (error) {
    fail(`expo export failed:\n${error.stdout?.toString().slice(-2000) || error.message}`)
  }

  const bundlePath = findBundle(outDir)
  const found = scan(bundlePath)
  const size = statSync(bundlePath).size

  if (found.length > 0) {
    fail(
      `The capture fixtures are still in the store bundle (${(size / 1024).toFixed(0)} KB):\n` +
        found.map(marker => `    ${marker}`).join('\n') +
        '\n\n  Invented care records must not ship. Check metro.config.js still substitutes\n' +
        '  src/capture for the inert stub when EXPO_PUBLIC_CAPTURE_MODE is not 1.'
    )
  }

  console.log(`  Bundle: ${(size / 1024).toFixed(0)} KB`)
  console.log(`  None of the ${FIXTURE_MARKERS.length} fixture markers are present.`)
  console.log('\n  OK — no invented care records in a store build.\n')
  if (!keepBundle) rmSync(outDir, { recursive: true, force: true })
}

main()
