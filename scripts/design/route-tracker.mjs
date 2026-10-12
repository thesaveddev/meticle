/**
 * Per-route remediation tracker — generated, never maintained.
 *
 * The audit document used to carry hand-written claims about how far the
 * route-by-route pass had got ("129 routes inventoried and colour-reviewed in
 * source", "Phase F not complete"). A hand-written claim is wrong the first time
 * somebody adds a route, and nobody can tell which half is stale. This derives
 * every route's status from source on each run:
 *
 *   audited  this document names the page module — the pass recorded reviewing
 *            it. The tracker's own block is removed before searching, so the
 *            table cannot certify itself.
 *   updated  `design:lint` finds no off-palette colour literal in the module,
 *            i.e. the module is token-clean. This is a colour claim, not a claim
 *            that the layout was reviewed — those are the two questions the
 *            audit keeps separate.
 *   tested   a colocated `<module>.test.tsx` exists, or a test file imports the
 *            module.
 *
 * The result is written into one marked block in `docs/DESIGN_SYSTEM_AUDIT.md`
 * and verified by `design:check`, which CI runs — so the tracker cannot drift
 * from the router, the page tree or the test tree. Adding a route and not
 * regenerating it is a red build, not a stale table.
 *
 *   node scripts/design/route-tracker.mjs          # report drift only
 *   node scripts/design/route-tracker.mjs --write  # rewrite the block
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  pageComponents,
  repoPath,
  resolveSource,
  routeComponents,
  routeEntries,
} from './audit-inventory.mjs'
import { scan } from './lint.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const DOC = resolve(ROOT, 'docs', 'DESIGN_SYSTEM_AUDIT.md')
const WEB_SRC = resolve(ROOT, 'apps', 'web', 'src')
const APP = resolve(WEB_SRC, 'App.tsx')
const PAGES = join(WEB_SRC, 'pages')

/**
 * The app's entry points. The reachability walk starts here as well as at the
 * routed modules, because App.tsx imports a few modules directly rather than
 * through the lazy map (`getDashboardEntryPath` is the live example) and those
 * are used, not orphans.
 */
const ENTRY_POINTS = [APP, join(WEB_SRC, 'main.tsx')].filter((p) => existsSync(p))

const BEGIN = '<!-- BEGIN generated route tracker -->'
const END = '<!-- END generated route tracker -->'

/**
 * Routes whose element is a thin in-file component that renders a page module.
 * App.tsx declares these because they choose at runtime (by role, by service
 * model); without them the tracker would report those routes as rendering
 * nothing. Adding a wrapper to App.tsx means adding it here — the guard test
 * fails until you do, so the choice is never silent.
 */
export const LOCAL_ROUTE_WRAPPERS = {
  DashboardRoute: './pages/dashboard/DashboardPage',
  MissionControlSwitch: './pages/mission-control/MissionControlWorkspace',
}

/**
 * Components that wrap a route without being its page: guards, providers and
 * chrome. A route whose element contains only these is a structural wrapper,
 * not a screen.
 */
export const STRUCTURAL_COMPONENTS = new Set([
  'AuthGuard',
  'ModuleGuard',
  'SubscriptionGuard',
  'ErrorBoundary',
  'Layout',
  'MeticleThemeProvider',
  'Suspense',
  'Routes',
  'Route',
  'RouteLoading',
])

const isTestFile = (p) => /\.test\.(ts|tsx)$/.test(p)

function walk(dir, acc = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, acc)
    else acc.push(full)
  }
  return acc
}

const sourceFiles = (dir) => walk(dir).filter((f) => /\.(ts|tsx)$/.test(f))

