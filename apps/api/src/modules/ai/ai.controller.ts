import { Request, Response } from 'express';
import { AIRepository } from './ai.repository';
import { MicaGateway } from './ai.gateway';
import { getProvider, synthesizeSpeech } from './ai.provider';
import { renderOrgPrompt } from './ai.render';
import { MICA_TOOLS, findMicaTool } from './mica.tools';
import { loadOrCreateSession, recordTurn, setPendingPage, buildFollowUpMessages } from './mica.session';
import { getMicaAction, MicaActionRequest, MicaActionDraft } from './ai.actions';
import { recordPageFor, recordRefFromWrite } from './mica.recordPages';
import { collectNames, redactText, pseudonymFor } from './ai.redaction';
import { resolveAiMinimisation } from './ai.minimisation';
import type { AiCapability } from './ai.capabilities';
import { AuditRepository } from '../audit/audit.repository';
import { CAPABILITY_BY_PATH, getCapability, AI_CAPABILITIES, AI_METHOD_DISCLOSURE, AI_FLAG_DISCLOSURES, getDisclosureForFeature } from './ai.capabilities';
import { PROMPTS } from './ai.prompts';
import { migrateQuery, query, transaction } from '../../shared/database';
import { parseNavigationRequest, formatNavigationMonth } from './mica.navigation';
import { parseFactQuestion, formatFactReply, factPageFor, parseFactConfirmation, formatSpokenDay } from './mica.facts';
import type { MicaFactPage } from './mica.facts';
import { loadModuleAccess } from './mica.moduleAccess';
import type { MicaPendingPage } from './mica.session';
import { AIConfig, AIProvider } from './ai.types';
import { UserRole, micaRecordPath } from '@meticle/shared';
import logger from '../../shared/utils/logger';
import { decryptField } from '../../shared/utils/encryption';
import { decryptRowsForOrg } from '../../shared/utils/encrypted-columns';

/**
 * Centralised AI call helper with budget enforcement and provider fallback.
 * All AI calls should go through this function.
 */
/**
 * The reply Mica's navigation path returns: what to say, and where to go.
 *
 * `navigate` is absent when the destination could not be honoured — a spoken
 * name that matches nobody, or matches more than one person. In those cases the
 * answer says so and no route is pushed, because opening a page that looks like
 * the answer when it is not is worse than saying the name back and asking again.
 */
interface MicaNavigationReply {
  answer: string;
  navigate?: {
    destination: string;
    path: string;
    label: string;
    person?: { id: string; name: string };
  };
}

/**
 * Resolves a spoken destination into a route the client can push.
 *
 * The deterministic half lives in `mica.navigation.ts` (no model sees this); the
 * only things that cannot be resolved without a database are which *person* — or
 * which *incident* — a destination refers to, so those lookups — org-scoped and
 * LIMITed, exactly like the read-only Mica tools — are all this does. Two
 * consequences are deliberate:
 *
 *   1. No model, no tokens, no budget. Navigation runs before the AI config
 *      gates in `micaAsk`, so "open the incidents" works for an organisation
 *      that has not configured a provider at all.
 *   2. An ambiguous or unknown name is never guessed. "There's more than one
 *      Evan" is spoken and the next sentence retries the name; the alternative
 *      — picking one and opening their chart — is the single failure this flow
 *      must not make with medication records.
 */
/**
 * A spoken name → the one service user it names, or why it does not.
 *
 * One query, org-scoped and LIMITed, exported to both deterministic Mica paths
 * (navigation and the list facts) so a name resolves identically whichever way
 * the carer asked. The ordering is the disambiguation rule: an exact full-name
 * match wins over a substring one, a former resident never outranks an active
 * one, and only then does the alphabet decide.
 *
 * `many` is deliberately not a guess. Two people share a first name often enough
 * that "which Grace?" is a normal question, and picking one silently is the
 * single failure neither path may make with a person's records.
 */
async function resolveServiceUserName(
  orgId: string,
  name: string,
): Promise<
  | { status: 'one'; id: string; name: string }
  | { status: 'many'; names: string[] }
  | { status: 'none' }
> {
  const people = await query(
    `SELECT id, first_name || ' ' || last_name AS name
       FROM people
      WHERE organization_id = $1
        AND (first_name || ' ' || last_name) ILIKE $2
      ORDER BY (lower(first_name || ' ' || last_name) = lower($3)) DESC,
               (status = 'active') DESC,
               last_name, first_name
      LIMIT 2`,
    [orgId, `%${name}%`, name],
  );
  if (people.rows.length > 1) return { status: 'many', names: people.rows.map((row) => row.name as string) };
  if (people.rows.length === 1) {
    return { status: 'one', id: people.rows[0].id as string, name: people.rows[0].name as string };
  }
  return { status: 'none' };
}

/**
 * A spoken name → the one member of staff it names, or why it does not.
 *
 * The service-user resolver's twin, and deliberately a separate lookup: a leave
 * balance and a training record belong to a colleague, and the two name spaces
 * overlap (a "Grace" is a resident in one home and a carer in the next), so a
 * single resolver would happily answer a question about a resident with a staff
 * member's record. Org scoping runs through `users` here for the same reason the
 * navigation path does: `staff_profiles` carries no organization_id of its own.
 */
async function resolveStaffName(
  orgId: string,
  name: string,
): Promise<
  | { status: 'one'; id: string; name: string }
  | { status: 'many'; names: string[] }
  | { status: 'none' }
> {
  const staff = await query(
    `SELECT u.id AS id, sp.first_name || ' ' || sp.last_name AS name
       FROM staff_profiles sp
       JOIN users u ON u.id = sp.user_id
      WHERE u.organization_id = $1
        AND (sp.first_name || ' ' || sp.last_name) ILIKE $2
      ORDER BY (lower(sp.first_name || ' ' || sp.last_name) = lower($3)) DESC,
               sp.last_name, sp.first_name
      LIMIT 2`,
    [orgId, `%${name}%`, name],
  );
  if (staff.rows.length > 1) return { status: 'many', names: staff.rows.map((row) => row.name as string) };
  if (staff.rows.length === 1) {
    return { status: 'one', id: staff.rows[0].id as string, name: staff.rows[0].name as string };
  }
  return { status: 'none' };
}

/**
 * Resolves a list question — "who is on shift today", "give me today's
 * appointments", "how is Nora's medication round looking" — into the sentence
 * Mica speaks, from the organisation's own rows.
 *
 * No model, no tokens, no budget, no network: the parsing and the phrasing are
 * pure (`mica.facts.ts`) and the only database work is the one name lookup a
 * parser cannot do plus the tool's own bounded SELECT. That is what lets this
 * run before the AI gates in `micaAsk` and answer for an organisation that has
 * not configured a provider at all.
 *
 * `null` means "not one of these facts" — a question needing judgement, a write,
 * or a day window this module has no arithmetic for — and the utterance carries
 * on to the paths that already handle it.
 *
 * When the list came from a page, the reply carries that page too (`page`) and
 * ends by asking whether to open it; `micaAsk` remembers it in the conversation so
 * the carer's next word opens it, still with no provider in the loop.
 *
 * The caller comes in with the question — role, id and organisation — because
 * every one of those pages is behind a gate: `/training` is restricted to
 * ORG_ADMIN, MANAGER and COMPLIANCE_OFFICER while this endpoint also serves
 * CARE_WORKER, and the rota and the leave page are gated by module, which is the
 * caller's own. The offer is made only when both halves of that gate open, and the
 * sentence asking the question goes with the offer — so nobody is asked whether to
 * go somewhere they would be turned away from.
 */
async function resolveMicaFact(
  orgId: string,
  userId: string,
  utterance: string,
  role: UserRole | undefined,
): Promise<{ answer: string; kind: string; page?: MicaFactPage } | null> {
  const todayRes = await query('SELECT CURRENT_DATE::text AS day');
  const today = String(todayRes.rows[0]?.day || new Date().toISOString().slice(0, 10));
  const parsed = parseFactQuestion(utterance, today);
  if (!parsed) return null;

  // Two name spaces, and the question decides which one is looked in: a leave
  // balance and a training record belong to a member of staff, and every other
  // answer here is about a resident.
  const staffScoped = parsed.kind === 'leave-balance' || parsed.kind === 'training-expiry';

  let request = parsed;
  if (parsed.personName && staffScoped) {
    const staff = await resolveStaffName(orgId, parsed.personName);
    if (staff.status === 'many') {
      return {
        kind: 'staff-ambiguous',
        answer: `I found more than one match for ${parsed.personName}: ${staff.names.join(' and ')}. Say the full name.`,
      };
    }
    if (staff.status === 'none') {
      return {
        kind: 'staff-unknown',
        answer: `I couldn't find a staff member called ${parsed.personName}. Say the name again and I'll try.`,
      };
    }
    // The resolved full name goes to the tool, not what was heard: "Priya" must
    // not be left to the tool's own ILIKE, which would happily blend two Priyas.
    request = {
      ...parsed,
      staffName: staff.name,
      args: { ...parsed.args, staff_name: staff.name },
    };
  } else if (parsed.personName) {
    const resolved = await resolveServiceUserName(orgId, parsed.personName);
    if (resolved.status === 'many') {
      return {
        kind: 'person-ambiguous',
        answer: `I found more than one match for ${parsed.personName}: ${resolved.names.join(' and ')}. Say the full name.`,
      };
    }
    if (resolved.status === 'none') {
      return {
        kind: 'person-unknown',
        answer: `I couldn't find anyone called ${parsed.personName}. Say the name again and I'll try.`,
      };
    }
    // The resolved full name goes to the tool, not what was heard: "Nora" must
    // not be left to the tool's own ILIKE, which would happily sum two Noras.
    request = {
      ...parsed,
      personName: resolved.name,
      args: { ...parsed.args, person_name: resolved.name },
    };
  }

  const tool = findMicaTool(request.tool);
  if (!tool) return null;
  const rows = await tool.execute(orgId, request.args);
  // The gate's second half is resolved only for an answer that has a page at all:
  // four of the eight kinds do not, and a question that can never end in an offer
  // should not pay for the two lookups.
  const modules = factPageFor(request.kind)
    ? await loadModuleAccess(userId, orgId, role)
    : undefined;
  // `formatFactReply` decides the sentence and the page offer together, so a
  // reply that could not read a list can never end up offering the page it would
  // have come from — nor asking about a door the caller's role or modules hold
  // shut.
  const reply = formatFactReply(request, rows, { role, modules });
  return { answer: reply.answer, kind: request.kind, ...(reply.page ? { page: reply.page } : {}) };
}

/**
 * A spoken incident subject → the one incident it names, or why it does not.
 *
 * The third resolver on this path, and the loosest, because an incident's only
 * handle is its free-text title: the match is a substring over the organisation's
 * own titles, ordered so an exact title wins and the most recent incident wins a
 * tie. Two matches are never guessed between, for the same reason two people with
 * one first name are not — the carer is asked instead, and the record that opens is
 * the one they said.
 *
 * Confidential incidents are the admin-only class in this product, so they are
 * excluded for everyone else: the same rule `IncidentsController.isAdmin` applies to
 * the directory, the facts tool and the stats. A carer asking about "the medication
 * incident" must not hear a confidential record's title read back, and must not be
 * sent to it either — the honest answer there is the one a miss gets.
 */
async function resolveMicaIncident(
  orgId: string,
  subject: string,
  role: UserRole | undefined,
): Promise<
  | { status: 'one'; id: string; title: string }
  | { status: 'many'; titles: string[] }
  | { status: 'none' }
> {
  const incidents = await query(
    `SELECT id, title
       FROM incidents
      WHERE organization_id = $1
        AND title ILIKE $2
        ${role === UserRole.ORG_ADMIN ? '' : 'AND is_confidential = FALSE'}
      ORDER BY (lower(title) = lower($3)) DESC, incident_date DESC, created_at DESC
      LIMIT 2`,
    [orgId, `%${subject}%`, subject],
  );
  if (incidents.rows.length > 1) return { status: 'many', titles: incidents.rows.map((row) => row.title as string) };
  if (incidents.rows.length === 1) {
    return { status: 'one', id: incidents.rows[0].id as string, title: incidents.rows[0].title as string };
  }
  return { status: 'none' };
}

async function resolveMicaNavigation(orgId: string, utterance: string, role: UserRole | undefined): Promise<MicaNavigationReply | null> {
  const todayRes = await query('SELECT CURRENT_DATE::text AS day');
  const today = String(todayRes.rows[0]?.day || new Date().toISOString().slice(0, 10));
  const parsed = parseNavigationRequest(utterance, today);
  if (!parsed) return null;

  // One incident, named by its subject. Done before the person lookup because the
  // record it opens is the whole request: there is no name to resolve and no
  // directory that would be the right answer.
  if (parsed.needsIncident && parsed.incidentSubject) {
    const incident = await resolveMicaIncident(orgId, parsed.incidentSubject, role);
    if (incident.status === 'many') {
      return { answer: `I found more than one incident matching "${parsed.incidentSubject}": ${incident.titles.join('; ')}. Which one did you mean?` };
    }
    if (incident.status === 'none') {
      return { answer: `I couldn't find an incident matching "${parsed.incidentSubject}". Say a few more words from the title and I'll try again.` };
    }
    const label = incident.title;
    return { answer: `Here's ${label}.`, navigate: { destination: 'incidents', path: `/incidents/${incident.id}`, label } };
  }

  const name = parsed.needsPerson ? parsed.personName : undefined;

  // No person to resolve: the destination stands on its own, with its month if
  // it has one.
  if (!name) {
    // Every parameter a destination's page reads, composed off the parsed request:
    // the month the medication pages live on, and the week the rota planner opens.
    const params = [
      parsed.monthParam && parsed.month ? `${parsed.monthParam}=${parsed.month}` : '',
      parsed.weekParam && parsed.week ? `${parsed.weekParam}=${parsed.week}` : '',
    ].filter(Boolean).join('&');
    const search = params ? `?${params}` : '';
    const label = parsed.month
      ? `${parsed.label} — ${formatNavigationMonth(parsed.month)}`
      : parsed.week
        ? `${parsed.label} — week of ${formatSpokenDay(parsed.week, today)}`
        : parsed.label;
    return { answer: `Opening ${label}.`, navigate: { destination: parsed.destination, path: `${parsed.path}${search}`, label } };
  }

  const people = await resolveServiceUserName(orgId, name);

  if (people.status === 'many') {
    return { answer: `I found more than one match for ${name}: ${people.names.join(' and ')}. Say the full name.` };
  }

  if (people.status === 'one') {
    const person = { id: people.id, name: people.name };
    if (parsed.destination === 'person') {
      // The tab, when one was asked for. The profile page reads `?tab=`, and the
      // label follows it, so the carer hears "Grace Roberts's health tab" rather
      // than "profile" — the page they are about to be shown is the difference.
      const label = `${person.name}'s ${parsed.label}`;
      const search = parsed.tab ? `?tab=${parsed.tab}` : '';
      return { answer: `Here's ${label}.`, navigate: { destination: parsed.destination, path: `/people/${person.id}${search}`, label, person } };
    }
    const monthPrefix = parsed.month ? `${formatNavigationMonth(parsed.month)} ` : '';
    const label = `${person.name}'s ${monthPrefix}MAR chart`;
    const search = `?personId=${person.id}${parsed.month ? `&month=${parsed.month}` : ''}`;
    return { answer: `Here's ${label}.`, navigate: { destination: parsed.destination, path: `${parsed.path}${search}`, label, person } };
  }

  // Nobody in this organisation's service-user records: the other place a
  // spoken name lives is the staff directory, and "open Priya's profile" is a
  // staff page. `/staff/:userId` takes the user id, not the staff profile id.
  // Org scoping runs through `users` here, not `staff_profiles`: the profile
  // table carries no organization_id of its own (mica.tools.ts scopes staff the
  // same way, for the same reason).
  const staff = await resolveStaffName(orgId, name);
  if (staff.status === 'many') {
    return { answer: `I found more than one ${name}: ${staff.names.join(' and ')}. Say the full name.` };
  }
  if (staff.status === 'one') {
    const label = `${staff.name}'s profile`;
    // No `person` here on purpose: a staff member is not a care-note subject, so
    // the id must not become the next note's target.
    return { answer: `Here's ${label}.`, navigate: { destination: 'person', path: `/staff/${staff.id}`, label } };
  }

  return { answer: `I couldn't find anyone called ${name}. Say the name again and I'll try.` };
}

