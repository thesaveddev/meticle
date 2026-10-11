import { AIController } from '../ai.controller';
import {
  MicaAction,
  MicaActionContext,
  MicaActionRequest,
  MicaActionResult,
  MicaActionDraft,
  MicaActionMetadata,
  MicaActionError,
} from '../ai.actions';
import { renderOrgPrompt } from '../ai.render';
import { aiCall } from '../ai.controller';
import { AIRepository } from '../ai.repository';
import { validateAIResponse, IntelligenceResponseSchema } from '../ai.schemas';
import { query as dbQuery } from '../../../shared/database';
import { resolveAiMinimisation } from '../ai.minimisation';
import logger from '../../../shared/utils/logger';

/**
 * PREPARE_HANDOVER — a read-only Mica action.
 *
 * Same confirm-before-persist framework as the write actions, with one
 * deliberate difference: there is nothing to persist. The action gathers the
 * period's care activity for one person (visits, daily notes, medication
 * administrations, incident involvement), sends it through the same redaction
 * + minimisation pipeline as every other intelligence surface, and returns a
 * structured handover summary as a reviewed output — a human reads it into the
 * next shift; the platform writes nothing on their behalf.
 *
 * No confirm(): the base contract requires one, and the gateway refuses any
 * draft bearing a read-only action id. The registry marks it risk 'low' and
 * requiresConfirmation false so the client renders a plain read card, not a
 * save button.
 */
export class PrepareHandoverAction implements MicaAction<PrepareHandoverInput, PrepareHandoverOutput> {
  metadata: MicaActionMetadata = {
    id: 'PREPARE_HANDOVER',
    label: 'Prepare a handover',
    description: 'Prepare a shift handover summary for a person, for a human to read into the next shift.',
    inputSchema: 'MicaPrepareHandoverInput',
    outputSchema: 'MicaPrepareHandoverOutput',
    allowedRoles: ['ORG_ADMIN', 'MANAGER', 'CARE_WORKER'],
    risk: 'low',
    requiresConfirmation: false,
    auditFeature: 'mica_prepare_handover',
    promptKey: 'unified_intelligence',
  };

  constructor(private db: { query: typeof dbQuery }) {}

  async resolve(
    request: MicaActionRequest,
    context: MicaActionContext,
  ): Promise<MicaActionResult | MicaActionDraft<PrepareHandoverOutput>> {
    const input = request.input as PrepareHandoverInput;
    const personId = input.personId;
    const personName = (input.personName || '').trim();

    if (!personId && !personName) {
      return { error: { message: 'Who is the handover for? Give me a person.' } } satisfies MicaActionError;
    }

    let resolvedPersonId = personId;
    let resolvedPersonName = personName;
    if (!resolvedPersonId) {
      // Shared person resolution: ambiguous names come back as a clarification,
      // exactly as the write actions disambiguate.
      const resolved = await AIController.resolvePersonByIdentity(this.db, context.organizationId, undefined, personName);
      if ('error' in resolved) {
        const err = resolved.error!;
        if (err.candidates?.length) {
          return {
            needClarification: true,
            type: 'choosePerson',
            prompt: `More than one person matches "${personName}". Who is the handover about?`,
            candidates: err.candidates,
          };
        }
        return { error: err } satisfies MicaActionError;
      }
      resolvedPersonId = resolved.person.id;
      resolvedPersonName = resolved.person.name;
    } else {
      // An id may still point outside the org or at a discharged person;
      // resolvePersonByIdentity re-validates both.
      const resolved = await AIController.resolvePersonByIdentity(this.db, context.organizationId, personId, undefined);
      if ('error' in resolved) {
        const err = resolved.error!;
        return { error: err } satisfies MicaActionError;
      }
      resolvedPersonName = resolved.person.name;
    }

    return this.buildDraft(resolvedPersonId!, resolvedPersonName!, input, context);
  }

  async execute(
    request: MicaActionRequest,
    context: MicaActionContext,
  ): Promise<MicaActionResult | MicaActionDraft<PrepareHandoverOutput>> {
    return this.resolve(request, context);
  }

