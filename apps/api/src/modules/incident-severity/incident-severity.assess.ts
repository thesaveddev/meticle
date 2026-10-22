/**
 * Severity Engine (P0-2) — pure, no DB. Normative order per plan §8.4:
 * 1 validate → 2 emergency → 3 safeguarding fast-path → 4 actual harm →
 * 5 potential harm → 6 urgency + continuing risk → 7 category escalations →
 * 8 weighted score (only if sufficient data) → 9 recurrence →
 * 10 provisional → 11 explanation + tasks → 12 human review/override.
 *
 * Invariants: weighted score never downgrades a mandatory escalation;
 * unknown ≠ no harm (missing → provisional); every reassessment appends.
 */

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface SeverityInputs {
  emergency_indicators?: string[];
  safeguarding_concern?: boolean | string;
  harm_level?: string;
  potential_harm?: string;
  urgency?: string;
  continuing_risk?: boolean | string;
  category?: string;
  recurrence_count?: number;
  [key: string]: unknown;
}

export interface RulesConfig {
  weights?: Record<string, number>;
  escalation_conditions?: Array<{ when: Record<string, unknown>; level: SeverityLevel; reason: string }>;
}

export interface AssessResult {
  level: SeverityLevel;
  score: number | null;
  dimensions: Record<string, number>;
  provisional: boolean;
  explanation: Array<{ rule: string; detail: string }>;
  missing: string[];
}

const RANK: Record<SeverityLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const LEVELS: SeverityLevel[] = ['low', 'medium', 'high', 'critical'];

function truthy(v: unknown): boolean {
  return v === true || v === 'true' || v === 'yes' || v === 1 || v === '1';
}

function maxLevel(a: SeverityLevel, b: SeverityLevel): SeverityLevel {
  return RANK[a] >= RANK[b] ? a : b;
}