function sourceUrl(sourceType: string, sourceId: string, record?: any): string | undefined {
  switch (sourceType) {
    case 'daily_note':
      return record?.person_id ? `/people/${record.person_id}?tab=daily-notes&source=${sourceId}` : undefined;
    case 'homecare_visit':
      return `/homecare?visitId=${sourceId}`;
    case 'incident':
      return `/incidents/${sourceId}`;
    case 'training_record':
      return `/training?recordId=${sourceId}`;
    case 'medication_administration':
      return record?.person_id ? `/emedication?personId=${record.person_id}&administrationId=${sourceId}` : '/emedication';
    case 'risk_assessment':
      return record?.person_id ? `/people/${record.person_id}?tab=risk-assessments&source=${sourceId}` : undefined;
    case 'incident_action':
      return record?.incident_id ? `/incidents/${record.incident_id}?action=${sourceId}` : undefined;
    case 'competency_assessment':
      return `/compliance/competency?assessmentId=${sourceId}`;
    case 'shift':
      return `/scheduling?shiftId=${sourceId}`;
    case 'family_contact':
      return record?.person_id ? `/people/${record.person_id}?tab=family-contacts&source=${sourceId}` : undefined;
    default:
      return undefined;
  }
}

/**
 * Centralised AI call helper with budget enforcement and provider fallback.
 * All AI calls go through this function.
 *
 * Exported — action implementations (Mica actions) import it rather than
 * duplicating the budget check and fallback chain, because a copy here and a
 * copy there drift apart exactly when a payment cap changes.
 */
export async function aiCall(
  orgId: string,
  config: AIConfig,
  messages: Array<{ role: string; content: string }>,
  options?: { model?: string; maxTokens?: number; temperature?: number },
): Promise<{ content: string; promptTokens: number; completionTokens: number; totalTokens: number; provider: string }> {
  // Budget check
  const budget = await AIRepository.checkBudget(orgId, config);
  if (!budget.allowed) {
    throw new Error(`AI budget exceeded: ${budget.reason}`);
  }

  // Primary provider
  const primaryProvider = getProvider(config);
  try {
    const result = await primaryProvider.chatCompletion(messages, options);
    return { ...result, provider: config.provider };
  } catch (err: any) {
    logger.warn({ err: err.message, provider: config.provider, orgId }, 'Primary AI provider failed');

    // Fallback provider
    if (config.fallbackProvider && config.fallbackApiKey) {
      logger.info({ fallback: config.fallbackProvider, orgId }, 'Attempting fallback AI provider');
      const fallbackConfig: AIConfig = {
        ...config,
        provider: config.fallbackProvider,
        apiKey: config.fallbackApiKey,
        model: config.fallbackModel || config.model,
      };
      const fallbackProvider = getProvider(fallbackConfig);
      const result = await fallbackProvider.chatCompletion(messages, options);
      return { ...result, provider: config.fallbackProvider };
    }
    throw err;
  }
}

export class AIController {
  /**
   * How much clinical narrative is allowed to cross the LLM boundary.
   *
   * Returns the disclosure alongside the setting rather than just the setting.
   * A manager reading a single value has no way to know that switching to
   * `minimal` degrades family communication drafts and care summaries, and the
   * first they would hear of that is worse output weeks later. The consequence
   * list travels with the control.
   */
  /**
   * Publishes the capability registry and every prompt template verbatim.
   *
   * The honest-mechanism argument — one query-plus-summary implementation,
   * eleven named entry points — only holds if a customer's security review can
   * read the actual instructions the model receives rather than our description
   * of them. This returns `PROMPTS` in full: system prompts, user templates,
   * the disclosure object, and the capability-to-prompt mapping that makes the
   * sharing visible instead of deniable.
   *
   * ORG_ADMIN-gated like the rest of the AI configuration surface: prompts are
   * a commercial asset and this is an authenticated API, not a public page.
   * No secrets can leak through it — templates contain no keys, and redaction
   * happens per-request at render time, not in the template text.
   */
  static async getPrompts(_req: Request, res: Response) {
    res.json({
      method: AI_METHOD_DISCLOSURE,
      capabilities: Object.values(AI_CAPABILITIES).map((c) => ({
        id: c.id,
        label: c.label,
        entry_point: c.entryPoint,
        prompt_key: c.promptKey,
        summary: c.summary,
        requires_narrative: c.requiresNarrative,
        // The exact data classes sent to the provider, with the prompt
        // variable each rides in — the same array the Settings AI tab renders
        // per toggle. Shipping it here means a security review reads the
        // machine-readable claim directly, not only the UI's rendering of it.
        data_classes: c.dataClasses,
        identifier_fields: c.identifierFields,
      })),
      prompts: PROMPTS,
    });
  }

  /**
   * GET /ai/data-classes — capability disclosure for the Settings AI tab.
   *
   * Exists separately from /ai/prompts because the disclosure a manager reads
   * next to a toggle must be ORG_ADMIN-only, but cheap and stable — while
   * /ai/prompts ships the full templates verbatim and is heavier than a
   * settings page needs. Same source of truth (AI_CAPABILITIES for the eleven
   * unified-intelligence capabilities + AI_FLAG_DISCLOSURES for the seven
   * single-purpose generators the Settings page also toggles), narrow shape.
   * Every key the Settings AI tab can toggle resolves through
   * getDisclosureForFeature — the drift-guard test holds that invariant.
   */
  static async getDataClasses(_req: Request, res: Response) {
    const all: Array<{ id: string; label: string; data_classes: AiCapability['dataClasses']; identifier_fields: readonly string[]; requires_narrative: boolean }> = Object.values(AI_CAPABILITIES).map((c) => ({
      id: c.id,
      label: c.label,
      data_classes: c.dataClasses,
      identifier_fields: c.identifierFields,
      requires_narrative: c.requiresNarrative,
    }));
    for (const f of Object.values(AI_FLAG_DISCLOSURES)) {
      all.push({
        id: f.id,
        label: f.label,
        data_classes: f.dataClasses,
        identifier_fields: f.identifierFields,
        requires_narrative: true,
      });
    }
    res.json({ method: AI_METHOD_DISCLOSURE, capabilities: all });
  }

