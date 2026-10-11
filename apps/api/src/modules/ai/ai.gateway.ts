import { Request } from 'express';
import pool from '../../shared/database';
import { CreateCareNoteAction } from './actions/createCareNote.action';
import { CreateTaskAction } from './actions/createTask.action';
import { CreateAppointmentAction } from './actions/createAppointment.action';
import { PrepareHandoverAction } from './actions/prepareHandover.action';
import { SummariseChangesAction } from './actions/summariseChanges.action';
import {
  MicaActionRequest,
  MicaActionContext,
  MicaActionResult,
  getMicaAction,
  MicaActionDraft,
} from './ai.actions';
import { AIController } from './ai.controller';
import {
  publishMicaTaskConfirmedEvent,
  publishMicaAppointmentConfirmedEvent,
} from './ai.events';
import { query } from '../../shared/database';

/**
 * Resolves the users.id behind a staff_profiles.id. The notification
 * consumers fan out to user accounts, not profile rows, so the event carries
 * both; an inactive/missing profile resolves to null and the consumer
 * notifies the creating manager instead.
 */
async function staffProfileUserId(staffProfileId: string | null | undefined): Promise<string | null> {
  if (!staffProfileId) return null;
  const r = await query(
    `SELECT sp.user_id FROM staff_profiles sp
     JOIN users u ON u.id = sp.user_id
     WHERE sp.id = $1 AND u.status = 'active'`,
    [staffProfileId],
  );
  return r.rows[0]?.user_id ?? null;
}

export type MicaGatewayContext = {
  req: Request;
  user: { organizationId: string; userId: string };
};

function baseContext(ctx: MicaGatewayContext, source: unknown): MicaActionContext {
  return {
    organizationId: ctx.user.organizationId,
    userId: ctx.user.userId,
    actedBy: ctx.user.userId,
    preparedAt: new Date().toISOString(),
    source: ((source as MicaActionRequest['input']['source']) || 'voice') as 'voice' | 'text' | 'manual',
    extras: undefined,
  };
}