export function assessSeverity(inputs: SeverityInputs, rules?: RulesConfig): AssessResult {
  const explanation: Array<{ rule: string; detail: string }> = [];
  const missing: string[] = [];
  const dimensions: Record<string, number> = {};
  let mandatory: SeverityLevel | null = null;

  const escalate = (level: SeverityLevel, rule: string, detail: string) => {
    mandatory = mandatory ? maxLevel(mandatory, level) : level;
    explanation.push({ rule, detail });
  };

  // 1. Validate — collect what is missing before deciding anything.
  if (inputs.harm_level == null || inputs.harm_level === '') missing.push('harm_level');
  if (inputs.category == null || inputs.category === '') missing.push('category');

  // 2. Emergency indicators — always critical, no scoring needed.
  const emergency = Array.isArray(inputs.emergency_indicators) ? inputs.emergency_indicators.filter(Boolean) : [];
  if (emergency.length > 0) {
    escalate('critical', 'emergency', `Emergency indicators present: ${emergency.join(', ')}`);
  }

  // 3. Safeguarding fast-path — never waits for a score.
  if (truthy(inputs.safeguarding_concern)) {
    escalate('high', 'safeguarding', 'Safeguarding concern flagged — fast-path to high pending review');
  }

  // 4. Actual harm mapping.
  const harm = String(inputs.harm_level ?? '').toLowerCase();
  if (harm === 'death') escalate('critical', 'actual_harm', 'Death recorded');
  else if (harm === 'severe') escalate('high', 'actual_harm', 'Severe harm recorded');
  else if (harm === 'moderate') escalate('medium', 'actual_harm', 'Moderate harm recorded');
  else if (harm === 'unknown' || harm === '') {
    if (harm === 'unknown') explanation.push({ rule: 'unknown_harm', detail: 'Harm unknown — provisional until clarified' });
  }

  // 5. Potential harm — what could easily have happened.
  const potential = String(inputs.potential_harm ?? '').toLowerCase();
  if (potential === 'severe' || potential === 'death') escalate('high', 'potential_harm', `Potential harm ${potential} — escalated even though actual harm is lower`);

  // 6. Urgency + continuing risk.
  const urgency = String(inputs.urgency ?? '').toLowerCase();
  if ((urgency === 'immediate' || urgency === 'today') && truthy(inputs.continuing_risk)) {
    escalate('high', 'continuing_risk', 'Immediate urgency with continuing risk');
  } else if (truthy(inputs.continuing_risk)) {
    escalate('medium', 'continuing_risk', 'Continuing risk flagged');
  }

  // 7. Category escalations + custom rule conditions.
  const category = String(inputs.category ?? '').toLowerCase();
  if (['safeguarding', 'abuse', 'neglect'].includes(category)) {
    escalate('high', 'category', `Category ${category} escalates to high`);
  }
  for (const cond of rules?.escalation_conditions ?? []) {
    const matches = Object.entries(cond.when ?? {}).every(([k, v]) => String(inputs[k] ?? '') === String(v));
    if (matches) escalate(cond.level, 'custom_rule', cond.reason);
  }

  // 8. Weighted score — only when the mandatory inputs exist. Default weights
  // per plan §3 (40/25/20/10/5, flagged non-clinical pending sign-off).
  const weights = { harm: 40, potential: 25, urgency: 20, recurrence: 10, vulnerability: 5, ...(rules?.weights ?? {}) };
  let score: number | null = null;
  const sufficient = harm !== '' && harm !== 'unknown' && category !== '';
  if (sufficient) {
    const harmScore = harm === 'death' ? 100 : harm === 'severe' ? 80 : harm === 'moderate' ? 50 : harm === 'minor' ? 25 : 5;
    const potScore = potential === 'death' ? 100 : potential === 'severe' ? 80 : potential === 'moderate' ? 50 : 10;
    const urgScore = urgency === 'immediate' ? 100 : urgency === 'today' ? 70 : urgency === 'week' ? 30 : 10;
    const recScore = Math.min(100, (Number(inputs.recurrence_count) || 0) * 25);
    const totalW = weights.harm + weights.potential + weights.urgency + weights.recurrence + weights.vulnerability;
    score = Math.round((harmScore * weights.harm + potScore * weights.potential + urgScore * weights.urgency + recScore * weights.recurrence + 10 * weights.vulnerability) / Math.max(1, totalW));
    dimensions.harm = harmScore;
    dimensions.potential = potScore;
    dimensions.urgency = urgScore;
    dimensions.recurrence = recScore;
    explanation.push({ rule: 'weighted_score', detail: `Weighted score ${score} from harm/potential/urgency/recurrence` });
  } else {
    missing.push(...(['harm_level', 'category'].filter(k => !inputs[k] || inputs[k] === 'unknown')));
  }

  // Score maps to a level, but never downgrades a mandatory escalation.
  let scored: SeverityLevel = 'low';
  if (score != null) scored = score >= 80 ? 'critical' : score >= 55 ? 'high' : score >= 30 ? 'medium' : 'low';

  // 9. Recurrence modifier — repeat events step up one level.
  const rec = Number(inputs.recurrence_count) || 0;
  if (rec >= 3) {
    scored = LEVELS[Math.min(3, RANK[scored] + 1)];
    explanation.push({ rule: 'recurrence', detail: `${rec} prior similar events — stepped up one level` });
  }

  let level = mandatory ? maxLevel(mandatory, scored) : scored;

  // 10. Provisional — unknown or missing means "not yet decided", never "no harm".
  const provisional = missing.length > 0 || harm === 'unknown' || emergency.length > 0;
  if (provisional && level === 'low') level = 'medium';

  return { level, score, dimensions, provisional, explanation, missing: [...new Set(missing)] };
}

export function hashInputs(inputs: Record<string, unknown>): string {
  const keys = Object.keys(inputs).sort();
  const canonical = JSON.stringify(keys.map(k => [k, inputs[k]]));
  let h = 0;
  for (let i = 0; i < canonical.length; i++) {
    h = (Math.imul(h, 31) + canonical.charCodeAt(i)) | 0;
  }
  return `h${(h >>> 0).toString(16)}`;
}
