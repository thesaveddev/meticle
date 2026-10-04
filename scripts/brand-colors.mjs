/**
 * Extracts the dominant colours from the supplied brand assets.
 *
 * Guessing a brand palette from a logo screenshot is how you end up with five
 * navies. This decodes the actual PNGs and counts real pixel colours, so
 * scripts/design/palette.mjs can be built from the artwork rather than from
 * someone's memory of it.
 *
 *   node scripts/brand-colors.mjs "Store assets"
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import zlib from 'node:zlib'

function decodePng(path) {
  const buf = readFileSync(path)
  if (buf.subarray(1, 4).toString('ascii') !== 'PNG') throw new Error('not a png')
  let i = 8
  let w = 0
  let h = 0
  let depth = 0
  let type = 0
  const idat = []
  while (i < buf.length) {
    const len = buf.readUInt32BE(i)
    const kind = buf.toString('ascii', i + 4, i + 8)
    const data = buf.subarray(i + 8, i + 8 + len)
    if (kind === 'IHDR') {
      w = data.readUInt32BE(0)
      h = data.readUInt32BE(4)
      depth = data[8]
      type = data[9]
    } else if (kind === 'IDAT') idat.push(data)
    else if (kind === 'IEND') break
    i += 12 + len
  }
  if (depth !== 8) throw new Error(`unsupported bit depth ${depth}`)
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type]
  if (!channels) throw new Error(`unsupported colour type ${type}`)

  const raw = zlib.inflateSync(Buffer.concat(idat))
  const bpp = channels
  const stride = w * bpp
  const out = Buffer.alloc(h * stride)
  let pos = 0
  for (let y = 0; y < h; y++) {
    const filter = raw[pos++]
    const line = raw.subarray(pos, pos + stride)
    pos += stride
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride)
    const cur = out.subarray(y * stride, (y + 1) * stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0
      const b = prev[x]
      const c = x >= bpp ? prev[x - bpp] : 0
      let v = line[x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += Math.floor((a + b) / 2)
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      cur[x] = v & 255
    }
  }
  return { w, h, channels, data: out }
}

const hex = (r, g, b) =>
  '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()

// sRGB -> OKLab lightness/chroma, so "is this a brand colour or is it a near-
// white artefact" is decided perceptually rather than by guessing a threshold.
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
function oklab(r, g, b) {
  const lr = toLinear(r / 255)
  const lg = toLinear(g / 255)
  const lb = toLinear(b / 255)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}

export function dominantColours(path, { minChroma = 12, topN = 8, bucket = 16 } = {}) {
  const { w, h, channels, data } = decodePng(path)
  const counts = new Map()
  const sums = new Map()
  let sampled = 0
  // Stride over the image: every 3rd pixel is plenty and keeps this fast.
  for (let y = 0; y < h; y += 3) {
    for (let x = 0; x < w; x += 3) {
      const o = (y * w + x) * channels
      const r = data[o]
      const g = channels >= 3 ? data[o + 1] : r
      const b = channels >= 3 ? data[o + 2] : r
      const alpha = channels === 4 || channels === 2 ? data[o + channels - 1] : 255
      if (alpha < 125) continue
      const { L, a, b: bb } = oklab(r, g, b)
      const chroma = Math.sqrt(a * a + bb * bb) * 100
      if (chroma < minChroma) continue
      if (L < 0.12 || L > 0.97) continue // drop near-black and near-white
      sampled++
      // Bucket before counting. Exact-pixel counting on a logo returns fifty
      // shades of the same blue, because every glyph edge is antialiased; the
      // answer we want is the cluster, not the pixel.
      const key = [r, g, b].map((v) => Math.round(v / bucket) * bucket).join(',')
      counts.set(key, (counts.get(key) ?? 0) + 1)
      const s = sums.get(key) ?? [0, 0, 0]
      s[0] += r; s[1] += g; s[2] += b
      sums.set(key, s)
    }
  }
  const colours = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([key, n]) => {
      const [r, g, b] = sums.get(key)
      return [hex(Math.round(r / n), Math.round(g / n), Math.round(b / n)), n]
    })
  return { w, h, sampled, colours }
}

const dir = resolve(process.argv[2] ?? 'Store assets')
if (!existsSync(dir)) {
  console.error(`No such directory: ${dir}`)
  process.exit(1)
}

// Assets that carry a third party's brand, not ours. Google's Play badge is
// Google's blue/yellow/green — including those in our palette would mean
// shipping someone else's identity as our own.
const THIRD_PARTY = /google play badge/i

// A roll-up across all assets, so the palette is derived from the brand as a
// whole rather than from whichever file happens to sort first.
const rollup = new Map()

for (const name of readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png')).sort()) {
  if (THIRD_PARTY.test(name)) {
    console.log(`\n${name}  SKIPPED — third-party brand colours, not ours`)
    continue
  }
  try {
    const { w, h, sampled, colours } = dominantColours(join(dir, name))
    console.log(`\n${name}  (${w}x${h}, ${sampled} chromatic samples)`)
    for (const [hexValue, n] of colours) {
      console.log(`   ${hexValue}  ${((n / sampled) * 100).toFixed(1)}%`)
      rollup.set(hexValue, (rollup.get(hexValue) ?? 0) + n)
    }
  } catch (e) {
    console.log(`\n${name}  SKIPPED: ${e.message}`)
  }
}

const total = [...rollup.values()].reduce((a, b) => a + b, 0)
console.log(`\n${'='.repeat(52)}\nROLL-UP ACROSS ALL METICLE ASSETS\n${'='.repeat(52)}`)
for (const [hexValue, n] of [...rollup.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`   ${hexValue}  ${((n / total) * 100).toFixed(1)}%`)
}