import { query as dbQuery } from '../../../shared/database';
import { AIController } from '../ai.controller';
import { AppointmentRepository } from '../../appointments/appointments.repository';
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
 * CREATE_APPOINTMENT — book an appointment for a service user via Mica.
 *
 * Same confirm-before-persist contract as the care note and task actions:
 * resolve (with person + staff disambiguation), draft for review, and persist
 * only through `confirm()` invoked by the gateway's confirm endpoint after the
 * user approves. Date and time are normalised server-side so a spoken
 * "next Tuesday at 2" resolved on the client can never become an ambiguous
 * server-side write; the client sends ISO strings it has already confirmed
 * with the user in the review card.
 */
export class CreateAppointmentAction implements MicaAction<CreateAppointmentInput, CreateAppointmentOutput> {
  metadata: MicaActionMetadata = {
    id: 'CREATE_APPOINTMENT',
    label: 'Book an appointment',
    description: 'Book an appointment for a service user, then review the details before saving.',
    inputSchema: 'MicaCreateAppointmentInput',
    outputSchema: 'MicaCreateAppointmentOutput',
    allowedRoles: ['ORG_ADMIN', 'MANAGER', 'CARE_WORKER'],
    risk: 'medium',
    requiresConfirmation: true,
    auditFeature: 'mica_create_appointment',
  };

  constructor(private db: typeof dbQuery) {}

  async resolve(
    request: MicaActionRequest,
    context: MicaActionContext,
  ): Promise<MicaActionResult | MicaActionDraft<CreateAppointmentOutput>> {
    const input = request.input as CreateAppointmentInput;
    const title = (input.title || '').trim();
    if (!title) {
      return { error: { message: 'What is the appointment for? Say or type a short title.' } };
    }

    const body: CreateAppointmentInput = {
      title,
      personId: input.personId,
      personName: input.personName,
      staffName: input.staffName,
      staffId: input.staffId,
      locationId: input.locationId,
      startTime: this.normaliseTimestamp(input.startTime),
      endTime: this.normaliseTimestamp(input.endTime),
      notes: (input.notes || '').trim() || undefined,
      source: input.source,
    };

    if (!body.startTime) {
      return { error: { message: 'When is the appointment? Give me a date and time.' } };
    }
    // End time defaults to start + 1 hour, matching the manual booking form's
    // behaviour, so the user only has to confirm one time when speaking.
    if (!body.endTime) {
      const start = new Date(body.startTime);
      start.setHours(start.getHours() + 1);
      body.endTime = start.toISOString();
    }

    // Person disambiguation: same contract as the care-note action.
    if (!body.personId && body.personName) {
      const candidates = await AIController.findPersonByName(this.db, context.organizationId, body.personName);
      if (candidates.length === 0) {
        return { error: { message: `No active person named "${body.personName}" found in this organisation` } };
      }
      if (candidates.length > 1) {
        return {
          needClarification: true,
          type: 'choosePerson',
          prompt: `I found ${candidates.length} people named "${body.personName}". Who is the appointment for?`,
          candidates: candidates.map((c: any) => ({
            id: c.id,
            name: `${c.first_name} ${c.last_name}`,
            detail: c.room_number ? `Room ${c.room_number}` : undefined,
          })),
        } satisfies MicaClarificationResponse;
      }
      body.personId = candidates[0].id;
    }

    // Attending staff, if named: clarify rather than guess.
    if (!body.staffId && body.staffName) {
      const staff = await this.findStaff(context.organizationId, body.staffName);
      if (staff.length === 0) {
        return { error: { message: `No staff member matching "${body.staffName}" found.` } };
      }
      if (staff.length > 1) {
        return {
          needClarification: true,
          type: 'chooseOption',
          prompt: `More than one person matches "${body.staffName}". Who should attend?`,
          options: staff.map((s: any) => ({ id: s.id, label: `${s.first_name} ${s.last_name}` })),
        };
      }
      body.staffId = String(staff[0].id);
    }

    return this.buildDraft(body, context);
  }

  async execute(
    request: MicaActionRequest,
    context: MicaActionContext,
  ): Promise<MicaActionResult | MicaActionDraft<CreateAppointmentOutput>> {
    return this.resolve(request, context);
  }

  /**
   * Persist the reviewed draft. Called by the gateway's confirm endpoint.
   * Re-validates person/staff/location org-scoping here rather than trusting
   * the draft: between drafting and confirming, a reference could have been
   * removed — and the confirmation client is untrusted input again.
   */
  async confirm(draft: CreateAppointmentOutput, context: MicaActionContext): Promise<{ appointmentId: string; title: string }> {
    const orgId = context.organizationId;
    if (draft.personId) {
      const person = await dbQuery('SELECT 1 FROM people WHERE id = $1 AND organization_id = $2', [draft.personId, orgId]);
      if (!person.rows.length) return Promise.reject(new Error('Person not found in this organisation'));
    }
    if (draft.staffId) {
      const staff = await dbQuery(
        `SELECT 1 FROM staff_profiles sp JOIN users u ON u.id = sp.user_id
         WHERE sp.id = $1 AND u.organization_id = $2 AND u.status = 'active'`,
        [draft.staffId, orgId],
      );
      if (!staff.rows.length) return Promise.reject(new Error('Staff member not found in this organisation'));
    }
    if (draft.locationId) {
      const loc = await dbQuery('SELECT 1 FROM locations WHERE id = $1 AND organization_id = $2', [draft.locationId, orgId]);
      if (!loc.rows.length) return Promise.reject(new Error('Location not found in this organisation'));
    }
    const row = await AppointmentRepository.create({
      organization_id: orgId,
      person_id: draft.personId || null,
      staff_id: draft.staffId || null,
      title: draft.title,
      notes: draft.notes || null,
      start_time: draft.startTime,
      end_time: draft.endTime,
      status: 'scheduled',
      location_id: draft.locationId || null,
      created_by: context.userId,
    } as any);
    return { appointmentId: row.id, title: row.title };
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

  private normaliseTimestamp(value: unknown): string | undefined {
    const s = typeof value === 'string' ? value.trim() : '';
    if (!s) return undefined;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  private buildDraft(
    body: CreateAppointmentInput,
    context: MicaActionContext,
  ): MicaActionDraft<CreateAppointmentOutput> | MicaActionError {
    if (!body.title || !body.startTime) {
      return { error: { message: 'Appointment title and start time are required.' } };
    }
    const when = new Date(body.startTime);
    const dateLabel = when.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    const timeLabel = when.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });
    const output: CreateAppointmentOutput = {
      title: body.title,
      personId: body.personId,
      personName: body.personName,
      staffId: body.staffId,
      staffName: body.staffName,
      locationId: body.locationId,
      startTime: body.startTime,
      endTime: body.endTime!,
      notes: body.notes,
    };
    const who = body.personName ? ` for ${body.personName}` : '';
    return {
      draft: true,
      action: 'CREATE_APPOINTMENT',
      output,
      summary: `I've prepared "${body.title}"${who} on ${dateLabel} at ${timeLabel}. Shall I book it?`,
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

export interface CreateAppointmentInput {
  title?: string;
  personId?: string;
  personName?: string;
  staffId?: string;
  staffName?: string;
  locationId?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  source?: 'voice' | 'text' | 'manual';
}

export interface CreateAppointmentOutput {
  title: string;
  personId?: string;
  personName?: string;
  staffId?: string;
  staffName?: string;
  locationId?: string;
  startTime: string;
  endTime: string;
  notes?: string;
}
