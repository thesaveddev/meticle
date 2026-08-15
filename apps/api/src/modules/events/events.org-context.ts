import pool, { requestDBStorage, resetRlsSessionVars } from '../../shared/database';
import { setRlsSessionVars, AuthUser } from '../../shared/middleware/auth.middleware';
import { UserRole } from '@meticle/shared';

/**
 * Synthetic actor used when background work (event consumers, jobs) touches
 * tenant tables. RLS only trusts the org session variable for org_check(), so a
 * system user id + an elevated role is safe here — the org id is what gates
 * every row the work can see or write.
 */
export const SYSTEM_ACTOR: AuthUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'system@meticle.local',
  role: UserRole.ORG_ADMIN,
};

/**
 * Run `fn` with an RLS org context bound to `organizationId`.
 *
 * The event worker has no Express request, so it has no request-scoped pg
 * client and no RLS session variables. This helper acquires a dedicated pool
 * client, sets the tenant session vars for the event's organization, runs the
 * callback inside `requestDBStorage.run` so every `query()` inside it is
 * org-scoped (exactly like a request), then clears the vars and releases the
 * client so no tenant context leaks back into the pool.
 */
export async function runWithOrgContext<T>(organizationId: string, fn: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await setRlsSessionVars(client, { ...SYSTEM_ACTOR, organizationId });
    return await requestDBStorage.run({ client }, () => fn());
  } finally {
    await resetRlsSessionVars(client);
    client.release();
  }
}