  private async buildDraft(
    personId: string,
    personName: string,
    input: PrepareHandoverInput,
    context: MicaActionContext,
  ): Promise<MicaActionDraft<PrepareHandoverOutput> | MicaActionError> {
    const config = await AIRepository.getConfig(context.organizationId);
    if (!config || !config.enabled || !config.apiKey) {
      return { error: { message: 'AI not configured. Configure AI provider in Settings first.' } };
    }
    if (!config.enabledFeatures?.includes('natural_language_assistant')) {
      return { error: { message: 'Enable the "Natural-language Assistant" feature in Settings → AI to use Mica actions.' } };
    }

    const today = new Date().toISOString().slice(0, 10);
    // Default window: today's shift. A handover covers what happened since the
    // last change-of-shift, not an arbitrary reporting week.
    const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(String(input.from || '')) ? String(input.from) : today;
    const toDate = /^\d{4}-\d{2}-\d{2}$/.test(String(input.to || '')) ? String(input.to) : today;

    try {
      const [visits, notes, medication, incidents] = await Promise.all([
        this.db.query(
          `SELECT hv.id, hv.status, hv.visit_type, hv.label, hv.scheduled_start, hv.scheduled_end,
                  sp.first_name || ' ' || sp.last_name AS staff_name
           FROM homecare_visits hv
           LEFT JOIN staff_profiles sp ON sp.id = hv.assigned_staff_id
           JOIN people p ON p.id = hv.person_id
           WHERE hv.person_id = $1 AND p.organization_id = $2
             AND hv.scheduled_start::date BETWEEN $3::date AND $4::date
           ORDER BY hv.scheduled_start LIMIT 200`,
          [personId, context.organizationId, fromDate, toDate],
        ),
        this.db.query(
          `SELECT n.id, n.note_date, n.shift, n.category, LEFT(n.content, 600) AS content
           FROM daily_notes n
           WHERE n.person_id = $1 AND n.note_date BETWEEN $2::date AND $3::date
           ORDER BY n.note_date DESC, n.created_at DESC LIMIT 100`,
          [personId, fromDate, toDate],
        ),
        this.db.query(
          `SELECT a.id, a.status, a.scheduled_time, a.administered_time, mi.name AS medication_name
           FROM emedication_administrations a
           JOIN emedication_items mi ON mi.id = a.emedication_item_id
           JOIN emedication_records r ON r.id = mi.emedication_record_id
           WHERE r.person_id = $1 AND r.organization_id = $2
             AND a.scheduled_time::date BETWEEN $3::date AND $4::date
           ORDER BY a.scheduled_time LIMIT 200`,
          [personId, context.organizationId, fromDate, toDate],
        ),
        this.db.query(
          `SELECT i.id, i.title, i.severity, i.status, i.incident_date
           FROM incidents i
           LEFT JOIN incident_involved_residents iir ON iir.incident_id = i.id
           WHERE iir.person_id = $1
             AND EXISTS (SELECT 1 FROM people p WHERE p.id = $1 AND p.organization_id = $2)
             AND i.incident_date BETWEEN $3::date AND $4::date
           ORDER BY i.incident_date DESC LIMIT 50`,
          [personId, context.organizationId, fromDate, toDate],
        ),
      ]);

      const records = [
        ...visits.rows.map((r: any) => ({ source_type: 'homecare_visit', source_id: String(r.id), ...r })),
        ...notes.rows.map((r: any) => ({ source_type: 'daily_note', source_id: String(r.id), ...r })),
        ...medication.rows.map((r: any) => ({ source_type: 'medication_administration', source_id: String(r.id), ...r })),
        ...incidents.rows.map((r: any) => ({ source_type: 'incident', source_id: String(r.id), ...r })),
      ];

      if (records.length === 0) {
        return { error: { message: `No care records found for ${personName} between ${fromDate} and ${toDate}. Widen the period or check the person.` } };
      }

      const minimisation = await resolveAiMinimisation(context.organizationId);
      const { system, user } = await renderOrgPrompt(
        'unified_intelligence',
        {
          capability: 'mica_prepare_handover',
          from: fromDate,
          to: toDate,
          question: `Prepare a shift handover summary for ${personName}: what happened, what is outstanding, and what the next carer must continue.`,
          audience: 'next shift carer',
          tone: 'professional and cautious',
          records: JSON.stringify(records),
        },
        context.organizationId,
        [],
        minimisation,
      );

      const start = Date.now();
      const result = await aiCall(context.organizationId, config, [{ role: 'system', content: system }, { role: 'user', content: user }], { model: config.model, temperature: 0.2, maxTokens: 2200 });
      const validated = validateAIResponse(IntelligenceResponseSchema, result.content, 'Handover summary');
      await AIRepository.logAudit({
        organizationId: context.organizationId,
        feature: 'mica_prepare_handover',
        promptKey: 'unified_intelligence',
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        model: config.model,
        provider: result.provider,
        durationMs: Date.now() - start,
        success: true,
        createdBy: context.userId,
        requestData: { personId, from: fromDate, to: toDate, windowDays: fromDate === toDate ? 1 : 0, recordCount: records.length },
        responseSummary: validated.data?.headline || 'Handover summary',
      }).catch(() => undefined);

      const output: PrepareHandoverOutput = {
        personId,
        personName,
        from: fromDate,
        to: toDate,
        handover: validated.data || {
          headline: 'Handover summary could not be validated',
          summary: 'The prepared summary failed validation. Check the source records directly.',
          items: [],
          suggested_follow_up: [],
          limitations: [validated.error || 'AI response failed validation'],
        },
        generated_by_ai: true,
      };

      const summaryBits: string[] = [`I've prepared a handover for ${personName}`];
      if (validated.data?.headline) summaryBits.push(validated.data.headline);
      return {
        draft: true,
        action: 'PREPARE_HANDOVER',
        output,
        summary: `${summaryBits.join('. ')}. This is a draft to read, nothing is saved.`,
        context: {
          organizationId: context.organizationId,
          userId: context.userId,
          actedBy: context.userId,
          preparedAt: new Date().toISOString(),
          source: context.source,
          extras: { personId, personName },
        },
      };
    } catch (err: any) {
      logger.error(err, 'Mica prepare handover failed');
      return { error: { message: err?.message?.slice(0, 200) || 'Preparing the handover failed.' } };
    }
  }
}

export interface PrepareHandoverInput {
  personId?: string;
  personName?: string;
  from?: string;
  to?: string;
  source?: 'voice' | 'text' | 'manual';
}

export interface PrepareHandoverOutput {
  personId: string;
  personName: string;
  from: string;
  to: string;
  handover: {
    headline: string;
    summary: string;
    items: Array<{ title: string; detail: string; priority: 'high' | 'medium' | 'low'; source_type: string; source_id: string; source_url?: string }>;
    suggested_follow_up: string[];
    limitations: string[];
  };
  generated_by_ai: boolean;
}
