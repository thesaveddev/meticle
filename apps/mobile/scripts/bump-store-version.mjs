#!/usr/bin/env node
/**
 * Bumps the store version of the app.
 *
 * Both stores reject an upload whose build number has not gone up, and they
 * reject it late — after the review queue, after the listing is filled in. The
 * two counters are separate keys in `app.json` (`ios.buildNumber` and
 * `android.versionCode`) and nothing in the toolchain keeps them in step, so
 * bumping one and forgetting the other is a genuinely easy mistake with an
 * expensive failure mode.
 *
 * This moves both together, because for a React Native app they describe the
 * same build. It does not touch `version`, the user-facing release number:
 * that is a decision, and is passed explicitly with `--release 0.2.0` when
 * there is one.
 *
 *   node scripts/bump-store-version.mjs            # increment the build only
 *   node scripts/bump-store-version.mjs --release 0.2.0
 *   node scripts/bump-store-version.mjs --dry-run
 *
 * With `cli.appVersionSource: "local"` in eas.json, `app.json` is the single
 * source of truth for both counters, so this is the only place they change.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APP_JSON = resolve(APP_ROOT, 'app.json')

function fail(message) {
  console.error(`\n  ${message}\n`)
  process.exit(1)
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const releaseIndex = args.indexOf('--release')
const release = releaseIndex >= 0 ? args[releaseIndex + 1] : null
if (releaseIndex >= 0 && !release) fail('--release needs a version, e.g. --release 0.2.0')

const raw = readFileSync(APP_JSON, 'utf8')
const config = JSON.parse(raw)
const expo = config.expo

// A build number is an integer that only ever goes up. Anything else here means
// the file has been hand-edited into a state the stores will not accept, and
// quietly coercing it would hide that.
const currentBuild = expo.ios?.buildNumber
const currentCode = expo.android?.versionCode
if (!Number.isInteger(Number(currentBuild))) fail(`ios.buildNumber is "${currentBuild}", which is not an integer.`)
if (!Number.isInteger(Number(currentCode))) fail(`android.versionCode is "${currentCode}", which is not an integer.`)

const nextBuild = String(Number(currentBuild) + 1)
const nextCode = Number(currentCode) + 1

const report = [
  `  ios.buildNumber     ${currentBuild} -> ${nextBuild}`,
  `  android.versionCode ${currentCode} -> ${nextCode}`,
]
if (release) report.push(`  version             ${expo.version} -> ${release}`)

if (dryRun) {
  console.log(`\n  Would bump:\n${report.map(line => `    ${line}`).join('\n')}\n`)
  process.exit(0)
}

expo.ios.buildNumber = nextBuild
expo.android.versionCode = nextCode
if (release) expo.version = release

writeFileSync(APP_JSON, `${JSON.stringify(config, null, 2)}\n`)

console.log(`\n  Bumped:\n${report.map(line => `    ${line}`).join('\n')}`)
console.log('\n  Commit this with the change it belongs to. The stores reject a build')
console.log('  number that has not increased, and they reject it at upload time.\n')
