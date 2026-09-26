#!/usr/bin/env node
/**
 * Takes the six store screenshots, repeatably.
 *
 * The app does the hard part: with EXPO_PUBLIC_CAPTURE_MODE=1 it serves fixture
 * data, raises no permission prompts, and walks the six screens in order,
 * writing `capture-step.json` once each screen has settled (src/capture). This
 * script watches that file and takes the picture, so nothing here knows where a
 * button is and nothing breaks when the layout moves.
 *
 * It deliberately does not launch the app. Starting Metro and opening a
 * development build is two commands a person runs on the machine that has the
 * simulator or the emulator, and getting that wrong is a much more common
 * failure than anything in here. Run `--print-launch` for the exact commands.
 *
 *   node scripts/capture-store-screenshots.mjs --platform ios
 *   node scripts/capture-store-screenshots.mjs --platform android --dry-run
 */
import { execFile, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const HERE = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = resolve(HERE, '..')
const REPO_ROOT = resolve(APP_ROOT, '../..')

/* ─── Arguments ─────────────────────────────────────────────── */

function parseArgs(argv) {
  const args = { platform: '', out: '', only: [], dryRun: false, udid: '', timeout: 90, printLaunch: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => argv[++i]
    if (arg === '--platform') args.platform = next()
    else if (arg === '--out') args.out = next()
    else if (arg === '--only') args.only.push(...next().split(',').map(value => value.trim()).filter(Boolean))
    else if (arg === '--udid') args.udid = next()
    else if (arg === '--timeout') args.timeout = Number(next())
    else if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--print-launch') args.printLaunch = true
    else if (arg === '--help' || arg === '-h') args.help = true
    else fail(`Unknown argument "${arg}". Try --help.`)
  }
  return args
}

function fail(message) {
  console.error(`\n  ${message}\n`)
  process.exit(1)
}

const USAGE = `
  Takes the six Meticle Care store screenshots from a running capture build.

    --platform ios|android   Required. Which device to photograph.
    --out <dir>              Where to write. Default: <repo>/store-assets/screenshots/<platform>
    --only <id,id>           Recapture a subset, e.g. 05-chat
    --udid <id>              A specific simulator or device. Default: the booted one.
    --timeout <seconds>      How long to wait for each shot. Default: 90.
    --dry-run                Print the plan and exit. Touches nothing.
    --print-launch           Print the two commands that start the capture build.
`

/* ─── The shot list ─────────────────────────────────────────── */

/**
 * Read straight out of the app's own shot list rather than kept here as well:
 * one list, so the six images and the six lines of store copy cannot drift.
 */
function readShotList() {
  const source = readFileSync(join(APP_ROOT, 'src/capture/shots.ts'), 'utf8')
  const shots = []
  const blockPattern = /\{\s*index:\s*(\d+),\s*id:\s*'([^']+)',\s*title:\s*'([^']*)',\s*storeCaption:\s*'([^']*)',[\s\S]*?dwellMs:\s*([A-Za-z0-9_ +]+?),?\s*\}/g
  let match
  while ((match = blockPattern.exec(source)) !== null) {
    shots.push({
      index: Number(match[1]),
      id: match[2],
      title: match[3],
      storeCaption: match[4],
      dwellMs: resolveDwell(match[5]),
    })
  }
  if (shots.length === 0) fail('Could not read the shot list from src/capture/shots.ts. Has its shape changed?')
  if (shots.length !== 6) fail(`The shot list has ${shots.length} shots, not 6. The store listing expects six.`)
  return shots
}

/** The shot list writes its dwell times as `SETTLE_MS` and `SETTLE_MS + 600`. */
function resolveDwell(expression) {
  const SETTLE_MS = 1200
  const resolved = expression.replace(/SETTLE_MS/g, String(SETTLE_MS))
  const parts = resolved.split('+').map(part => Number(part.trim()))
  if (parts.some(part => !Number.isFinite(part))) fail(`Could not read a dwell time from "${expression.trim()}" in src/capture/shots.ts.`)
  const value = parts.reduce((total, part) => total + part, 0)
  if (value <= 0) fail(`A dwell time of ${value}ms in src/capture/shots.ts would never let the app settle.`)
  return value
}

function readAppIds() {
  const config = JSON.parse(readFileSync(join(APP_ROOT, 'app.json'), 'utf8')).expo
  return {
    bundleId: config.ios?.bundleIdentifier,
    package: config.android?.package,
    name: config.name,
  }
}

/* ─── Platform plumbing ─────────────────────────────────────── */

function which(command) {
  try {
    return execFileSync(process.platform === 'win32' ? 'where' : 'which', [command], { stdio: 'pipe' }).toString().trim().split(/\r?\n/)[0]
  } catch {
    return null
  }
}

