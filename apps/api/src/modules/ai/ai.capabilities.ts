/**
 * What the intelligence surface actually is.
 *
 * Eleven routes, one implementation. Every one of them calls
 * `AIController.intelligence`, which runs a handful of date-bounded SQL queries
 * over visits, notes, incidents, medication and training, `JSON.stringify`s the
 * rows, and asks a language model to summarise them. The only thing that varies
 * is a capability string, which changes which optional query is included and
 * which prompt template is selected.
 *
 * That is worth stating precisely, because the route names implied more than
 * that. "Anomaly detection" and "change detection" are the two that would
 * mislead an assessor: both names describe a *model* — a baseline, a deviation
 * from expected, a learned threshold — and neither exists. What runs is a
 * SELECT with date bounds and a summariser. There is no statistical detection,
 * no time-series comparison, and no baseline of any kind.
 *
 * The claim is not "this is a useless feature" and this file does not say it is.
 * A manager asking "what changed in these records this week" over a bounded,
 * source-linked set of rows is a real need and this answers it usefully. The
 * problem is only that "anomaly detection" describes a capability that is not
 * implemented, and an experienced assessor will find that out with one query,
 * because there is nothing underneath the name to find. The fix is not to
 * downgrade the product's ambition in the copy; it is to describe the mechanism
 * accurately and let the usefulness stand on its own.
 *
 * `id` is frozen and must not be renamed. These strings are feature-flag keys in
 * every existing organisation's `enabledFeatures` array and in the AI audit log,
 * so renaming one would silently disable a capability a customer had switched on.
 */

export type AiCapabilityId =
  | 'care_summary'
  | 'change_detection'
  | 'risk_signals'
  | 'compliance_copilot'
  | 'natural_language_assistant'
  | 'end_of_day_intelligence'
  | 'domiciliary_operations_copilot'
  | 'operational_anomaly_detection'
  | 'rota_alternatives'
  | 'competency_coaching'
  | 'family_communication_draft'
  | 'manager_briefing';

export type AiCapability = {
  /** Frozen feature-flag and audit-log key. Never rename — see the note above. */
  id: AiCapabilityId;
  /** The route this capability is reached on. */
  entryPoint: string;
  /** What the surface is called in the interface. Describes the action, not a model. */
  label: string;
  /** One line on what actually runs. Shown in the UI, so it is user-facing copy. */
  summary: string;
  /**
   * The prompt template this capability renders. Published verbatim at
   * GET /ai/prompts so a customer's security review can read the actual
   * instructions the model receives — the honest-mechanism argument only
   * holds if the instructions are inspectable, not just described.
   * Every intelligence capability shares `unified_intelligence`; that is the
   * point, and publishing the list makes the sharing visible instead of
   * deniable.
   */
  promptKey: string;
  /**
   * Whether this capability needs clinical narrative to be useful. Used to warn
   * a manager who has switched on minimisation mode that they have degraded it.
   */
  requiresNarrative: boolean;

  /**
   * The exact data classes this capability sends to the LLM provider, and which
   * field carries each. Sourced from the controller's actual queries — see
   * AIController.intelligence / managerBriefing / generateDailyNote / etc.
   * Rendered verbatim in Settings → AI as the per-toggle disclosure, so the
   * description a manager reads IS the mechanism, not a description of it.
   *
   * Claimed in `identifierFields`: what carries a real person's name in the
   * clear, when minimisation does NOT withhold it (it pseudonymises narrative
   * names via ai.redaction but leaves coded facts — status, medication name —
   * intact). Accurate disclosure must say which fields those are.
   */
  dataClasses: ReadonlyArray<{
    /** Machine-readable class name — the drift-guard test keys off this. */
    type: string;
    /** Human line for the Settings disclosure, no jargon. */
    label: string;
    /** The prompt variable(s) carrying this data in the rendered prompt. */
    promptVar: string;
  }>;
  /**
   * Which prompt variables carry identifiers that survive minimisation
   * (i.e. names that reappear in output). Empty when pseudonymised upstream.
   */
  identifierFields: readonly string[];
};

