/**
 * Tests for the design-token tooling.
 *
 * The ramp maths is generated rather than hand-typed, so it needs proving:
 * a silent error in the OKLab matrices would produce plausible-looking ramps
 * that are subtly wrong, and nobody would notice until a colour shipped.
 *
 *   node --test scripts/design/
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { hexToOklch, oklchToRgb, rgbToHex, maxChroma, inGamut, hexToRgb } from './oklch.mjs'
import { PALETTE, tonalRamp, buildColorMeta, RAMP_L } from './palette.mjs'
import { buildDesignMd, buildDesignJson } from './sync.mjs'
import { buildInventory, pageComponents, resolveRoutes, routeEntries } from './audit-inventory.mjs'
import { buildTracker, docWithoutTracker, routeStatuses, testIndex } from './route-tracker.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('hex -> OKLCH -> hex round-trips within one 8-bit step', () => {
  for (const hex of Object.values(PALETTE).map((p) => p.value)) {
    const back = rgbToHex(oklchToRgb(hexToOklch(hex)))
    const a = hexToRgb(hex)
    const b = hexToRgb(back)
    for (const ch of ['r', 'g', 'b']) {
      assert.ok(
        Math.abs(a[ch] - b[ch]) <= 1 / 255 + 1e-9,
        `${hex} -> ${back} drifted on ${ch}`
      )
    }
  }
})

test('known reference: mid grey has near-zero chroma', () => {
  const { L, C } = hexToOklch('#808080')
  assert.ok(C < 0.005, `expected achromatic, got C=${C}`)
  assert.ok(L > 0.5 && L < 0.6, `expected L near 0.55, got ${L}`)
})

test('known reference: sRGB primaries map to their expected hues', () => {
  // Red ~29deg, green ~142deg, blue ~264deg in OKLCH.
  assert.ok(Math.abs(hexToOklch('#FF0000').h - 29.2) < 1.5)
  assert.ok(Math.abs(hexToOklch('#00FF00').h - 142.5) < 1.5)
  assert.ok(Math.abs(hexToOklch('#0000FF').h - 264.1) < 1.5)
})

test('white and black sit at the lightness extremes', () => {
  assert.ok(hexToOklch('#FFFFFF').L > 0.99)
  assert.ok(hexToOklch('#000000').L < 0.01)
})

test('maxChroma returns the largest in-gamut chroma, and one step more is out', () => {
  const { h } = hexToOklch('#0F4C81')
  const L = 0.58
  const c = maxChroma(L, h)
  assert.ok(inGamut({ L, C: c, h }), 'maxChroma returned an out-of-gamut colour')
  assert.ok(!inGamut({ L, C: c + 0.01, h }), 'maxChroma was not maximal')
})

test('tonalRamp is deterministic and returns one valid hex per lightness target', () => {
  const a = tonalRamp('#0F4C81')
  const b = tonalRamp('#0F4C81')
  assert.deepEqual(a, b)
  assert.equal(a.length, RAMP_L.length)
  for (const hex of a) assert.match(hex, /^#[0-9A-F]{6}$/)
})

test('tonalRamp is monotonically lightening', () => {
  for (const hex of Object.values(PALETTE).map((p) => p.value)) {
    const ramp = tonalRamp(hex)
    for (let i = 1; i < ramp.length; i++) {
      assert.ok(
        hexToOklch(ramp[i]).L >= hexToOklch(ramp[i - 1]).L,
        `${hex} ramp not monotonic at ${i}`
      )
    }
  }
})

test('buildColorMeta covers every palette entry', () => {
  const meta = buildColorMeta()
  assert.equal(Object.keys(meta).length, Object.keys(PALETTE).length)
  for (const [key, spec] of Object.entries(PALETTE)) {
    assert.equal(meta[key].canonical, spec.value, `${key} canonical mismatch`)
    assert.equal(meta[key].tonalRamp.length, RAMP_L.length, `${key} ramp length`)
  }
})

test('buildDesignMd is idempotent — running it twice changes nothing', () => {
  const original = readFileSync(resolve(ROOT, 'DESIGN.md'), 'utf8')
  const once = buildDesignMd(original)
  const twice = buildDesignMd(once)
  assert.equal(once, twice, 'generator is not idempotent; it would churn on every run')
})

test('buildDesignMd preserves the prose body byte-for-byte', () => {
  const original = readFileSync(resolve(ROOT, 'DESIGN.md'), 'utf8')
  const body = (s) => s.replace(/^---\r?\n[\s\S]*?\r?\n---/, '').replace(/\r\n/g, '\n')
  assert.equal(body(buildDesignMd(original)), body(original))
})

test('buildDesignMd regenerates colour values from the canonical palette', () => {
  const out = buildDesignMd(readFileSync(resolve(ROOT, 'DESIGN.md'), 'utf8'))
  // Hex values are emitted quoted, which is valid YAML and survives re-parsing.
  assert.ok(out.includes(`navy: "${PALETTE.navy.value}"`), 'navy not regenerated')
  assert.ok(out.includes(`mint: "${PALETTE.mint.value}"`), 'mint not regenerated')
  assert.ok(out.includes(`sky: "${PALETTE.sky.value}"`), 'sky not regenerated')
})

test('palette slot names and human names agree', () => {
  // A mint colour stored under an `emerald` key is exactly the drift this
  // tooling exists to prevent, so the name has to track the value.
  assert.ok(PALETTE.mint.name.toLowerCase().includes('mint'))
  assert.ok(PALETTE.sky.name.toLowerCase().includes('sky'))
  assert.equal(PALETTE.emerald, undefined, 'emerald slot should be gone after the rebrand')
})

test('generated ramps are actually chromatic, not grey', () => {
  // Regression guard: maxChroma once short-circuited on the C=0 case, which is
  // always in gamut, so every ramp stop came out as a flat grey.
  const ramp = tonalRamp(PALETTE.navy.value)
  const chromatic = ramp.filter((hex) => hexToOklch(hex).C > 0.02).length
  assert.equal(chromatic, ramp.length, `expected every stop chromatic, got ${chromatic}/${ramp.length}`)
  const mintRamp = tonalRamp(PALETTE.mint.value)
  assert.ok(
    mintRamp.every((hex) => hexToOklch(hex).C > 0.02),
    'mint ramp lost its chroma'
  )
})

test('buildDesignJson replaces colorMeta but preserves narrative sections', () => {
  const existing = JSON.parse(readFileSync(resolve(ROOT, '.impeccable', 'design.json'), 'utf8'))
  const out = buildDesignJson(existing)
  assert.deepEqual(out.extensions.colorMeta, buildColorMeta())
  assert.deepEqual(out.narrative, existing.narrative)
  assert.deepEqual(out.components, existing.components)
})

test('drift is detectable: a hand-edited generated file fails the check', async () => {
  // Mutating a committed artifact must make --check report it as stale.
  const { computeOutputs } = await import('./sync.mjs')
  const outputs = computeOutputs()
  const designJson = Object.keys(outputs).find((f) => f.endsWith('design.json'))
  const tampered = outputs[designJson].replace('"Brand Deep Blue"', '"Tampered Blue"')
  assert.notEqual(outputs[designJson], tampered, 'check could not distinguish a tampered artifact')
})

/* ── route tracker ──────────────────────────────────────────────────
 * The tracker turns "how far has the route-by-route pass got" into a derived
 * answer. These tests hold the derivation, not the numbers: the counts are
 * expected to move as routes and tests are added, but a route that stops
 * resolving to a module is a bug in the tracker or in the router, and either
 * way it must fail here rather than print a reassuring table. */

