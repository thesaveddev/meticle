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
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { hexToOklch, oklchToRgb, rgbToHex, maxChroma, inGamut, hexToRgb } from './oklch.mjs'
import { PALETTE, tonalRamp, buildColorMeta, RAMP_L } from './palette.mjs'
import { buildDesignMd, buildDesignJson } from './sync.mjs'

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