/**
 * Generates the route/screen inventory section of DESIGN.md from source.
 *
 * The alternative — a hand-written list of 128 routes and 28 screens — is
 * stale the first time somebody adds a page, and nobody notices which half is
 * wrong. This reads the router and the mobile screens directory and rewrites
 * one marked block in DESIGN.md, so the inventory is regenerated rather than
 * maintained by hand:
 *
 *   node scripts/design/audit-inventory.mjs          # report drift only
 *   node scripts/design/audit-inventory.mjs --write  # rewrite the block
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const DESIGN = resolve(ROOT, 'DESIGN.md')

const BEGIN = '<!-- BEGIN generated inventory -->'
const END = '<!-- END generated inventory -->'

const APP = resolve(ROOT, 'apps/web/src/App.tsx')
const PAGES = resolve(ROOT, 'apps/web/src/pages')
const COMPONENTS = resolve(ROOT, 'apps/web/src/components')
const MOBILE_SCREENS = resolve(ROOT, 'apps/mobile/src/screens')

/**
 * Find the `>` that closes the tag starting at `start`, ignoring `>` characters
 * that sit inside a `{...}` expression or a quoted string. A naive
 * `[^>]*>` stops inside `element={<Guard><Child /></Guard>}`, which silently
 * corrupts the nesting depth and therefore every child path below it.
 */
export function findTagEnd(src, start) {
  let depth = 0
  let quote = null
  for (let i = start; i < src.length; i++) {
    const ch = src[i]
    if (quote) {
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
    } else if (ch === '{') {
      depth += 1
    } else if (ch === '}') {
      depth -= 1
    } else if (ch === '>' && depth === 0) {
      return i
    }
  }
  return -1
}

/**
 * Every route in the router, resolved to the full URL path it serves.
 *
 * Child paths are relative to their parent (`<Route path="/mission-control">`
 * with `<Route path="calls">` is `/mission-control/calls`, not `/calls`), index
 * routes serve the parent's own URL, and a pathless wrapper element leaves the
 * URL space unchanged. Reporting the literals instead of the resolved paths is
 * how a six-workspace Mission Control can look like two routes.
 */
export function routeEntries() {
  const src = readFileSync(APP, 'utf8')
  const tags = /<\/?Route\b/g
  const stack = []
  const out = []
  let m
  while ((m = tags.exec(src))) {
    const isClose = src[m.index + 1] === '/'
    const end = isClose ? src.indexOf('>', m.index) : findTagEnd(src, m.index)
    if (end === -1) break
    const text = src.slice(m.index, end + 1)
    tags.lastIndex = end + 1

    if (isClose) {
      stack.pop()
      continue
    }

    const selfClosing = /\/\s*>$/.test(text)
    const parent = stack.length ? stack[stack.length - 1] : ''
    const pathAttr = text.match(/path="([^"]+)"/)
    let resolved = parent
    if (pathAttr) {
      const p = pathAttr[1]
      resolved = p.startsWith('/')
        ? p
        : parent
          ? `${parent.replace(/\/$/, '')}/${p}`
          : `/${p}`
      resolved = resolved.replace(/\/{2,}/g, '/')
    } else if (/\bindex\b/.test(text) && parent) {
      resolved = parent
    }
    out.push({ path: resolved, element: text, selfClosing })
    if (!selfClosing) stack.push(resolved)
  }
  return out
}

/** The URL paths the router serves, unique and sorted. */
export function resolveRoutes() {
  return [...new Set(routeEntries().map((e) => e.path))].sort()
}

/**
 * Component identifiers rendered inside one route's element, in source order.
 * The element is a whole JSX expression (`<ErrorBoundary><Suspense>…<Page />`),
 * so this is what a route actually renders rather than just its first tag.
 */
export function routeComponents(element) {
  const out = []
  for (const m of element.matchAll(/<\s*([A-Za-z][\w$]*)/g)) {
    if (!out.includes(m[1])) out.push(m[1])
  }
  return out
}