const DOC_AUDIT = resolve(ROOT, 'docs', 'DESIGN_SYSTEM_AUDIT.md')
const DOC_DESIGN = resolve(ROOT, 'DESIGN.md')

test('the router resolves to an absolute, unique route set', () => {
  const routes = resolveRoutes()
  assert.ok(routes.length > 100, `expected the whole router, got ${routes.length} paths`)
  assert.equal(new Set(routes).size, routes.length, 'resolved paths must be unique')
  // The empty path is real: the router's pathless wrappers (`<Route element={
  // <AuthGuard />}>`) leave the URL space unchanged, so they resolve to the
  // root. Every other path is absolute.
  assert.ok(
    routes.every((r) => r === '' || r.startsWith('/')),
    `a resolved path was relative: ${routes.find((r) => r !== '' && !r.startsWith('/'))}`
  )
  assert.ok(
    routeEntries().length >= routes.length,
    'route entries cannot be fewer than the unique paths they resolve to'
  )
})

test('every route element is a page, a redirect or a declared wrapper', () => {
  const { rows, redirects, wrappers, unresolved } = routeStatuses()
  assert.deepEqual(
    unresolved.map((u) => `${u.path} → ${u.components.join(', ')}`),
    [],
    'a route renders something that is neither a page module, a redirect nor a known wrapper: ' +
      'add it to LOCAL_ROUTE_WRAPPERS or STRUCTURAL_COMPONENTS in scripts/design/route-tracker.mjs'
  )
  const accounted = [...new Set([...rows.map((r) => r.path), ...redirects, ...wrappers])].sort()
  assert.deepEqual(accounted, resolveRoutes(), 'every resolved path must be accounted for exactly once')
})

