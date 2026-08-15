import { query } from '../../../shared/database';
import logger from '../../../shared/utils/logger';
import { AIRepository } from '../../ai/ai.repository';
import { getProvider } from '../../ai/ai.provider';
import { renderPrompt } from '../../ai/ai.prompts';
import { DomainEvent, EventConsumer } from '../events.consumers';

const FEATURE = 'incident_severity_triage';

/**
 * First production consumer: runs AI severity triage on newly reported
 * incidents and stores the result on the incident (`ai_triage`) plus an audit
 * log entry. Triggered by `incident.created` events.
 *
 * Degrades gracefully: if the org has no AI config, AI is disabled, or the
 * triage feature is not enabled, the consumer no-ops and the event is marked
 * delivered — the incident was already recorded durably. Provider/network
 * failures rethrow so the outbox retries (up to MAX_PUBLISH_ATTEMPTS).
 */
export const IncidentTriageConsumer: EventConsumer = {
  name: 'incident-ai-triage',

  async handle(event: DomainEvent) {
    const orgId = event.organizationId;
    const payload = event.payload as any;

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      logger.debug({ orgId, eventId: event.id }, 'Incident AI triage skipped — AI not configured');
      return;
    }
    if (!config.enabledFeatures?.includes(FEATURE)) {
      logger.debug({ orgId, eventId: event.id }, 'Incident AI triage skipped — feature disabled');
      return;
    }

    const category = payload.category_id
      ? (await query(`SELECT name FROM incident_categories WHERE id = $1`, [payload.category_id])).rows[0]?.name
      : undefined;

    // Audit rows attribute the run to the person who reported the incident
    // (ai_audit_logs.created_by is an FK to users).
    const reportedBy = (payload.reported_by as string | undefined) || null;

    const { system, user } = renderPrompt(FEATURE, {
      title: String(payload.title || 'Untitled'),
      description: String(payload.description || ''),
      category: category || 'Uncategorized',
      date: String(payload.incident_date || new Date().toISOString().split('T')[0]),
      location: String(payload.location || 'Unknown'),
      involved: String(payload.involved || 'None specified'),
    });

    const start = Date.now();
    let completion: { content: string; promptTokens: number; completionTokens: number; totalTokens: number };
    try {
      const provider = getProvider(config);
      completion = await provider.chatCompletion(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        { model: config.model, temperature: 0.3 }
      );
    } catch (err: any) {
      await AIRepository.logAudit({
        organizationId: orgId,
        feature: FEATURE,
        promptKey: FEATURE,
        success: false,
        errorMessage: err?.message || String(err),
        model: config.model,
        provider: config.provider,
        durationMs: Date.now() - start,
        createdBy: reportedBy,
        requestData: { incidentId: payload.id, automatic: true },
      }).catch(() => undefined);
      logger.error({ orgId, eventId: event.id, incidentId: payload.id, err }, 'Incident AI triage failed');
      throw err;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(completion.content);
    } catch {
      parsed = { raw: completion.content };
    }

    await query(
      `UPDATE incidents SET ai_triage = $1 WHERE id = $2 AND organization_id = $3`,
      [JSON.stringify(parsed), payload.id, orgId]
    );

    await AIRepository.logAudit({
      organizationId: orgId,
      feature: FEATURE,
      promptKey: FEATURE,
      promptTokens: completion.promptTokens,
      completionTokens: completion.completionTokens,
      totalTokens: completion.totalTokens,
      model: config.model,
      provider: config.provider,
      durationMs: Date.now() - start,
      createdBy: reportedBy,
      requestData: { incidentId: payload.id, automatic: true },
      responseSummary:
        typeof parsed === 'object' && parsed.severity
          ? `${parsed.severity} (${Math.round(Number(parsed.confidence || 0) * 100)}%)`
          : completion.content.slice(0, 200),
    }).catch(() => undefined);
  },
};