function iosDevice(udid) {
  const list = execFileSync('xcrun', ['simctl', 'list', 'devices', 'booted', '--json'], { stdio: 'pipe' }).toString()
  const booted = Object.values(JSON.parse(list).devices).flat().filter(device => device.state === 'Booted')
  if (udid) {
    const match = booted.find(device => device.udid === udid)
    if (!match) fail(`No booted simulator with udid ${udid}. Boot one in Xcode first.`)
    return match
  }
  if (booted.length === 0) fail('No booted iOS simulator. Open Xcode > Devices and Simulators, boot one, and try again.')
  if (booted.length > 1) fail(`More than one simulator is booted (${booted.map(d => d.name).join(', ')}). Pass --udid.`)
  return booted[0]
}

async function androidDevice(udid) {
  const { stdout } = await execFileAsync('adb', ['devices', '-l'])
  const connected = stdout.split('\n').slice(1)
    .map(line => line.trim())
    .filter(line => line && line.includes('device '))
    .map(line => line.split(/\s+/)[0])
  if (connected.length === 0) fail('No Android device or emulator is connected. Start one and try `adb devices`.')
  if (udid) {
    if (!connected.includes(udid)) fail(`${udid} is not connected. Connected: ${connected.join(', ') || 'none'}.`)
    return udid
  }
  if (connected.length > 1) fail(`More than one Android device is connected (${connected.join(', ')}). Stop the extras or pass --udid.`)
  return connected[0]
}

