/**
 * Generates `packages/shared/src/pageAccess.generated.ts` — every page's access,
 * read out of the router.
 *
 * Why this exists. A page's access is decided in `apps/web/src/App.tsx`: a route
 * sits inside `<AuthGuard />`, sometimes narrows itself with
 * `allowedRoles={[...]}`, and often adds `<ModuleGuard module="…">`. Mica offers
 * to open pages from a spoken answer, so it needs the same decision — and until
 * this script, it had its own hand-written copy of it: one `roles` array on one
 * row of `FACT_PAGES`. A copy is wrong the first time somebody restricts a route,
 * and the failure is invisible: the carer hears "want me to open the training
 * matrix?", says yes, and lands on `/unauthorized`. Worse, nobody editing a route
 * has any reason to know a voice assistant's table needs updating too.
 *
 * So the router stays the only place a gate is written, and this derives the fact
 * from it. Mica reads the generated table; if a route gains a restriction, the
 * change is in the router, and `design:check` (CI) fails until this file is
 * regenerated — which is the moment the offer gate changes with it. The failure
 * mode the old copy had becomes a red build instead of a locked door.
 *
 *   node scripts/design/route-access.mjs          # report drift only
 *   node scripts/design/route-access.mjs --write  # rewrite the generated file
 *
 * Three reading rules, each with a reason:
 *
 *   - **Nesting is inherited.** A route inside `<Route element={<AuthGuard />}>`
 *     is authenticated, and one inside a role-narrowed parent keeps the parent's
 *     roles unless it narrows them further. Anything else would report Mission
 *     Control's views as public.
 *   - **A duplicated path takes the most restrictive declaration.** The router
 *     declares `/compliance` twice (the marketing page and the application page),
 *     and the marketing one has no guard. Restricting an *offer* is the one
 *     direction where being wrong is harmless — Mica says nothing and the carer
 *     uses the nav — so the union of the declarations' restrictions is the one
 *     recorded.
 *   - **A gate the script cannot read is an error, not an omission.** A
 *     `roles` array this cannot parse, or a router that yields no authenticated
 *     route at all, stops the script. A silently smaller table is exactly the
 *     bug being fixed, one level up.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { findTagEnd } from './audit-inventory.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const APP = resolve(ROOT, 'apps', 'web', 'src', 'App.tsx')
const OUT = resolve(ROOT, 'packages', 'shared', 'src', 'pageAccess.generated.ts')

/** `UserRole.ORG_ADMIN` → `'ORG_ADMIN'`, the way the enum's values are spelled. */
const ROLE_REF = /UserRole\.([A-Z_]+)/g

/** The roles a route's own `allowedRoles` names, or undefined when it names none. */
export function rolesFromElement(element) {
  const attr = /allowedRoles=\{?\[([^\]]*)\]/.exec(element)
  // A gate this cannot read — a spread, a constant, a list built at runtime —
  // must not be read as "no restriction", which is the one wrong answer: it
  // would report a gated route as open and hand Mica an offer the router refuses.
  // Refusing to generate is the safe failure, so any `allowedRoles=` that is not
  // a readable array literal stops the script.
  if (!attr) {
    if (/allowedRoles=/.test(element)) {
      throw new Error(`Unreadable allowedRoles in: ${element.replace(/\s+/g, ' ').slice(0, 120)}`)
    }
    return undefined
  }
  const roles = [...attr[1].matchAll(ROLE_REF)].map((m) => m[1])
  if (roles.length === 0) {
    throw new Error(`allowedRoles lists no role names it can read: ${element.replace(/\s+/g, ' ').slice(0, 120)}`)
  }
  return roles
}

/** The module a route's `ModuleGuard` names, when it names one as a literal. */
export function moduleFromElement(element) {
  const guard = /ModuleGuard\s+module="([^"]+)"/.exec(element)
  if (guard) return guard[1]
  // `module={payrollModuleForRole()}` picks between two modules at runtime. It is
  // recorded as null — "a module this table cannot name" — rather than guessed at,
  // and no route Mica offers uses it.
  return null
}

/** True when the route (or a wrapper inside its element) requires authentication. */
function authenticatedByElement(element) {
  return /<AuthGuard\b/.test(element)
}

/**
 * Every route the router declares, with the access it inherits from the routes it
 * sits inside.
 *
 * Deliberately its own traversal rather than `routeEntries()`: nesting is the
 * whole question here, and that helper reports resolved paths only.
 */
export function routeAccessDeclarations(source) {
  const tags = /<\/?Route\b/g
  const stack = []
  const out = []
  let match
  while ((match = tags.exec(source))) {
    const isClose = source[match.index + 1] === '/'
    const end = isClose ? source.indexOf('>', match.index) : findTagEnd(source, match.index)
    if (end === -1) break
    const text = source.slice(match.index, end + 1)
    tags.lastIndex = end + 1

    if (isClose) {
      stack.pop()
      continue
    }

    const enclosing = stack.length ? stack[stack.length - 1] : null
    const selfClosing = /\/\s*>$/.test(text)
    const parent = enclosing ? enclosing.path : ''
    const pathAttr = text.match(/path="([^"]+)"/)
    let path = parent
    if (pathAttr) {
      const declared = pathAttr[1]
      path = declared.startsWith('/')
        ? declared
        : parent
          ? `${parent.replace(/\/$/, '')}/${declared}`
          : `/${declared}`
      path = path.replace(/\/{2,}/g, '/')
    } else if (/\bindex\b/.test(text) && parent) {
      path = parent
    }

    const ownRoles = rolesFromElement(text)
    const context = {
      path,
      roles: ownRoles ?? (enclosing ? enclosing.roles : null),
      authenticated: authenticatedByElement(text) || Boolean(enclosing && enclosing.authenticated),
      module: moduleFromElement(text),
    }

    if (path) out.push(context)
    if (!selfClosing) stack.push(context)
  }
  return out
}