export const MicaGateway = {
  /**
   * Prepare an action: resolve, disambiguate, and return a DRAFT for the
   * client's review card. Never persists anything.
   */
  async handle(
    request: MicaActionRequest,
    ctx: MicaGatewayContext,
  ): Promise<MicaActionResult> {
    const actionContext = baseContext(ctx, request.input?.source);

    if (request.action === 'CREATE_CARE_NOTE') {
      const action = new CreateCareNoteAction(AIController as any);
      const resolveResult = await action.resolve(request, actionContext);

      if ('error' in resolveResult) {
        return resolveResult;
      }
      if ('needClarification' in resolveResult) {
        return resolveResult;
      }
      if ('draft' in resolveResult) {
        return resolveResult;
      }

      // If resolution did not hand us a draft, treat it as an error.
      return { error: { message: 'The care note request could not be prepared.' } };
    }

    if (request.action === 'CREATE_TASK') {
      // The patched pool (request-scoped via AsyncLocalStorage) is the DB
      // handle the actions' name resolution runs through.
      const action = new CreateTaskAction(pool as any);
      const result = await action.resolve(request, actionContext);
      return result;
    }

    if (request.action === 'CREATE_APPOINTMENT') {
      const action = new CreateAppointmentAction(pool as any);
      const result = await action.resolve(request, actionContext);
      return result;
    }

    // PREPARE_HANDOVER and SUMMARISE_CHANGES are read-only actions: they run
    // the same resolve → prompt → draft contract as the write actions but have
    // no confirm step, so nothing they produce can be persisted. The gateway
    // still refuses their confirm (see below), so the read-only guarantee
    // holds even if a client is tricked into calling the confirm endpoint.
    if (request.action === 'PREPARE_HANDOVER' || request.action === 'SUMMARISE_CHANGES') {
      const readOnly = request.action === 'PREPARE_HANDOVER'
        ? new PrepareHandoverAction(pool as any)
        // The summariser takes the RLS-scoped callable query; wrap it so the
        // shared resolvePersonByIdentity (pool.query) and this module's own
        // db.query both resolve against the same request-scoped handle.
        : new SummariseChangesAction({ query } as any);
      const result = await readOnly.resolve(request, actionContext);
      return result;
    }

    return { error: { message: `Mica action "${request.action}" is not implemented yet.` } };
  },

  /**
   * Confirm a previously reviewed draft: the only path from a draft to a
   * database write. The gateway re-derives the action from the draft's own
   * `action` field so a client cannot confirm a task through the appointment
   * confirmer (or vice versa), and passes the draft through the action's own
   * `confirm`, which re-validates every org-scoped reference server-side.
   */
  async confirm(
    draft: MicaActionDraft<unknown>,
    ctx: MicaGatewayContext,
  ): Promise<{ ok: true; result: Record<string, unknown> } | MicaActionResult> {
    const actionContext = baseContext(ctx, (draft.context as { source?: string })?.source);

    if (draft.action === 'CREATE_TASK') {
      const action = new CreateTaskAction(pool as any);
      const confirmed = await action.confirm(draft.output as never, actionContext);
      // Domain event: notifications to the assignee flow through the outbox
      // worker rather than inline, so the confirm endpoint stays fast and the
      // notification survives a restart. Event failure must not fail the
      // confirmed write — the row already exists and the user has approved it.
      try {
        const output = confirmed as unknown as { taskId: string; title: string } & Record<string, unknown>;
        const taskRow = await query(
          `SELECT assigned_to, person_id, priority, due_date, created_by FROM tasks WHERE id = $1`,
          [output.taskId],
        );
        const t = taskRow.rows[0] || {};
        const assignedUserId = await staffProfileUserId(t.assigned_to);
        await publishMicaTaskConfirmedEvent({
          organizationId: actionContext.organizationId,
          payload: {
            task_id: output.taskId,
            title: output.title,
            priority: t.priority || 'medium',
            due_date: t.due_date ? String(t.due_date) : null,
            assigned_to: t.assigned_to || null,
            assigned_user_id: assignedUserId,
            person_id: t.person_id || null,
            created_by: t.created_by || actionContext.userId,
            source: actionContext.source,
          },
        });
      } catch (err) {
        console.warn('mica.task_confirmed event publish failed (write already persisted):', (err as Error).message);
      }
      return { ok: true, result: confirmed as unknown as Record<string, unknown> };
    }

    if (draft.action === 'PREPARE_HANDOVER' || draft.action === 'SUMMARISE_CHANGES') {
      // Read-only by construction: both actions produce analysis drafts with
      // no persist path, so there is nothing to confirm. Refuse rather than
      // route into an action's confirm — a crafty client cannot launder a
      // read-only draft into a write by calling this endpoint with it.
      return { error: { message: `Mica action "${draft.action}" is read-only and produces no persistent output to confirm.` } };
    }

    if (draft.action === 'CREATE_APPOINTMENT') {
      const action = new CreateAppointmentAction(pool as any);
      const confirmed = await action.confirm(draft.output as never, actionContext);
      try {
        const output = confirmed as unknown as { appointmentId: string; title: string } & Record<string, unknown>;
        const apptRow = await query(
          `SELECT staff_id, person_id, start_time, end_time, created_by FROM appointments WHERE id = $1`,
          [output.appointmentId],
        );
        const a = apptRow.rows[0] || {};
        const assignedUserId = await staffProfileUserId(a.staff_id);
        await publishMicaAppointmentConfirmedEvent({
          organizationId: actionContext.organizationId,
          payload: {
            appointment_id: output.appointmentId,
            title: output.title,
            start_time: a.start_time ? String(a.start_time) : '',
            end_time: a.end_time ? String(a.end_time) : null,
            staff_id: a.staff_id || null,
            assigned_user_id: assignedUserId,
            person_id: a.person_id || null,
            created_by: a.created_by || actionContext.userId,
            source: actionContext.source,
          },
        });
      } catch (err) {
        console.warn('mica.appointment_confirmed event publish failed (write already persisted):', (err as Error).message);
      }
      return { ok: true, result: confirmed as unknown as Record<string, unknown> };
    }

    return { error: { message: `Mica action "${draft.action}" cannot be confirmed through this gateway.` } };
  },
};

export type { MicaActionRequest, MicaActionContext, MicaActionResult } from './ai.actions';
export { getMicaAction } from './ai.actions';