  static async getDataMinimisation(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });
    const mode = await resolveAiMinimisation(orgId);
    res.json({
      mode,
      method: AI_METHOD_DISCLOSURE,
      description:
        'Names are always replaced with stable pseudonyms before anything is sent. ' +
        'In "minimal" mode the clinical narrative inside visit notes, incident descriptions and medication names ' +
        'is withheld as well, while the coded facts around it — status, category, severity and dates — are kept, ' +
        'so summaries still have something to work from.',
      degraded_capabilities: Object.values(AI_CAPABILITIES)
        .filter((c) => c.requiresNarrative)
        .map((c) => ({ id: c.id, label: c.label, entry_point: c.entryPoint })),
    });
  }

  static async updateDataMinimisation(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    const userId = req.user?.userId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });
    const mode = req.body?.mode;
    if (mode !== 'full' && mode !== 'minimal') {
      return res.status(400).json({ error: { message: 'mode must be "full" or "minimal"' } });
    }
    const previous = await resolveAiMinimisation(orgId);
    await migrateQuery('UPDATE organizations SET ai_data_minimisation = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [mode, orgId]);
    // Audited old -> new through the same audit channel as the vetting scheme
    // and regulator registrations, so every privacy-relevant organisation
    // setting has one audit shape. A privacy control whose history is invisible
    // is not a control anyone can evidence to a customer's security review.
    await AuditRepository.log({
      user_id: userId,
      action: 'update',
      entity_type: 'organization_ai_data_minimisation',
      entity_id: orgId,
      old_data: { mode: previous },
      new_data: { mode },
      ip_address: req.ip,
    }).catch(() => {});
    res.json({ mode, previous, method: AI_METHOD_DISCLOSURE });
  }

  static async getConfig(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });
    const config = await AIRepository.getConfig(orgId);
    // Mask every secret on the way out: the Settings form binds GET straight
    // back into its inputs, and an unmasked fallback key would sit in the DOM.
    const sanitized = config ? { ...config, apiKey: config.apiKey ? '••••••••' + config.apiKey.slice(-4) : '', fallbackApiKey: config.fallbackApiKey ? '••••••••' + config.fallbackApiKey.slice(-4) : '' } : null;
    res.json({ config: sanitized });
  }

  static async updateConfig(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });

    const { provider, model, enabledFeatures, apiKey, monthlyTokenBudget, monthlyCostCapGBP, fallbackProvider, fallbackApiKey, fallbackModel, ttsVoice } = req.body;
    const update: Partial<AIConfig> = {};
    if (provider !== undefined) update.provider = provider;
    if (model !== undefined) update.model = model;
    if (enabledFeatures !== undefined) update.enabledFeatures = enabledFeatures;
    if (ttsVoice !== undefined) update.ttsVoice = ttsVoice;
    if (apiKey !== undefined) {
      const trimmed = typeof apiKey === 'string' ? apiKey.trim() : apiKey;
      if (trimmed === '') {
        update.apiKey = '';
      } else if (typeof trimmed === 'string' && !trimmed.includes('••')) {
        update.apiKey = trimmed;
      }
    }
    if (req.body.enabled !== undefined) update.enabled = req.body.enabled;
    if (monthlyTokenBudget !== undefined) update.monthlyTokenBudget = Number(monthlyTokenBudget) || 0;
    if (monthlyCostCapGBP !== undefined) update.monthlyCostCapGBP = Number(monthlyCostCapGBP) || 0;
    if (fallbackProvider !== undefined) update.fallbackProvider = fallbackProvider;
    if (fallbackModel !== undefined) update.fallbackModel = fallbackModel;
    if (fallbackApiKey !== undefined) {
      const trimmed = typeof fallbackApiKey === 'string' ? fallbackApiKey.trim() : fallbackApiKey;
      if (trimmed === '' || (typeof trimmed === 'string' && trimmed.includes('••'))) {
        // Don't overwrite masked key
      } else {
        update.fallbackApiKey = trimmed;
      }
    }

    const config = await AIRepository.updateConfig(orgId, update);
    const sanitized = { ...config, apiKey: config.apiKey ? '••••••••' + config.apiKey.slice(-4) : '', fallbackApiKey: config.fallbackApiKey ? '••••••••' + config.fallbackApiKey.slice(-4) : '' };
    res.json({ config: sanitized });
  }

  static async managerBriefing(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    const userId = req.user?.userId;
    if (!orgId || !userId) return res.status(400).json({ error: { message: 'Organization and user required' } });

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) return res.status(400).json({ error: { message: 'AI not configured. Configure AI provider in Settings first.' } });
    if (!config.enabledFeatures?.includes('manager_briefing')) return res.status(403).json({ error: { message: 'Manager Briefing is not enabled for your organization.' } });

    const { from, to } = req.body;
    const pool = (await import('../../shared/database')).default;
    const [visits, notes, incidents, leave, training] = await Promise.all([
      pool.query(`SELECT v.id, v.status, v.label, v.scheduled_start, v.scheduled_end, p.first_name || ' ' || p.last_name AS person_name
        FROM homecare_visits v JOIN people p ON p.id = v.person_id
        WHERE v.organization_id = $1 AND v.scheduled_start::date BETWEEN $2::date AND $3::date
        ORDER BY v.scheduled_start LIMIT 500`, [orgId, from, to]),
      pool.query(`SELECT n.id, n.note_date, n.category, LEFT(n.content, 600) AS content, p.first_name || ' ' || p.last_name AS person_name
        FROM daily_notes n JOIN people p ON p.id = n.person_id
        WHERE p.organization_id = $1 AND n.note_date BETWEEN $2::date AND $3::date
        ORDER BY n.note_date DESC, n.created_at DESC LIMIT 200`, [orgId, from, to]),
      pool.query(`SELECT i.id, i.title, i.severity, i.status, i.incident_date, LEFT(i.description, 500) AS description
        FROM incidents i WHERE i.organization_id = $1 AND i.incident_date BETWEEN $2::date AND $3::date
        ORDER BY i.incident_date DESC LIMIT 200`, [orgId, from, to]),
      pool.query(`SELECT lr.id, lr.status, lr.start_date, lr.end_date, lt.name AS leave_type, sp.first_name || ' ' || sp.last_name AS staff_name
        FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id JOIN staff_profiles sp ON sp.id = lr.staff_id
        JOIN users u ON u.id = sp.user_id WHERE u.organization_id = $1 AND lr.start_date <= $3::date AND lr.end_date >= $2::date
        ORDER BY lr.start_date LIMIT 200`, [orgId, from, to]),
      pool.query(`SELECT tr.id, tm.name AS module_name, tr.status, tr.expires_at, sp.first_name || ' ' || sp.last_name AS staff_name
        FROM training_records tr JOIN training_modules tm ON tm.id = tr.module_id JOIN staff_profiles sp ON sp.id = tr.staff_id
        JOIN users u ON u.id = sp.user_id WHERE u.organization_id = $1 AND (tr.expires_at BETWEEN $2::date AND $3::date OR tr.status = 'expired')
        LIMIT 200`, [orgId, from, to]),
    ]);

    const records = JSON.stringify({
      visits: visits.rows.map((r: any) => ({ source_type: 'homecare_visit', source_id: r.id, ...r })),
      notes: notes.rows.map((r: any) => ({ source_type: 'daily_note', source_id: r.id, ...r })),
      incidents: incidents.rows.map((r: any) => ({ source_type: 'incident', source_id: r.id, ...r })),
      leave: leave.rows.map((r: any) => ({ source_type: 'leave_request', source_id: r.id, ...r })),
      training: training.rows.map((r: any) => ({ source_type: 'training_record', source_id: r.id, ...r })),
    });
    const { system, user } = await renderOrgPrompt('manager_briefing', { from, to, records }, orgId);
    const start = Date.now();
    try {
      const result = await aiCall(orgId, config, [{ role: 'system', content: system }, { role: 'user', content: user }], { model: config.model, temperature: 0.2, maxTokens: 2500 });
      const { data: parsed, error: validationError } = (await import('./ai.schemas')).validateAIResponse((await import('./ai.schemas')).ManagerBriefingSchema, result.content, 'Manager briefing');
      await AIRepository.logAudit({ organizationId: orgId, feature: 'manager_briefing', promptKey: 'manager_briefing', promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens, model: config.model, provider: result.provider, durationMs: Date.now() - start, createdBy: userId, requestData: { from, to, sourceCounts: { visits: visits.rowCount, notes: notes.rowCount, incidents: incidents.rowCount, leave: leave.rowCount, training: training.rowCount } }, responseSummary: parsed?.headline || validationError || 'Generated' });
      res.json({ briefing: parsed ? { ...parsed, generated_by_ai: true, ai_model: config.model, ai_generated_at: new Date().toISOString() } : { headline: 'Briefing could not be validated', attention: [], follow_up: [], validationWarning: validationError, generated_by_ai: true }, sources: { visits: visits.rowCount, notes: notes.rowCount, incidents: incidents.rowCount, leave: leave.rowCount, training: training.rowCount }, period: { from, to } });
    } catch (err: any) {
      await AIRepository.logAudit({ organizationId: orgId, feature: 'manager_briefing', promptKey: 'manager_briefing', success: false, errorMessage: err.message, durationMs: Date.now() - start, createdBy: userId, requestData: { from, to } }).catch(() => {});
      logger.error(err, 'Manager briefing failed');
      res.status(500).json({ error: { message: 'Manager briefing failed' } });
    }
  }

  static async analyzeComplianceGap(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured. Configure AI provider in Settings first.' } });
    }
    if (!config.enabledFeatures?.includes('compliance_gap_analysis')) {
      return res.status(403).json({ error: { message: 'Compliance Gap Analysis is not enabled for your organization.' } });
    }

    const { orgName, regulator, overallRate, domainScores, keyIssues } = req.body;
    const { system, user } = await renderOrgPrompt('compliance_gap_analysis', {
      org_name: orgName || 'Unknown',
      regulator: regulator || 'CQC',
      overall_rate: String(overallRate || '0'),
      domain_scores: domainScores || 'No data',
      key_issues: keyIssues || 'No issues provided',
    }, orgId);

    const start = Date.now();
    try {
      const result = await aiCall(orgId, config,
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        { model: config.model, temperature: 0.3 }
      );

      const { validateAIResponse } = await import('./ai.schemas');
      const { ComplianceGapAnalysisSchema } = await import('./ai.schemas');
      const { data: parsed, error: validationError } = validateAIResponse(ComplianceGapAnalysisSchema, result.content, 'Compliance gap analysis');

      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'compliance_gap_analysis',
          promptKey: 'compliance_gap_analysis',
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          model: config.model,
          provider: result.provider,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
          requestData: { regulator, overallRate },
          responseSummary: parsed?.overall_assessment || 'Completed',
        });
      } catch { /* audit logging non-critical */ }

      if (!parsed) {
        return res.json({ analysis: { raw: result.content, validationWarning: validationError }, generated_by_ai: true, ai_model: config.model, ai_generated_at: new Date().toISOString(), usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens } });
      }

      res.json({ analysis:{...parsed,generated_by_ai:true,ai_model:config.model,ai_generated_at:new Date().toISOString()},usage:{promptTokens:result.promptTokens,completionTokens:result.completionTokens,totalTokens:result.totalTokens}});
    } catch (err: any) {
      try {
        await AIRepository.logAudit({organizationId:orgId,feature:'compliance_gap_analysis',promptKey:'compliance_gap_analysis',success:false,errorMessage:err.message,durationMs:Date.now()-start,createdBy:req.user?.userId});
      } catch {}
      logger.error(err,'Compliance gap analysis failed');
      res.status(500).json({error:{message:'AI analysis failed'}});
    }
  }

  static async triageIncident(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured.' } });
    }
    if (!config.enabledFeatures?.includes('incident_severity_triage')) {
      return res.status(403).json({ error: { message: 'Incident Severity Triage is not enabled.' } });
    }

    const { title, description, category, date, location, involved } = req.body;
    const { system, user } = await renderOrgPrompt('incident_severity_triage', {
      title: title || 'Untitled',
      description: description || '',
      category: category || 'Uncategorized',
      date: date || new Date().toISOString().split('T')[0],
      location: location || 'Unknown',
      involved: involved || 'None specified',
    }, orgId);

    const start = Date.now();
    try {
      const result = await aiCall(orgId, config,
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        { model: config.model, temperature: 0.3 }
      );

      const { validateAIResponse, IncidentTriageSchema } = await import('./ai.schemas');
      const { data: parsed, error: validationError } = validateAIResponse(IncidentTriageSchema, result.content, 'Incident triage');

      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'incident_severity_triage',
          promptKey: 'incident_severity_triage',
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          model: config.model,
          provider: result.provider,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
          responseSummary: parsed ? `${parsed.severity} (${Math.round((parsed.confidence || 0) * 100)}%)` : 'Parse failed',
        });
      } catch { /* audit logging non-critical */ }

      if (!parsed) {
        return res.json({ triage: { raw: result.content, validationWarning: validationError }, usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens } });
      }

      res.json({ triage: parsed, usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens } });
    } catch (err: any) {
      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'incident_severity_triage',
          promptKey: 'incident_severity_triage',
          success: false,
          errorMessage: err.message,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
        });
      } catch { /* audit logging non-critical */ }
      logger.error(err, 'Incident triage failed');
      res.status(500).json({ error: { message: 'AI triage failed' } });
    }
  }

  static async analyzeRota(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured. Configure AI provider in Settings first.' } });
    }
    if (!config.enabledFeatures?.includes('rota_optimization')) {
      return res.status(403).json({ error: { message: 'Rota Optimization is not enabled for your organization.' } });
    }

    const { weekRange, locationName, minStaffPerDay, minDayStaff, minNightStaff, minSleepStaff, staffRoster, shifts, openShifts, staffCompliance, overtimeHours } = req.body;
    const { system, user } = await renderOrgPrompt('rota_optimization', {
      week_range: weekRange || 'This week',
      location_name: locationName || 'Unknown',
      min_staff_per_day: String(minStaffPerDay ?? 1),
      min_day_staff: String(minDayStaff ?? 1),
      min_night_staff: String(minNightStaff ?? 1),
      min_sleep_staff: String(minSleepStaff ?? 0),
      staff_roster: staffRoster || 'No data',
      shifts: shifts || 'No data',
      open_shifts: openShifts || 'No data',
      staff_compliance: staffCompliance || 'No data',
      overtime_hours: overtimeHours || 'No data',
    }, orgId);

    const start = Date.now();
    try {
      const provider = getProvider(config);
      const result = await provider.chatCompletion(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        { model: config.model, temperature: 0.3 }
      );

      let parsed;
      try { parsed = JSON.parse(result.content); }
      catch { parsed = { raw: result.content }; }

      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'rota_optimization',
          promptKey: 'rota_optimization',
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          model: config.model,
          provider: provider.name,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
          requestData: { weekRange, locationName },
          responseSummary: typeof parsed === 'object' ? parsed.overall_assessment || 'Completed' : result.content.slice(0, 200),
        });
      } catch { /* audit logging non-critical */ }

      res.json({ analysis: parsed, usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens } });
    } catch (err: any) {
      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'rota_optimization',
          promptKey: 'rota_optimization',
          success: false,
          errorMessage: err.message,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
        });
      } catch { /* audit logging non-critical */ }
      logger.error(err, 'Rota analysis failed');
      res.status(500).json({ error: { message: 'AI rota analysis failed' } });
    }
  }

  static async generateRota(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured. Configure AI provider in Settings first.' } });
    }
    if (!config.enabledFeatures?.includes('rota_optimization')) {
      return res.status(403).json({ error: { message: 'Rota Optimization is not enabled for your organization.' } });
    }

    const { generatePeriod, locationName, minStaffPerDay, minDayStaff, minNightStaff, minSleepStaff, staffRoster, existingShifts, staffOnLeave, people, staffingNeeds, contractedHours, mandatoryStartTimes, minEndTime, allSameEnd } = req.body;
    const { system, user } = await renderOrgPrompt('rota_generation', {
      generate_period: generatePeriod || 'This week',
      location_name: locationName || 'Unknown',
      min_staff_per_day: minStaffPerDay || '1',
      min_day_staff: minDayStaff || '1',
      min_night_staff: minNightStaff || '1',
      min_sleep_staff: minSleepStaff || '0',
      staff_roster: staffRoster || 'No data',
      existing_shifts: existingShifts || 'No existing shifts',
      staff_on_leave: staffOnLeave || 'None on leave',
      people: people || 'No people requiring care',
      staffing_needs: staffingNeeds || 'No staffing needs data',
      contracted_hours: contractedHours || 'No contracted hours data',
      mandatory_start_times: mandatoryStartTimes || '07:00, 10:00, 14:00, 21:00',
      min_end_time: minEndTime || '22:00',
      all_same_end: allSameEnd || 'false',
    }, orgId);

    const start = Date.now();
    try {
      const provider = getProvider(config);
      const result = await provider.chatCompletion(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        { model: config.model, temperature: 0.3 }
      );

      let parsed;
      try { parsed = JSON.parse(result.content); }
      catch { parsed = { raw: result.content }; }

      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'rota_generation',
          promptKey: 'rota_generation',
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          model: config.model,
          provider: provider.name,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
          requestData: { generatePeriod, locationName },
          responseSummary: typeof parsed === 'object' ? `${parsed?.coverage_summary?.total_shifts || 0} shifts generated` : result.content.slice(0, 200),
        });
      } catch { /* audit logging non-critical */ }

      res.json({ rota: parsed, usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens } });
    } catch (err: any) {
      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'rota_generation',
          promptKey: 'rota_generation',
          success: false,
          errorMessage: err.message,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
        });
      } catch { /* audit logging non-critical */ }
      logger.error(err, 'Rota generation failed');
      res.status(500).json({ error: { message: 'AI rota generation failed' } });
    }
  }

  static async auditLogs(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const logs = await AIRepository.getAuditLogs(orgId, limit, offset);
    res.json({ logs });
  }

  static async usageStats(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });
    const stats = await AIRepository.getUsageStats(orgId);
    // The Settings budget bar needs this month's spend against this month's
    // cap. checkBudget already computes both from the audit log with the same
    // cost factor it enforces, so reuse it rather than a second query.
    const config = await AIRepository.getConfig(orgId);
    const budget = await AIRepository.checkBudget(orgId, config || { enabled: false, provider: 'openai', apiKey: '', model: '', enabledFeatures: [] });
    res.json({ stats: { ...stats, monthlyTokens: budget.currentTokens, monthlyCostGbp: budget.currentCostGBP, monthlyTokenBudget: budget.budgetTokens, monthlyCostCapGbp: budget.costCapGBP } });
  }

  // Shift words the brief asks Mica to understand. The daily_notes table only
  // stores 'day' or 'night', so this is the single place where natural-language
  // shift names are normalised. Adding a new shift word here is the only change
  // required to teach Mica a new shift concept.
  private static readonly SHIFT_WORDS: Record<string, 'day' | 'night'> = {
    morning: 'day',
    day: 'day',
    afternoon: 'day',
    evening: 'day',
    night: 'night',
    night_shift: 'night',
    overnight: 'night',
  };

  /** Resolve a natural-language shift word to the schema enum. Returns the
   * normalised value or throws a 400 the UI can surface as a clarification
   * prompt rather than silently defaulting.
   */
  private static normaliseShift(raw?: string): 'day' | 'night' {
    const key = raw && AIController.SHIFT_WORDS[String(raw).trim().toLowerCase()];
    if (!key) {
      const err = Object.assign(new Error(`Unrecognised shift "${raw}". Supported: morning, day, afternoon, evening, night.`), { status: 400 });
      throw err;
    }
    return key;
  }

  /** Lightweight org-scoped person search used by the voice intent resolver when
   * the user said a name rather than a UUID. Returns enough to disambiguate
   * (e.g. two Grace Roberts) without returning sensitive fields.
   */
  static async findPersonByName(pool: any, orgId: string, name: string) {
    const rows = await pool.query(
      `SELECT id, first_name, last_name, room_number, status FROM people
       WHERE organization_id = $1 AND status = 'active'
         AND (LOWER(first_name || ' ' || last_name) = LOWER($2)
              OR LOWER(first_name) = LOWER($3)
              OR LOWER(last_name) = LOWER($4)
              OR LOWER(first_name || ' ' || last_name) LIKE LOWER($5))
       ORDER BY first_name, last_name
       LIMIT 10`,
      [orgId, name, name.split(' ')[0] || name, name.split(' ').pop() || name, `%${name}%`],
    );
    return rows.rows;
  }

  static async generateDailyNote(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured. Configure AI provider in Settings first.' } });
    }
    if (!config.enabledFeatures?.includes('daily_note_generation')) {
      return res.status(403).json({ error: { message: 'Daily Note Generation is not enabled for your organization.' } });
    }

    // Accept the existing shape plus the voice-intent fields added to the schema.
    // Person may be identified either by UUID or by name; the brief requires Mica
    // to resolve ambiguous names before recording anything.
    const body = req.body as {
      personId?: string;
      personName?: string;
      staffInput: string;
      shift?: string;
      noteDate?: string;
      source?: 'voice' | 'text' | 'manual';
    };
    const { personId, personName, staffInput, shift, noteDate, source } = body;

    if (!staffInput || staffInput.trim().length === 0) {
      return res.status(400).json({ error: { message: 'Staff observation is required' } });
    }

    const pool = (await import('../../shared/database')).default;

    // --- Person resolution ---
    // If the caller supplied a UUID we still verify the person belongs to the org
    // (the brief says Mica must not guess). If the caller supplied a name we
    // resolve it org-scoped and refuse to continue when there is ambiguity.
    let resolvedPersonId: string;
    let resolvedPersonName: string;

    if (personId) {
      const suResult = await pool.query(
        `SELECT first_name, last_name FROM people WHERE id = $1 AND organization_id = $2`,
        [personId, orgId],
      );
      if (suResult.rows.length === 0) {
        return res.status(404).json({ error: { message: 'Person not found in this organisation' } });
      }
      resolvedPersonId = personId;
      resolvedPersonName = `${suResult.rows[0].first_name} ${suResult.rows[0].last_name}`;
    } else if (personName) {
      const candidates = await AIController.findPersonByName(pool, orgId, personName);
      if (candidates.length === 0) {
        return res.status(404).json({ error: { message: `No active person named "${personName}" found in this organisation` } });
      }
      if (candidates.length > 1) {
        return res.status(409).json({
          error: {
            message: `Multiple people match "${personName}". Please choose one.`,
            candidates: candidates.map((c: any) => ({
              id: c.id,
              name: `${c.first_name} ${c.last_name}`,
              room_number: c.room_number || null,
            })),
          },
        });
      }
      resolvedPersonId = candidates[0].id;
      resolvedPersonName = `${candidates[0].first_name} ${candidates[0].last_name}`;
    } else {
      return res.status(400).json({ error: { message: 'Person ID or name is required' } });
    }

    // --- Shift normalisation ---
    // Accepts the natural-language shift words from the brief and maps them to
    // the day/night values the rest of the application uses.
    const normalisedShift = shift ? AIController.normaliseShift(shift) : 'day';
    const safeNoteDate = noteDate || new Date().toISOString().split('T')[0];
    const safeSource = source || (body.source === 'voice' ? 'voice' : 'text');

    // Fetch person context from the org-scoped pool already resolved above.
    const suResult = await pool.query(
      `SELECT su.*, 
              json_agg(DISTINCT jsonb_build_object('title', cp.title, 'category', cp.category, 'description', cp.description)) FILTER (WHERE cp.id IS NOT NULL) as care_plans,
              json_agg(DISTINCT jsonb_build_object('title', sg.title, 'description', sg.description, 'status', sg.status, 'target_value', sg.target_value, 'value_unit', sg.value_unit)) FILTER (WHERE sg.id IS NOT NULL) as recent_goals
       FROM people su
       LEFT JOIN care_plans cp ON cp.person_id = su.id AND cp.status = 'active'
       LEFT JOIN person_goals sg ON sg.person_id = su.id AND sg.status != 'completed'
       WHERE su.id = $1 AND su.organization_id = $2 AND su.id = $3
       GROUP BY su.id`,
      [resolvedPersonId, orgId, resolvedPersonId]
    );

    if (suResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Person not found' } });
    }

    const su = suResult.rows[0];

    // Fetch recent mood/baseline data
    const baselineResult = await pool.query(
      `SELECT content, category, note_date FROM daily_notes 
       WHERE person_id = $1 AND note_date >= CURRENT_DATE - INTERVAL '7 days'
       ORDER BY note_date DESC LIMIT 5`,
      [personId]
    );

    const carePlans = (su.care_plans || []).filter((cp: any) => cp.title).map((cp: any) => 
      `- ${cp.title} (${cp.category}): ${cp.description || 'No description'}`
    ).join('\n') || 'No active care plans';

    const recentGoals = (su.recent_goals || []).filter((g: any) => g.title).map((g: any) => 
      `- ${g.title}: ${g.description || 'No description'} (Status: ${g.status}${g.target_value ? `, Target: ${g.target_value}${g.value_unit || ''}` : ''})`
    ).join('\n') || 'No active goals';

    const baselineData = baselineResult.rows.map((r: any) => 
      `[${r.note_date}] (${r.category}): ${r.content.slice(0, 150)}...`
    ).join('\n') || 'No recent notes';

    const { system, user } = await renderOrgPrompt('daily_note_generation', {
      person_name: resolvedPersonName,
      date_of_birth: decryptField(su.date_of_birth, orgId) || 'Unknown',
      room_number: su.room_number || 'N/A',
      allergies: Array.isArray(su.allergies) ? su.allergies.join(', ') || 'None known' : 'None known',
      dietary_requirements: su.dietary_requirements || 'None noted',
      gp_name: su.gp_name || 'Unknown',
      gp_surgery: su.gp_surgery || 'Unknown',
      care_plans: carePlans,
      recent_goals: recentGoals,
      baseline_data: baselineData,
      staff_input: staffInput,
      shift: normalisedShift,
      note_date: safeNoteDate,
    }, orgId);

    const start = Date.now();
    try {
      const provider = getProvider(config);
      const result = await provider.chatCompletion(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        { model: config.model, temperature: 0.3 }
      );

      let parsed;
      try { parsed = JSON.parse(result.content); }
      catch { parsed = { raw: result.content }; }

      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'daily_note_generation',
          promptKey: 'daily_note_generation',
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          model: config.model,
          provider: provider.name,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
          requestData: { personId: resolvedPersonId, shift: normalisedShift, noteDate: safeNoteDate, source: safeSource },
          responseSummary: typeof parsed === 'object' ? `Risk: ${parsed.risk_level || 'unknown'}, Safeguarding flags: ${parsed.safeguarding_flags?.length || 0}` : result.content.slice(0, 200),
        });
      } catch { /* audit logging non-critical */ }

      res.json({
        result: parsed,
        // The brief wants the voice flow to return a structured draft Mica can
        // show for review before anything is persisted. The existing approval
        // endpoint still expects the same shape, so we return enough for the UI
        // to render the review card and for approveDailyNote to consume.
        person: { id: resolvedPersonId, name: resolvedPersonName },
        noteContext: {
          personId: resolvedPersonId,
          shift: normalisedShift,
          noteDate: safeNoteDate,
          source: safeSource,
        },
        usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens },
      });
    } catch (err: any) {
      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'daily_note_generation',
          promptKey: 'daily_note_generation',
          success: false,
          errorMessage: err.message,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
        });
      } catch { /* audit logging non-critical */ }
      logger.error(err, 'Daily note generation failed');
      res.status(500).json({ error: { message: 'AI daily note generation failed' } });
    }
  }

  /**
   * Raw generation helper for the action framework.
   *
   * The Mica action implementations call this instead of reaching back into the
   * HTTP handler, so the same prompt + parse + audit pipeline can be reused by
   * voice, text, and any future care-note action without duplicating code.
   */
  static async generateDailyNoteRaw(
    pool: any,
    orgId: string,
    userId: string,
    body: {
      personId?: string;
      personName?: string;
      staffInput: string;
      shift?: string;
      noteDate?: string;
      source?: 'voice' | 'text' | 'manual';
    },
  ): Promise<{
    result: any;
    person: { id: string; name: string };
    noteContext: {
      personId: string;
      shift: 'day' | 'night';
      noteDate: string;
      source: 'voice' | 'text' | 'manual';
    };
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  } | { error: { message: string } }> {
    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return { error: { message: 'AI not configured. Configure AI provider in Settings first.' } };
    }
    if (!config.enabledFeatures?.includes('daily_note_generation')) {
      return { error: { message: 'Daily Note Generation is not enabled for your organization.' } };
    }

    const { personId, personName, staffInput, shift, noteDate, source } = body;

    if (!staffInput || staffInput.trim().length === 0) {
      return { error: { message: 'Staff observation is required' } };
    }

    // --- Person resolution ---
    let resolvedPersonId: string;
    let resolvedPersonName: string;

    if (personId) {
      const suResult = await pool.query(
        `SELECT first_name, last_name FROM people WHERE id = $1 AND organization_id = $2`,
        [personId, orgId],
      );
      if (suResult.rows.length === 0) {
        return { error: { message: 'Person not found in this organisation' } };
      }
      resolvedPersonId = personId;
      resolvedPersonName = `${suResult.rows[0].first_name} ${suResult.rows[0].last_name}`;
    } else if (personName) {
      const candidates = await AIController.findPersonByName(pool, orgId, personName);
      if (candidates.length === 0) {
        return { error: { message: `No active person named "${personName}" found in this organisation` } };
      }
      if (candidates.length > 1) {
        return { error: { message: `Multiple people match "${personName}". Please choose one.` } };
      }
      resolvedPersonId = candidates[0].id;
      resolvedPersonName = `${candidates[0].first_name} ${candidates[0].last_name}`;
    } else {
      return { error: { message: 'Person ID or name is required' } };
    }

    const normalisedShift = shift ? AIController.normaliseShift(shift) : 'day';
    const safeNoteDate = noteDate || new Date().toISOString().split('T')[0];
    const safeSource = source || (body.source === 'voice' ? 'voice' : 'text');

    // Fetch person context
    const suResult = await pool.query(
      `SELECT su.*, 
              json_agg(DISTINCT jsonb_build_object('title', cp.title, 'category', cp.category, 'description', cp.description)) FILTER (WHERE cp.id IS NOT NULL) as care_plans,
              json_agg(DISTINCT jsonb_build_object('title', sg.title, 'description', sg.description, 'status', sg.status, 'target_value', sg.target_value, 'value_unit', sg.value_unit)) FILTER (WHERE sg.id IS NOT NULL) as recent_goals
       FROM people su
       LEFT JOIN care_plans cp ON cp.person_id = su.id AND cp.status = 'active'
       LEFT JOIN person_goals sg ON sg.person_id = su.id AND sg.status != 'completed'
       WHERE su.id = $1 AND su.organization_id = $2 AND su.id = $3
       GROUP BY su.id`,
      [resolvedPersonId, orgId, resolvedPersonId],
    );

    if (suResult.rows.length === 0) {
      return { error: { message: 'Person not found' } };
    }

    const su = suResult.rows[0];

    // Fetch recent mood/baseline data
    const baselineResult = await pool.query(
      `SELECT content, category, note_date FROM daily_notes 
       WHERE person_id = $1 AND note_date >= CURRENT_DATE - INTERVAL '7 days'
       ORDER BY note_date DESC LIMIT 5`,
      [resolvedPersonId],
    );

    const carePlans = (su.care_plans || []).filter((cp: any) => cp.title).map((cp: any) => 
      `- ${cp.title} (${cp.category}): ${cp.description || 'No description'}`
    ).join('\n') || 'No active care plans';

    const recentGoals = (su.recent_goals || []).filter((g: any) => g.title).map((g: any) => 
      `- ${g.title}: ${g.description || 'No description'} (Status: ${g.status}${g.target_value ? `, Target: ${g.target_value}${g.value_unit || ''}` : ''})`
    ).join('\n') || 'No active goals';

    const baselineData = baselineResult.rows.map((r: any) => 
      `[${r.note_date}] (${r.category}): ${r.content.slice(0, 150)}...`
    ).join('\n') || 'No recent notes';

    const { system, user } = await renderOrgPrompt('daily_note_generation', {
      person_name: resolvedPersonName,
      date_of_birth: decryptField(su.date_of_birth, orgId) || 'Unknown',
      room_number: su.room_number || 'N/A',
      allergies: Array.isArray(su.allergies) ? su.allergies.join(', ') || 'None known' : 'None known',
      dietary_requirements: su.dietary_requirements || 'None noted',
      gp_name: su.gp_name || 'Unknown',
      gp_surgery: su.gp_surgery || 'Unknown',
      care_plans: carePlans,
      recent_goals: recentGoals,
      baseline_data: baselineData,
      staff_input: staffInput,
      shift: normalisedShift,
      note_date: safeNoteDate,
    }, orgId);

    const start = Date.now();
    try {
      const provider = getProvider(config);
      const result = await provider.chatCompletion(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        { model: config.model, temperature: 0.3 },
      );

      let parsed;
      try { parsed = JSON.parse(result.content); }
      catch { parsed = { raw: result.content }; }

      return {
        result: parsed,
        person: { id: resolvedPersonId, name: resolvedPersonName },
        noteContext: {
          personId: resolvedPersonId,
          shift: normalisedShift,
          noteDate: safeNoteDate,
          source: safeSource,
        },
        usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens },
      };
    } catch (err: any) {
      throw err;
    }
  }

  static async handleVoiceNote(req: Request, res: Response) {
    return res.status(501).json({ error: { message: 'Voice note handling is now performed by the Mica action gateway.' } });
  }

  /**
   * Mica action gateway adapter for voice care notes.
   *
   * The HTTP contract is unchanged: the client still posts to /ai/voice/notes and
   * still gets needClarification / result / person / noteContext. Internally the
   * request is now routed through MicaGateway so the same resolver, clarification,
   * draft, and audit contract is shared by future voice actions.
   */
  static async handleVoiceNoteViaGateway(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    const userId = req.user?.userId;
    if (!orgId || !userId) {
      return res.status(400).json({ error: { message: 'Organization and user required' } });
    }

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured. Configure AI provider in Settings first.' } });
    }
    if (!config.enabledFeatures?.includes('daily_note_generation')) {
      return res.status(403).json({ error: { message: 'Voice care notes are not enabled for your organization.' } });
    }

    const body = req.body as {
      intent?: string;
      personId?: string;
      personName?: string;
      transcription?: string;
      shift?: string;
      noteDate?: string;
      clarify?: boolean;
      staffInput?: string;
      source?: 'voice' | 'text' | 'manual';
    };

    const actionRequest: MicaActionRequest = {
      action: 'CREATE_CARE_NOTE',
      clarify: body.clarify,
      utterance: body.intent || body.transcription || undefined,
      input: {
        personId: body.personId,
        personName: body.personName,
        staffInput: body.staffInput || body.transcription,
        shift: body.shift,
        noteDate: body.noteDate,
        source: body.source || 'voice',
      },
    };

    const result = await MicaGateway.handle(actionRequest, {
      req,
      user: { organizationId: orgId, userId },
    });

    if ('error' in result) {
      return res.status(400).json(result);
    }

    if (result.needClarification) {
      return res.json(result);
    }

    if ('draft' in result) {
      const extras = result.context.extras as {
        personId: string;
        personName: string;
        shift: 'day' | 'night';
        noteDate: string;
        source: 'voice' | 'text' | 'manual';
      } | undefined;
      if (!extras) {
        return res.status(500).json({ error: { message: 'Voice care note draft was returned without context.' } });
      }
      return res.json({
        result: result.output,
        person: { id: extras.personId, name: extras.personName },
        noteContext: {
          personId: extras.personId,
          shift: extras.shift,
          noteDate: extras.noteDate,
          source: extras.source,
        },
        usage: (result.output as any).usage,
      });
    }

    return res.json(result);
  }

  /**
   * Mica action gateway for write actions (create task, book appointment).
   *
   * The confirm-before-persist contract: POST /ai/mica/actions prepares a
   * DRAFT (with clarification rounds if a spoken name is ambiguous); the
   * client shows the summary; the user approves; the client posts the draft
   * to /ai/mica/actions/confirm and only then is anything persisted. The
   * confirm endpoint re-validates every org-scoped reference server-side
   * because the confirming client is untrusted input again.
   */
  static async micaAction(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    const userId = req.user?.userId;
    if (!orgId || !userId) {
      return res.status(400).json({ error: { message: 'Organization and user required' } });
    }

    const body = req.body as { action?: string; clarify?: boolean; utterance?: string; input?: Record<string, unknown> };
    const actionId = body.action as MicaActionRequest['action'];
    if (!actionId || actionId === 'CREATE_CARE_NOTE') {
      // Care notes keep their dedicated endpoint and feature flag.
      return res.status(400).json({ error: { message: 'Send care notes to /ai/voice/notes.' } });
    }

    // Feature gate: Mica write actions ride the natural_language_assistant
    // feature — the same switch that enables Mica's question answering.
    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured. Configure AI provider in Settings first.' } });
    }
    if (!config.enabledFeatures?.includes('natural_language_assistant')) {
      return res.status(403).json({ error: { message: 'Enable the "Natural-language Assistant" feature in Settings → AI to use Mica actions.' } });
    }

    const role = (req as unknown as { user?: { role?: string } }).user?.role;
    const metadata = getMicaAction(actionId);
    const allowed = metadata.allowedRoles as readonly string[];
    if (role && !allowed.includes(role)) {
      return res.status(403).json({ error: { message: `Your role cannot use the "${metadata.label}" action.` } });
    }

    const result = await MicaGateway.handle(
      { action: actionId, clarify: body.clarify, utterance: body.utterance, input: body.input || {} },
      { req, user: { organizationId: orgId, userId } },
    );

    if ('error' in result) {
      await AuditRepository.log({
        user_id: userId,
        action: `${metadata.auditFeature}.rejected`,
        entity_type: 'mica_action',
        entity_id: undefined,
        new_data: { action: actionId, reason: result.error.message },
      });
      return res.status(400).json(result);
    }

    // Drafts and clarifications are audit-logged as prepared (not applied).
    await AuditRepository.log({
      user_id: userId,
      action: `${metadata.auditFeature}.prepared`,
      entity_type: 'mica_action',
      entity_id: undefined,
      new_data: { action: actionId, source: (result as { context?: { source?: string } }).context?.source || 'voice' },
    });
    return res.json(result);
  }

  static async micaActionConfirm(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    const userId = req.user?.userId;
    if (!orgId || !userId) {
      return res.status(400).json({ error: { message: 'Organization and user required' } });
    }

    const draft = req.body?.draft as MicaActionDraft<unknown> | undefined;
    if (!draft || typeof draft !== 'object' || (draft as { draft?: unknown }).draft !== true || typeof draft.action !== 'string') {
      return res.status(400).json({ error: { message: 'A reviewed draft is required to confirm.' } });
    }
    if (draft.action === 'CREATE_CARE_NOTE') {
      return res.status(400).json({ error: { message: 'Care notes are approved through /ai/daily-notes/approve.' } });
    }

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured. Configure AI provider in Settings first.' } });
    }
    if (!config.enabledFeatures?.includes('natural_language_assistant')) {
      return res.status(403).json({ error: { message: 'Enable the "Natural-language Assistant" feature in Settings → AI to use Mica actions.' } });
    }

    const role = (req as unknown as { user?: { role?: string } }).user?.role;
    const metadata = getMicaAction(draft.action as MicaActionRequest['action']);
    const allowed = metadata.allowedRoles as readonly string[];
    if (role && !allowed.includes(role)) {
      return res.status(403).json({ error: { message: `Your role cannot use the "${metadata.label}" action.` } });
    }

    try {
      const result = await MicaGateway.confirm(draft, { req, user: { organizationId: orgId, userId } });
      if ('error' in result) {
        return res.status(400).json(result);
      }
      const confirmedResult = result as { ok: true; result: Record<string, unknown> };
      await AuditRepository.log({
        user_id: userId,
        action: `${metadata.auditFeature}.confirmed`,
        entity_type: 'mica_action',
        entity_id: (confirmedResult.result.taskId as string) || (confirmedResult.result.appointmentId as string) || undefined,
        new_data: { action: draft.action, result: confirmedResult.result },
      });

      // A write ends where a read answer ends: with the record's own page offered
      // by name, so the carer's next word can open what was just saved instead of
      // leaving them to go and hunt for the row (`mica.recordPages.ts`). The gate
      // is the router's own — roles *and* modules — so a caller who cannot open the
      // page is asked nothing about it. Both halves are resolved only when a record
      // was actually written: a refused draft reaches nobody.
      const ref = recordRefFromWrite(confirmedResult.result);
      const page = ref
        ? recordPageFor(ref, role as UserRole | undefined, await loadModuleAccess(userId, orgId, role))
        : undefined;

      // The offer is what the reply asks about, so it has to outlive the request
      // that made it: recorded on the caller's session when they had one, which is
      // what lets a bare "yes" to /ai/mica/ask resolve to this record. A write that
      // can offer nothing still retires whatever was offered before it.
      const sessionId = (req.body as { sessionId?: string }).sessionId;
      const session = sessionId ? await loadOrCreateSession(orgId, userId, sessionId) : null;
      if (session) await setPendingPage(session, page).catch(() => undefined);

      return res.json({
        confirmed: true,
        result: confirmedResult.result,
        ...(page ? { offer: page } : {}),
        ...(session ? { sessionId: session.sessionId } : {}),
      });
    } catch (err: any) {
      return res.status(400).json({ error: { message: err?.message || 'Could not save that.' } });
    }
  }

  /**
   * POST /ai/tts — text-to-speech for Mica's spoken replies.
   *
   * The client (useMica.speak) sends the sentence Mica is about to say and gets
   * MP3 bytes back, which it plays through Web Audio. Playing through Web Audio
   * (rather than <audio> or speechSynthesis) is what lets the orb react to the
   * literal output amplitude via an AnalyserNode instead of a synthetic
   * word-boundary envelope.
   *
   * Gated like every other AI call: org AI config enabled, an OpenAI primary
   * or fallback key (Anthropic has no TTS API), and the org's monthly token
   * budget. Usage is audit-logged so TTS spend shows up in /ai/usage-stats.
   */
  static async textToSpeech(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    const userId = req.user?.userId;
    if (!orgId || !userId) {
      return res.status(400).json({ error: { message: 'Organization and user required' } });
    }

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured. Configure AI provider in Settings first.' } });
    }

    // TTS speaks the model's own reply back to the user — no care-record
    // narrative crosses the boundary here, only short UI sentences, so no
    // per-feature flag; the org-level AI enablement is the control.
    const started = Date.now();
    const { text, voice } = req.body as { text: string; voice?: string };
    try {
      const budget = await AIRepository.checkBudget(orgId, config);
      if (!budget.allowed) {
        return res.status(402).json({ error: { message: `AI budget exceeded: ${budget.reason}` } });
      }

      // OpenAI TTS needs an OpenAI key: synthesizeSpeech tries the primary,
      // then the configured fallback, and returns null when the org has no
      // OpenAI key at all. The processor allowlist is enforced inside it.
      // Voice resolution order: per-request override (kept for the client's
      // quick-switch), then the org's Settings → AI choice, then coral.
      const speech = await synthesizeSpeech(config, text, { voice: voice || config.ttsVoice });
      if (!speech) {
        return res.status(400).json({ error: { message: 'Text-to-speech requires an OpenAI provider (primary or fallback).' } });
      }

      const { audio, mime } = speech;

      await AIRepository.logAudit({
        organizationId: orgId,
        feature: 'tts',
        provider: 'openai',
        model: 'gpt-4o-mini-tts',
        durationMs: Date.now() - started,
        success: true,
        createdBy: userId,
        // Never store the spoken text: it is frequently a care-note reply and
        // the audit log is read by more roles than the note itself.
        responseSummary: `tts ${audio.length} bytes`,
      });

      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'no-store');
      return res.send(audio);
    } catch (err: any) {
      await AIRepository.logAudit({
        organizationId: orgId,
        feature: 'tts',
        provider: 'openai',
        model: 'gpt-4o-mini-tts',
        durationMs: Date.now() - started,
        success: false,
        errorMessage: err?.message?.slice(0, 500),
        createdBy: userId,
      }).catch(() => undefined);
      const status = err?.status && Number.isInteger(err.status) ? err.status : 500;
      return res.status(status).json({ error: { message: err?.message || 'Text-to-speech failed.' } });
    }
  }

  /**
   * Mica's platform-wide question answering ("who is on shift today",
   * "who is supporting Grace Roberts", "give me today's appointments").
   *
   * Mechanism, stated honestly for the prompts disclosure: the model does not
   * see your records. It sees the question plus a menu of read-only tools; it
   * picks tools and arguments; we run those SELECTs org-scoped; and the model
   * only ever summarises pseudonymised results. Real names are held in a
   * server-side map and restored into the client-facing answer, so a person's
   * name never crosses the model boundary — the same control every other AI
   * surface in this codebase applies, one step further because here the
   * *reply itself* is what gets spoken aloud.
   */
  /**
   * POST /ai/mica/settle — intent classification for ambiguous utterances.
   *
   * The client's regex heuristics (detectMicaActionIntent) catch obvious
   * shapes like "create a task" or "book a podiatry appointment", but short
   * spoken imperatives such as "book podiatry" or "arrangea Hoknow visit" —
   * where the object is a kind of appointment rather than the word itself —
   * match no regex, fall through the care-note path, and produce a wrong
   * draft. Rather than growing the regex pile, this route classifies the
   * utterance with one small LLM call when the client asks for help, and
   * returns the action id plus extraction of the appointment/task subject.
   *
   * The model is told explicitly that anything other than one of the four
   * listed write intents is `none` (read or care-note, which stay on their
   * current paths), so the fallback can never invent a fifth action — it
   * can only pick between the two registered write actions, decline to
   * `none`, or fail bounded. Recognition-only: nothing here writes.
   */
  static async micaSettle(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    const orgUserId = req.user?.userId;
    if (!orgId || !orgUserId) {
      return res.status(400).json({ error: { message: 'Organization and user required' } });
    }

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured. Configure AI provider in Settings first.' } });
    }
    if (!config.enabledFeatures?.includes('natural_language_assistant')) {
      return res.status(403).json({ error: { message: 'Enable the "Natural-language Assistant" feature in Settings → AI to use Mica actions.' } });
    }
    if (config.provider !== 'openai') {
      return res.status(400).json({ error: { message: 'Mica intent fallback requires an OpenAI provider.' } });
    }
    const utterance = (req.body as { utterance: string }).utterance;

    const started = Date.now();
    const today = new Date().toISOString().split('T')[0];
    const system = [
      `You are classifying what a care worker wants when speaking to a voice assistant (today is ${today}).`,
      `Reply with ONLY a JSON object: {"action":"CREATE_APPOINTMENT"|"CREATE_TASK"|"none", "subject":"...", "personName":"..."}.`,
      `CREATE_APPOINTMENT — they want to book/schedule/arrange/reschedule an appointment, visit, clinic, check-up, review or similar clinical/official slot.\nCREATE_TASK — they want to create/add a task, reminder, to-do or follow-up item.\n"none" — everything else (questions, care observations, notes).`,
      `Rules: subject is the event/thing's short name ("podiatry", "GP review", "fire drill"); personName is the person it concerns ONLY if clearly named (null otherwise); a statement about someone's day is a care note, not a task; never invent an action outside the list.`,
    ].join(' ');
    const user = `Utterance: "${utterance}"`;

    try {
      const provider = getProvider(config);
      const result = await provider.chatCompletion(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        { model: config.model, temperature: 0, maxTokens: 120 },
      );
      const match = result.content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('no JSON in reply');
      let parsed: any;
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        throw new Error('unparseable JSON reply');
      }
      const action = parsed?.action === 'CREATE_APPOINTMENT' || parsed?.action === 'CREATE_TASK'
        ? parsed.action
        : null; // anything else (including 'none', misspellings) is no intent
      await AIRepository.logAudit({
        organizationId: orgId,
        feature: 'mica_intent_settle',
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        model: config.model,
        provider: config.provider,
        durationMs: Date.now() - started,
        createdBy: orgUserId,
        requestData: { utterance },
        responseSummary: action || 'none',
      }).catch(() => undefined);

      if (!action) {
        // Explicit none is a real result, not an error: it tells the client
        // "this is a question or care note — carry on down your usual path".
        return res.json({ intent: null, action: parsed?.action === 'none' ? 'none' : 'unclassified' });
      }
      const subject = typeof parsed?.subject === 'string' ? parsed.subject.slice(0, 80) : undefined;
      const personName = typeof parsed?.personName === 'string' ? parsed.personName.slice(0, 80) : undefined;
      const prefill: Record<string, unknown> = { utterance };
      if (action === 'CREATE_APPOINTMENT') {
        if (subject) prefill.title = subject;
        if (personName) prefill.personName = personName;
      } else if (subject) {
        prefill.title = /renewal|review|follow-?up/i.test(subject) ? subject : `${subject} — check or arrange`;
        if (personName) prefill.personName = personName;
        prefill.priority = 'medium';
      }
      return res.json({ intent: { action, utterance, ...prefill }, action });
    } catch (err: any) {
      await AIRepository.logAudit({
        organizationId: orgId,
        feature: 'mica_intent_settle',
        success: false,
        errorMessage: err?.message?.slice(0, 300),
        durationMs: Date.now() - started,
        createdBy: orgUserId,
      }).catch(() => undefined);
      return res.status(400).json({ error: { message: 'Mica could not determine what you meant. Try rewording.' } });
    }
  }

  static async micaAsk(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    const userId = req.user?.userId;
    if (!orgId || !userId) {
      return res.status(400).json({ error: { message: 'Organization and user required' } });
    }

    // Navigation first, and before every AI gate below it. A destination
    // request is resolved deterministically (no provider, no tokens), so
    // "open the incidents" or "give me Evan Turner's MAR chart for March"
    // works for an organisation that has not configured a model at all — and
    // costs nothing for the ones that have.
    try {
      const startedAt = Date.now();
      const navigation = await resolveMicaNavigation(orgId, (req.body as { question: string }).question, req.user?.role);
      if (navigation) {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'mica_navigation',
          model: 'deterministic',
          provider: 'deterministic',
          durationMs: Date.now() - startedAt,
          createdBy: userId,
          requestData: { question: (req.body as { question: string }).question },
          responseSummary: navigation.navigate ? navigation.navigate.path : 'no-destination',
        }).catch(() => undefined);
        return res.json(navigation);
      }
    } catch (err: any) {
      // A resolver failure must not take the question path down with it: the
      // model below can still answer, and a failed lookup is not a failed ask.
      logger.warn({ message: err?.message }, 'Mica navigation resolution failed');
    }

    // List questions next — "who is on shift today", "give me today's
    // appointments", "how is Nora's medication round looking" — and still before
    // every AI gate, for the same reason as navigation: the answer is a bounded
    // set of the organisation's own rows, so it needs no provider, no tokens and
    // no budget, and an organisation with no AI configured still gets it.
    try {
      const startedAt = Date.now();
      const question = (req.body as { question: string }).question;
      const fact = await resolveMicaFact(orgId, userId, question, req.user?.role);
      if (fact) {
        // The answer joins the conversation memory exactly as a model answer
        // does, so the elliptical follow-up ("what about tomorrow?") is grounded
        // in what the carer just heard. A session store failure costs nothing
        // here: the answer is already formed, so it is still spoken.
        const session = await loadOrCreateSession(
          orgId,
          userId,
          (req.body as { sessionId?: string }).sessionId,
        );
        // The page the answer came from, when there is one, is remembered in the
        // conversation: the carer's next word is answered by the server that
        // asked the question, and recording this turn is also what retires any
        // earlier offer. Only a route travels — never a name or an id.
        const page: MicaPendingPage | undefined = fact.page
          ? { destination: fact.page.destination, path: fact.page.path, label: fact.page.label }
          : undefined;
        if (session) await recordTurn(session, question, fact.answer, page).catch(() => undefined);
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'mica_fact',
          model: 'deterministic',
          provider: 'deterministic',
          durationMs: Date.now() - startedAt,
          createdBy: userId,
          requestData: { question },
          // The kind, never the answer: this log is readable by ORG_ADMINs and
          // the answer echoes record data (names, medication, rota).
          responseSummary: fact.kind,
        }).catch(() => undefined);
        return res.json({
          answer: fact.answer,
          // `navigate` means "go there now"; `offer` means "this page is waiting on
          // your yes". The client needs only to know one is outstanding — it
          // routes the next utterance back here, and the route is opened here.
          ...(page ? { offer: page } : {}),
          ...(session ? { sessionId: session.sessionId } : {}),
        });
      }
    } catch (err: any) {
      // Same rule as navigation: a failed lookup is not a failed ask.
      logger.warn({ message: err?.message }, 'Mica fact resolution failed');
    }

    // The other half of a list answer: the carer confirms the page Mica offered
    // in it. "yes", "okay", "go on" are not questions and not care notes, and a
    // destination spoken once is not worth parsing twice — the route was resolved
    // when the list was read and remembered in the conversation, so confirming it
    // costs one session read and no parse at all. Like the answer it confirms, it
    // runs before every AI gate: an organisation with no provider configured hears
    // "want me to open the rota planner?" and can still say yes.
    //
    // Only an utterance shaped like a confirmation touches the store, so an
    // ordinary question pays nothing for this. A "yes" with nothing outstanding
    // falls through untouched to the paths that already handled it.
    const response = req.body as { question: string; sessionId?: string };
    const answering = response.question;
    if (parseFactConfirmation(answering)) {
      try {
        const startedAt = Date.now();
        const session = await loadOrCreateSession(orgId, userId, response.sessionId);
        const offered = session?.pendingPage;
        if (session && offered) {
          const confirmed: MicaNavigationReply = {
            answer: `Opening ${offered.label}.`,
            navigate: { destination: offered.destination, path: offered.path, label: offered.label },
          };
          // The confirmation is itself a turn, and recording it is what retires
          // the offer: a second "yes" cannot re-open the same page.
          await recordTurn(session, answering, confirmed.answer).catch(() => undefined);
          await AIRepository.logAudit({
            organizationId: orgId,
            feature: 'mica_navigation',
            model: 'deterministic',
            provider: 'deterministic',
            durationMs: Date.now() - startedAt,
            createdBy: userId,
            requestData: { question: answering, confirmed: true },
            responseSummary: offered.path,
          }).catch(() => undefined);
          return res.json({ ...confirmed, sessionId: session.sessionId });
        }
      } catch (err: any) {
        // Same rule as the rest: a failed lookup is not a failed ask.
        logger.warn({ message: err?.message }, 'Mica page confirmation failed');
      }
    }

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured. Configure AI provider in Settings first.' } });
    }
    if (!config.enabledFeatures?.includes('natural_language_assistant')) {
      return res.status(403).json({ error: { message: 'Enable the "Natural-language Assistant" feature in Settings → AI to ask Mica questions.' } });
    }
    if (config.provider !== 'openai') {
      return res.status(400).json({ error: { message: 'Mica question answering requires an OpenAI provider (tool calling).' } });
    }
    const budget = await AIRepository.checkBudget(orgId, config);
    if (!budget.allowed) {
      return res.status(402).json({ error: { message: `AI budget exceeded: ${budget.reason}` } });
    }

    // Provider construction is the deployment's processor gate
    // (assertApprovedProcessor): an unapproved processor or a production
    // deploy without its transfer-basis acknowledgement throws here. Caught
    // into a 400 with the real reason — an opaque 500 surfaces in Mica as
    // "check AI settings" with no hint that the key is fine and the gate is
    // what refused, which is exactly the loop that sends an admin back to
    // Settings to re-enter a key that was never the problem.
    let provider;
    try {
      provider = getProvider(config);
    } catch (err: any) {
      return res.status(400).json({ error: { message: err?.message || 'AI provider is not available for this deployment.' } });
    }
    if (typeof (provider as any).chatWithTools !== 'function') {
      return res.status(400).json({ error: { message: 'Mica question answering requires an OpenAI provider (tool calling).' } });
    }

    const started = Date.now();
    const question = (req.body as { question: string }).question;
    const clientSessionId = (req.body as { sessionId?: string }).sessionId;
    // Follow-up memory: the client sends back the opaque sessionId the server
    // issued last time. Sessions are scoped to this user+org, so an id from
    // another user (or an expired one) silently starts a fresh conversation.
    const session = await loadOrCreateSession(orgId, userId, clientSessionId);
    if (!session) {
      // The store could not allocate a conversation (never happens in
      // practice — the memory fallback is synchronous). Fail the question
      // rather than answering without context.
      return res.status(503).json({ error: { message: 'Mica conversation store unavailable. Try again.' } });
    }
    const today = new Date().toISOString().split('T')[0];
    const systemPrompt = [
      `You are Mica, the voice assistant inside MeticleCare, a care-management platform. You answer one question from a member of staff, concisely (1-3 sentences, spoken style).`,
      `Today's date is ${today}. Answer in British English.`,
      `When asked how urgent a medication reorder is, quote the stock urgency bands consistently: already out or projected to run out within 3 days means urgent and delivery should be arranged today; 4–7 days means arrange delivery this week; over 7 days is lower urgency and can follow normal replenishment. Base this only on days_until_empty from the last 28 days of given doses. An incoming future delivery can avoid a duplicate order only if it arrives before run-out and is sufficient; explain if timing or quantity is insufficient. If expired_first is true, warn that stock expires before projected run-out and still needs replacement. Say when usage or expiry is unknown; do not invent an estimate.`,
      `You have read-only tools over the organisation's records: rota/staff on shift, who supports a person, appointments, person overview, incidents, staff on leave, rota coverage, medication rounds, expiring training, leave balances, person lookup.`,
      `Call the tool(s) you need, then answer from the results. Do not invent data: if the results are empty or do not answer the question, say what you could not find. Never guess names, rooms or times that are not in the results.`,
      `If the question is actually asking to record or write something (e.g. "record a care note"), say you will start the care-note flow rather than calling tools.`,
      `This may be a follow-up to an earlier question in the same conversation, provided as prior user/assistant turns. Pronouns and ellipses ("what about tomorrow?", "and the night shift?") refer to the most recent topic. Resolve relative dates against Today's date above, then answer the NEW question — do not just repeat the previous answer. If the follow-up is ambiguous, answer for the most likely reading and say which reading you took.`,
    ].join(' ');

    const { messages: historyMessages, priorTurns } = buildFollowUpMessages(session, systemPrompt, question);

    // Names in tool results are pseudonymised before the model sees them; this
    // map is what restores real names into the answer the staff member reads.
    const pseudonymToReal = new Map<string, string>();
    const pseudonymise = (rows: unknown[]): string => {
      const names = collectNames({ rows } as Record<string, unknown>);
      const scoped = new Map<string, string>();
      for (const [name, pseudo] of names) {
        const kind = pseudo.startsWith('Staff') ? 'staff' : 'person';
        const scopedPseudo = pseudonymFor(name, orgId, kind as 'staff' | 'person');
        scoped.set(name, scopedPseudo);
        pseudonymToReal.set(scopedPseudo, name);
      }
      return redactText(JSON.stringify(rows), scoped);
    };

    try {
      const tools = MICA_TOOLS.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
      const messages: any[] = historyMessages;

      let answer: string | null = null;
      let totalTokens = 0;
      const MAX_TOOL_ROUNDS = 3;
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const step = await (provider as any).chatWithTools(messages, { tools, model: config.model });
        totalTokens += step.totalTokens;
        if (!step.toolCalls?.length) {
          answer = step.content || 'I could not answer that. Try asking again.';
          break;
        }
        messages.push({ role: 'assistant', tool_calls: step.toolCalls.map((tc: any) => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.args } })) });
        for (const tc of step.toolCalls) {
          const tool = findMicaTool(tc.name);
          let payload: string;
          if (!tool) {
            payload = JSON.stringify({ error: `Unknown tool ${tc.name}` });
          } else {
            try {
              const args = JSON.parse(tc.args || '{}');
              payload = pseudonymise(await tool.execute(orgId, args));
            } catch (e: any) {
              payload = JSON.stringify({ error: e?.message?.slice(0, 200) || 'tool failed' });
            }
          }
          messages.push({ role: 'tool', tool_call_id: tc.id, content: payload });
        }
      }
      if (answer === null) {
        // Loop exhausted mid-tool-calling: make one final no-tools call so the
        // user still gets an answer built from what was gathered.
        const final = await (provider as any).chatWithTools(messages, { model: config.model });
        totalTokens += final.totalTokens;
        answer = final.content || 'I could not complete that question. Try asking again.';
      }
      const answerText: string = answer ?? 'I could not answer that. Try asking again.';

      // Restore real names into the client-facing answer. Longest first so a
      // full name is restored before a bare given name maps to the same key.
      let restored: string = answerText;
      for (const [pseudo, real] of [...pseudonymToReal.entries()].sort((a, b) => b[0].length - a[0].length)) {
        restored = restored.replace(new RegExp(`\\b${pseudo.replace(/ /g, '\\s+')}\\b`, 'g'), real);
      }
      answer = restored;
      const finalAnswer: string = restored;

      await AIRepository.logAudit({
        organizationId: orgId,
        feature: 'mica_ask',
        totalTokens,
        model: config.model,
        provider: config.provider,
        durationMs: Date.now() - started,
        success: true,
        createdBy: userId,
        // Store the question (it is the user's own words) but not the answer:
        // answers echo record data, and this log is readable by ORG_ADMINs.
        responseSummary: `mica_ask ${totalTokens} tokens${priorTurns ? ` followup_of_${priorTurns}` : ''}`,
      });
      // Only completed answers join the conversation memory, so a failed turn
      // never poisons the context the next follow-up sees.
      await recordTurn(session, question, finalAnswer);
      return res.json({ answer: finalAnswer, tokens: totalTokens, sessionId: session.sessionId });
    } catch (err: any) {
      await AIRepository.logAudit({
        organizationId: orgId,
        feature: 'mica_ask',
        durationMs: Date.now() - started,
        success: false,
        errorMessage: err?.message?.slice(0, 500),
        createdBy: userId,
      }).catch(() => undefined);
      return res.status(500).json({ error: { message: err?.message || 'Mica could not answer that.' } });
    }
  }

  /**
   * Minimal reusable person-resolution helper exported so the same disambiguation
   * logic the brief requires for voice actions is available to any future Mica
   * tool that needs to identify a person by name rather than UUID.
   */
  static async resolvePersonByIdentity(pool: any, orgId: string, personId?: string, personName?: string) {
    if (!personId && !personName) {
      return { error: { message: 'Person ID or name is required' } };
    }
    if (personId) {
      const suResult = await pool.query(
        `SELECT first_name, last_name, room_number, status FROM people WHERE id = $1 AND organization_id = $2`,
        [personId, orgId],
      );
      if (suResult.rows.length === 0) {
        return { error: { message: 'Person not found in this organisation' } };
      }
      const r = suResult.rows[0];
      if (r.status !== 'active') {
        return { error: { message: 'Person is not currently active' } };
      }
      return { person: { id: r.id, name: `${r.first_name} ${r.last_name}`, room_number: r.room_number || null } };
    }
    const candidates = await AIController.findPersonByName(pool, orgId, personName!);
    if (candidates.length === 0) {
      return { error: { message: `No active person named "${personName}" found in this organisation` } };
    }
    if (candidates.length > 1) {
      return {
        error: {
          message: `Multiple people match "${personName}". Please choose one.`,
          candidates: candidates.map((c: any) => ({
            id: c.id,
            name: `${c.first_name} ${c.last_name}`,
            room_number: c.room_number || null,
          })),
        },
      };
    }
    const r = candidates[0];
    return { person: { id: r.id, name: `${r.first_name} ${r.last_name}`, room_number: r.room_number || null } };
  }

  static async approveDailyNote(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    const userId = req.user?.userId;
    if (!orgId || !userId) return res.status(400).json({ error: { message: 'Organization and user required' } });

    const pool = (await import('../../shared/database')).default;
    const body = req.body as {
      personId?: string;
      dailyNote?: {
        content?: string;
        shift?: string;
        category?: string;
        support_level?: string;
      };
      source?: 'voice' | 'text' | 'manual';
      moodAnalysis?: any;
      safeguardingFlags?: any[];
      carePlanUpdates?: any[];
      interventionsSuggested?: any[];
      riskLevel?: string;
      followUpRequired?: boolean;
      followUpDetails?: string;
      linkedGoalId?: string;
      noteDate?: string;
    };
    const { personId, dailyNote, moodAnalysis, safeguardingFlags, carePlanUpdates, interventionsSuggested, riskLevel, followUpRequired, followUpDetails, linkedGoalId, noteDate } = body;

    // Verify person belongs to org
    const suCheck = await pool.query('SELECT id FROM people WHERE id = $1 AND organization_id = $2', [personId, orgId]);
    if (suCheck.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Person not found' } });
    }

    // The RLS session variables are set on the *request's* pooled client by
    // `rlsMiddleware` + `authenticate`. `pool.connect()` hands out a different
    // connection that carries none of them, and the `daily_notes` tenant policy
    // then rejects the insert below — the note was never saved at all, and the
    // carer saw "Failed to save daily note". `transaction()` is the helper that
    // reaches for the request-scoped client when the request has one.
    let note: Record<string, any> | undefined;
    try {
      note = await transaction(async (client) => {

      // 1. Insert the daily note with AI analysis metadata
      // Shift is passed through from the approved draft. If the client already
    // normalised it (which it should have, because generateDailyNote returns
    // noteContext.shift as a day/night value), this is safe. If for some reason
    // the client sent a natural-language word, we still accept it here because
    // normaliseShift is the single source of truth and this is the persistence
    // path that must never silently drop a valid shift.
    const noteResult = await client.query(
        `INSERT INTO daily_notes (person_id, author_id, note_date, shift, category, content, support_level, generated_by_ai,
         ai_mood_analysis, ai_safeguarding_flags, ai_care_plan_updates, ai_interventions, ai_risk_level, ai_follow_up_required, ai_follow_up_details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
        [
          personId,
          userId,
          noteDate || new Date().toISOString().split('T')[0],
          dailyNote?.shift ? AIController.normaliseShift(dailyNote.shift) : 'day',
          dailyNote?.category || 'wellbeing',
          dailyNote?.content || '',
          dailyNote?.support_level || null,
          moodAnalysis ? JSON.stringify(moodAnalysis) : null,
          safeguardingFlags && safeguardingFlags.length > 0 ? JSON.stringify(safeguardingFlags) : null,
          carePlanUpdates && carePlanUpdates.length > 0 ? JSON.stringify(carePlanUpdates) : null,
          interventionsSuggested && interventionsSuggested.length > 0 ? JSON.stringify(interventionsSuggested) : null,
          riskLevel || null,
          followUpRequired || false,
          followUpDetails || null,
        ]
      );

      // Audit the voice-assisted creation exactly as the brief asks for: who
      // created it, that Mica assisted, the source, and the timestamp.
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
         VALUES ($1, $2, 'daily_note', $3, $4)`,
        [
          userId,
          'ai_daily_note_approved',
          noteResult.rows[0].id,
          JSON.stringify({
            mood_score: moodAnalysis?.mood_score,
            safeguarding_flags: safeguardingFlags?.length || 0,
            care_plan_updates: carePlanUpdates?.length || 0,
            risk_level: riskLevel,
            follow_up_required: followUpRequired,
            assisted_by: 'Mica',
            source: body.source || (body.dailyNote?.shift ? 'voice' : 'manual'),
            note_date: noteDate || new Date().toISOString().split('T')[0],
            shift: dailyNote?.shift ? AIController.normaliseShift(dailyNote.shift) : 'day',
          }),
        ]
      );

      // 2. Create safeguarding alerts if flagged
      if (safeguardingFlags && safeguardingFlags.length > 0) {
        for (const flag of safeguardingFlags) {
          if (flag.severity !== 'low') {
            // The alert carries the note that raised it. "Safeguarding Alert: fall" with
            // no way to read what was written is a sentence a manager has to go hunting
            // behind; the same link Mica speaks back when it saves that note opens the
            // note itself, on the profile it belongs to.
            await client.query(
              `INSERT INTO notifications (user_id, title, message, type, link)
               SELECT u.id, $1, $2, 'warning', $4
               FROM users u WHERE u.organization_id = $3 AND u.role IN ('ORG_ADMIN', 'MANAGER')
               LIMIT 5`,
              [
                `Safeguarding Alert: ${flag.concern_type}`,
                `${flag.description}. Action: ${flag.action_required}. Severity: ${flag.severity.toUpperCase()}`,
                orgId,
                // `personId` is optional on the request, and a care note's link names the
                // profile it sits on: with no person there is no note to open, so the
                // alert carries no link rather than pointing into a profile that is not
                // the one the note was written against.
                personId
                  ? micaRecordPath({ kind: 'care-note', id: noteResult.rows[0].id, personId })
                  : null,
              ]
            );
          }
        }
      }

      // 4. Log AI usage in audit trail
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
         VALUES ($1, $2, 'daily_note', $3, $4)`,
        [
          userId,
          'ai_daily_note_approved',
          noteResult.rows[0].id,
          JSON.stringify({
            mood_score: moodAnalysis?.mood_score,
            safeguarding_flags: safeguardingFlags?.length || 0,
            care_plan_updates: carePlanUpdates?.length || 0,
            risk_level: riskLevel,
            follow_up_required: followUpRequired,
          })
        ]
      );

      return noteResult.rows[0];
      });

      // A saved care note ends where a saved task does: with its own page offered,
      // so the carer lands on the note that was just written instead of on the top
      // of the notes list looking for it. The link names the profile *and* the note
      // (see `micaRecordPath`), which is also what makes it the same link another
      // device, a notification or a colleague can arrive on. The gate is the
      // router's, both halves: the profile is gated by the `people` module, so a
      // caller who is not offered `/people/:id` is not offered the note on it.
      const role = (req as unknown as { user?: { role?: UserRole } }).user?.role;
      const page = recordPageFor(
        { kind: 'care-note', id: note!.id, personId: note!.person_id },
        role,
        await loadModuleAccess(userId, orgId, role),
      );

      res.status(201).json({
        dailyNote: note,
        message: 'Daily note saved successfully',
        safeguardingAlerts: safeguardingFlags?.filter((f: any) => f.severity !== 'low').length || 0,
        ...(page ? { offer: page } : {}),
      });
    } catch (err: any) {
      logger.error(err, 'Failed to approve daily note');
      res.status(500).json({ error: { message: 'Failed to save daily note' } });
    }
  }

  static async analyzeExistingNote(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization required' } });

    const pool = (await import('../../shared/database')).default;
    const { noteId } = req.params;

    const noteResult = await pool.query(
      'SELECT n.*, su.first_name, su.last_name FROM daily_notes n JOIN people su ON su.id = n.person_id WHERE n.id = $1 AND su.organization_id = $2',
      [noteId, orgId]
    );
    if (noteResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Note not found' } });
    }

    const note = noteResult.rows[0];
    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured. Add API keys in Settings > AI.' } });
    }

    const provider = getProvider(config);
    const { system, user: userTemplate } = await renderOrgPrompt('daily_note_generation', {}, orgId);
    const staffInput = note.content;

    const start = Date.now();
    try {
      const personRes = await pool.query(
        'SELECT first_name, last_name, date_of_birth, room_number FROM people WHERE id = $1',
        [note.person_id]
      );
      const su = personRes.rows[0];

      const carePlansRes = await pool.query(
        'SELECT title FROM care_plans WHERE person_id = $1 AND status = $2',
        [note.person_id, 'active']
      );

      const goalsRes = await pool.query(
        'SELECT title, target_date, status FROM person_goals WHERE person_id = $1',
        [note.person_id]
      );

      const userPrompt = userTemplate
        .replace('{{person_name}}', `${su.first_name} ${su.last_name}`)
        .replace('{{date_of_birth}}', su.date_of_birth ? new Date(decryptField(su.date_of_birth, orgId) as string).toLocaleDateString('en-GB') : 'Unknown')
        .replace('{{room_number}}', su.room_number || 'Unknown')
        .replace('{{allergies}}', 'None on file')
        .replace('{{dietary_requirements}}', 'None on file')
        .replace('{{gp_name}}', 'Unknown')
        .replace('{{gp_surgery}}', 'Unknown')
        .replace('{{care_plans}}', carePlansRes.rows.map(cp => cp.title).join(', ') || 'No active care plans')
        .replace('{{recent_goals}}', goalsRes.rows.map(g => `${g.title} (${g.status}, due ${g.target_date || 'no date'})`).join('\n') || 'No goals set')
        .replace('{{staff_observations}}', staffInput)
        .replace('{{shift}}', note.shift)
        .replace('{{date}}', note.note_date);

      const result = await provider.chatCompletion(
        [{ role: 'system', content: system }, { role: 'user', content: userPrompt }],
        { model: config.model, temperature: 0.3, maxTokens: 1500 }
      );

      let parsed: any;
      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { daily_note: { content: result.content } };
      } catch {
        parsed = { daily_note: { content: result.content } };
      }

      await pool.query(
        `UPDATE daily_notes SET
          generated_by_ai = TRUE,
          ai_mood_analysis = $1,
          ai_safeguarding_flags = $2,
          ai_care_plan_updates = $3,
          ai_interventions = $4,
          ai_risk_level = $5,
          ai_follow_up_required = $6,
          ai_follow_up_details = $7
         WHERE id = $8`,
        [
          parsed.mood_analysis ? JSON.stringify(parsed.mood_analysis) : null,
          parsed.safeguarding_flags?.length > 0 ? JSON.stringify(parsed.safeguarding_flags) : null,
          parsed.care_plan_updates?.length > 0 ? JSON.stringify(parsed.care_plan_updates) : null,
          parsed.interventions_suggested?.length > 0 ? JSON.stringify(parsed.interventions_suggested) : null,
          parsed.risk_level || null,
          parsed.follow_up_required || false,
          parsed.follow_up_details || null,
          noteId,
        ]
      );

      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'daily_note_generation',
          promptKey: 'daily_note_generation',
          success: true,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          model: config.model,
          provider: provider.name,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
          requestData: { noteId, personId: note.person_id },
          responseSummary: `Risk: ${parsed.risk_level || 'unknown'}, Safeguarding flags: ${parsed.safeguarding_flags?.length || 0}`,
        });
      } catch { /* audit non-critical */ }

      res.json({ result: parsed, usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens } });
    } catch (err: any) {
      logger.error(err, 'Note analysis failed');
      res.status(500).json({ error: { message: 'Analysis failed' } });
    }
  }

  static async generateMealPlan(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured. Configure AI provider in Settings first.' } });
    }
    if (!config.enabledFeatures?.includes('meal_plan_generation')) {
      return res.status(403).json({ error: { message: 'Meal Plan Generation is not enabled for your organization.' } });
    }

    const { personId, mealType, dayOfWeek, specialRequirements } = req.body;
    const pool = (await import('../../shared/database')).default;

    // Fetch person and dietary profile
    const personResult = await pool.query(
      `SELECT p.*, dp.dietary_type, dp.texture_modified, dp.vegetarian, dp.vegan,
              dp.halal, dp.kosher, dp.gluten_free, dp.dairy_free, dp.nut_allergy,
              dp.other_allergies, dp.food_preferences, dp.food_dislikes,
              dp.fluid_daily_target_ml, dp.appetite_level, dp.eating_abilities,
              dp.additional_notes
       FROM people p
       LEFT JOIN dietary_profiles dp ON dp.person_id = p.id
       WHERE p.id = $1 AND p.organization_id = $2`,
      [personId, orgId]
    );

    if (personResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Person not found' } });
    }

    const person = personResult.rows[0];
    const { system, user } = await renderOrgPrompt('meal_plan_generation', {
      person_name: `${person.first_name} ${person.last_name}`,
      date_of_birth: person.date_of_birth ? new Date(decryptField(person.date_of_birth, orgId) as string).toLocaleDateString('en-GB') : 'Unknown',
      dietary_type: person.dietary_type || 'Standard',
      texture_modified: person.texture_modified || 'None',
      vegetarian: person.vegetarian ? 'Yes' : 'No',
      vegan: person.vegan ? 'Yes' : 'No',
      halal: person.halal ? 'Yes' : 'No',
      kosher: person.kosher ? 'Yes' : 'No',
      gluten_free: person.gluten_free ? 'Yes' : 'No',
      dairy_free: person.dairy_free ? 'Yes' : 'No',
      nut_allergy: person.nut_allergy ? 'Yes' : 'No',
      other_allergies: person.other_allergies || 'None noted',
      food_preferences: person.food_preferences || 'No specific preferences noted',
      food_dislikes: person.food_dislikes || 'No dislikes noted',
      appetite_level: person.appetite_level || 'Good',
      eating_abilities: person.eating_abilities || 'Independent',
      fluid_target_ml: String(person.fluid_daily_target_ml || 2000),
      additional_notes: person.additional_notes || 'None',
      meal_type: mealType || 'lunch',
      day_of_week: dayOfWeek || new Date().toLocaleDateString('en-US', { weekday: 'long' }),
      special_requirements: specialRequirements || 'None',
    }, orgId);

    const start = Date.now();
    try {
      const provider = getProvider(config);
      const result = await provider.chatCompletion(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        { model: config.model, temperature: 0.4, maxTokens: 2000 }
      );

      let parsed;
      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: result.content };
      } catch {
        parsed = { raw: result.content };
      }

      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'meal_plan_generation',
          promptKey: 'meal_plan_generation',
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          model: config.model,
          provider: provider.name,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
          requestData: { personId, mealType, dayOfWeek },
          responseSummary: typeof parsed === 'object' && parsed.plan_name ? `${parsed.plan_name} - ${Object.keys(parsed.daily_plan || {}).length} meals` : 'Meal plan generated',
        });
      } catch { /* audit non-critical */ }

      res.json({ mealPlan: { ...parsed, generated_by_ai: true, ai_model: config.model, ai_generated_at: new Date().toISOString() }, usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens } });
    } catch (err: any) {
      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'meal_plan_generation',
          promptKey: 'meal_plan_generation',
          success: false,
          errorMessage: err.message,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
        });
      } catch { /* audit non-critical */ }
      logger.error(err, 'AI meal plan generation failed');
      res.status(500).json({ error: { message: 'AI meal plan generation failed' } });
    }
  }

  static async generateWeeklyMealPlan(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured. Configure AI provider in Settings first.' } });
    }
    if (!config.enabledFeatures?.includes('meal_plan_generation')) {
      return res.status(403).json({ error: { message: 'Meal Plan Generation is not enabled for your organization.' } });
    }

    const { personId, specialRequirements } = req.body;
    const pool = (await import('../../shared/database')).default;

    const personResult = await pool.query(
      `SELECT p.*, dp.dietary_type, dp.texture_modified, dp.vegetarian, dp.vegan,
              dp.halal, dp.kosher, dp.gluten_free, dp.dairy_free, dp.nut_allergy,
              dp.other_allergies, dp.food_preferences, dp.food_dislikes,
              dp.fluid_daily_target_ml, dp.appetite_level, dp.eating_abilities,
              dp.additional_notes
       FROM people p
       LEFT JOIN dietary_profiles dp ON dp.person_id = p.id
       WHERE p.id = $1 AND p.organization_id = $2`,
      [personId, orgId]
    );

    if (personResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Person not found' } });
    }

    const person = personResult.rows[0];
    const { system, user } = await renderOrgPrompt('weekly_meal_plan', {
      person_name: `${person.first_name} ${person.last_name}`,
      date_of_birth: person.date_of_birth ? new Date(decryptField(person.date_of_birth, orgId) as string).toLocaleDateString('en-GB') : 'Unknown',
      dietary_type: person.dietary_type || 'Standard',
      texture_modified: person.texture_modified || 'None',
      vegetarian: person.vegetarian ? 'Yes' : 'No',
      vegan: person.vegan ? 'Yes' : 'No',
      halal: person.halal ? 'Yes' : 'No',
      kosher: person.kosher ? 'Yes' : 'No',
      gluten_free: person.gluten_free ? 'Yes' : 'No',
      dairy_free: person.dairy_free ? 'Yes' : 'No',
      nut_allergy: person.nut_allergy ? 'Yes' : 'No',
      other_allergies: person.other_allergies || 'None noted',
      food_preferences: person.food_preferences || 'No specific preferences',
      food_dislikes: person.food_dislikes || 'No dislikes noted',
      appetite_level: person.appetite_level || 'Good',
      eating_abilities: person.eating_abilities || 'Independent',
      fluid_target_ml: String(person.fluid_daily_target_ml || 2000),
      additional_notes: person.additional_notes || 'None',
    }, orgId);

    const start = Date.now();
    try {
      const provider = getProvider(config);
      const result = await provider.chatCompletion(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        { model: config.model, temperature: 0.4, maxTokens: 4000 }
      );

      let parsed;
      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: result.content };
      } catch {
        parsed = { raw: result.content };
      }

      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'meal_plan_generation',
          promptKey: 'weekly_meal_plan',
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          model: config.model,
          provider: provider.name,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
          requestData: { personId },
          responseSummary: typeof parsed === 'object' && parsed.plan_name ? `Weekly plan: ${parsed.plan_name}` : 'Weekly plan generated',
        });
      } catch { /* audit non-critical */ }

      res.json({ weeklyPlan: { ...parsed, generated_by_ai: true, ai_model: config.model, ai_generated_at: new Date().toISOString() }, usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens } });
    } catch (err: any) {
      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'meal_plan_generation',
          promptKey: 'weekly_meal_plan',
          success: false,
          errorMessage: err.message,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
        });
      } catch { /* audit non-critical */ }
      logger.error(err, 'AI weekly meal plan generation failed');
      res.status(500).json({ error: { message: 'AI weekly meal plan generation failed' } });
    }
  }

  static async generateShoppingList(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured. Configure AI provider in Settings first.' } });
    }
    if (!config.enabledFeatures?.includes('meal_plan_generation')) {
      return res.status(403).json({ error: { message: 'Meal Plan Generation is not enabled for your organization.' } });
    }

    const { weeklyPlan, personName, dietarySummary, allergens, textureModification } = req.body;
    if (!weeklyPlan) {
      return res.status(400).json({ error: { message: 'Weekly plan data required' } });
    }

    const { system, user } = await renderOrgPrompt('shopping_list_generation', {
      person_name: personName || 'Unknown',
      dietary_summary: dietarySummary || 'Standard',
      allergens: allergens || 'None noted',
      texture_modification: textureModification || 'None',
      weekly_plan_data: JSON.stringify(weeklyPlan, null, 2),
    }, orgId);

    const start = Date.now();
    try {
      const provider = getProvider(config);
      const result = await provider.chatCompletion(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        { model: config.model, temperature: 0.3, maxTokens: 3000 }
      );

      let parsed;
      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: result.content };
      } catch {
        parsed = { raw: result.content };
      }

      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'meal_plan_generation',
          promptKey: 'shopping_list_generation',
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          model: config.model,
          provider: provider.name,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
          requestData: { personName },
          responseSummary: typeof parsed === 'object' && parsed.shopping_list ? `Shopping list: ${parsed.shopping_list.total_items || 0} items` : 'Shopping list generated',
        });
      } catch { /* audit non-critical */ }

      res.json({ shoppingList: { ...parsed, generated_by_ai: true, ai_model: config.model, ai_generated_at: new Date().toISOString() }, usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens } });
    } catch (err: any) {
      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'meal_plan_generation',
          promptKey: 'shopping_list_generation',
          success: false,
          errorMessage: err.message,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
        });
      } catch { /* audit non-critical */ }
      logger.error(err, 'AI shopping list generation failed');
      res.status(500).json({ error: { message: 'AI shopping list generation failed' } });
    }
  }

  /** POST /ai/daily-notes/:noteId/care-plan-gap — compare a visit note against care plan + nutrition */
  static async analyzeCarePlanGap(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization required' } });

    const pool = (await import('../../shared/database')).default;
    const { noteId } = req.params;

    const noteResult = await pool.query(
      `SELECT n.*, p.first_name, p.last_name, p.id as person_id
       FROM daily_notes n JOIN people p ON p.id = n.person_id
       WHERE n.id = $1 AND p.organization_id = $2`,
      [noteId, orgId]
    );
    if (noteResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Note not found' } });
    }
    const note = noteResult.rows[0];

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured' } });
    }

    const [carePlans, dietaryProfile, recentNutrition] = await Promise.all([
      pool.query('SELECT title, goals, review_date FROM care_plans WHERE person_id = $1 AND status = $2', [note.person_id, 'active']),
      pool.query('SELECT allergies, dietary_requirements, texture_modified, favourite_foods, disliked_foods, cultural_preferences FROM dietary_profiles WHERE person_id = $1', [note.person_id]),          pool.query(`SELECT meal_type, date, consumed_percentage, fluid_ml, appetite_level, refused, notes
        FROM nutrition_records WHERE person_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days' ORDER BY date DESC`, [note.person_id]),
    ]);

    const { system, user: userTemplate } = await renderOrgPrompt('visit_note_care_plan_gap', {}, orgId);
    const userPrompt = userTemplate
      .replace('{{care_plan}}', carePlans.rows.map((cp: any) => `${cp.title}: ${cp.goals || 'No goals recorded'}`).join('\n') || 'No active care plans')
      .replace('{{visit_note}}', note.content)
      .replace('{{dietary_profile}}', dietaryProfile.rows[0]
        ? `Allergies: ${dietaryProfile.rows[0].allergies || 'None'}\nDietary: ${dietaryProfile.rows[0].dietary_requirements || 'None'}\nTexture: ${dietaryProfile.rows[0].texture_modified || 'Normal'}\nPreferences: ${dietaryProfile.rows[0].favourite_foods || 'None'}`
        : 'No dietary profile on file')
      .replace('{{recent_nutrition}}', recentNutrition.rows.map((r: any) =>
        `${r.date} ${r.meal_type}: ${r.consumed_percentage || '?'}% consumed, ${r.fluid_ml || 0}ml fluid, appetite ${r.appetite_level || 'unknown'}${r.refused ? ' (REFUSED)' : ''}`
      ).join('\n') || 'No nutrition records in last 7 days');

    const start = Date.now();
    try {
      const provider = getProvider(config);
      const result = await provider.chatCompletion(
        [{ role: 'system', content: system }, { role: 'user', content: userPrompt }],
        { model: config.model, temperature: 0.3, maxTokens: 1500 }
      );

      let parsed: any;
      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: result.content, gaps: [], nutrition_flags: [], audit_risk: 'unknown' };
      } catch {
        parsed = { summary: result.content, gaps: [], nutrition_flags: [], audit_risk: 'unknown' };
      }

      await AIRepository.logAudit({
        organizationId: orgId, feature: 'care_plan_gap_analysis', promptKey: 'visit_note_care_plan_gap',
        success: true, promptTokens: result.promptTokens, completionTokens: result.completionTokens,
        totalTokens: result.totalTokens, model: config.model, provider: provider.name,
        durationMs: Date.now() - start, createdBy: req.user?.userId,
        requestData: { noteId, personId: note.person_id },
        responseSummary: `Risk: ${parsed.audit_risk}, Gaps: ${parsed.gaps?.length || 0}, Nutrition flags: ${parsed.nutrition_flags?.length || 0}`,
      });

      res.json({ analysis: { ...parsed, generated_by_ai: true, ai_model: config.model, ai_generated_at: new Date().toISOString() }, usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens } });
    } catch (err: any) {
      logger.error(err, 'Care plan gap analysis failed');
      res.status(500).json({ error: { message: 'Care plan gap analysis failed' } });
    }
  }

  /** POST /ai/competency/generate-questions — generate assessment questions from a CQC statement */
  static async generateCompetencyQuestions(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization required' } });

    const { cqcStatement, role, area } = req.body;
    if (!cqcStatement || !role || !area) {
      return res.status(400).json({ error: { message: 'cqcStatement, role, and area are required' } });
    }

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured' } });
    }

    const { system, user: userTemplate } = await renderOrgPrompt('competency_assessment_assistant', {}, orgId);
    const userPrompt = userTemplate
      .replace('{{cqc_statement}}', cqcStatement)
      .replace('{{role}}', role)
      .replace('{{area}}', area);

    const start = Date.now();
    try {
      const provider = getProvider(config);
      const result = await provider.chatCompletion(
        [{ role: 'system', content: system }, { role: 'user', content: userPrompt }],
        { model: config.model, temperature: 0.4, maxTokens: 2000 }
      );

      let parsed: any;
      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { questions: [], cqc_statement: cqcStatement };
      } catch {
        parsed = { questions: [], cqc_statement: cqcStatement };
      }

      await AIRepository.logAudit({
        organizationId: orgId, feature: 'competency_assessment_assistant', promptKey: 'competency_assessment_assistant',
        success: true, promptTokens: result.promptTokens, completionTokens: result.completionTokens,
        totalTokens: result.totalTokens, model: config.model, provider: provider.name,
        durationMs: Date.now() - start, createdBy: req.user?.userId,
        requestData: { cqcStatement, role, area },
        responseSummary: `Generated ${parsed.questions?.length || 0} questions for ${area}`,
      });

      res.json({ questions:(parsed.questions||[]).map((q:any)=>({...q,generated_by_ai:true})),cqcStatement:parsed.cqc_statement||cqcStatement,generated_by_ai:true,ai_model:config.model,ai_generated_at:new Date().toISOString(),usage:{promptTokens:result.promptTokens,completionTokens:result.completionTokens}});
    } catch (err: any) {
      logger.error(err, 'Competency question generation failed');
      res.status(500).json({ error: { message: 'Competency question generation failed' } });
    }
  }

  /**
   * Shared, source-linked intelligence surface. Each route selects one capability
   * while the data boundary and the mechanism remain identical — see
   * `ai.capabilities.ts` for why the routes are named for the entry point rather
   * than the eleven distinct features the naming used to imply.
   */
  static async intelligence(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    const userId = req.user?.userId;
    if (!orgId || !userId) return res.status(400).json({ error: { message: 'Organization and user required' } });

    const capability = CAPABILITY_BY_PATH[req.path] || 'manager_briefing';
    const capabilityMeta = getCapability(capability);
    // Resolved once here and passed down as an override, because the response
    // has to report what actually crossed the boundary. Letting renderOrgPrompt
    // resolve it independently would mean the reported value and the applied
    // value came from two reads, which can disagree if a manager saves the
    // setting mid-request — and the report would then be the one that is wrong.
    const minimisation = await resolveAiMinimisation(orgId);
    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) return res.status(400).json({ error: { message: 'AI not configured. Configure AI provider in Settings first.' } });
    if (!config.enabledFeatures?.includes(capability)) return res.status(403).json({ error: { message: `${capability} is not enabled for your organization.` } });

    // This route runs after rlsMiddleware; tenant queries must use the ALS
    // scoped helper rather than the privileged database pool.
    const { query: tenantQuery } = await import('../../shared/database');
    const today = new Date().toISOString().slice(0, 10);
    const windowDays = ['7', '14', '30'].includes(String(req.body.window)) ? Number(req.body.window) : 7;
    const from = req.body.from || (capability === 'end_of_day_intelligence' ? today : new Date(Date.now() - (windowDays - 1) * 86400000).toISOString().slice(0, 10));
    const to = req.body.to || today;
    const personId = req.body.personId;
    const question = req.body.question || '';
    if (from > to) return res.status(400).json({ error: { message: 'from must be on or before to' } });
    if (['care_summary', 'family_communication_draft'].includes(capability) && !personId) return res.status(400).json({ error: { message: 'personId is required for this capability' } });

    try {
      const personFilter = personId ? ' AND p.id = $4' : '';
      const params = personId ? [orgId, from, to, personId] : [orgId, from, to];
      const [visits, notes, incidents, training] = await Promise.all([
        tenantQuery(`SELECT v.id, v.status, v.label, v.scheduled_start, v.scheduled_end, p.id AS person_id, p.first_name || ' ' || p.last_name AS person_name
          FROM homecare_visits v JOIN people p ON p.id = v.person_id
          WHERE v.organization_id = $1 AND v.scheduled_start::date BETWEEN $2::date AND $3::date${personFilter}
          ORDER BY v.scheduled_start LIMIT 500`, params),
        tenantQuery(`SELECT n.id, n.note_date, n.category, LEFT(n.content, 600) AS content, p.id AS person_id, p.first_name || ' ' || p.last_name AS person_name
          FROM daily_notes n JOIN people p ON p.id = n.person_id
          WHERE p.organization_id = $1 AND n.note_date BETWEEN $2::date AND $3::date${personFilter}
          ORDER BY n.note_date DESC, n.created_at DESC LIMIT 300`, params),
        tenantQuery(`SELECT DISTINCT i.id, i.title, i.severity, i.status, i.incident_date, LEFT(i.description, 500) AS description, iir.person_id
          FROM incidents i LEFT JOIN incident_involved_residents iir ON iir.incident_id = i.id
          WHERE i.organization_id = $1 AND i.incident_date BETWEEN $2::date AND $3::date
            AND ($4::uuid IS NULL OR iir.person_id = $4)
          ORDER BY i.incident_date DESC LIMIT 300`, [orgId, from, to, personId || null]),
        tenantQuery(`SELECT tr.id, tm.name AS module_name, tr.status, tr.expires_at, sp.first_name || ' ' || sp.last_name AS staff_name
          FROM training_records tr JOIN training_modules tm ON tm.id = tr.module_id JOIN staff_profiles sp ON sp.id = tr.staff_id
          JOIN users u ON u.id = sp.user_id WHERE u.organization_id = $1 AND (tr.expires_at BETWEEN $2::date AND $3::date OR tr.status = 'expired') LIMIT 200`, [orgId, from, to]),
      ]);

      const records = [
        ...visits.rows.map((r: any) => ({ source_type: 'homecare_visit', source_id: String(r.id), ...r })),
        ...notes.rows.map((r: any) => ({ source_type: 'daily_note', source_id: String(r.id), ...r })),
        ...incidents.rows.map((r: any) => ({ source_type: 'incident', source_id: String(r.id), ...r })),
        ...(capability === 'compliance_copilot' || capability === 'competency_coaching' ? training.rows.map((r: any) => ({ source_type: 'training_record', source_id: String(r.id), ...r })) : []),
      ];

      if (['change_detection', 'risk_signals', 'operational_anomaly_detection', 'care_summary'].includes(capability)) {
        const medication = await tenantQuery(`SELECT a.id, a.status, a.scheduled_time, a.administered_time, a.notes, i.name AS medication_name, r.person_id
          FROM emedication_administrations a JOIN emedication_items i ON i.id = a.emedication_item_id
          JOIN emedication_records r ON r.id = i.emedication_record_id
          WHERE r.organization_id = $1 AND a.scheduled_time::date BETWEEN $2::date AND $3::date
            AND ($4::uuid IS NULL OR r.person_id = $4) ORDER BY a.scheduled_time DESC LIMIT 300`, [orgId, from, to, personId || null]);
        records.push(...medication.rows.map((r: any) => ({ source_type: 'medication_administration', source_id: String(r.id), ...r })));
      }

      if (capability === 'compliance_copilot' || capability === 'operational_anomaly_detection') {
        const [risks, actions, competencies] = await Promise.all([
          tenantQuery(`SELECT ra.id, ra.type, ra.risk_level, ra.review_date, LEFT(ra.details, 400) AS details, ra.person_id
            FROM risk_assessments ra JOIN people p ON p.id = ra.person_id
            WHERE p.organization_id = $1 AND (ra.review_date BETWEEN $2::date AND $3::date OR ra.review_date < CURRENT_DATE)
            LIMIT 200`, [orgId, from, to]),
          tenantQuery(`SELECT ia.id, ia.incident_id, ia.action, ia.due_date, ia.status
            FROM incident_actions ia JOIN incidents i ON i.id = ia.incident_id
            WHERE i.organization_id = $1 AND (ia.due_date BETWEEN $2::date AND $3::date OR (ia.due_date < CURRENT_DATE AND ia.status != 'completed'))
            LIMIT 200`, [orgId, from, to]),
          tenantQuery(`SELECT ca.id, ca.staff_id, ca.passed, ca.assessed_at, ca.reassessment_date, ct.name AS competency_name
            FROM competency_assessments ca JOIN competency_templates ct ON ct.id = ca.template_id
            WHERE ct.organization_id = $1 AND (ca.reassessment_date BETWEEN $2::date AND $3::date OR ca.reassessment_date < CURRENT_DATE OR ca.passed = false)
            LIMIT 200`, [orgId, from, to]),
        ]);
        records.push(...risks.rows.map((r: any) => ({ source_type: 'risk_assessment', source_id: String(r.id), ...r })));
        records.push(...actions.rows.map((r: any) => ({ source_type: 'incident_action', source_id: String(r.id), ...r })));
        records.push(...competencies.rows.map((r: any) => ({ source_type: 'competency_assessment', source_id: String(r.id), ...r })));
      }

      if (capability === 'rota_alternatives') {
        const shifts = await tenantQuery(`SELECT s.id, s.start_time, s.end_time, s.status, s.shift_type, l.name AS location_name
          FROM shifts s JOIN locations l ON l.id = s.location_id
          WHERE l.organization_id = $1 AND s.start_time::date BETWEEN $2::date AND $3::date
          ORDER BY s.start_time LIMIT 300`, [orgId, from, to]);
        records.push(...shifts.rows.map((r: any) => ({ source_type: 'shift', source_id: String(r.id), ...r })));
      }

      if (capability === 'family_communication_draft' && personId) {
        const family = await tenantQuery(`SELECT id, name, relationship, email FROM family_contacts WHERE person_id = $1`, [personId]);
        // `email` is an encrypted `family_contacts` column; decrypted here because
        // it is about to be summarised into a draft that leaves the process.
        const familyRows = decryptRowsForOrg('family_contacts', family.rows, orgId);
        records.push(...familyRows.map((r: any) => ({ source_type: 'family_contact', source_id: String(r.id), ...r })));
      }
      const sourceIds = records.map((r: any) => ({ type: r.source_type, id: r.source_id, url: sourceUrl(r.source_type, r.source_id, r) })).filter((source: any) => source.url);
      const sourceUrlByKey = new Map(records.map((r: any) => [`${r.source_type}:${r.source_id}`, sourceUrl(r.source_type, r.source_id, r)]));
      const withSourceUrl = (item: any) => ({ ...item, source_url: sourceUrlByKey.get(`${item.source_type}:${item.source_id}`) });
      const deterministicItems: any[] = [];
      if (capability === 'change_detection') {
        const midpoint = new Date(`${from}T00:00:00Z`).getTime() + (new Date(`${to}T23:59:59Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 2;
        const before = records.filter((r: any) => new Date(r.note_date || r.incident_date || r.scheduled_start || r.expires_at || 0).getTime() <= midpoint).length;
        const after = records.length - before;
        deterministicItems.push(...records.filter((r: any) => r.source_type === 'incident' || r.status === 'missed' || r.status === 'overdue').slice(0, 20).map((r: any) => withSourceUrl({ title: 'Record may need review', detail: `The source record is marked ${r.status || r.severity || 'noted'}.`, priority: r.severity === 'critical' || r.status === 'missed' ? 'high' : 'medium', source_type: r.source_type, source_id: r.source_id })));
        if (before !== after && records[0]) deterministicItems.push(withSourceUrl({ title: 'Record volume changed across the period', detail: `There are ${before} records in the earlier half and ${after} in the later half. This is a signal for review, not a conclusion.`, priority: 'low', source_type: records[0].source_type, source_id: records[0].source_id }));
      }
      if (capability === 'risk_signals') {
        deterministicItems.push(...records.filter((r: any) => r.source_type === 'incident' || ['missed', 'overdue'].includes(r.status)).slice(0, 30).map((r: any) => withSourceUrl({ title: r.source_type === 'incident' ? `Incident: ${r.title}` : `Visit status: ${r.status}`, detail: 'This operational record may require human review.', priority: r.severity === 'critical' || r.status === 'missed' ? 'high' : 'medium', source_type: r.source_type, source_id: r.source_id })));
      }
      if (capability === 'compliance_copilot') {
        deterministicItems.push(...records.filter((r: any) => ['training_record', 'risk_assessment', 'incident_action', 'competency_assessment'].includes(r.source_type) || r.status === 'expired').slice(0, 50).map((r: any) => withSourceUrl({ title: `${r.source_type.replace(/_/g, ' ')} may need attention`, detail: r.staff_name ? `${r.staff_name} — ${r.module_name || r.competency_name || 'record'} is ${r.status || (r.passed === false ? 'not passed' : 'due for review')}.` : (r.action || r.details || 'Review this source record.'), priority: r.status === 'expired' || r.passed === false ? 'high' : 'medium', source_type: r.source_type, source_id: r.source_id })));
      }
      if (['domiciliary_operations_copilot', 'operational_anomaly_detection'].includes(capability)) {
        deterministicItems.push(...records.filter((r: any) => r.status === 'missed' || r.status === 'overdue' || r.source_type === 'incident_action' || r.source_type === 'medication_administration').slice(0, 50).map((r: any) => withSourceUrl({ title: 'Operational pattern may need attention', detail: r.source_type === 'medication_administration' ? `${r.medication_name || 'Medication'} administration is ${r.status}.` : (r.action || `Source record is marked ${r.status || 'noted'}.`), priority: ['missed', 'overdue', 'refused'].includes(r.status) ? 'high' : 'medium', source_type: r.source_type, source_id: r.source_id })));
      }
      const { system, user } = await renderOrgPrompt('unified_intelligence', { capability, from, to, question, audience: req.body.audience || 'internal manager', tone: req.body.tone || 'professional and cautious', records: JSON.stringify(records) }, orgId, [], minimisation);
      const start = Date.now();
      const result = await aiCall(orgId, config, [{ role: 'system', content: system }, { role: 'user', content: user }], { model: config.model, temperature: 0.2, maxTokens: 2200 });
      const validated = (await import('./ai.schemas')).validateAIResponse((await import('./ai.schemas')).IntelligenceResponseSchema, result.content, 'Intelligence response');
      const parsed = validated.data || { headline: capabilityMeta.label, summary: 'The AI response could not be validated. Review the source records directly.', items: [], suggested_follow_up: [], limitations: [validated.error || 'Validation failed'] };
      const items = [...deterministicItems, ...parsed.items.map((item: any) => ({ ...item, source_url: sourceUrlByKey.get(`${item.source_type}:${item.source_id}`) }))].filter((item, index, all) => all.findIndex(other => other.source_type === item.source_type && other.source_id === item.source_id) === index).slice(0, 50);
      await AIRepository.logAudit({ organizationId: orgId, feature: capability, promptKey: 'unified_intelligence', promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens, model: config.model, provider: result.provider, durationMs: Date.now() - start, createdBy: userId, requestData: { from, to, windowDays, personId, question, sourceIds }, responseSummary: parsed.headline });
      res.json({
        capability,
        // The honest name and a plain statement of the mechanism, returned on
        // every response. A customer's own security review should be able to
        // read the same claim out of this JSON that the interface makes, rather
        // than inferring eleven separate features from eleven route names.
        capability_meta: {
          label: capabilityMeta.label,
          summary: capabilityMeta.summary,
          entry_point: capabilityMeta.entryPoint,
        },
        method: AI_METHOD_DISCLOSURE,
        data_boundary: {
          direct_identifiers_removed: true,
          clinical_narrative: minimisation === 'minimal' ? 'withheld' : 'included',
          ai_data_minimisation: minimisation,
          // True when this capability is materially degraded by minimisation.
          // Surfaced so a manager who turned the setting on learns which of
          // their features it quietly weakened, instead of finding out from
          // output quality weeks later.
          narrative_dependent: capabilityMeta.requiresNarrative,
        },
        result: { ...parsed, items, generated_by_ai: true, ai_model: config.model, ai_generated_at: new Date().toISOString() },
        sources: sourceIds,
        period: { from, to },
        counts: { visits: visits.rowCount, notes: notes.rowCount, incidents: incidents.rowCount, training: training.rowCount },
      });
    } catch (err: any) {
      await AIRepository.logAudit({ organizationId: orgId, feature: capability, promptKey: 'unified_intelligence', success: false, errorMessage: err.message, createdBy: userId, requestData: { from, to, personId, question } }).catch(() => {});
      logger.error(err, `AI ${capability} failed`);
      res.status(500).json({ error: { message: `${capabilityMeta.label} failed` } });
    }
  }
}