const platform = {
  ios: {
    stepFile: async (device, appId) => {
      const container = execFileSync('xcrun', ['simctl', 'get_app_container', device.udid, appId, 'data'], { stdio: 'pipe' }).toString().trim()
      return join(container, 'Documents', 'capture-step.json')
    },
    readStep: async (device, appId) => {
      const path = await platform.ios.stepFile(device, appId)
      return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null
    },
    capture: (device, destination) => {
      execFileSync('xcrun', ['simctl', 'io', device.udid, 'screenshot', '--type=png', destination], { stdio: 'pipe' })
    },
    describe: device => `iOS Simulator — ${device.name} (${device.udid})`,
    preflight: () => {
      if (!which('xcrun')) fail('xcrun was not found. This script needs macOS with Xcode and its command line tools installed.')
    },
  },
  android: {
    stepFile: async (device, appId) => null,
    readStep: async (device, appId) => {
      // `run-as` only works on a debuggable build, which is what a development
      // build is. The file lives in the app's own files directory; the cache
      // directory is tried as well because the two moved between Expo versions.
      for (const directory of ['files', 'cache', '.']) {
        const { stdout } = await execFileAsync('adb', ['-s', device, 'shell', 'run-as', appId, 'cat', `${directory}/capture-step.json`])
          .catch(() => ({ stdout: '' }))
        if (stdout.trim()) return JSON.parse(stdout)
      }
      return null
    },
    capture: (device, destination) => {
      // screencap writes the PNG to stdout. It is captured as a buffer rather
      // than through a shell redirect, which corrupts binary on some builds.
      const image = execFileSync('adb', ['-s', device, 'exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 })
      writeFileSync(destination, image)
    },
    describe: device => `Android — ${device}`,
    preflight: () => {
      if (!which('adb')) fail('adb was not found. Install the Android SDK platform-tools and put adb on your PATH.')
    },
  },
}

/* ─── The run ───────────────────────────────────────────────── */

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function waitForShot(target, appId, device, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1000
  let lastSeq = -1
  while (Date.now() < deadline) {
    const signal = await platform[target].readStep(device, appId)
    if (signal && signal.seq > lastSeq) {
      lastSeq = signal.seq
      if (signal.state === 'error') fail(`The app reported an error during the capture tour: ${signal.error}`)
      if (signal.state === 'done') return { done: signal }
      if (signal.state === 'shot' && signal.shot === target.id) return { shot: signal }
    }
    await sleep(400)
  }
  fail(`Timed out after ${timeoutSeconds}s waiting for "${target.id}". Is the app running with EXPO_PUBLIC_CAPTURE_MODE=1? Run with --print-launch to see the command.`)
}

function launchInstructions(target, appId) {
  if (target === 'ios') {
    return [
      'cd apps/mobile',
      'EXPO_PUBLIC_CAPTURE_MODE=1 npx expo start --dev-client --ios',
      '',
      'Leave that running, then run this script in a second terminal.',
    ]
  }
  return [
    'cd apps/mobile',
    'EXPO_PUBLIC_CAPTURE_MODE=1 npx expo start --dev-client --android',
    '',
    'Leave that running, then run this script in a second terminal.',
  ]
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) { console.log(USAGE); return }
  if (!['ios', 'android'].includes(args.platform)) fail(`--platform must be ios or android.\n${USAGE}`)

  const shots = readShotList()
  const wanted = args.only.length ? shots.filter(shot => args.only.includes(shot.id)) : shots
  if (wanted.length === 0) fail(`--only matched none of: ${shots.map(shot => shot.id).join(', ')}`)
  const appId = readAppIds()
  const identifier = args.platform === 'ios' ? appId.bundleId : appId.package
  if (!identifier) fail(`No ${args.platform} identifier in app.json.`)
  const outDir = resolve(args.out || join(REPO_ROOT, 'store-assets', 'screenshots', args.platform))

  if (args.dryRun) {
    // A dry run has to work on a machine with no device attached — that is
    // often exactly the machine you want to check the plan on.
    console.log(`\n  Would capture ${wanted.length} shot(s) of ${identifier}\n`)
    console.log(`  Device:   the booted ${args.platform === 'ios' ? 'iOS simulator' : 'Android device or emulator'} (or --udid)`)
    console.log(`  Watching: capture-step.json in the app's own container`)
    console.log(`  Writing:  ${outDir}\n`)
    for (const shot of wanted) {
      console.log(`  ${String(shot.index).padStart(2, '0')}. ${shot.id.padEnd(22)} ${shot.title}`)
      console.log(`      ${shot.storeCaption}`)
    }
    console.log(`\n  Start the app first:\n`)
    console.log(launchInstructions(args.platform, identifier).map(line => `    ${line}`).join('\n'))
    console.log('')
    return
  }

  platform[args.platform].preflight()
  const device = args.platform === 'ios' ? iosDevice(args.udid) : await androidDevice(args.udid)

  if (args.printLaunch) {
    console.log(launchInstructions(args.platform, identifier).join('\n'))
    return
  }

  mkdirSync(outDir, { recursive: true })
  console.log(`\n  ${platform[args.platform].describe(device)}`)
  console.log(`  Writing to ${outDir}\n`)

  const captured = []
  for (const shot of wanted) {
    process.stdout.write(`  ${String(shot.index).padStart(2, '0')}/${wanted.length}  ${shot.id.padEnd(22)} waiting for the screen…`)
    await waitForShot(shot, identifier, device, args.timeout)
    const destination = join(outDir, `${shot.id}.png`)
    platform[args.platform].capture(device, destination)
    if (!existsSync(destination)) fail(`The screenshot for ${shot.id} was not written.`)
    console.log(` saved`)
    captured.push({ ...shot, file: destination })
    // The app holds the screen for its dwell time; do not race it to the next
    // shot or the capture lands mid-transition.
    await sleep(shot.dwellMs)
  }

  // The app reports which endpoints its fixtures could not answer when the tour
  // finishes. That list is the warning sign for a screenshot that is emptier
  // than it should be, so it is recorded rather than logged and forgotten.
  const done = await platform[args.platform].readStep(device, identifier)
  const misses = done?.state === 'done' ? (done.misses || []) : []

  const manifest = {
    capturedAt: new Date().toISOString(),
    platform: args.platform,
    device: platform[args.platform].describe(device),
    app: identifier,
    shots: captured.map(({ index, id, title, storeCaption, file }) => ({ index, id, title, storeCaption, file: file.replace(`${REPO_ROOT}/`, '') })),
    fixtureMisses: misses,
  }
  writeFileSync(join(outDir, 'capture-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  writeFileSync(join(outDir, 'store-listing-copy.md'), listingCopy(manifest))

  console.log(`\n  ${captured.length} screenshot(s) saved.`)
  console.log(`  Manifest:  ${join(outDir, 'capture-manifest.json')}`)
  console.log(`  Copy:      ${join(outDir, 'store-listing-copy.md')}`)
  if (misses.length) {
    console.log(`\n  WARNING: the app asked for ${misses.length} endpoint(s) the fixtures do not answer.`)
    console.log('  A screen may be emptier in the image than it should be:')
    for (const miss of misses) console.log(`    ${miss}`)
  }
  console.log('')
}

function listingCopy(manifest) {
  const lines = [
    `# Store listing copy — ${manifest.platform}`,
    '',
    `Captured ${manifest.capturedAt} on ${manifest.device}.`,
    '',
    'Paste these under each image, in order. The file names are the order.',
    '',
  ]
  for (const shot of manifest.shots) {
    lines.push(`${shot.index}. **${shot.title}** — \`${shot.file.split('/').pop()}\``)
    lines.push(`   ${shot.storeCaption}`)
    lines.push('')
  }
  lines.push('## Before uploading')
  lines.push('')
  lines.push('- Play wants at least 2 phone screenshots, 16:9 or 9:16, 320–3840 px on the long edge.')
  lines.push('- Apple wants a 6.9" and a 6.5" set; only one size is mandatory.')
  lines.push('- These are device-resolution images. If Play rejects the aspect ratio, crop rather than rescale.')
  lines.push('- Check nothing in the image identifies a real client. The fixtures are invented, but the app chrome is not.')
  lines.push('')
  return lines.join('\n')
}

main().catch(error => fail(error?.stack || String(error)))

export { readShotList, listingCopy }
