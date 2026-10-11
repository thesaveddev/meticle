import { query as dbQuery } from '../../../shared/database';
import { AIController } from '../ai.controller';
import { TaskRepository } from '../../tasks/tasks.repository';
import {
  MicaAction,
  MicaActionContext,
  MicaActionRequest,
  MicaActionResult,
  MicaClarificationResponse,
  MicaActionDraft,
  MicaActionMetadata,
  MicaActionError,
} from '../ai.actions';

/**
 * CREATE_TASK — Mica's first write action beyond the care note.
 *
 * Contract, matching the care-note action exactly: `resolve` validates and
 * disambiguates (returning a structured clarification when a spoken name is
 * ambiguous), `execute` returns a DRAFT — never a persisted row — and the
 * client reviews the summary before confirming. Persistence happens only in
 * `confirm()` below, which the gateway invokes from the confirm endpoint after
 * the user has approved the draft. A voice utterance can therefore never be a
 * write path on its own.
 */
export class CreateTaskAction implements MicaAction<CreateTaskInput, CreateTaskOutput> {
  metadata: MicaActionMetadata = {
    id: 'CREATE_TASK',
    label: 'Create a task',
    description: 'Create a follow-up task for a person or the team, then review before saving.',
    inputSchema: 'MicaCreateTaskInput',
    outputSchema: 'MicaCreateTaskOutput',
    allowedRoles: ['ORG_ADMIN', 'MANAGER', 'CARE_WORKER'],
    risk: 'medium',
    requiresConfirmation: true,
    auditFeature: 'mica_create_task',
  };

  constructor(private db: typeof dbQuery) {}

  async resolve(
    request: MicaActionRequest,
    context: MicaActionContext,
  ): Promise<MicaActionResult | MicaActionDraft<CreateTaskOutput>> {
    const input = request.input as CreateTaskInput;
    const title = (input.title || '').trim();
    if (!title) {
      return { error: { message: 'What should the task be called? Say or type a short title.' } };
    }

    const body: CreateTaskInput = {
      title,
      description: (input.description || '').trim() || undefined,
      personId: input.personId,
      personName: input.personName,
      assigneeName: input.assigneeName,
      assigneeId: input.assigneeId,
      priority: this.normalisePriority(input.priority),
      dueDate: this.normaliseDate(input.dueDate),
      source: input.source,
    };

    // Person disambiguation: identical contract to the care-note action.
    if (!body.personId && body.personName) {
      const candidates = await AIController.findPersonByName(this.db, context.organizationId, body.personName);
      if (candidates.length === 0) {
        return { error: { message: `No active person named "${body.personName}" found in this organisation` } };
      }
      if (candidates.length > 1) {
        return {
          needClarification: true,
          type: 'choosePerson',
          prompt: `I found ${candidates.length} people named "${body.personName}". Who is the task about?`,
          candidates: candidates.map((c: any) => ({
            id: c.id,
            name: `${c.first_name} ${c.last_name}`,
            detail: c.room_number ? `Room ${c.room_number}` : undefined,
          })),
        } satisfies MicaClarificationResponse;
      }
      body.personId = candidates[0].id;
    }

    // Assignee resolution: staff, not service users. A spoken name that maps to
    // several colleagues is a clarification, not a guess — assigning follow-up
    // work to the wrong person is how tasks silently die.
    if (!body.assigneeId && body.assigneeName) {
      const staff = await this.findStaff(context.organizationId, body.assigneeName);
      if (staff.length === 0) {
        return { error: { message: `No staff member matching "${body.assigneeName}" found.` } };
      }
      if (staff.length > 1) {
        return {
          needClarification: true,
          type: 'chooseOption',
          prompt: `More than one person matches "${body.assigneeName}". Who should get this task?`,
          options: staff.map((s: any) => ({ id: s.id, label: `${s.first_name} ${s.last_name}` })),
        };
      }
      body.assigneeId = String(staff[0].id);
    }

    return this.buildDraft(body, context);
  }

