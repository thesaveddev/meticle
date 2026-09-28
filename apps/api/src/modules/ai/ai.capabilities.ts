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
  },
  change_detection: {
    id: 'change_detection',
    entryPoint: '/change-detection',
    label: 'Record change summary',
    summary:
      'A comparison of records across two periods. It surfaces what the filters returned, not changes ' +
      'a system inferred — nothing is learned from your history.',
    promptKey: 'unified_intelligence',
    requiresNarrative: true,
  },
  risk_signals: {
    id: 'risk_signals',
    entryPoint: '/risk-signals',
    label: 'Record-derived risk summary',
    summary:
      'A written summary of the incidents, notes and medication events in a period, each linked to the ' +
      'record it came from. It is a reading of the records, not a risk score.',
    promptKey: 'unified_intelligence',
    requiresNarrative: true,
  },
  compliance_copilot: {
    id: 'compliance_copilot',
    entryPoint: '/compliance-copilot',
    label: 'Compliance gap summary',
    summary:
      'A written explanation of the compliance gaps already computed for your organisation, with the ' +
      'underlying records linked.',
    promptKey: 'unified_intelligence',
    requiresNarrative: false,
  },
  natural_language_assistant: {
    id: 'natural_language_assistant',
    entryPoint: '/assistant',
    label: 'Ask about your records',
    summary: 'Answers a question in plain English against the records in the period you select.',
    promptKey: 'unified_intelligence',
    requiresNarrative: true,
  },
  end_of_day_intelligence: {
    id: 'end_of_day_intelligence',
    entryPoint: '/end-of-day',
    label: 'End-of-day activity summary',
    summary: 'A summary of the day’s visits, notes and incidents.',
    promptKey: 'unified_intelligence',
    requiresNarrative: true,
  },
  domiciliary_operations_copilot: {
    id: 'domiciliary_operations_copilot',
    entryPoint: '/operations-copilot',
    label: 'Operational activity summary',
    summary: 'A written summary of operational records in the period, with each item linked to its source.',
    promptKey: 'unified_intelligence',
    requiresNarrative: false,
  },
  operational_anomaly_detection: {
    id: 'operational_anomaly_detection',
    entryPoint: '/anomaly-detection',
    label: 'Operational activity review',
    summary:
      'A review of operational records for the period. No statistical detection is applied: there is ' +
      'no baseline to deviate from, so this reports the records that met the filters rather than ' +
      'outliers that were detected.',
    promptKey: 'unified_intelligence',
    requiresNarrative: false,
  },
  rota_alternatives: {
    id: 'rota_alternatives',
    entryPoint: '/rota-alternatives',
    label: 'Rota alternatives',
    summary: 'Suggested alternative staff for shifts, drawn from availability already recorded.',
    promptKey: 'unified_intelligence',
    requiresNarrative: false,
  },
  competency_coaching: {
    id: 'competency_coaching',
    entryPoint: '/competency-coaching',
    label: 'Training support',
    summary: 'Written guidance drawn from training records and the competency framework.',
    promptKey: 'unified_intelligence',
    requiresNarrative: false,
  },
  family_communication_draft: {
    id: 'family_communication_draft',
    entryPoint: '/family-communication-draft',
    label: 'Family update draft',
    summary: 'A draft update for a family, written from the records for that person. A draft for a person to review, not sent to anyone.',
    promptKey: 'unified_intelligence',
    requiresNarrative: true,
  },
  manager_briefing: {
    id: 'manager_briefing',
    entryPoint: '/intelligence',
    label: 'Manager briefing',
    summary: 'A written briefing over the records in the period you select.',
    promptKey: 'manager_briefing',
    requiresNarrative: true,
  },
};

/** Route path to capability id. Single source for the routing the controller does. */
export const CAPABILITY_BY_PATH: Record<string, AiCapabilityId> = Object.fromEntries(
  Object.values(AI_CAPABILITIES).map((c) => [c.entryPoint, c.id]),
);

export function getCapability(id: string): AiCapability {
  return AI_CAPABILITIES[id as AiCapabilityId] ?? AI_CAPABILITIES.manager_briefing;
}