/**
 * One mechanism, stated once and returned with every response.
 *
 * Machine-readable rather than only prose, so a customer's own security review
 * — or an endorsing body — can read the same claim out of the JSON that the
 * interface makes, instead of taking the marketing copy's word for it.
 */
export const AI_METHOD_DISCLOSURE = {
  method: 'dated_record_query_plus_language_model_summary' as const,
  appliesStatisticalDetection: false,
  hasLearnedBaseline: false,
  hasTimeSeriesComparison: false,
  description:
    'Records are selected with date and status filters, then summarised in prose by a language model. ' +
    'There is no statistical model, no learned baseline and no time-series comparison: every item shown ' +
    'is a record that met the same filters a manager could apply by hand.',
} as const;

export const AI_CAPABILITIES: Record<AiCapabilityId, AiCapability> = {
  care_summary: {
    id: 'care_summary',
    entryPoint: '/care-summary',
    label: 'Care record summary',
    summary: 'A written summary of the care records for one person over a period you choose.',
    promptKey: 'unified_intelligence',
    requiresNarrative: true,
    dataClasses: [
      { type: 'homecare_visit', label: 'Visits (status, type, times, person name)', promptVar: 'records' },
      { type: 'daily_note', label: 'Daily notes (up to 600 chars of content, date, category)', promptVar: 'records' },
      { type: 'incident', label: 'Incidents (title, description up to 500 chars, severity, status)', promptVar: 'records' },
      { type: 'medication_administration', label: 'Medication administrations (medicine name, status, times, notes)', promptVar: 'records' },
    ],
    identifierFields: ['records.person_name'],
  },  change_detection: {
    id: 'change_detection',
    entryPoint: '/change-detection',
    label: 'Record change summary',
    summary:
      'A comparison of records across two periods. It surfaces what the filters returned, not changes '
      + 'a system inferred — nothing is learned from your history.',
    promptKey: 'unified_intelligence',
    requiresNarrative: true,
    dataClasses: [
      { type: 'homecare_visit', label: 'Visits (status, type, times, person name)', promptVar: 'records' },
      { type: 'daily_note', label: 'Daily notes (up to 600 chars of content, date, category)', promptVar: 'records' },
      { type: 'incident', label: 'Incidents (title, description up to 500 chars, severity, status)', promptVar: 'records' },
      { type: 'medication_administration', label: 'Medication administrations (medicine name, status, times, notes)', promptVar: 'records' },
    ],
    identifierFields: ['records.person_name'],
  },  risk_signals: {
    id: 'risk_signals',
    entryPoint: '/risk-signals',
    label: 'Record-derived risk summary',
    summary:
      'A written summary of the incidents, notes and medication events in a period, each linked to the '
      + 'record it came from. It is a reading of the records, not a risk score.',
    promptKey: 'unified_intelligence',
    requiresNarrative: true,
    dataClasses: [
      { type: 'homecare_visit', label: 'Visits (status, type, times, person name)', promptVar: 'records' },
      { type: 'daily_note', label: 'Daily notes (up to 600 chars of content, date, category)', promptVar: 'records' },
      { type: 'incident', label: 'Incidents (title, description up to 500 chars, severity, status)', promptVar: 'records' },
      { type: 'medication_administration', label: 'Medication administrations (medicine name, status, times, notes)', promptVar: 'records' },
    ],
    identifierFields: ['records.person_name'],
  },  compliance_copilot: {
    id: 'compliance_copilot',
    entryPoint: '/compliance-copilot',
    label: 'Compliance gap summary',
    summary:
      'A written explanation of the compliance gaps already computed for your organisation, with the '
      + 'underlying records linked.',
    promptKey: 'unified_intelligence',
    requiresNarrative: false,
    dataClasses: [
      { type: 'homecare_visit', label: 'Visits (status, type, times, person name)', promptVar: 'records' },
      { type: 'daily_note', label: 'Daily notes (up to 600 chars of content, date, category)', promptVar: 'records' },
      { type: 'incident', label: 'Incidents (title, description up to 500 chars, severity, status)', promptVar: 'records' },
      { type: 'training_record', label: 'Training records (module, status, expiry, staff name)', promptVar: 'records' },
      { type: 'risk_assessment', label: 'Risk assessments (type, level, up to 400 chars of details, review date)', promptVar: 'records' },
      { type: 'incident_action', label: 'Incident actions (text, due date, status)', promptVar: 'records' },
      { type: 'competency_assessment', label: 'Competency assessments (name, pass status, dates, staff id)', promptVar: 'records' },
    ],
    identifierFields: ['records.person_name', 'records.staff_name'],
  },
  natural_language_assistant: {
    id: 'natural_language_assistant',
    entryPoint: '/assistant',
    label: 'Ask about your records',
    summary: 'Answers a question in plain English against the records in the period you select: staff on shift, who '
      + 'supports a person, appointments, incidents, the medication round (including overdue doses and medicines '
      + 'running low), expiring training and leave balances.',
    promptKey: 'unified_intelligence',
    requiresNarrative: true,
    // What the Mica question-answering tool loop can fetch and pass to the
    // model. Real names in tool results are pseudonymised before the model
    // sees them (mica.tools.ts header), so identifierFields is empty — the
    // pseudonymisation is what carries the claim, not a field edit.
    dataClasses: [
      { type: 'staff_on_shift', label: 'Shifts and who is on them (staff names, locations, times)', promptVar: 'tool_results' },
      { type: 'person_support', label: 'Who supports a person (person and carer names, visit times)', promptVar: 'tool_results' },
      { type: 'appointments', label: 'Appointments (title, times, staff and person names)', promptVar: 'tool_results' },
      { type: 'incidents', label: 'Incidents (title, severity, status, date)', promptVar: 'tool_results' },
      { type: 'medication_round', label: 'Medication round (medicine names, statuses, times)', promptVar: 'tool_results' },
      { type: 'expiring_training', label: 'Expiring training (module, staff name, expiry date)', promptVar: 'tool_results' },
      { type: 'leave_balances', label: 'Leave balances (staff name, entitlement, taken, remaining)', promptVar: 'tool_results' },
    ],
    identifierFields: [],
  },
  end_of_day_intelligence: {
    id: 'end_of_day_intelligence',
    entryPoint: '/end-of-day',
    label: 'End-of-day activity summary',
    summary: 'A summary of the day’s visits, notes and incidents.',
    promptKey: 'unified_intelligence',
    requiresNarrative: true,
    dataClasses: [
      { type: 'homecare_visit', label: 'Visits today (status, type, times, person name)', promptVar: 'records' },
      { type: 'daily_note', label: 'Daily notes today (up to 600 chars of content)', promptVar: 'records' },
      { type: 'incident', label: 'Incidents today (title, description up to 500 chars, severity)', promptVar: 'records' },
    ],
    identifierFields: ['records.person_name'],
  },
  domiciliary_operations_copilot: {
    id: 'domiciliary_operations_copilot',
    entryPoint: '/operations-copilot',
    label: 'Operational activity summary',
    summary: 'A written summary of operational records in the period, with each item linked to its source.',
    promptKey: 'unified_intelligence',
    requiresNarrative: false,
    dataClasses: [
      { type: 'homecare_visit', label: 'Visits (status, type, times, person name)', promptVar: 'records' },
      { type: 'daily_note', label: 'Daily notes (up to 600 chars of content, date, category)', promptVar: 'records' },
      { type: 'incident', label: 'Incidents (title, description up to 500 chars, severity, status)', promptVar: 'records' },
      { type: 'incident_action', label: 'Incident actions (text, due date, status)', promptVar: 'records' },
      { type: 'medication_administration', label: 'Medication administrations (medicine name, status, times)', promptVar: 'records' },
    ],
    identifierFields: ['records.person_name'],
  },  operational_anomaly_detection: {
    id: 'operational_anomaly_detection',
    entryPoint: '/anomaly-detection',
    label: 'Operational activity review',
    summary:
      'A review of operational records for the period. No statistical detection is applied: there is '
      + 'no baseline to deviate from, so this reports the records that met the filters rather than '
      + 'outliers that were detected.',
    promptKey: 'unified_intelligence',
    requiresNarrative: false,
    dataClasses: [
      { type: 'homecare_visit', label: 'Visits (status, type, times, person name)', promptVar: 'records' },
      { type: 'daily_note', label: 'Daily notes (up to 600 chars of content, date, category)', promptVar: 'records' },
      { type: 'incident', label: 'Incidents (title, description up to 500 chars, severity, status)', promptVar: 'records' },
      { type: 'medication_administration', label: 'Medication administrations (medicine name, status, times, notes)', promptVar: 'records' },
      { type: 'risk_assessment', label: 'Risk assessments (type, level, up to 400 chars of details, review date)', promptVar: 'records' },
      { type: 'incident_action', label: 'Incident actions (text, due date, status)', promptVar: 'records' },
      { type: 'competency_assessment', label: 'Competency assessments (name, pass status, dates, staff id)', promptVar: 'records' },
    ],
    identifierFields: ['records.person_name'],
  },
  rota_alternatives: {
    id: 'rota_alternatives',
    entryPoint: '/rota-alternatives',
    label: 'Rota alternatives',
    summary: 'Suggested alternative staff for shifts, drawn from availability already recorded.',
    promptKey: 'unified_intelligence',
    requiresNarrative: false,
    dataClasses: [
      { type: 'homecare_visit', label: 'Visits (status, type, times, person name)', promptVar: 'records' },
      { type: 'daily_note', label: 'Daily notes (up to 600 chars of content, date, category)', promptVar: 'records' },
      { type: 'incident', label: 'Incidents (title, description up to 500 chars, severity, status)', promptVar: 'records' },
      { type: 'shift', label: 'Shifts (times, type, status, location name)', promptVar: 'records' },
    ],
    identifierFields: ['records.person_name'],
  },
  competency_coaching: {
    id: 'competency_coaching',
    entryPoint: '/competency-coaching',
    label: 'Training support',
    summary: 'Written guidance drawn from training records and the competency framework.',
    promptKey: 'unified_intelligence',
    requiresNarrative: false,
    dataClasses: [
      { type: 'homecare_visit', label: 'Visits (status, type, times, person name)', promptVar: 'records' },
      { type: 'daily_note', label: 'Daily notes (up to 600 chars of content, date, category)', promptVar: 'records' },
      { type: 'incident', label: 'Incidents (title, description up to 500 chars, severity, status)', promptVar: 'records' },
      { type: 'training_record', label: 'Training records (module, status, expiry, staff name)', promptVar: 'records' },
    ],
    identifierFields: ['records.person_name', 'records.staff_name'],
  },
  family_communication_draft: {
    id: 'family_communication_draft',
    entryPoint: '/family-communication-draft',
    label: 'Family update draft',
    summary: 'A draft update for a family, written from the records for that person. A draft for a person to review, not sent to anyone.',
    promptKey: 'unified_intelligence',
    requiresNarrative: true,
    dataClasses: [
      { type: 'homecare_visit', label: 'Visits (status, type, times, person name)', promptVar: 'records' },
      { type: 'daily_note', label: 'Daily notes (up to 600 chars of content, date, category)', promptVar: 'records' },
      { type: 'incident', label: 'Incidents (title, description up to 500 chars, severity, status)', promptVar: 'records' },
      { type: 'family_contact', label: 'Family contacts (name, relationship, decrypted email address)', promptVar: 'records' },
    ],
    // family_contacts.email is decrypted before the prompt because the draft
    // reply may be addressed to it — this is the one capability where a real
    // contact email crosses the boundary, and the disclosure must say so.
    identifierFields: ['records.person_name', 'records.email'],
  },
  manager_briefing: {
    id: 'manager_briefing',
    entryPoint: '/intelligence',
    label: 'Manager briefing',
    summary: 'A written briefing over the records in the period you select.',
    // Its own template (not unified_intelligence) and its own controller
    // method (AIController.managerBriefing) — the only capability whose
    // queries differ structurally from the intelligence() handler.
    promptKey: 'manager_briefing',
    requiresNarrative: true,
    dataClasses: [
      { type: 'homecare_visit', label: 'Visits (status, label, times, person name)', promptVar: 'records' },
      { type: 'daily_note', label: 'Daily notes (up to 600 chars of content, date, category, person name)', promptVar: 'records' },
      { type: 'incident', label: 'Incidents (title, description up to 500 chars, severity, status)', promptVar: 'records' },
      { type: 'leave_request', label: 'Leave (staff name, type, dates)', promptVar: 'records' },
      { type: 'training_record', label: 'Training records (module, staff name, status, expiry)', promptVar: 'records' },
    ],
    identifierFields: ['records.person_name', 'records.staff_name'],
  },
};

