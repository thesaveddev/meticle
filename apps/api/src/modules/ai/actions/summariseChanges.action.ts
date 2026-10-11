import { AIController, aiCall } from '../ai.controller';
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
import { AIRepository } from '../ai.repository';
import { validateAIResponse, IntelligenceResponseSchema } from '../ai.schemas';
import { query as dbQuery } from '../../../shared/database';
import { resolveAiMinimisation } from '../ai.minimisation';
import logger from '../../../shared/utils/logger';

/**
 * SUMMARISE_CHANGES — a read-only Mica action.
 *
 * Companion to PREPARE_HANDOVER from the same framework, one deliberate
 * difference in scope: where the handover covers one person's window ending
 * today, this summarises a person (or the org) across a recent window, so the
 * question it answers is "what changed". Like-for-like counts for the two
 * halves of the window travel in the prompt; everything flows through the
 * identical redaction and minimisation boundary as /ai/change-detection.
 *
 * No confirm(): read-only. The gateway refuses confirm for any draft bearing
 * this action id, the same as care notes — nothing here can write.
 */
export class SummariseChangesAction implements MicaAction<SummariseChangesInput, SummariseChangesOutput> {
  metadata: MicaActionMetadata = {
    id: 'SUMMARISE_CHANGES',
    label: 'Summarise what has changed',
    description: 'Summarise changes for a person or the organisation across a recent window, as a read-only draft.',
    inputSchema: 'MicaSummariseChangesInput',
    outputSchema: 'MicaSummariseChangesOutput',
    allowedRoles: ['ORG_ADMIN', 'MANAGER', 'CARE_WORKER'],
    risk: 'low',
    requiresConfirmation: false,
    auditFeature: 'mica_summarise_changes',
    promptKey: 'unified_intelligence',
  };

  constructor(private db: { query: typeof dbQuery }) {}

  async resolve(
    request: MicaActionRequest,
    context: MicaActionContext,
  ): Promise<MicaActionResult | MicaActionDraft<SummariseChangesOutput>> {
    const input = request.input as SummariseChangesInput;
    const personId = input.personId;
    const personName = (input.personName || '').trim();

    // Default window: the last 7 days ending today, mirroring the
    // /ai/change-detection default. The compare window is the same length
    // immediately before it, so "what changed" is a like-for-like.
    const windowDays = [7, 14, 30].includes(Number(input.windowDays)) ? Number(input.windowDays) : 7;
    const dayMs = 86400000;
    const toDate = /^\d{4}-\d{2}-\d{2}$/.test(String(input.to || '')) ? String(input.to) : new Date().toISOString().slice(0, 10);
    const toDateMs = new Date(`${toDate}T00:00:00Z`).getTime();
    const fromDate = new Date(toDateMs - (windowDays - 1) * dayMs).toISOString().slice(0, 10);
    const compareFrom = new Date(toDateMs - (2 * windowDays - 1) * dayMs).toISOString().slice(0, 10);
    const compareTo = new Date(toDateMs - windowDays * dayMs).toISOString().slice(0, 10);

    let resolvedPersonId: string | undefined = personId || undefined;
    let resolvedPersonName: string | undefined = personName || undefined;
    if (!resolvedPersonId && personName) {
      const resolved = await AIController.resolvePersonByIdentity(this.db, context.organizationId, undefined, personName);
      if ('error' in resolved) {
        const err = resolved.error!;
        if (err.candidates?.length) {
          return {
            needClarification: true,
            type: 'choosePerson',
            prompt: `More than one person matches "${personName}". Whose changes should I summarise?`,
            candidates: err.candidates,
          };
        }
        return { error: err } satisfies MicaActionError;
      }
      resolvedPersonId = resolved.person.id;
      resolvedPersonName = resolved.person.name;
    } else if (resolvedPersonId) {
      // A supplied id may point outside the org or at a discharged person;
      // resolvePersonByIdentity re-validates both.
      const resolved = await AIController.resolvePersonByIdentity(this.db, context.organizationId, personId, undefined);
      if ('error' in resolved) {
        const err = resolved.error!;
        return { error: err } satisfies MicaActionError;
      }
      resolvedPersonName = resolved.person.name;
    }

    return this.buildDraft({
      personId: resolvedPersonId,
      personName: resolvedPersonName,
      fromDate,
      toDate,
      compareFrom,
      compareTo,
      windowDays,
      organisationWide: !resolvedPersonId,
      context,
    });
  }

  async execute(
    request: MicaActionRequest,
    context: MicaActionContext,
  ): Promise<MicaActionResult | MicaActionDraft<SummariseChangesOutput>> {
    return this.resolve(request, context);
  }

