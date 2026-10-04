/**
 * Fails the build when a component hardcodes a colour that is not in the
 * canonical palette.
 *
 * The marketing surface had ~448 inline `#0F4C81` literals. Those are real and
 * correct today — they match the brand — but a palette duplicated 448 times is a
 * palette that will drift, because there is nothing stopping the 449th literal
 * from being a slightly different navy.
 *
 * So this lints, but it lints against a recorded baseline rather than refusing
 * to run on an existing codebase:
 *
 *   - hexes in `palette.mjs`                -> allowed, that is the definition
 *   - hexes already recorded in the baseline -> reported, not failing (debt)
 *   - any NEW off-palette hex                -> exit 1
 *
 * The debt count only goes down. `--update` re-records the baseline and should
 * be paired with actually routing the colours through tokens.
 *
 *   node scripts/design/lint.mjs
 *   node scripts/design/lint.mjs --update
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { allowedHexes } from './palette.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const BASELINE = resolve(HERE, 'hex-baseline.json')

/** Where hardcoded brand colours actually live. */
const SCAN_DIRS = [
  'apps/web/src/components',
  'apps/web/src/pages',
  'apps/web/src/theme',
]

const EXTENSIONS = new Set(['.ts', '.tsx'])

/** Matches #abc, #AABBCC. Deliberately skips 4/8-digit alpha forms. */
const HEX_RE = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g

function walk(dir, acc = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, acc)
    else {
      const dot = name.lastIndexOf('.')
      if (dot > 0 && EXTENSIONS.has(name.slice(dot))) acc.push(full)
    }
  }
  return acc
}

const normalise = (hex) => {
  const body = hex.length === 4 ? hex.slice(1).split('').map((c) => c + c).join('') : hex.slice(1)
  return `#${body.toUpperCase()}`
}

/** Every off-palette hex occurrence, keyed `path:hex` for stable baselining. */
export function scan() {
  const allowed = allowedHexes()
  const findings = []
  for (const dir of SCAN_DIRS) {
    for (const file of walk(resolve(ROOT, dir))) {
      const src = readFileSync(file, 'utf8')
      const rel = relative(ROOT, file).split(sep).join('/')
      const lines = src.split(/\r?\n/)
      lines.forEach((line, i) => {
        // Ignore comment-only lines: a hex named in prose is documentation.
        const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')
        for (const m of code.matchAll(HEX_RE)) {
          const hex = normalise(m[0])
          if (allowed.has(hex)) continue
          findings.push({ key: `${rel}:${hex}`, file: rel, line: i + 1, hex })
        }
      })
    }
  }
  findings.sort((a, b) => a.key.localeCompare(b.key) || a.line - b.line)
  return findings
}

function readBaseline() {
  try {
    const raw = JSON.parse(readFileSync(BASELINE, 'utf8'))
    return Array.isArray(raw.entries) ? raw.entries : []
  } catch {
    return []
  }
}

function main() {
  const update = process.argv.includes('--update')
  const findings = scan()
  const keys = [...new Set(findings.map((f) => f.key))].sort()

  if (update) {
    const payload = {
      note: 'Off-palette hex literals recorded as existing debt by scripts/design/lint.mjs --update. New off-palette hexes fail the build until they are either added to palette.mjs or removed.',
      entries: keys,
    }
    writeFileSync(BASELINE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    console.log(`design-lint: baseline recorded ${keys.length} existing entries`)
    return 0
  }

  const baselined = new Set(readBaseline())
  const fresh = findings.filter((f) => !baselined.has(f.key))
  const stale = keys.filter((k) => !baselined.has(k))

  console.log(`design-lint: scanned ${SCAN_DIRS.length} dirs`)
  console.log(`design-lint: ${findings.length} off-palette hex occurrences across ${keys.length} unique keys`)
  console.log(`design-lint: ${keys.length - stale.length} baselined (existing debt), ${stale.length} new`)

  if (stale.length === 0) {
    console.log('design-lint: no new off-palette colours')
    return 0
  }

  console.error('\ndesign-lint FAILED: new off-palette colour literals.\n')
  for (const f of fresh.slice(0, 40)) {
    console.error(`  ${f.file}:${f.line}  ${f.hex}`)
  }
  if (fresh.length > 40) console.error(`  ... and ${fresh.length - 40} more`)
  console.error('\nFix: import the colour from the design tokens, or add it to')
  console.error('scripts/design/palette.mjs if it is genuinely part of the brand.')
  return 1
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main())
}