/** Relative import specifiers in a module, including dynamic `import('…')`. */
function relativeImports(src, fromDir) {
  const out = []
  for (const m of src.matchAll(/(?:from|import\()\s*['"](\.[^'"]+)['"]/g)) {
    const target = resolveSource(fromDir, m[1])
    if (target) out.push(repoPath(target))
  }
  return out
}

/**
 * module -> the tests that cover it. Two signals, because both are real: a
 * colocated `<Name>.test.tsx` beside the module, and any test that imports it
 * (which is how a page covered from `__tests__` or from a sibling suite shows
 * up).
 */
export function testIndex() {
  const index = new Map()
  const add = (mod, test) => {
    const list = index.get(mod) ?? []
    if (!list.includes(test)) list.push(test)
    index.set(mod, list)
  }
  for (const file of sourceFiles(WEB_SRC)) {
    if (!isTestFile(file)) continue
    const testRel = repoPath(file)
    const beside = file.replace(/\.test\.(ts|tsx)$/, (_, ext) => `.${ext}`)
    if (existsSync(beside)) add(repoPath(beside), testRel)
    for (const target of relativeImports(readFileSync(file, 'utf8'), dirname(file))) {
      add(target, testRel)
    }
  }
  return index
}

/**
 * The audit document with this tracker's own block removed.
 *
 * Exported because it is the mechanism that stops the table certifying itself:
 * the block names every routed module in its `Page module` column, so searching
 * the document for module names with the block still in it would report every
 * route as audited. Tests assert the removal directly.
 */
export function docWithoutTracker(text) {
  const start = text.indexOf(BEGIN)
  const end = text.indexOf(END)
  if (start === -1 || end === -1) return text
  return text.slice(0, start) + text.slice(end + END.length)
}

/** Page-tree modules reachable from a set of routed modules, transitively. */
function reachableModules(seeds) {
  const seen = new Set()
  const queue = [...seeds]
  while (queue.length) {
    const mod = queue.pop()
    if (!mod || seen.has(mod) || !mod.startsWith('apps/web/src/')) continue
    seen.add(mod)
    const abs = join(ROOT, mod)
    if (!existsSync(abs)) continue
    for (const dep of relativeImports(readFileSync(abs, 'utf8'), dirname(abs))) queue.push(dep)
  }
  return seen
}

/**
 * One row per route × page module, plus the routes that render no module at all
 * (redirects and structural wrappers) and the page-tree modules no route
 * reaches.
 */
export function routeStatuses() {
  const pages = pageComponents()
  const offPalette = new Set(scan().map((f) => f.file))
  const tests = testIndex()
  // A missing document means nothing is on record as audited, not a crash: the
  // tracker is still the right answer for the other two columns, and every
  // route reads `audited: no`, which is true.
  const doc = existsSync(DOC) ? docWithoutTracker(readFileSync(DOC, 'utf8')) : ''
  const appDir = dirname(APP)

  const byPath = new Map()
  for (const entry of routeEntries()) {
    const list = byPath.get(entry.path) ?? []
    list.push(entry)
    byPath.set(entry.path, list)
  }

  const audited = (mod) => {
    const short = mod.replace(/^apps\/web\/src\//, '')
    const base = short.split('/').pop() ?? short
    return doc.includes(short) || doc.includes(mod) || doc.includes(base)
  }
  const updated = (mod) => !offPalette.has(mod)
  const tested = (mod) => (tests.get(mod) ?? []).length > 0

  const rows = []
  const redirects = []
  const wrappers = []
  const unresolved = []

  for (const path of [...byPath.keys()].sort()) {
    const entries = byPath.get(path)
    const components = [...new Set(entries.flatMap((e) => routeComponents(e.element)))]
    const modules = new Set()
    for (const c of components) {
      if (pages.has(c)) {
        modules.add(pages.get(c))
        continue
      }
      if (LOCAL_ROUTE_WRAPPERS[c]) {
        const target = resolveSource(appDir, LOCAL_ROUTE_WRAPPERS[c])
        if (target) modules.add(repoPath(target))
      }
    }

    if (modules.size === 0) {
      if (components.includes('Navigate')) redirects.push(path)
      else if (components.every((c) => STRUCTURAL_COMPONENTS.has(c))) wrappers.push(path)
      else unresolved.push({ path, components })
      continue
    }

    for (const mod of [...modules].sort()) {
      rows.push({
        path,
        module: mod,
        shadowed: entries.length > 1,
        audited: audited(mod),
        updated: updated(mod),
        tested: tested(mod),
      })
    }
  }

  const routed = [...new Set(rows.map((r) => r.module))]
  const reachable = reachableModules([...routed, ...ENTRY_POINTS.map(repoPath)])
  const orphans = sourceFiles(PAGES)
    .filter((f) => !isTestFile(f))
    .map(repoPath)
    .filter((m) => !reachable.has(m))
    .sort()

  return { rows, redirects, wrappers, unresolved, routed, orphans }
}

const yesNo = (b) => (b ? 'yes' : 'no')

export function buildTracker() {
  const { rows, redirects, wrappers, unresolved, routed, orphans } = routeStatuses()
  const total = rows.length
  const audited = rows.filter((r) => r.audited).length
  const updated = rows.filter((r) => r.updated).length
  const tested = rows.filter((r) => r.tested).length
  const signedOff = rows.filter((r) => r.audited && r.updated && r.tested).length
  const routes = new Set(rows.map((r) => r.path)).size

  const lines = []
  lines.push(BEGIN)
  lines.push('')
  lines.push('## Appendix A — Per-route remediation status (generated)')
  lines.push('')
  lines.push('Generated by `node scripts/design/route-tracker.mjs` from the router')
  lines.push('(`apps/web/src/App.tsx`), the page tree and the test tree, and verified by')
  lines.push('`design:check`. Do not edit by hand; run `npm run design:sync` after adding a route,')
  lines.push('a page, or a test. Every column is derived, so this table cannot claim progress the')
  lines.push('code does not have:')
  lines.push('')
  lines.push('- **audited** — this document names the page module, i.e. the pass recorded reviewing it.')
  lines.push('  The tracker block itself is excluded from the search, so the table cannot certify itself.')
  lines.push('- **updated** — `design:lint` finds no off-palette colour literal in the module. A colour')
  lines.push('  claim only: it says the module is token-clean, not that its layout was reviewed.')
  lines.push('- **tested** — a colocated `<module>.test.tsx` exists, or a test file imports the module.')
  lines.push('')
  lines.push('A path served by two different modules (the marketing and the application `/compliance`,')
  lines.push('for instance) appears once per module, and `†` marks a path the router declares more than')
  lines.push('once — the first declaration wins at runtime.')
  lines.push('')
  lines.push('| Surface | Count |')
  lines.push('|---|---|')
  lines.push(`| Routes with a page module | ${routes} |`)
  lines.push(`| Route × module rows | ${total} |`)
  lines.push(`| Distinct page modules routed | ${routed.length} |`)
  lines.push(`| Redirect routes (no page to review) | ${redirects.length} |`)
  lines.push(`| Structural wrapper routes (guards, layouts) | ${wrappers.length} |`)
  lines.push(`| Route elements that resolve to nothing | ${unresolved.length} |`)
  lines.push(`| Page-tree modules the router does not reach | ${orphans.length} |`)
  lines.push(`| audited / updated / tested | ${audited} / ${updated} / ${tested} |`)
  lines.push(`| Fully signed off (all three) | ${signedOff} |`)
  lines.push(`| Gaps (any of the three missing) | ${total - signedOff} |`)
  lines.push('')
  if (wrappers.length) {
    lines.push('**Structural wrapper routes** — guards and layouts that render no page of their own:')
    lines.push(`${wrappers.map((w) => `\`${w === '' ? '(root)' : w}\``).join(', ')}.`)
    lines.push('')
  }
  if (unresolved.length) {
    lines.push('**Route elements that resolve to nothing** — a component that is neither a page module,')
    lines.push('a redirect nor a declared structural wrapper. Each is a gap in the tracker, not in the app:')
    lines.push('')
    for (const u of unresolved) lines.push(`- \`${u.path}\` renders ${u.components.map((c) => `\`<${c} />\``).join(', ')}`)
    lines.push('')
  }
  lines.push('### Routes')
  lines.push('')
  lines.push('| Route | Page module | audited | updated | tested |')
  lines.push('|---|---|---|---|---|')
  for (const r of rows) {
    lines.push(
      `| \`${r.path}\`${r.shadowed ? ' †' : ''} | \`${r.module.replace(/^apps\/web\/src\//, '')}\` | ${yesNo(r.audited)} | ${yesNo(r.updated)} | ${yesNo(r.tested)} |`,
    )
  }
  lines.push('')
  lines.push('### Page-tree modules the router does not reach')
  lines.push('')
  lines.push('Reachability follows relative imports transitively from every routed module and from the')
  lines.push('entry points (`main.tsx`, `App.tsx`), so a sub-component reached from a routed page is not')
  lines.push('listed here and neither is anything the router imports directly. An entry below is reached')
  lines.push('by nothing in the application: dead code, or a page whose route was removed.')
  lines.push('')
  if (orphans.length) {
    for (const o of orphans) lines.push(`- \`${o.replace(/^apps\/web\/src\//, '')}\``)
  } else {
    lines.push('None.')
  }
  lines.push('')
  lines.push(END)
  return lines.join('\n')
}