  async execute(
    request: MicaActionRequest,
    context: MicaActionContext,
  ): Promise<MicaActionResult | MicaActionDraft<CreateTaskOutput>> {
    return this.resolve(request, context);
  }

  /**
   * Persist the reviewed draft. Called by the gateway's confirm endpoint —
   * the only path from a draft to a row in `tasks`.
   */
  async confirm(draft: CreateTaskOutput, context: MicaActionContext): Promise<{ taskId: string; title: string }> {
    const row = await TaskRepository.create(context.organizationId, {
      title: draft.title,
      description: draft.description || null,
      notes: null,
      assigned_to: draft.assigneeId || null,
      person_id: draft.personId || null,
      priority: draft.priority || 'medium',
      status: 'pending',
      due_date: draft.dueDate || null,
      created_by: context.userId,
    });
    return { taskId: row.id, title: row.title };
  }

  private async findStaff(orgId: string, name: string): Promise<Array<Record<string, unknown>>> {
    const parts = name.split(' ').filter(Boolean);
    const result = await dbQuery(
      `
      SELECT sp.id, sp.first_name, sp.last_name
      FROM staff_profiles sp
      JOIN users u ON u.id = sp.user_id
      WHERE u.organization_id = $1 AND u.status = 'active'
        AND (sp.first_name || ' ' || sp.last_name) ILIKE $2
        AND ($3::text IS NULL OR sp.first_name ILIKE $3)
      ORDER BY sp.last_name
      LIMIT 5
    `,
      [orgId, `%${name}%`, parts[0] || null],
    );
    return result.rows;
  }

  private normalisePriority(value: unknown): string | undefined {
    const p = typeof value === 'string' ? value.toLowerCase().trim() : '';
    if (!p) return undefined;
    if (['urgent', 'critical', 'asap'].includes(p)) return 'urgent';
    if (['high', 'important'].includes(p)) return 'high';
    if (['low', 'whenever'].includes(p)) return 'low';
    if (['medium', 'normal'].includes(p)) return 'medium';
    return 'medium';
  }

  private normaliseDate(value: unknown): string | undefined {
    const s = typeof value === 'string' ? value.trim() : '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return undefined;
  }

  private buildDraft(
    body: CreateTaskInput,
    context: MicaActionContext,
  ): MicaActionDraft<CreateTaskOutput> | MicaActionError {
    if (!body.title) return { error: { message: 'Task title is required.' } };
    const output: CreateTaskOutput = {
      title: body.title,
      description: body.description,
      personId: body.personId,
      personName: body.personName,
      assigneeId: body.assigneeId,
      assigneeName: body.assigneeName,
      priority: body.priority || 'medium',
      dueDate: body.dueDate,
    };
    const bits: string[] = [];
    bits.push(body.personName ? `a task about ${body.personName}` : 'a task');
    if (body.assigneeName) bits.push(`assigned to ${body.assigneeName}`);
    if (body.dueDate) bits.push(`due ${body.dueDate}`);
    bits.push(`priority ${output.priority}`);
    return {
      draft: true,
      action: 'CREATE_TASK',
      output,
      summary: `I've prepared ${bits.join(', ')}. Shall I save it?`,
      context: {
        organizationId: context.organizationId,
        userId: context.userId,
        actedBy: context.userId,
        preparedAt: new Date().toISOString(),
        source: (body.source || context.source) as 'voice' | 'text' | 'manual',
        extras: { personId: body.personId, personName: body.personName },
      },
    };
  }
}

export interface CreateTaskInput {
  title?: string;
  description?: string;
  personId?: string;
  personName?: string;
  assigneeId?: string;
  assigneeName?: string;
  priority?: string;
  dueDate?: string;
  source?: 'voice' | 'text' | 'manual';
}

export interface CreateTaskOutput {
  title: string;
  description?: string;
  personId?: string;
  personName?: string;
  assigneeId?: string;
  assigneeName?: string;
  priority: string;
  dueDate?: string;
}
