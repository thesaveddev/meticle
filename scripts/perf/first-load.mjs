#!/usr/bin/env node
/**
 * What the browser must download before the first paint.
 *
 * Why this exists: "the orb appears late" is a question about *bytes on the
 * critical path*, and a bundler's per-chunk size table cannot answer it. A
 * chunk that nobody loads until a page is open costs nothing; a chunk the entry
 * imports statically is on the path whether or not the page that needs it has
 * been opened. So this walks the real graph Vite emitted — `index.html`'s
 * script and stylesheet tags, then every *static* import from those, and every
 * stylesheet those chunks pull in — and prints what that set actually weighs.
 *
 * Dynamic imports (`import(...)`) are deliberately not followed: that is the
 * boundary being measured. `mica.surfaces.tsx` uses one for the assistant's
 * overlay and bar, and the point of the split is that their cost left this set.
 *
 * Usage:
 *   node scripts/perf/first-load.mjs apps/web/dist
 *   node scripts/perf/first-load.mjs apps/web/dist --list
 *
 * Gzip here is a per-file `gzip -9`-equivalent, the same for every build it is
 * pointed at, so the comparison between two builds is honest even though a
 * production CDN would serve brotli.
 */
import { readFileSync, existsSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { dirname, join, resolve } from 'node:path'

const [distArg, ...flags] = process.argv.slice(2)
const list = flags.includes('--list')

if (!distArg) {
  console.error('usage: node scripts/perf/first-load.mjs <dist-dir> [--list]')
  process.exit(2)
}

const dist = resolve(distArg)
const indexPath = join(dist, 'index.html')

if (!existsSync(indexPath)) {
  console.error(`no index.html in ${dist} — build first (vite build)`)
  process.exit(2)
}

const read = path => readFileSync(path, 'utf8')
const kb = bytes => (bytes / 1024).toFixed(1)

/** Static import specifiers only — `import ... from "./x.js"` and `import "./x.js"`. */
const STATIC_IMPORT = /import\s*(?!\()(?:[^"'()]*?\bfrom\s*)?["']([^"']+\.(?:js|mjs|css))["']/g
/** A chunk's own stylesheet, which Vite names next to it. */
const CSS_REF = /["']\.\/([A-Za-z0-9_.-]+\.css)["']/g

const queue = []
const seen = new Set()

const enqueue = (file, from) => {
  // `index.html` asks for `/assets/...` (absolute on the web), and a chunk asks
  // for its sibling relatively; both mean "inside this build".
  const path = resolve(from, file.replace(/^\/+/, ''))
  if (seen.has(path)) return
  if (!path.startsWith(dist)) {
    console.warn(`  (skipped ${file} — outside the build)`)
    return
  }
  if (!existsSync(path)) {
    console.warn(`  (missing ${file})`)
    return
  }
  seen.add(path)
  queue.push(path)
}

// The entry: everything index.html asks for before any JavaScript runs.
const html = read(indexPath)
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const file = match[1]
  if (/\.(js|css)$/.test(file)) enqueue(file, dist)
}

for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
  if (!path.endsWith('.js')) continue
  const code = read(path)
  for (const match of code.matchAll(STATIC_IMPORT)) enqueue(match[1], dirname(path))
  for (const match of code.matchAll(CSS_REF)) enqueue(match[1], dirname(path))
}

let jsRaw = 0
let jsGzip = 0
let cssRaw = 0
let cssGzip = 0
const rows = []

for (const path of seen) {
  const body = readFileSync(path)
  const gzip = gzipSync(body, { level: 9 }).length
  const isCss = path.endsWith('.css')
  if (isCss) {
    cssRaw += body.length
    cssGzip += gzip
  } else {
    jsRaw += body.length
    jsGzip += gzip
  }
  rows.push({ file: path.slice(dist.length + 1), raw: body.length, gzip, isCss })
}

if (list) {
  rows.sort((a, b) => b.raw - a.raw)
  for (const row of rows) {
    console.log(`  ${kb(row.raw).padStart(8)} kB  ${kb(row.gzip).padStart(7)} kB gzip   ${row.file}`)
  }
  console.log('')
}

console.log(`${dist}`)
console.log(`  files           ${seen.size}`)
console.log(`  javascript      ${kb(jsRaw)} kB raw / ${kb(jsGzip)} kB gzip`)
console.log(`  css             ${kb(cssRaw)} kB raw / ${kb(cssGzip)} kB gzip`)
console.log(`  first load      ${kb(jsRaw + cssRaw)} kB raw / ${kb(jsGzip + cssGzip)} kB gzip`)