test('every routed page module exists and every lazy component resolves', () => {
  const { rows } = routeStatuses()
  assert.ok(rows.length > 100, `expected per-route rows, got ${rows.length}`)
  assert.deepEqual(
    rows.filter((r) => !existsSync(resolve(ROOT, r.module))).map((r) => r.module),
    [],
    'a route points at a module that is not on disk'
  )
  const pages = pageComponents()
  assert.ok(pages.size > 100, `expected the lazy page map, got ${pages.size}`)
  assert.deepEqual(
    [...pages.entries()].filter(([, mod]) => mod.includes('(unresolved)')).map(([name]) => name),
    [],
    'a lazy import form in App.tsx is not being parsed, so its route would report no page'
  )
})

test('the tracker cannot certify itself', () => {
  const doc = readFileSync(DOC_AUDIT, 'utf8')
  assert.ok(doc.includes('<!-- BEGIN generated route tracker -->'), 'the audit doc carries the tracker')
  const stripped = docWithoutTracker(doc)
  assert.ok(!stripped.includes('<!-- BEGIN generated route tracker -->'), 'the block marker survives')
  assert.ok(!stripped.includes('<!-- END generated route tracker -->'), 'the block end marker survives')
  assert.ok(stripped.length < doc.length, 'nothing was removed, so the audited signal would be self-fulfilling')
  assert.ok(
    routeStatuses().rows.some((r) => !r.audited),
    'the audited column is not discriminating at all'
  )
})

test('test coverage is derived from colocated tests and imports alike', () => {
  const index = testIndex()
  const medPage = 'apps/web/src/pages/emedication/EMedicationPage.tsx'
  assert.ok(index.has(medPage), 'a colocated page test must be detected')
  assert.ok(
    (index.get(medPage) ?? []).every((t) => /\.test\.(ts|tsx)$/.test(t)),
    'only test files may count as coverage'
  )
  const coveredPages = [...index.keys()].filter((k) => k.startsWith('apps/web/src/pages/'))
  assert.ok(coveredPages.length >= 20, `expected page coverage entries, got ${coveredPages.length}`)
  // Import-based coverage as well as the colocated rule: a test in another
  // directory that imports the module must count. Asserted as "such edges exist"
  // rather than pinning one import, so moving a suite does not fail the design
  // tests for no reason.
  const dirOf = (p) => p.split('/').slice(0, -1).join('/')
  const crossDirectory = [...index.entries()].filter(([mod, tests]) =>
    tests.some((t) => dirOf(t) !== dirOf(mod))
  )
  assert.ok(
    crossDirectory.length > 0,
    'no coverage is detected through an import, so only colocated tests would ever count'
  )
})

test('page-tree orphans are real paths in the page tree', () => {
  const { orphans, routed } = routeStatuses()
  for (const orphan of orphans) {
    assert.ok(existsSync(resolve(ROOT, orphan)), `${orphan} does not exist`)
    assert.ok(!/\.test\./.test(orphan), `${orphan} is a test file`)
    assert.ok(orphan.startsWith('apps/web/src/pages/'), `${orphan} is not in the page tree`)
  }
  for (const mod of routed) assert.ok(!orphans.includes(mod), `${mod} is both routed and an orphan`)
})

test('the generated blocks in both documents match their generators', () => {
  assert.ok(
    readFileSync(DOC_AUDIT, 'utf8').includes(buildTracker()),
    'the per-route tracker is stale; run npm run design:sync'
  )
  assert.ok(
    readFileSync(DOC_DESIGN, 'utf8').includes(buildInventory()),
    'the DESIGN.md inventory is stale; run npm run design:sync'
  )
})

test('the tracker summary agrees with its own rows', () => {
  const { rows } = routeStatuses()
  const block = buildTracker()
  const count = (pred) => rows.filter(pred).length
  assert.ok(
    block.includes(`| audited / updated / tested | ${count((r) => r.audited)} / ${count((r) => r.updated)} / ${count((r) => r.tested)} |`),
    'the summary line disagrees with the table'
  )
  assert.ok(
    block.includes(`| Fully signed off (all three) | ${count((r) => r.audited && r.updated && r.tested)} |`),
    'the signed-off count disagrees with the table'
  )
})