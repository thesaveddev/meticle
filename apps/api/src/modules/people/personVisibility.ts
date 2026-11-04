/**
 * Which residents a support worker may see.
 *
 * `GET /people` returned every resident in the organisation to every signed-in
 * user the `people` module was enabled for. The default permission matrix gives
 * a care worker `people: none`, so in practice this was a granted exception
 * rather than the norm — which made it worse, not better: the one worker who had
 * been given the module could read the whole provider's residents, and nothing
 * recorded that as a decision. Blueprint §9.10 (closed 4 November 2026) asks for
 * the least-privilege version: the residents on their shift, or their team.
 *
 * What this implements, and why it is location-shaped rather than team-shaped:
 *
 *  * A resident has no team. `teams`/`team_members` group *users*, and nothing
 *    in the schema links a resident to one, so "their team" cannot be expressed
 *    without inventing a column and asking every provider to fill it in. What a
 *    resident does have is a `location_id`, and what a worker does have is shift
 *    assignments — which is the same pair the rota itself reasons about.
 *  * So a worker sees a resident when **any** of these is true:
 *      1. a shift **names that resident** (`shifts.person_id`) and this worker is
 *         assigned to it — the one-to-one case;
 *      2. a shift at **the resident's own location**, in the roster window below,
 *         and this worker is assigned to it — the unit case, which is how most
 *         supported-living rotas are actually written;
 *      3. a domiciliary **visit** for that resident has been assigned to them —
 *         the homecare case, where there is no shift at a building at all.
 *  * Rejected assignments and cancelled shifts do not count. An offer a worker
 *    declined is not access, and neither is a shift that no longer happens.
 *  * The window is a week behind and a fortnight ahead of now. Behind, because a
 *    note is written at the end of a shift and a handover is read after one;
 *    ahead, because the rota is planned in advance and a worker reading up on a
 *    resident the night before is exactly the behaviour worth encouraging. It is
 *    deliberately *not* "any shift ever", which would mean that a worker who
 *    left a service two years ago still reads its residents.
 *
 * The honest consequence, stated rather than hidden: a worker with no shifts at
 * all sees an empty directory. That is the least-privilege answer, but it is a
 * visible change for a provider that does not use the rota, and the empty state
 * has to say why rather than look like a fault. It is also why this is applied to
 * `GET /people` and `GET /people/:id` only — the sub-resource routes (notes,
 * care plans, assessments) keep their organisation-level check, because they are
 * driven from the web rota, eMAR and mobile flows that have their own scoping and
 * narrowing them here would break a carer recording care for a resident they are
 * standing in front of. Widening this predicate to those routes is a separate
 * piece of work, not a side effect of this one.
 */
import { UserRole } from '@meticle/shared';
import { query } from '../../shared/database';

/** How far behind now a shift can be and still grant sight of its residents. */
export const ROSTER_PAST_DAYS = 7;

/** How far ahead a planned shift grants sight of its residents. */
export const ROSTER_AHEAD_DAYS = 14;

/**
 * Whether this role's resident reads should be narrowed to their own work.
 *
 * Managers, organisation admins and compliance officers keep the whole
 * organisation: the rota, the evidence packs and the CQC response all need the
 * full list, and none of them is the worker §9.10 is about. Platform super-admins
 * are left alone for the same reason they are left alone elsewhere.
 */
export function personReadsAreScoped(role?: string | null): boolean {
  return role === UserRole.CARE_WORKER;
}

/**
 * The SQL predicate, for use as `AND <predicate>` against a `people` row.
 *
 * `userParam` is a placeholder (`$3`), never an interpolated value, so callers
 * keep their own parameter numbering and the value stays bound. `alias` is the
 * `people` alias in the surrounding query — one argument rather than a separate
 * `id` expression, because a caller that renamed one and forgot the other would
 * still produce valid SQL and a wrong answer.
 */
export function visibleResidentPredicate(userParam: string, alias = 'su'): string {
  return `(
    EXISTS (
      SELECT 1
        FROM shifts s
        JOIN shift_assignments sa ON sa.shift_id = s.id
        JOIN staff_profiles sp ON sp.id = sa.staff_id
       WHERE sp.user_id = ${userParam}
         AND s.person_id = ${alias}.id
         AND s.status <> 'cancelled'
         AND sa.status <> 'rejected'
    )
    OR EXISTS (
      SELECT 1
        FROM shifts s
        JOIN shift_assignments sa ON sa.shift_id = s.id
        JOIN staff_profiles sp ON sp.id = sa.staff_id
       WHERE sp.user_id = ${userParam}
         AND s.location_id = ${alias}.location_id
         AND s.status <> 'cancelled'
         AND sa.status <> 'rejected'
         AND s.end_time   >= CURRENT_TIMESTAMP - INTERVAL '${ROSTER_PAST_DAYS} days'
         AND s.start_time <= CURRENT_TIMESTAMP + INTERVAL '${ROSTER_AHEAD_DAYS} days'
    )
    OR EXISTS (
      SELECT 1
        FROM homecare_visits v
        JOIN staff_profiles sp ON sp.id = v.assigned_staff_id
       WHERE sp.user_id = ${userParam}
         AND v.person_id = ${alias}.id
         AND v.status <> 'cancelled'
    )
  )`;
}

/**
 * The same rule, for one record.
 *
 * Returns `false` for a resident that does not exist in this tenant as well as
 * for one out of scope, so the caller can answer 404 in both cases and the
 * response does not disclose that a record exists behind the boundary.
 */
export async function canUserSeePerson(userId: string, personId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1
       FROM people su
      WHERE su.id = $2
        AND ${visibleResidentPredicate('$1', 'su')}
      LIMIT 1`,
    [userId, personId],
  );
  return (result.rowCount ?? 0) > 0;
}
