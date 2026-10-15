/**
 * The second half of a page's gate: which modules *this* caller has.
 *
 * A route's gate is written in two places in the router — `allowedRoles={[…]}` and
 * `<ModuleGuard module="tasks">` — and Mica's offer gate read only the first. The
 * generated `PAGE_ACCESS` table recorded the module and nothing consulted it, so a
 * carer whose module permission was `'none'`, or one working in an organisation
 * whose service model does not provide that module at all, could still be asked
 * "want me to open the new task?" and sent to `/unauthorized` by `ModuleGuard`.
 * The router half could not drift because the table is generated from the router;
 * this half could not drift either — but only once something read it.
 *
 * So this resolves it, by asking the questions `ModuleGuard`'s own answer is made
 * of. `ModuleGuard` calls `GET /permissions/:userId`, and that endpoint computes
 * `getAvailableModules(org.service_types, org.primary_service_type)` and then takes
 * the level for each module as the user's `user_permissions` row, falling back to
 * `ROLE_DEFAULTS[role]`. Both of those are imported here rather than restated —
 * the same two functions, so a module added to the availability list, or a default
 * changed for a role, changes the offer gate without an edit here.
 *
 * Deliberately *not* consulted:
 *
 *   - **Manager delegations.** `requirePermission` falls back to a delegated
 *     manager's permission and this does not, because the page the carer will
 *     actually land on is decided by `ModuleGuard`, which does not either. The
 *     question here is "will the door open", not "may the API be called", and the
 *     offer must match the first — a delegate inherits API access without
 *     inheriting the nav item.
 *   - **`requireServiceType`'s own route middleware.** Every page under
 *     `/permissions/:userId` availability is already filtered by service model, so
 *     a route guarded a second time at the API level is not offered to an
 *     organisation that cannot open its page either way. Two sources for one
 *     answer is the shape being removed, not added.
 *
 * The gate's parameter type lives with the gate (`MicaModuleAccess` in
 * `mica.facts.ts`); this module is only how the value is produced.
 */

import { query } from '../../shared/database';
import { getAvailableModules, ROLE_DEFAULTS } from '../permissions/permissions.controller';
import type { MicaModuleAccess } from './mica.facts';

/**
 * The caller's module access, from values already in hand.
 *
 * Pure, and the only place the level of a module is decided: the caller's own row
 * where there is one, the role's default where there is not, `'none'` where the
 * role has no default for it — which is the whole of what `GET /permissions/:userId`
 * returns, and the reason a module missing from `MODULES` (or excluded by the
 * service model) reads as `'none'` instead of as an absent key.
 */
export function buildModuleAccess(input: {
  serviceTypes: readonly string[];
  primaryServiceType?: string | null;
  role: string | undefined;
  /** `user_permissions` rows for this caller: module → level. */
  overrides?: Readonly<Record<string, string>>;
}): MicaModuleAccess {
  const available = getAvailableModules(
    [...input.serviceTypes],
    input.primaryServiceType ?? null,
  );
  const defaults = ROLE_DEFAULTS[input.role ?? ''] ?? {};
  const overrides = input.overrides ?? {};
  const levels: Record<string, string> = {};
  for (const module of available) {
    levels[module] = overrides[module] ?? defaults[module] ?? 'none';
  }
  return { available, levels };
}

/**
 * The caller's module access, read from the organisation and the caller's rows.
 *
 * Two indexed lookups, and no cache. The org row is what the client's own gate
 * reads through `/settings/org`, and the permission rows are the ones
 * `/permissions/:userId` reads; a cache here would buy two queries on a path that
 * makes a model call and add a window in which a revoked module is still offered —
 * the same trade `requirePermission` already makes per module, declined for a gate
 * that runs at most once per voice turn.
 */
export async function loadModuleAccess(
  userId: string,
  organizationId: string,
  role: string | undefined,
): Promise<MicaModuleAccess> {
  const [organization, permissions] = await Promise.all([
    query('SELECT service_types, primary_service_type FROM organizations WHERE id = $1', [organizationId]),
    query('SELECT module, permission_level FROM user_permissions WHERE user_id = $1', [userId]),
  ]);
  return buildModuleAccess({
    serviceTypes: organization.rows[0]?.service_types ?? [],
    primaryServiceType: organization.rows[0]?.primary_service_type ?? null,
    role,
    overrides: Object.fromEntries(
      permissions.rows.map((row: { module: string; permission_level: string }) => [
        row.module,
        row.permission_level,
      ]),
    ),
  });
}
