/**
 * Re-points literals from the superseded master UI palette onto the
 * logo-derived brand ramp — a one-file, auditable record of the re-tint.
 *
 * Why a codemod rather than hand edits: the superseded palette was spread over
 * more than a hundred component and page files. Doing that by hand invites a
 * near-miss (a 6-digit value one digit off the intended stop) that no reviewer
 * can see and no test catches until it ships as a *slightly wrong* blue next to
 * a correct one. A mapping table plus one deterministic pass makes the change
 * reviewable as a diff and re-runnable.
 *
 * The token modules are deliberately excluded: they are the destination, they
 * were authored by hand, and several values that are *sources* elsewhere
 * (e.g. #EAF3FF) are *targets* inside them, so running the map over them would
 * undo the work.
 *
 *   node scripts/design/brand-migration.mjs            # dry run, reports counts
 *   node scripts/design/brand-migration.mjs --write    # apply
 *
 * Every value here is either a slot from `palette.mjs` or a derived stop of one
 * (brand hue at ramp L=0.92 for `*Soft`, that stop at 50% white for `*Subtle`,
 * ramp L=0.38 for text-on-soft). The semantic trio (success / warning / danger)
 * is intentionally NOT remapped: it carries meaning, not identity.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')

/** Where literals live. */
const ROOTS = ['apps/web/src', 'apps/mobile/src', 'tests']

/**
 * The destination. Excluded because they are the token modules themselves —
 * nothing in them should be rewritten by a literal map.
 */
const SKIP_FILES = new Set([
  'apps/web/src/context/ThemeContext.tsx',
  'apps/web/src/index.css',
  'apps/web/src/theme/noticeTokens.ts',
  'apps/web/src/styles/tokens.ts',
  'apps/web/src/styles/marketing-tokens.ts',
  'apps/mobile/src/theme.tsx',
  // Holds the ban list and the chart-order assertion; the ban list must keep
  // naming the *superseded* values, so a literal map must never touch it.
  'apps/web/src/__tests__/paletteAudit.test.ts',
])

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'build', 'android', 'ios', '.expo', 'coverage'])

/** Superseded hex -> brand hex. Keys are uppercase and always 6 digits. */
export const HEX_MAP = {
  // ── Old master blue -> Brand Blue family ──────────────────────────────
  '#2F80ED': '#0164C8',
  '#2674D9': '#0251B3',
  '#1F68C7': '#014FB5',
  '#1F5FC4': '#0251B3',
  '#2A6EE0': '#014FB5',
  '#175CD3': '#004085',
  '#243B5A': '#002552',
  '#1B3658': '#002552',
  '#F0F6FF': '#EAF3FF',
  '#F4F8FF': '#EAF3FF',
  '#EAF3FF': '#EAF3FF',
  '#DDF8FA': '#D2FBF4',
  '#CFE4FB': '#D4E6FF',
  // ── Old accent (teal) -> brand Mint ───────────────────────────────────
  '#10BFA5': '#03C6B1',
  '#0FAF97': '#02A995',
  '#0C9E89': '#046E86',
  '#E8FAF6': '#D2FBF4',
  '#F3FCFA': '#E9FDF9',
  '#5CC8B7': '#2DAE9D',
  '#55BFD3': '#0187BA',
  // ── Neutrals -> brand Ink / Mist / Hairline ───────────────────────────
  '#17202A': '#0C1B2E',
  '#1E293B': '#112539',
  '#334155': '#2A3C54',
  '#475467': '#51637A',
  '#667085': '#51637A',
  // Muted text lands on #5D6E85, not the brand's Foot Muted #8497AC: that
  // ramp value measures 3.00:1 on white and 2.83:1 on the page — below the
  // 4.5:1 that the WCAG AA text requirement asks for, and captions, meta rows
  // and placeholders are real text. #5D6E85 is the same slate hue one step
  // darker, at 5.21:1 on white and 4.91:1 on the page.
  '#98A2B3': '#5D6E85',
  '#94A3B8': '#5D6E85',
  '#8497AC': '#5D6E85',
  '#CBD5E1': '#C3D2E2',
  '#E6EAF0': '#E3E9F0',
  '#D8DEE7': '#D6E2EE',
  '#F7F9FC': '#F4F9FC',
  '#F9FAFB': '#F7FAFE',
  '#F5F7FA': '#F7FAFE',
  '#FBFCFE': '#FCFDFF',
  '#F8FAFC': '#F7FAFE',
  '#F7FAFC': '#F7FAFE',
  '#F2F4F7': '#F0F5FC',
  '#B8C0CC': '#B0BFD2',
  '#344054': '#3A4551',
  '#3A4A60': '#354357',
  // ── Dark chrome -> brand ink ramp ─────────────────────────────────────
  '#0F172A': '#081320',
  '#172235': '#112539',
  '#1B2A3E': '#16283D',
  // Dark divider/border. The old pair measured 1.36:1 against its paper;
  // an ink-ramp .27 stop would have dropped that to 1.03:1 (a divider nobody
  // can see). This sits at 1.39:1 against the new paper #112539.
  '#2B394D': '#2A3C54',
  '#1B2737': '#2A3C54',
  '#43536A': '#354357',
  '#111C2D': '#0E1F33',
  '#A8B3C3': '#8A9AAF',
  '#8290A4': '#8A9AAF',
  '#738096': '#8A9AAF',
  '#8C9AAF': '#8A9AAF',
  // Dark secondary text lands on #B0BFD2 and dark muted on #8A9AAF, so the
  // dark hierarchy passes AA at every level (text 16.0:1, secondary 8.3:1,
  // muted 5.4:1 on the dark paper). The dark chrome values themselves live in
  // the token modules, which this map deliberately does not touch.
  '#E7EDF5': '#E8EEF6',
  // ── Marketing on-dark text tints -> brand neutrals ────────────────────
  '#D9EAF5': '#E8EEF6',
  '#C9D4DD': '#B0BFD2',
}

