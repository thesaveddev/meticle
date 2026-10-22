/**
 * Corrective-action suggestions (blueprint §13.5 step 7): draft action items.
 *
 * Deterministic rules propose candidate work from the incident's own facts;
 * anything the AI triage already recommended is folded in with its provenance
 * kept (`source: 'ai'`). Nothing here assigns work — every row is a draft a
 * manager approves into a real `incident_action` or rejects with a reason.
 * Rule keys are stable so tests and analytics can name them; labels may change.
 */

export interface SuggestionInput {
  category?: string | null;
  severity?: string | null;
  isCqcReportable?: boolean | null;
  isNearMiss?: boolean | null;
  investigationSummary?: string | null;
  aiRecommended?: unknown;
}

export interface SuggestedAction {
  action: string;
  dueInDays: number;
  ruleKey: string;
  source: 'rules' | 'ai';
}

interface Rule {
  key: string;
  when: (input: SuggestionInput, category: string) => boolean;
  actions: Array<{ action: string; dueInDays: number }>;
}

const RULES: Rule[] = [
  {
    key: 'falls_review',
    when: (_i, c) => c.includes('fall'),
    actions: [
      { action: 'Review the falls risk assessment for everyone involved', dueInDays: 7 },
      { action: 'Check flooring, lighting and clutter where the fall happened', dueInDays: 3 },
    ],
  },
  {
    key: 'post_fall_obs',
    when: (_i, c) => c.includes('fall'),
    actions: [{ action: 'Complete post-fall observations and record them', dueInDays: 1 }],
  },
  {
    key: 'medication_review',
    when: (_i, c) => c.includes('medication') || c.includes('mar') || c.includes('drug'),
    actions: [
      { action: 'Double-check the MAR chart against the prescription', dueInDays: 1 },
      { action: 'Ask the prescriber or GP to review the medication', dueInDays: 3 },
    ],
  },
  {
    key: 'safeguarding_escalation',
    when: (i, c) => c.includes('safeguard') || c.includes('abuse') || c.includes('neglect'),
    actions: [
      { action: 'Notify the safeguarding lead and record the referral', dueInDays: 1 },
      { action: 'Review the body map and linked clinical observations', dueInDays: 1 },
    ],
  },
  {
    key: 'behaviour_support',
    when: (_i, c) => c.includes('behaviour') || c.includes('behavior'),
    actions: [{ action: 'Review the behaviour support plan with the team', dueInDays: 7 }],
  },
  {
    key: 'equipment_check',
    when: (_i, c) => c.includes('equipment'),
    actions: [
      { action: 'Take the equipment out of service until checked', dueInDays: 2 },
      { action: 'Raise a maintenance request and track it to completion', dueInDays: 3 },
    ],
  },
  {
    key: 'severe_harm_review',
    when: (i) => i.severity === 'high' || i.severity === 'critical',
    actions: [{ action: 'Hold a manager review of what happened and why', dueInDays: 2 }],
  },
  {
    key: 'critical_escalation',
    when: (i) => i.severity === 'critical',
    actions: [{ action: 'Brief senior management and record the briefing', dueInDays: 1 }],
  },
  {
    key: 'cqc_notification_prep',
    when: (i) => !!i.isCqcReportable,
    actions: [{ action: 'Prepare the statutory notification with dates and references', dueInDays: 2 }],
  },
  {
    key: 'near_miss_learning',
    when: (i) => !!i.isNearMiss,
    actions: [{ action: 'Share the learning with the team at handover', dueInDays: 7 }],
  },
  {
    key: 'triage_default',
    when: () => true,
    actions: [{ action: 'Confirm the investigation scope and owner with a manager', dueInDays: 3 }],
  },
];

const MAX_SUGGESTIONS = 10;

export function suggestActions(input: SuggestionInput): SuggestedAction[] {
  const category = `${input.category || ''}`.toLowerCase();
  const out: SuggestedAction[] = [];
  const seen = new Set<string>();
  const push = (action: string, dueInDays: number, ruleKey: string, source: 'rules' | 'ai') => {
    const key = action.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ action: action.trim(), dueInDays, ruleKey, source });
  };
  for (const rule of RULES) {
    if (out.length >= MAX_SUGGESTIONS) break;
    let fired = false;
    try {
      fired = rule.when(input, category);
    } catch {
      fired = false;
    }
    if (!fired) continue;
    for (const a of rule.actions) {
      if (out.length >= MAX_SUGGESTIONS) break;
      push(a.action, a.dueInDays, rule.key, 'rules');
    }
  }
  // The AI triage's own recommendations join the drafts with provenance kept,
  // so a manager sees what the model asked for alongside the rules. Anything
  // else in that payload (scores, prose) is not an action and stays out.
  const aiList = Array.isArray(input.aiRecommended) ? input.aiRecommended : [];
  for (const raw of aiList) {
    if (out.length >= MAX_SUGGESTIONS) break;
    if (typeof raw !== 'string') continue;
    push(raw, 7, 'ai_triage_recommendation', 'ai');
  }
  return out;
}