/**
 * The declarations collapsed to one entry per path.
 *
 * A path the router declares twice keeps the restrictions of both: authenticated
 * if either requires it, and the roles every declaration allows (a declaration
 * with no `allowedRoles` allows every role, so it narrows nothing).
 */
export function pageAccess(source) {
  const byPath = new Map()
  for (const declaration of routeAccessDeclarations(source)) {
    const existing = byPath.get(declaration.path)
    if (!existing) {
      byPath.set(declaration.path, {
        path: declaration.path,
        authenticated: declaration.authenticated,
        roles: declaration.roles,
        module: declaration.module,
      })
      continue
    }
    existing.authenticated = existing.authenticated || declaration.authenticated
    existing.roles = intersectRoles(existing.roles, declaration.roles)
    existing.module = existing.module ?? declaration.module
  }

  if (![...byPath.values()].some((entry) => entry.authenticated)) {
    throw new Error('No authenticated route found in the router — the parse, not the router, is wrong')
  }

  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path))
}

/** `null` means "every role"; intersecting with it leaves the other list alone. */
function intersectRoles(a, b) {
  if (!a) return b
  if (!b) return a
  return a.filter((role) => b.includes(role))
}

export function render(entries) {
  const rows = entries.map((entry) => {
    const roles = entry.roles ? entry.roles.map((r) => `UserRole.${r}`).join(', ') : null
    return `  '${entry.path}': { authenticated: ${entry.authenticated}, roles: ${roles ? `[${roles}]` : 'null'}, module: ${entry.module ? `'${entry.module}'` : 'null'} },`
  })

  const authenticated = entries.filter((e) => e.authenticated).length

  return `/**
 * Every page's access, read out of the router — GENERATED, do not edit.
 *
 * Written by \`scripts/design/route-access.mjs\` from \`apps/web/src/App.tsx\` and
 * verified by \`design:check\`, which CI runs: editing the router without
 * regenerating this file is a red build. Run \`npm run design:sync\`.
 *
 * The router is the only place a page's gate is written, and this is what makes
 * that true for the server as well. Mica offers to open pages from a spoken
 * answer (\`apps/api/src/modules/ai/mica.facts.ts\`), so it has to know whether the
 * carer who asked can open the page — and before this table it had its own
 * hand-written copy of that answer, which no change to a route would have
 * updated. A carer was asked "want me to open the training matrix?" and sent to
 * /unauthorized by the role the route already excluded.
 *
 * \`roles\` is the route's own \`allowedRoles\`, or null when it names none — which
 * means every authenticated role, not "no restriction". \`authenticated\` is false
 * for the public marketing and auth routes, which no offer may ever target.
 * \`module\` is the route's \`ModuleGuard\` module where it names one literally, so
 * the second half of a page's gate is recorded next to the first — and both halves
 * are read. Mica resolves the caller's own modules (\`mica.moduleAccess.ts\`, which
 * asks the two questions \`GET /permissions/:userId\` answers), and withholds the
 * offer where the organisation's service model does not provide that module or the
 * caller's level for it is 'none': a page the guard would refuse is not a door to
 * ask a carer to open.
 *
 * A path the router declares twice (\`/compliance\` is both a marketing page and an
 * application page) carries the restrictions of every declaration, because for an
 * offer the safe reading is the restrictive one.
 *
 * ${entries.length} routes, ${authenticated} of them authenticated.
 */

// The enum itself, not its names as strings: this file is generated from text,
// and typing the rows as \`UserRole\` is what makes a role the router spells in a
// way this cannot read a compile error rather than an entry nothing matches.
import { UserRole } from './roles'

export interface PageAccess {
  /** True when the route sits inside the router's authenticated area. */
  authenticated: boolean
  /** The route's own \`allowedRoles\`, or null when it names none. */
  roles: readonly UserRole[] | null
  /** The route's \`ModuleGuard\` module, or null when it has none. */
  module: string | null
}

export const PAGE_ACCESS: Readonly<Record<string, PageAccess>> = {
${rows.join('\n')}
}
`
}

function main() {
  const write = process.argv.includes('--write')
  const entries = pageAccess(readFileSync(APP, 'utf8'))
  const block = render(entries)

  let current = null
  try {
    current = readFileSync(OUT, 'utf8')
  } catch {
    current = null
  }

  if (current === block) {
    console.log(`route-access: the page access table is up to date (${entries.length} routes)`)
    return 0
  }
  if (!write) {
    console.error('route-access FAILED: the generated page access table is stale.\n')
    console.error('  It is derived from apps/web/src/App.tsx, so a route has been added,')
    console.error('  removed or re-restricted since it was written. Mica reads this table')
    console.error('  when it offers to open a page, so a stale one offers doors the router')
    console.error('  has closed.')
    console.error('\nRun: npm run design:sync')
    return 1
  }

  writeFileSync(OUT, block, 'utf8')
  console.log(`route-access: wrote packages/shared/src/pageAccess.generated.ts (${entries.length} routes)`)
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main())
}