/**
 * `rgb()`/`rgba()` sources. The channel triple is the key; alpha is preserved
 * because a shadow's alpha is a design decision this migration must not reset.
 */
const RGB_MAP = {
  '47,128,237': '1,100,200', // old master blue, focus rings and selection
  '23,32,42': '12,27,46', // old ink, shadows
  '16,24,40': '12,27,46', // generic near-black, shadows
  '27,36,48': '12,27,46', // marketing ink, shadows
  '11,44,81': '12,27,46', // retired navy shadows
  '0,201,167': '3,198,177', // old accent glow
  '14,165,233': '1,100,200', // dark info tint
}

const EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.js', '.mjs'])

function walk(dir, acc = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const name of entries) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (SKIP_DIRS.has(name)) continue
      walk(full, acc)
    } else {
      const dot = name.lastIndexOf('.')
      if (dot > 0 && EXTENSIONS.has(name.slice(dot))) acc.push(full)
    }
  }
  return acc
}

const display = (p) => relative(ROOT, p).split(sep).join('/')

/** One pass. Returns the rewritten source and the number of substitutions. */
export function rewrite(source) {
  let count = 0
  // 8-digit forms first: `#2F80ED10` is the old blue at 6% alpha, so the six
  // leading digits map and the alpha pair is preserved verbatim. Matching the
  // 6-digit pattern alone would miss these, because the 7th character is still
  // a hex digit and so there is no word boundary after the sixth.
  const hexed = source.replace(/#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b/g, (match) => {
    const alpha = match.length === 9 ? match.slice(7) : ''
    const upper = match.slice(0, 7).toUpperCase()
    const next = HEX_MAP[upper]
    if (!next || next === upper) return match
    count += 1
    return `${next}${alpha}`
  })
  const rgbd = hexed.replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g, (match, r, g, b) => {
    const next = RGB_MAP[`${r},${g},${b}`]
    if (!next) return match
    count += 1
    const [nr, ng, nb] = next.split(',')
    return match.replace(`${r}`, nr).replace(`${g}`, ng).replace(`${b}`, nb)
  })
  return { source: rgbd, count }
}

function main() {
  const write = process.argv.includes('--write')
  const files = []
  for (const root of ROOTS) {
    const abs = resolve(ROOT, root)
    for (const file of walk(abs)) {
      if (SKIP_FILES.has(display(file))) continue
      files.push(file)
    }
  }

  const changed = []
  let total = 0
  for (const file of files) {
    const before = readFileSync(file, 'utf8')
    const { source, count } = rewrite(before)
    if (count === 0) continue
    total += count
    changed.push({ file: display(file), count })
    if (write) writeFileSync(file, source, 'utf8')
  }

  changed.sort((a, b) => b.count - a.count || a.file.localeCompare(b.file))
  console.log(`brand-migration: ${files.length} files scanned`)
  console.log(`brand-migration: ${total} literal substitutions across ${changed.length} files${write ? ' (written)' : ' (dry run)'}`)
  for (const c of changed.slice(0, 25)) console.log(`  ${c.count.toString().padStart(4)}  ${c.file}`)
  if (changed.length > 25) console.log(`  ... and ${changed.length - 25} more files`)
  if (!write) console.log('\nbrand-migration: re-run with --write to apply')
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main())
}