  private async buildDraft(args: {
    personId?: string;
    personName?: string;
    fromDate: string;
    toDate: string;
    compareFrom: string;
    compareTo: string;
    windowDays: number;
    organisationWide: boolean;
    context: MicaActionContext;
  }): Promise<MicaActionDraft<SummariseChangesOutput> | MicaActionError> {
    const { personId, personName, fromDate, toDate, compareFrom, compareTo, windowDays, organisationWide, context } = args;
    const orgId = context.organizationId;
    const dayMs = 86400000;

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return { error: { message: 'AI not configured. Configure AI provider in Settings first.' } };
    }
    if (!config.enabledFeatures?.includes('natural_language_assistant')) {
      return { error: { message: 'Enable the "Natural-language Assistant" feature in Settings → AI to use Mica actions.' } };
    }

    try {
      const params = organisationWide
        ? [orgId, fromDate, toDate]
        : [orgId, fromDate, toDate, personId];
      const personFilter = organisationWide ? '' : ` AND X.person_id = $4`;
      const personFilterNullable = organisationWide ? '' : ` AND ($4::uuid IS NULL OR X.person_id = $4)`;

      const [visits, notes, incidents, medication, risks, actions] = await Promise.all([
        this.db.query(
          `SELECT hv.id, hv.status, hv.visit_type, hv.label, hv.scheduled_start, hv.scheduled_end,
                  p.id AS person_id, p.first_name || ' ' || p.last_name AS person_name,
                  'homecare_visit'::text AS __source_type
           FROM homecare_visits hv JOIN people p ON p.id = hv.person_id
           WHERE p.organization_id = $1 AND hv.scheduled_start::date BETWEEN $2::date AND $3::date${organisationWide ? '' : ' AND p.id = $4'}
           ORDER BY hv.scheduled_start LIMIT 300`,
          params,
        ),
        this.db.query(
          `SELECT n.id, n.note_date, n.category, n.shift, LEFT(n.content, 600) AS content,
                  p.id AS person_id, p.first_name || ' ' || p.last_name AS person_name,
                  'daily_note'::text AS __source_type
           FROM daily_notes n JOIN people p ON p.id = n.person_id
           WHERE p.organization_id = $1 AND n.note_date BETWEEN $2::date AND $3::date${organisationWide ? '' : ' AND p.id = $4'}
           ORDER BY n.note_date DESC LIMIT 200`,
          params,
        ),
        this.db.query(
          `SELECT DISTINCT i.id, i.title, i.severity, i.status, i.incident_date, iir.person_id,
                  'incident'::text AS __source_type
           FROM incidents i LEFT JOIN incident_involved_residents iir ON iir.incident_id = i.id
           WHERE i.organization_id = $1 AND i.incident_date BETWEEN $2::date AND $3::date${personFilterNullable}
           ORDER BY i.incident_date DESC LIMIT 100`,
          params,
        ),
        this.db.query(
          `SELECT a.id, a.status, a.scheduled_time, a.administered_time, mi.name AS medication_name, r.person_id,
                  'medication_administration'::text AS __source_type
           FROM emedication_administrations a
           JOIN emedication_items mi ON mi.id = a.emedication_item_id
           JOIN emedication_records r ON r.id = mi.emedication_record_id
           WHERE r.organization_id = $1 AND a.scheduled_time::date BETWEEN $2::date AND $3::date${organisationWide ? '' : ' AND r.person_id = $4'}
           ORDER BY a.scheduled_time DESC LIMIT 200`,
          params,
        ),
        this.db.query(
          `SELECT ra.id, ra.type, ra.risk_level, ra.review_date, LEFT(ra.details, 400) AS details, ra.person_id,
                  'risk_assessment'::text AS __source_type
           FROM risk_assessments ra JOIN people p ON p.id = ra.person_id
           WHERE p.organization_id = $1
             AND (ra.review_date BETWEEN $2::date AND $3::date OR ra.review_date < CURRENT_DATE)${organisationWide ? '' : ' AND p.id = $4'}
           ORDER BY ra.review_date DESC LIMIT 100`,
          params,
        ),
        this.db.query(
          `SELECT ia.id, ia.incident_id, ia.action, ia.due_date, ia.status,
                  'incident_action'::text AS __source_type
           FROM incident_actions ia JOIN incidents i ON i.id = ia.incident_id
           WHERE i.organization_id = $1
             AND (ia.due_date BETWEEN $2::date AND $3::date OR (ia.due_date < CURRENT_DATE AND ia.status != 'completed'))
             ${organisationWide ? '' : `AND EXISTS (SELECT 1 FROM incident_involved_residents x WHERE x.incident_id = i.id AND x.person_id = $4::uuid)`}
           ORDER BY ia.due_date LIMIT 100`,
          params,
        ),
      ]);

      const rows = [...visits.rows, ...notes.rows, ...medication.rows, ...incidents.rows, ...risks.rows, ...actions.rows] as Array<Record<string, unknown> & { id: string; __source_type: string }>;
      if (rows.length === 0) {
        return {
          error: {
            message: `No records found${personName ? ` for ${personName}` : ''} between ${fromDate} and ${toDate}. Widen the window or check the person.`,
          },
        };
      }

      // source_type is set where the row is fetched (see the SELECT literals
      // above), never inferred from the row's shape — a shape guesser is the
      // kind of drift that mislabels a visit as a note and then cites neither.
      const records = rows.map((r) => {
        const { __source_type, ...rest } = r;
        const dateKey = rest.note_date || rest.incident_date || rest.scheduled_start || rest.review_date || rest.due_date;
        return { source_type: __source_type, source_id: String(rest.id), ...rest, __source_date: String(dateKey || '') } as Record<string, unknown>;
      });

      // Like-for-like counts for the two halves of the window.
      const midpointMs = new Date(`${fromDate}T00:00:00Z`).getTime() + (windowDays * dayMs) / 2;
      const earlierCount = records.filter((r) => new Date(String(r.__source_date || 0)).getTime() <= midpointMs).length;
      const laterCount = records.length - earlierCount;

      const minimisation = await resolveAiMinimisation(orgId);
      const { system, user } = await renderOrgPrompt(
        'unified_intelligence',
        {
          capability: 'mica_summarise_changes',
          from: fromDate,
          to: toDate,
          question: organisationWide
            ? `Summarise what changed across the organisation between ${fromDate} and ${toDate}. Earlier half of the window: ${earlierCount} records; later half: ${laterCount} records.`
            : `Summarise what changed for ${personName} between ${fromDate} and ${toDate}. Earlier half of the window: ${earlierCount} records; later half: ${laterCount}.`,
          audience: 'internal manager',
          tone: 'professional and cautious',
          records: JSON.stringify(records),
        },
        orgId,
        [],
        minimisation,
      );

      const start = Date.now();
      const result = await aiCall(orgId, config, [{ role: 'system', content: system }, { role: 'user', content: user }], { model: config.model, temperature: 0.2, maxTokens: 2200 });
      const validated = validateAIResponse(IntelligenceResponseSchema, result.content, 'Changes summary');
      await AIRepository.logAudit({
        organizationId: orgId,
        feature: 'mica_summarise_changes',
        promptKey: 'unified_intelligence',
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        model: config.model,
        provider: result.provider,
        durationMs: Date.now() - start,
        success: true,
        createdBy: context.userId,
        requestData: { personId: personId || null, from: fromDate, to: toDate, windowDays, recordCount: records.length, earlierCount, laterCount },
        responseSummary: validated.data?.headline || 'Changes summary',
      }).catch(() => undefined);

      const output: SummariseChangesOutput = {
        personId: personId || null,
        personName: personName || null,
        from: fromDate,
        to: toDate,
        compareFrom,
        compareTo,
        changes: validated.data || {
          headline: 'Changes summary could not be validated',
          summary: 'The prepared summary failed validation. Check the source records directly.',
          items: [],
          suggested_follow_up: [],
          limitations: [validated.error || 'AI response failed validation'],
        },
        earlier_count: earlierCount,
        later_count: laterCount,
        generated_by_ai: true,
      };

      return {
        draft: true,
        action: 'SUMMARISE_CHANGES',
        output,
        summary: `I've summarised what changed${organisationWide ? ' across the organisation' : ` for ${personName}`} between ${fromDate} and ${toDate}${validated.data?.headline ? `. ${validated.data.headline}` : ''}. Nothing is saved.`,
        context: {
          organizationId: orgId,
          userId: context.userId,
          actedBy: context.userId,
          preparedAt: new Date().toISOString(),
          source: context.source,
          extras: { personId: personId || null, personName: personName || null },
        },
      };
    } catch (err: any) {
      logger.error(err, 'Mica summarise changes failed');
      return { error: { message: err?.message?.slice(0, 200) || 'Summarising changes failed.' } };
    }
  }
}

export interface SummariseChangesInput {
  personId?: string;
  personName?: string;
  windowDays?: number;
  from?: string;
  to?: string;
  source?: 'voice' | 'text' | 'manual';
}

export interface SummariseChangesOutput {
  personId: string | null;
  personName: string | null;
  from: string;
  to: string;
  compareFrom: string;
  compareTo: string;
  changes: {
    headline: string;
    summary: string;
    items: Array<{ title: string; detail: string; priority: 'high' | 'medium' | 'low'; source_type: string; source_id: string; source_url?: string }>;
    suggested_follow_up: string[];
    limitations: string[];
  };
  earlier_count: number;
  later_count: number;
  generated_by_ai: boolean;
}
