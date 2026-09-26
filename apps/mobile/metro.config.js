// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const projectRoot = __dirname
const config = getDefaultConfig(projectRoot)

const CAPTURE_DIR = path.join(projectRoot, 'src', 'capture')
const CAPTURE_STUB = path.join(CAPTURE_DIR, 'release-stub.js')

/**
 * Keep the invented capture fixtures out of store builds.
 *
 * Capture mode serves fake care records so the six store screenshots can be
 * re-taken after a rebuild. The `__DEV__` gate in `src/capture/mode.ts` stops
 * that code from running in a release build, and the
 * `EXPO_PUBLIC_CAPTURE_MODE` flag is inlined away — but neither removes the
 * fixture *data*. The strings stay in the bundle, so a published care app ships
 * a client called Eileen with a care plan and a medication list attached to
 * nothing executable. That is exactly the sort of thing that reads badly in a
 * store review or a security questionnaire.
 *
 * The gate cannot do this job on its own: a static `import` and even a
 * `require` inside a function are both module-graph edges Metro always follows,
 * so the module and its data are bundled regardless of runtime reachability. The
 * only reliable lever is resolution itself, so when this is not a capture build
 * every import under `src/capture` resolves to an inert stub instead.
 *
 * This is deliberately keyed on the same `EXPO_PUBLIC_CAPTURE_MODE=1` the app
 * itself checks, so the two can never disagree: if Metro substituted the stub,
 * `isCaptureMode()` is false; if the app is in capture mode, the real modules
 * were bundled. `npm run verify:no-fixtures` proves it against a real bundle.
 *
 * The stub is excluded from the substitution itself, or it would resolve to
 * itself.
 */
const isCaptureBuild = process.env.EXPO_PUBLIC_CAPTURE_MODE === '1'

if (!isCaptureBuild) {
  const defaultResolveRequest = config.resolver.resolveRequest
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    // Resolve first so relative and aliased paths are normalised to real files.
    const resolved = defaultResolveRequest
      ? defaultResolveRequest(context, moduleName, platform)
      : context.resolveRequest(context, moduleName, platform)

    const filePath = resolved && (resolved.filePath || resolved.realPath)
    if (!filePath) return resolved

    const inCaptureDir = filePath.startsWith(CAPTURE_DIR + path.sep)
    if (!inCaptureDir) return resolved
    if (path.resolve(filePath) === path.resolve(CAPTURE_STUB)) return resolved

    return { type: 'sourceFile', filePath: CAPTURE_STUB }
  }
}

module.exports = config