function main() {
  const write = process.argv.includes('--write')
  if (!existsSync(DOC)) {
    console.error(`route-tracker: ${DOC.replace(ROOT, '.')} does not exist.`)
    console.error('  The tracker block lives in the audit document, so that document has to be')
    console.error('  present — this fails rather than writing a tracker nobody can read.')
    return 1
  }
  const doc = readFileSync(DOC, 'utf8')
  const block = buildTracker()
  const start = doc.indexOf(BEGIN)
  const end = doc.indexOf(END)

  if (start === -1 || end === -1) {
    if (!write) {
      console.error('route-tracker: the audit document has no tracker block; run with --write to add one')
      return 1
    }
    writeFileSync(DOC, `${doc.trimEnd()}\n\n${block}\n`, 'utf8')
    console.log('route-tracker: appended the tracker block to docs/DESIGN_SYSTEM_AUDIT.md')
    return 0
  }

  const current = doc.slice(start, end + END.length)
  if (current === block) {
    console.log('route-tracker: the per-route tracker is up to date')
    return 0
  }
  if (!write) {
    console.error('route-tracker FAILED: the per-route tracker is stale.\n')
    console.error('  It is generated from the router, the page tree and the test tree, so a route,')
    console.error('  page or test has changed since it was written.')
    console.error('\nRun: npm run design:sync')
    return 1
  }
  writeFileSync(DOC, doc.slice(0, start) + block + doc.slice(end + END.length), 'utf8')
  console.log('route-tracker: rewrote the tracker block in docs/DESIGN_SYSTEM_AUDIT.md')
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main())
}
