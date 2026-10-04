/**
 * Generates the design-system artifacts from `palette.mjs` — the canonical
 * source of truth.
 *
 *   node scripts/design/sync.mjs          # rewrite artifacts
 *   node scripts/design/sync.mjs --check  # exit 1 if artifacts are stale
 *
 * Two artifacts are managed here:
 *   .impeccable/design.json  — colorMeta is regenerated; title, components and
 *                              narrative are preserved verbatim.
 *   DESIGN.md                — only the YAML frontmatter is regenerated. The
 *                              hand-written design narrative below it is prose,
 *                              and prose is not something a codegen should eat.
 *
 * Before this existed, both files were maintained by hand and had drifted from
 * the code they described. `--check` is the gate that stops that recurring.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ALLOWED_ALPHA_TOKENS,
  PALETTE,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  buildColorMeta,
} from './palette.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const DESIGN_JSON = resolve(ROOT, '.impeccable', 'design.json')
const DESIGN_MD = resolve(ROOT, 'DESIGN.md')

/* ── minimal deterministic YAML emitter ──────────────────────────────
 * Only handles the shapes DESIGN.md actually uses: strings, numbers and
 * plain nested objects. Anything else throws rather than guessing. */

const needsQuote = (s) =>
  s === '' ||
  /^[\s>|&*!%@`#-]/.test(s) ||
  /[:#]\s/.test(s) ||
  /^['"]/.test(s) ||
  s.endsWith(' ') ||
  /^(true|false|null|~|-?\d+(\.\d+)?)$/i.test(s)

function yamlScalar(v) {
  if (typeof v === 'number') return String(v)
  if (typeof v !== 'string') throw new Error(`Unsupported YAML scalar: ${JSON.stringify(v)}`)
  return needsQuote(v) ? `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : v
}

function emitYaml(obj, indent = 0) {
  const pad = '  '.repeat(indent)
  let out = ''
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const keys = Object.keys(value)
      if (keys.length === 0) continue
      out += `${pad}${key}:\n${emitYaml(value, indent + 1)}`
    } else {
      out += `${pad}${key}: ${yamlScalar(value)}\n`
    }
  }
  return out
}

/* ── artifact builders ───────────────────────────────────────────── */

/** colors block: hex tokens from the palette plus the sanctioned rgba tokens. */
function buildColors() {
  const colors = {}
  for (const [key, spec] of Object.entries(PALETTE)) colors[key] = spec.value
  for (const [key, value] of Object.entries(ALLOWED_ALPHA_TOKENS)) colors[key] = value
  return colors
}

/** .impeccable/design.json with a fresh colorMeta; prose sections preserved. */
export function buildDesignJson(existing) {
  if (!existing || typeof existing !== 'object') {
    throw new Error('design.json must exist already; refusing to invent its shape')
  }
  const { extensions, ...rest } = existing
  return {
    ...rest,
    schemaVersion: 2,
    generatedAt: existing.generatedAt,
    generatedFrom: 'scripts/design/palette.mjs',
    extensions: {
      ...(extensions ?? {}),
      colorMeta: buildColorMeta(),
    },
  }
}

/**
 * DESIGN.md with regenerated frontmatter. name/description/components are
 * carried over from the existing file; colors/typography/rounded/spacing are
 * replaced with generated values. Everything after the closing `---` is
 * returned byte-for-byte.
 */
export function buildDesignMd(existing) {
  // The body capture deliberately does NOT consume the newline after the closing
  // `---`, so the body round-trips byte-for-byte across repeated runs.
  const m = /^---\r?\n([\s\S]*?)\r?\n---([\s\S]*)$/.exec(existing)
  if (!m) throw new Error('DESIGN.md does not start with a YAML frontmatter block')

  const frontmatter = m[1]
  const body = m[2]

  // Parse just enough to carry prose keys forward: two-space indented maps.
  // Every scalar must be unquoted on the way in, otherwise the emitter
  // re-quotes the quotes and the file grows a layer of escaping per run.
  const unquote = (v) => (v ?? '').trim().replace(/^"(.*)"$/s, '$1').replace(/^'(.*)'$/s, '$1')

  const readTopLevel = (key) => {
    const lines = frontmatter.split(/\r?\n/)
    const start = lines.findIndex((l) => l === `${key}:`)
    if (start === -1) return null
    const out = {}
    let cur = null
    for (let i = start + 1; i < lines.length; i++) {
      const line = lines[i]
      if (line && !line.startsWith(' ')) break
      const nested = /^    ([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
      const kv = /^  ([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
      if (nested && cur !== null) {
        out[cur][nested[1]] = unquote(nested[2])
      } else if (kv) {
        cur = kv[1]
        out[cur] = {}
        // A key written as `name: value` (scalar) rather than `name:` (map).
        const scalar = unquote(kv[2])
        if (scalar !== '') out[cur].value = scalar
      }
    }
    return out
  }

  const nameLine = /^name:\s*(.*)$/m.exec(frontmatter)?.[1] ?? 'MeticleCare Marketing Site'
  const descriptionLine = /^description:\s*([\s\S]*?)(?=\r?\n[a-z_]+:)/m.exec(frontmatter)?.[1] ?? ''

  const header = {
    name: nameLine.replace(/^["']|["']$/g, ''),
    description: descriptionLine.trim().replace(/^["']|["']$/g, ''),
    colors: buildColors(),
    typography: TYPOGRAPHY,
    rounded: RADIUS,
    spacing: SPACING,
  }

  const components = readTopLevel('components')
  if (components) header.components = components

  return `---\n${emitYaml(header)}---${body}`
}

/* ── driver ──────────────────────────────────────────────────────── */

function readIfExists(p) {
  try {
    return readFileSync(p, 'utf8')
  } catch {
    return null
  }
}

/** Serialize exactly as we write it, so `--check` compares like for like. */
const serialize = (s) => (s.endsWith('\n') ? s : `${s}\n`)

export function computeOutputs() {
  const currentJson = readIfExists(DESIGN_JSON)
  if (currentJson === null) throw new Error(`Missing ${DESIGN_JSON}`)
  const currentMd = readIfExists(DESIGN_MD)
  if (currentMd === null) throw new Error(`Missing ${DESIGN_MD}`)

  return {
    [DESIGN_JSON]: serialize(JSON.stringify(buildDesignJson(JSON.parse(currentJson)), null, 2)),
    [DESIGN_MD]: serialize(buildDesignMd(currentMd)),
  }
}

function main() {
  const check = process.argv.includes('--check')
  const outputs = computeOutputs()

  const stale = []
  for (const [file, next] of Object.entries(outputs)) {
    const current = readIfExists(file)
    if (current !== next) stale.push(file)
  }

  if (stale.length === 0) {
    console.log('design-sync: design.json and DESIGN.md match palette.mjs')
    return 0
  }

  if (check) {
    console.error('design-sync FAILED: generated design artifacts are stale.\n')
    for (const file of stale) {
      console.error(`  stale: ${file.replace(ROOT, '.')}`)
    }
    console.error('\nRun: npm run design:sync')
    return 1
  }

  for (const [file, next] of Object.entries(outputs)) {
    if (!stale.includes(file)) continue
    writeFileSync(file, next, 'utf8')
    console.log(`wrote ${file.replace(ROOT, '.')}`)
  }
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main())
}