/* ------------------------------------------------------------------
 * Flag-gated features that live OUTSIDE AI_CAPABILITIES.
 *
 * Seven AI toggles in Settings gate dedicated controller methods rather
 * than an intelligence() capability id (daily notes, meal plans, rota
 * optimisation, incident triage, and the other single-purpose
 * generators). They are flag keys in enabledFeatures exactly like the
 * capability ids, but there is no route/audit-id coupling to keep frozen
 * — so they are not part of AiCapabilityId and must NOT be added there
 * without checking every existing organisation first. Their disclosure
 * lives here instead, keyed by the flag key the Settings page uses, so
 * every AI toggle has a data-class line sourced from the same place.
 * ------------------------------------------------------------------ */
export type FlagDisclosure = {
  id: string;
  label: string;
  dataClasses: ReadonlyArray<{ type: string; label: string; promptVar: string }>;
  identifierFields: readonly string[];
};

export const AI_FLAG_DISCLOSURES: Record<string, FlagDisclosure> = {
  compliance_gap_analysis: {
    id: 'compliance_gap_analysis',
    label: 'Compliance Gap Analysis',
    // analyzeComplianceGap: what the caller passes (page-provided data) is
    // what crosses — the endpoint fetches nothing itself.
    dataClasses: [
      { type: 'compliance_summary', label: 'Regulator name, compliance rate, domain scores, key issues as entered on the page', promptVar: 'org_name/overall_rate/domain_scores/key_issues' },
    ],
    identifierFields: [],
  },
  incident_severity_triage: {
    id: 'incident_severity_triage',
    label: 'Incident Severity Triage',
    // triageIncident: the incident fields being triaged are the payload.
    dataClasses: [
      { type: 'incident', label: 'The incident being triaged: title, full description, category, date, location, involved people', promptVar: 'title/description/involved' },
    ],
    identifierFields: ['involved'],
  },
  rota_optimization: {
    id: 'rota_optimization',
    label: 'Rota Optimization',
    // analyzeRota + generateRota: the rota payload from the planner page.
    dataClasses: [
      { type: 'shift', label: 'Shifts (times, location names)', promptVar: 'shifts/existing_shifts' },
      { type: 'staff_roster', label: 'Staff roster, compliance status, contracted hours and overtime hours', promptVar: 'staff_roster/staff_compliance/overtime_hours' },
      { type: 'staff_on_leave', label: 'Staff on leave (names, dates)', promptVar: 'staff_on_leave' },
      { type: 'people_requiring_care', label: 'People requiring care and staffing needs as entered', promptVar: 'people/staffing_needs' },
    ],
    identifierFields: ['staff_roster.staff_name', 'staff_on_leave.staff_name'],
  },
  daily_note_generation: {
    id: 'daily_note_generation',
    label: 'AI Daily Notes',
    // generateDailyNote: person row + care plans + goals + a 5-note baseline
    // window, plus the carer's own observation. date_of_birth and allergies
    // are decrypted before render (decryptField), so they are real.
    dataClasses: [
      { type: 'person_context', label: 'The person: name, date of birth, room number, allergies, dietary requirements, GP details', promptVar: 'person_name/date_of_birth/allergies/gp_name' },
      { type: 'care_plans', label: 'Active care plans (titles, categories, descriptions)', promptVar: 'care_plans' },
      { type: 'person_goals', label: 'Active goals (titles, descriptions, status, targets)', promptVar: 'recent_goals' },
      { type: 'daily_note', label: 'Up to 5 recent notes as baseline (first 150 chars each, date, category)', promptVar: 'baseline_data' },
      { type: 'staff_observation', label: "The carer's own observation text", promptVar: 'staff_input' },
    ],
    identifierFields: ['person_name', 'date_of_birth'],
  },
  meal_plan_generation: {
    id: 'meal_plan_generation',
    label: 'AI Meal Plans & Shopping Lists',
    // generateMealPlan / generateWeeklyMealPlan / generateShoppingList:
    // person + dietary profile; the shopping list sends the page's data.
    dataClasses: [
      { type: 'person_context', label: 'The person: name and date of birth (decrypted)', promptVar: 'person_name/date_of_birth' },
      { type: 'dietary_profile', label: 'Dietary profile: allergies, food preferences and dislikes, cultural requirements, texture, fluid target, appetite, eating abilities', promptVar: 'dietary fields' },
      { type: 'meal_plan', label: 'The weekly plan being turned into a shopping list', promptVar: 'weekly_plan_data' },
    ],
    identifierFields: ['person_name', 'date_of_birth'],
  },
  care_plan_gap_analysis: {
    id: 'care_plan_gap_analysis',
    label: 'Care Plan Gap Analysis',
    // analyzeCarePlanGap: the note + plans + dietary + 7-day nutrition.
    dataClasses: [
      { type: 'daily_note', label: "The note being analysed (full content) and the person's name", promptVar: 'visit_note/person_name' },
      { type: 'care_plans', label: 'Active care plans (titles, goals)', promptVar: 'care_plan' },
      { type: 'dietary_profile', label: 'Dietary profile (allergies, requirements, texture, preferences)', promptVar: 'dietary_profile' },
      { type: 'nutrition_records', label: 'Last 7 days of nutrition records (meals, intake %, fluids, appetite, refusals)', promptVar: 'recent_nutrition' },
    ],
    identifierFields: ['person_name'],
  },
  competency_assessment_assistant: {
    id: 'competency_assessment_assistant',
    label: 'Competency Assessment Generator',
    // generateCompetencyQuestions: no record data is fetched — only what
    // the caller typed travels.
    dataClasses: [
      { type: 'competency_statement', label: 'The CQC/regulatory statement, staff role and assessment area as entered', promptVar: 'cqc_statement/role/area' },
    ],
    identifierFields: [],
  },
};

/**
 * Data-class disclosure for any AI feature key. Looks in AI_CAPABILITIES
 * first (the eleven unified-intelligence routes + manager briefing), then
 * AI_FLAG_DISCLOSURES (the seven single-purpose generators). Used by
 * /ai/data-classes and GET /ai/prompts so the Settings page always maps by
 * the same key the toggle itself uses.
 */
export function getDisclosureForFeature(id: string): FlagDisclosure | undefined {
  const cap = AI_CAPABILITIES[id as AiCapabilityId];
  if (cap) {
    return { id: cap.id, label: cap.label, dataClasses: cap.dataClasses, identifierFields: cap.identifierFields };
  }
  return AI_FLAG_DISCLOSURES[id];
}

/** Route path to capability id. Single source for the routing the controller does. */
export const CAPABILITY_BY_PATH: Record<string, AiCapabilityId> = Object.fromEntries(
  Object.values(AI_CAPABILITIES).map((c) => [c.entryPoint, c.id]),
);

export function getCapability(id: string): AiCapability {
  return AI_CAPABILITIES[id as AiCapabilityId] ?? AI_CAPABILITIES.manager_briefing;
}