/** Resolve a relative import specifier to the source file it points at. */
export function resolveSource(fromDir, spec) {
  const base = resolve(fromDir, spec)
  for (const candidate of [
    `${base}.tsx`,
    `${base}.ts`,
    join(base, 'index.tsx'),
    join(base, 'index.ts'),
  ]) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

/** A repo-relative path, forward-slashed on every platform. */
export const repoPath = (p) => relative(ROOT, p).split(sep).join('/')

/**
 * Every page component App.tsx declares, mapped to the module that declares it.
 *
 * Three lazy forms are in use and all three must resolve, or a route quietly
 * reports "no page" and the tracker looks like it is working:
 *   lazy(() => import('./pages/a/B'))
 *   lazy(() => import('./pages/a/B').then(m => ({ default: m.B })))
 *   lazy(async () => { const module = await import('./pages/a/B'); … })
 */
export function pageComponents() {
  const src = readFileSync(APP, 'utf8')
  const map = new Map()
  const re = /const\s+([A-Za-z_$][\w$]*)\s*=\s*lazy\((?:async\s*)?\(\)\s*=>\s*[\s\S]{0,200}?import\('([^']+)'\)/g
  let m
  while ((m = re.exec(src))) {
    const target = resolveSource(dirname(APP), m[2])
    map.set(m[1], target ? repoPath(target) : `${m[2]} (unresolved)`)
  }
  return map
}

/** Route branches, for the grouped listing — grouped by resolved full path. */
export function routeGroups() {
  const groups = new Map()
  for (const path of resolveRoutes()) {
    const segments = path.split('/').filter(Boolean)
    const top = segments.length === 0 ? '(root)' : `/${segments[0]}`
    if (!groups.has(top)) groups.set(top, [])
    groups.get(top).push(path)
  }
  for (const [k, v] of groups) groups.set(k, [...new Set(v)].sort())
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

function tsxCount(dir, excludeTests = true) {
  let n = 0
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__tests__') continue
        walk(join(d, entry.name))
      } else if (/\.tsx$/.test(entry.name) && (!excludeTests || !/\.test\.tsx$/.test(entry.name))) {
        n += 1
      }
    }
  }
  walk(dir)
  return n
}

export function mobileScreens() {
  return readdirSync(MOBILE_SCREENS, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.tsx'))
    .map((e) => e.name.replace(/\.tsx$/, ''))
    .sort()
}

export function buildInventory() {
  const routes = resolveRoutes()
  const screens = mobileScreens()
  const lines = []
  lines.push(BEGIN)
  lines.push('')
  lines.push('## Appendix A — Route and screen inventory (generated)')
  lines.push('')
  lines.push('Generated by `node scripts/design/audit-inventory.mjs` from `apps/web/src/App.tsx` and')
  lines.push('`apps/mobile/src/screens/`. Do not edit by hand; regenerate after adding a route or screen.')
  lines.push('')
  lines.push('| Surface | Count | Source of truth |')
  lines.push('|---|---|---|')
  lines.push(`| Web routes (resolved unique paths) | ${routes.length} | \`apps/web/src/App.tsx\` |`)
  lines.push(`| Web page components | ${tsxCount(PAGES)} | \`apps/web/src/pages\` |`)
  lines.push(`| Web shared components | ${tsxCount(COMPONENTS)} | \`apps/web/src/components\` |`)
  lines.push(`| Mobile screens | ${screens.length} | \`apps/mobile/src/screens\` |`)
  lines.push('')
  lines.push('### Web routes by branch')
  lines.push('')
  for (const [group, paths] of routeGroups()) {
    lines.push(`- **${group}** (${paths.length}): ${paths.map((p) => `\`${p}\``).join(', ')}`)
  }
  lines.push('')
  lines.push('### Mobile screens')
  lines.push('')
  lines.push(screens.map((s) => `\`${s}\``).join(' · '))
  lines.push('')
  lines.push('Screens are reached through the tab navigator and stack routes in `apps/mobile/App.tsx`;')
  lines.push('the file list above is the authoritative set of what exists, including screens that are')
  lines.push('only reachable from a record (visit, client detail, swap transfer).')
  lines.push('')
  lines.push(END)
  return lines.join('\n')
}

function main() {
  const write = process.argv.includes('--write')
  const doc = readFileSync(DESIGN, 'utf8')
  const block = buildInventory()
  const start = doc.indexOf(BEGIN)
  const end = doc.indexOf(END)

  if (start === -1 || end === -1) {
    if (!write) {
      console.error('audit-inventory: DESIGN.md has no inventory block; run with --write to add one')
      return 1
    }
    writeFileSync(DESIGN, `${doc.trimEnd()}\n\n${block}\n`, 'utf8')
    console.log('audit-inventory: appended the inventory block to DESIGN.md')
    return 0
  }

  const current = doc.slice(start, end + END.length)
  if (current === block) {
    console.log('audit-inventory: DESIGN.md inventory is up to date')
    return 0
  }
  if (!write) {
    console.error('audit-inventory: DESIGN.md inventory is stale; re-run with --write')
    return 1
  }
  writeFileSync(DESIGN, doc.slice(0, start) + block + doc.slice(end + END.length), 'utf8')
  console.log('audit-inventory: rewrote the inventory block in DESIGN.md')
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main())
}
