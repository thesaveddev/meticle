/**
 * sRGB <-> OKLab/OKLCH conversions (Björn Ottosson's matrices).
 *
 * These exist so that the generated design system's tonal ramps are computed
 * from a single canonical hex per colour, rather than hand-typed and drifting.
 * Every function is pure and deterministic: same input, same output, always.
 */

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)

/** sRGB transfer function -> linear-light. */
function toLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** Linear-light -> sRGB transfer function. */
function toSrgb(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

/** '#RRGGBB' -> { r, g, b } in 0..1 sRGB. Throws on malformed input. */
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim())
  if (!m) throw new Error(`Not a hex colour: ${JSON.stringify(hex)}`)
  let h = m[1]
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  }
}

/** { r, g, b } in 0..1 -> '#RRGGBB' (uppercase, matching the existing artifacts). */
export function rgbToHex({ r, g, b }) {
  const to = (v) =>
    Math.round(clamp01(v) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()
  return `#${to(r)}${to(g)}${to(b)}`
}

/** '#RRGGBB' -> { L, C, h } OKLCH. Hue in degrees 0..360. */
export function hexToOklch(hex) {
  const { r, g, b } = hexToRgb(hex)
  const lr = toLinear(r)
  const lg = toLinear(g)
  const lb = toLinear(b)

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_

  const C = Math.sqrt(A * A + B * B)
  let h = (Math.atan2(B, A) * 180) / Math.PI
  if (h < 0) h += 360
  return { L, C, h }
}

/** { L, C, h } -> { r, g, b } in 0..1 sRGB, unclamped (may be out of gamut). */
export function oklchToRgb({ L, C, h }) {
  const hr = (h * Math.PI) / 180
  const A = C * Math.cos(hr)
  const B = C * Math.sin(hr)

  const l_ = L + 0.3963377774 * A + 0.2158037573 * B
  const m_ = L - 0.1055613458 * A - 0.0638541728 * B
  const s_ = L - 0.0894841775 * A - 1.291485548 * B

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  return {
    r: toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  }
}

/** True when every linear-light channel lands inside 0..1. */
export function inGamut({ L, C, h }) {
  const { r, g, b } = oklchToRgb({ L, C, h })
  const eps = 1e-4
  for (const v of [r, g, b]) {
    if (v < -eps || v > 1 + eps) return false
  }
  return true
}

/**
 * Largest chroma at (L, h) that still fits inside the sRGB gamut.
 * Bisection — 20 iterations is well past 8-bit precision.
 */
export function maxChroma(L, h, cap = 0.4) {
  // Chroma 0 is always in gamut (it is just the grey at lightness L), so `lo`
  // starts valid and bisection narrows upward to the boundary. Do not
  // short-circuit on the C=0 case — it is always true and returns 0 always.
  let lo = 0
  let hi = cap
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    if (inGamut({ L, C: mid, h })) lo = mid
    else hi = mid
  }
  return lo
}