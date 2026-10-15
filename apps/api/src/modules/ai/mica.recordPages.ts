/**
 * The page behind a *write* — the record Mica has just saved, offered the way a
 * list answer offers its page.
 *
 * Why this exists. Mica's read flows already end on a page: a list answer is
 * spoken and then asks "want me to open the rota planner?", the route is
 * remembered in the conversation, and the carer's next word opens it
 * (`MicaFactPage`, `formatFactReply`, and the confirmation branch of
 * `/ai/mica/ask`). The write flows ended nowhere. "Add a task to order new grip
 * rails" produced a saved row and a sentence, and the carer who wanted to look at
 * what had just been written had to leave the conversation entirely: find the
 * tasks page, find the row. The record was created and then handed over to be
 * hunted for.
 *
 * So a confirmed write ends like an answered question does — with the record's own
 * page offered by name, and the destination remembered so that a bare "yes" opens
 * it. The two halves of that contract are deliberately the same two halves as the
 * read flow's: the caller receives `offer` (the page, with the question in it) and
 * the server holds the page on the session, which is what makes the spoken
 * question answerable rather than decorative.
 *
 * What this module deliberately does not do:
 *
 *   - **No new route, and no route arithmetic.** The link itself is built by
 *     `micaRecordPath` in `@meticle/shared`, because the page that reads it lives
 *     in the other app; this module only says what Mica *calls* the record and
 *     whether the caller may open its page. Nothing here guesses a URL shape.
 *   - **No roles, and no modules, of its own.** Which roles can open `/tasks`,
 *     `/appointments` or a person's profile is the router's answer, read out of
 *     the generated `PAGE_ACCESS` table by `pageAccessFor` — the same gate, and
 *     the same reason, as `factPageForRole`. The other half of that gate is the
 *     caller's modules, which arrive already resolved (`MicaModuleAccess`, from
 *     `mica.moduleAccess.ts`) because they are this caller's rather than the
 *     router's. A record whose page the caller cannot open — by role *or* by
 *     module — is offered to nobody: no question is asked, so no promise is
 *     broken. `/tasks` is the case worth naming: the router gates it by module
 *     and not by role, so a task a care worker legitimately creates is saved with
 *     a plain sentence and no offer, because `ModuleGuard` would refuse them the
 *     page.
 *   - **No record data in the offer.** A route, a label and a destination. The id
 *     lives in the path for the page to read; nothing is spoken back that was not
 *     already said, and the session's copy of the offer carries no care record.
 *
 * Pure by design: no database, no model, no clock. The role is a parameter and the
 * ref is what the caller already has in hand.
 */

import { UserRole } from '@meticle/shared';
import { micaRecordPath, type MicaRecordRef, type MicaRecordKind } from '@meticle/shared';
import type { MicaNavigationDestination } from './mica.navigation';
import { pageAccessFor } from './mica.facts';
import type { MicaModuleAccess } from './mica.facts';

/**
 * The page behind a written record, when Mica can offer to open it.
 *
 * Deliberately the same shape as `MicaFactPage`, because it is the same kind of
 * thing arriving by a different door: the client sees `offer` on both a list
 * answer and a confirmed write, and pushes `path` either way. `label` is what
 * opening it is called aloud ("Opening the new task."), and `offer` is the
 * question the write's reply ends with.
 */
export interface MicaRecordPage {
  /** The router's own destination union: the same value navigation sends. */
  destination: MicaNavigationDestination
  /** The deep link to the one record, ids included. */
  path: string
  /** What opening it is called aloud: "Opening the new task." */
  label: string
  /** The question the reply ends with. */
  offer: string
}

interface RecordPageRow {
  destination: MicaNavigationDestination
  /**
   * The router path whose access decides whether this can be offered at all — the
   * page, not the record. It is a separate field from `path` because a record's
   * link carries an id and a query string, and the router declares its gate for
   * the route without them.
   */
  accessPath: string
  /** The record as it is referred to aloud: "the new task". */
  label: string
}

/**
 * Which records offer their page. All three, and that is the point: a record Mica
 * just wrote is the one thing in the product whose page the carer has certainly
 * not seen yet — the write is the reason to look at it.
 *
 * Three of the record kinds, not all of them, and the type says so: the shared
 * contract is wider than this table because notifications and email link to records
 * Mica never writes (a leave request, an incident, a shift). A write is the only
 * thing this module has an opinion about, so a kind outside `RecordPageForWrite` —
 * or one added to the contract tomorrow — finds no row here and is offered nothing,
 * which is the safe half of the answer.
 */
const RECORD_PAGES: Partial<Record<MicaRecordKind, RecordPageRow>> = {
  task: {
    destination: 'tasks',
    accessPath: '/tasks',
    label: 'the new task',
  },
  appointment: {
    destination: 'appointments',
    accessPath: '/appointments',
    label: 'the new appointment',
  },
  // The care note's page is the person's daily-notes tab: the note belongs to a
  // profile, and the link names both (see `micaRecordPath`).
  'care-note': {
    destination: 'person',
    accessPath: '/people/:id',
    label: 'the new care note',
  },
}

/**
 * The page behind a written record *for this caller*, or undefined when there is
 * none they could open.
 *
 * A record is never offered without its page: the question is asked only when the
 * door opens. `/tasks`, `/appointments` and `/people/:id` are gated by module and
 * (for appointments) by role, so the same save can end with a question for one
 * caller and a plain sentence for another — which is correct, and is exactly how
 * `factPageForRole` behaves for the training matrix.
 */
export function recordPageFor(
  ref: MicaRecordRef,
  role: UserRole | undefined,
  modules: MicaModuleAccess | undefined,
): MicaRecordPage | undefined {
  const row = RECORD_PAGES[ref.kind]
  if (!row) return undefined
  if (!pageAccessFor(row.accessPath, role, modules)) return undefined;
  return {
    destination: row.destination,
    path: micaRecordPath(ref),
    label: row.label,
    offer: `Want me to open ${row.label}?`,
  };
}

/**
 * The record a confirmed write produced, read from the gateway's own result.
 *
 * The gateway answers with `taskId` or `appointmentId` (`createTask.action.ts`,
 * `createAppointment.action.ts`), so the id of the new row is the one thing the
 * caller already knows and does not have to query for again. Care notes are
 * absent on purpose: they are persisted by `/ai/daily-notes/approve`, which reads
 * the note it inserted rather than a gateway result — the gateway refuses to
 * confirm one at all.
 */
export function recordRefFromWrite(result: Record<string, unknown> | undefined): MicaRecordRef | undefined {
  const taskId = result?.taskId;
  if (typeof taskId === 'string' && taskId) return { kind: 'task', id: taskId };
  const appointmentId = result?.appointmentId;
  if (typeof appointmentId === 'string' && appointmentId) return { kind: 'appointment', id: appointmentId };
  return undefined;
}
