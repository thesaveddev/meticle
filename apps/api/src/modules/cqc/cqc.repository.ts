import { query } from '../../shared/database';
import { getFramework, domainsForServiceTypes, type DomainDef, type FrameworkDef } from './frameworks';
import { vettingDocumentTypeSql, getVettingScheme } from '../compliance/compliance.vetting';

// Which identity documents count towards the documentation metric.
//
// This is the query that made the four-numbers claim checkable. The frameworks
// were CQC, CIW, Care Inspectorate and RQIA, but this metric counted only
// DBS / PASSPORT / VISA / RIGHT_TO_WORK for all of them, so a Scottish
// provider's score was framework-aware and its evidence was not. Now it is
// derived from each person's own nation.
const RESOLVED_VETTING_SCHEME_SQL = 'COALESCE(sp.vetting_scheme, o.vetting_scheme)';
const VETTING_DOC_TYPES_SQL = vettingDocumentTypeSql(RESOLVED_VETTING_SCHEME_SQL);
const VETTING_CHECK_TYPES_SQL = vettingDocumentTypeSql(RESOLVED_VETTING_SCHEME_SQL, 'check');

// ── Scoring constants ───────────────────────────────────────────────────────
// These thresholds reflect CQC Single Assessment Framework expectations.
// They are intentionally conservative so low data quality lowers scores.
const TARGET_RATE = 80; // target compliance rate for most metrics
const BASELINE_RATE = 65; // baseline score when no direct data exists
const MINIMUM_RATE = 20; // hard floor for metrics with some data
const NO_DATA_RATE = 0; // score when no relevant records exist
const WEIGHT_MINOR_BONUS = 5; // small bonus when adjacent evidence exists
const WEIGHT_MINOR_PENALTY = 15; // penalty per severe open incident
const INCIDENT_BASE_SCORE = 85; // starting score for incident domain

function clampRate(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function safeAvg(...values: (number | undefined)[]): number {
  const nums = values.filter((v): v is number => v !== undefined && !Number.isNaN(v));
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function weightedScore(rate: number, weight = 1, floor = 0): number {
  return clampRate(rate * weight + floor);
}

export class CqcRepository {
  static async calculateReadiness(orgId: string, regulator: string = 'cqc') {
    // ── Core metrics ──
    const staffResult = await query(
      `SELECT COUNT(*) as total FROM staff_profiles sp
       JOIN users u ON sp.user_id = u.id
       WHERE u.organization_id = $1 AND u.status = 'active'`,
      [orgId]
    );
    const totalStaff = parseInt(staffResult.rows[0]?.total || '0');

    const trainingResult = await query(
      `SELECT COUNT(*) FILTER (WHERE tr.status = 'completed') as completed,
              COUNT(*) as total
       FROM training_records tr
       JOIN training_modules tm ON tr.module_id = tm.id
       WHERE tm.organization_id = $1`,
      [orgId]
    );
    const trainingRate = trainingResult.rows[0]?.total > 0
      ? (parseInt(trainingResult.rows[0].completed) / parseInt(trainingResult.rows[0].total)) * 100
      : 0;

    const docResult = await query(
      `SELECT COUNT(*) FILTER (WHERE d.status = 'approved' OR d.status = 'pending') as valid,
              COUNT(*) as total
       FROM documents d
       JOIN staff_profiles sp ON d.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       JOIN organizations o ON o.id = u.organization_id
       WHERE u.organization_id = $1 AND d.type = ANY(${VETTING_DOC_TYPES_SQL})`,
      [orgId]
    );
    const docRate = docResult.rows[0]?.total > 0
      ? (parseInt(docResult.rows[0].valid) / parseInt(docResult.rows[0].total)) * 100
      : 0;

    // How many active staff actually hold their nation's background check.
    //
    // This is a separate metric from docRate on purpose, and it exists because
    // docRate cannot answer the question. docRate is the share of the identity
    // documents a provider *holds* that are valid, so its denominator is the
    // evidence already present: a Scottish provider with a full set of passports
    // and visas and not one PVG certificate scored 100% on documents, because
    // there was no DBS in the pile to be missing. Ranking an inspection-readiness
    // score on that alone would let the largest gap in a Scottish provider's
    // file raise no gap message at all.
    //
    // The denominator is active staff, so an absence counts.
    const checkResult = await query(
      `SELECT COUNT(*) FILTER (WHERE valid_checks > 0) as covered,
              COUNT(*) as total,
              MIN(org_scheme) as org_scheme
       FROM (
         SELECT sp.id, o.vetting_scheme as org_scheme,
                COUNT(*) FILTER (
                  WHERE d.type = ANY(${VETTING_CHECK_TYPES_SQL})
                    AND d.status = 'approved'
                    AND (d.expiry_date IS NULL OR d.expiry_date >= CURRENT_DATE)
                ) as valid_checks
         FROM staff_profiles sp
         JOIN users u ON sp.user_id = u.id
         JOIN organizations o ON o.id = u.organization_id
         LEFT JOIN documents d ON d.staff_id = sp.id
         WHERE u.organization_id = $1 AND u.status = 'active'
         GROUP BY sp.id, o.vetting_scheme
       ) per_staff`,
      [orgId]
    );
    const backgroundCheckCoverage = checkResult.rows[0]?.total > 0
      ? (parseInt(checkResult.rows[0].covered) / parseInt(checkResult.rows[0].total)) * 100
      : 0;

    const compResult = await query(
      `SELECT COUNT(*) FILTER (WHERE ca.passed = true) as passed,
              COUNT(*) as total
       FROM competency_assessments ca
       JOIN competency_templates ct ON ca.template_id = ct.id
       WHERE ct.organization_id = $1`,
      [orgId]
    );
    const compRate = compResult.rows[0]?.total > 0
      ? (parseInt(compResult.rows[0].passed) / parseInt(compResult.rows[0].total)) * 100
      : 0;

    const expiringResult = await query(
      `SELECT COUNT(*) as expiring
       FROM training_records tr
       JOIN training_modules tm ON tr.module_id = tm.id
       WHERE tm.organization_id = $1 AND tr.status = 'completed'
         AND tr.expires_at IS NOT NULL AND tr.expires_at <= CURRENT_DATE + 30`,
      [orgId]
    );
    const expiringCount = parseInt(expiringResult.rows[0]?.expiring || '0');

    // ── CQC-mandated training completion rate ──
    const cqcMandatedResult = await query(
      `SELECT COUNT(*) FILTER (WHERE tr.status = 'completed') as completed,
              COUNT(*) as total
       FROM training_records tr
       JOIN training_modules tm ON tr.module_id = tm.id
       WHERE tm.organization_id = $1 AND tm.cqc_mandated = true`,
      [orgId]
    );
    const cqcMandatedRate = parseInt(cqcMandatedResult.rows[0]?.total || '0') > 0
      ? (parseInt(cqcMandatedResult.rows[0].completed) / parseInt(cqcMandatedResult.rows[0].total)) * 100
      : 0;

    // ── Staffing adequacy: ratio of shifts that were properly staffed (covered by staff or agency) ──
    const staffingResult = await query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE NOT (
           (s.status = 'open') OR
           (s.agency_id IS NOT NULL AND s.agency_covered = false)
         )) as adequately_staffed
       FROM shifts s
       JOIN locations l ON s.location_id = l.id
       WHERE l.organization_id = $1
         AND s.start_time >= CURRENT_DATE - INTERVAL '90 days'
         AND s.start_time <= CURRENT_DATE
         AND s.status != 'cancelled'`,
      [orgId]
    );
    const totalShifts = parseInt(staffingResult.rows[0]?.total || '0');
    const adequatelyStaffed = parseInt(staffingResult.rows[0]?.adequately_staffed || '0');
    const staffingAdequacyRate = totalShifts > 0 ? (adequatelyStaffed / totalShifts) * 100 : 0;

    // ── Competency-to-CQC-statement mapping ──
    const compStatementResult = await query(
      `SELECT ct.cqc_statement_id,
              COUNT(*) FILTER (WHERE ca.passed = true) as passed_count,
              COUNT(*) as total_count
       FROM competency_templates ct
       LEFT JOIN competency_assessments ca ON ca.template_id = ct.id
       WHERE ct.organization_id = $1 AND ct.cqc_statement_id IS NOT NULL
       GROUP BY ct.cqc_statement_id`,
      [orgId]
    );
    const compStatementMap: Record<string, number> = {};
    for (const row of compStatementResult.rows) {
      const total = parseInt(row.total_count);
      const passed = parseInt(row.passed_count);
      compStatementMap[row.cqc_statement_id] = total > 0 ? Math.round((passed / total) * 100) : 0;
    }

    // ── Satisfaction surveys → Caring domain ──
    const satResult = await query(
      `SELECT COUNT(*)::int as total, ROUND(AVG(rating)::numeric, 2) as avg_rating
       FROM satisfaction_surveys WHERE organization_id = $1`,
      [orgId]
    );
    const satTotal = parseInt(satResult.rows[0]?.total || '0');
    const satAvgRating = parseFloat(satResult.rows[0]?.avg_rating || '0');
    const satRate = satTotal > 0 ? (satAvgRating / 5) * 100 : 0;

    // ── Staff engagement surveys → Well-led domain ──
    const engResult = await query(
      `SELECT COUNT(*)::int as total FROM staff_engagement_surveys WHERE organization_id = $1`,
      [orgId]
    );
    const engTotal = parseInt(engResult.rows[0]?.total || '0');
    let engAvgScore = 0;
    if (engTotal > 0) {
      const allRatings = await query(
        `SELECT ratings FROM staff_engagement_surveys WHERE organization_id = $1`,
        [orgId]
      );
      let totalScore = 0;
      let count = 0;
      for (const row of allRatings.rows) {
        const r = row.ratings || {};
        for (const val of Object.values(r as Record<string, number>)) {
          totalScore += val;
          count++;
        }
      }
      engAvgScore = count > 0 ? Math.round((totalScore / count) * 100 / 5) : 0;
    }

    // ── Incidents → Responsive domain ──
    const incResult = await query(
      `SELECT COUNT(*)::int as total,
              COUNT(*) FILTER (WHERE severity IN ('high','critical') AND status IN ('reported','investigating'))::int as severe_open
       FROM incidents WHERE organization_id = $1`,
      [orgId]
    );
    const incTotal = parseInt(incResult.rows[0]?.total || '0');
    const severeOpen = parseInt(incResult.rows[0]?.severe_open || '0');
    // Score starts high and deducts for each unresolved severe incident, floored at MINIMUM_RATE.
    const incRate = totalStaff > 0
      ? Math.max(MINIMUM_RATE, INCIDENT_BASE_SCORE - severeOpen * WEIGHT_MINOR_PENALTY)
      : 50;

    const framework = getFramework(regulator);

    // CIW carves Environment out for domiciliary services — "Domiciliary
    // support services do not receive a rating for ‘Environment’" — so a
    // domiciliary provider is not shown a theme CIW never scores it on. Read
    // from the org rather than the regulator, because it is the service the org
    // delivers that decides which themes apply.
    const orgTypeResult = await query(
      'SELECT service_types FROM organizations WHERE id = $1',
      [orgId]
    );
    const serviceTypes: string[] = orgTypeResult.rows[0]?.service_types || [];
    const applicableDomains = domainsForServiceTypes(framework, serviceTypes);
    const notApplicableDomains = framework.domains
      .filter(d => !applicableDomains.includes(d))
      .map(d => d.label);

    const domains = applicableDomains.map((domain: DomainDef) => {
      let score = 0;
      const details: Record<string, number> = {};

      domain.statements.forEach(statement => {
        let statementScore = 0;
        const evidence: string[] = [];

        if (framework.id === 'cqc') {
          statementScore = this.scoreCqcStatement(statement.id, {
            trainingRate, docRate, compRate, cqcMandatedRate, compStatementMap,
            satRate, satTotal, satAvgRating, engAvgScore, engTotal, incRate,
            totalStaff, staffingAdequacyRate
          }, evidence);
        } else if (framework.id === 'ciw') {
          // Wales has its own statements, and its own scoring. It used to fall
          // through to the CQC scorer, which was correct only while the Welsh
          // statements were CQC's.
          statementScore = this.scoreCiwStatement(statement.id, {
            trainingRate, docRate, compRate, satRate, satTotal, engAvgScore, engTotal,
            incRate, totalStaff
          }, evidence);
        } else if (framework.id === 'care-inspectorate') {
          statementScore = this.scoreCareInspectorateStatement(statement.id, {
            trainingRate, docRate, compRate, satRate, incRate, engAvgScore, totalStaff
          });
        } else if (framework.id === 'rqia') {
          statementScore = this.scoreRqiaStatement(statement.id, {
            trainingRate, docRate, compRate, satRate, incRate, engAvgScore, totalStaff
          });
        } else {
          // Fallback for unknown frameworks.
          statementScore = this.scoreGenericStatement(domain.key, {
            trainingRate, docRate, compRate, satRate, incRate, engAvgScore, totalStaff
          });
        }

        statementScore = Math.round(clampRate(statementScore));
        details[statement.id] = statementScore;
        score += statementScore;
      });

      const domainScore = Math.round(score / domain.statements.length);
      return {
        key: domain.key,
        label: domain.label,
        color: domain.color,
        score: domainScore,
        statements: domain.statements.map(s => ({
          ...s,
          score: details[s.id] || 0
        }))
      };
    });

    const overall = domains.length
      ? Math.round(domains.reduce((sum, d) => sum + d.score, 0) / domains.length)
      : 0;

    const gaps = buildGapMessages(framework, {
      trainingRate, docRate, compRate, cqcMandatedRate, expiringCount,
      satTotal, engTotal, severeOpen, totalStaff,
      staffingAdequacyRate, totalUncoveredShifts: totalShifts - adequatelyStaffed,
      backgroundCheckCoverage,
      vettingCheckName: getVettingScheme(checkResult.rows[0]?.org_scheme).checkName
    });

    // No band unless the regulator publishes one.
    //
    // CIW: "We award a rating for each inspection theme. We do not award one
    // overall rating for the service as a whole." RQIA publishes narrative
    // inspection reports and no numeric scale at all. Labelling an average of
    // our own theme scores "Good" under either regulator's name would be
    // inventing a rating on their behalf. `overall` stays as an internal
    // summary; only the word is withheld.
    const publishesOverall = framework.publishesOverallRating !== false && !!framework.ratings?.length;
    const overallLabel = publishesOverall ? overallRatingLabel(framework, overall) : null;

    return {
      overall,
      overallLabel,
      // Explicit rather than inferred from a null label, so a client does not
      // have to guess whether a missing band is a bug or the regulator's position.
      publishesOverallRating: publishesOverall,
      framework: {
        id: framework.id,
        name: framework.name,
        country: framework.country,
        ratings: framework.ratings,
        ratingsNote: framework.ratingsNote,
        source: framework.source,
        description: framework.description,
        publishesOverallRating: framework.publishesOverallRating !== false,
      },
      domains,
      // Themes the regulator does not rate for this kind of service. Said
      // out loud rather than silently absent, so nobody wonders where it went.
      notApplicableDomains,
      gaps,
      metrics: {
        training_completion_rate: Math.round(trainingRate),
        document_compliance_rate: Math.round(docRate),
        // Read this one, not document_compliance_rate, to know whether the
        // workforce is actually vetted. See the query above for why.
        background_check_coverage_rate: Math.round(backgroundCheckCoverage),
        competency_pass_rate: Math.round(compRate),
        total_staff: totalStaff,
        expiring_training: expiringCount,
        satisfaction_rate: Math.round(satRate),
        satisfaction_responses: satTotal,
        engagement_score: Math.round(engAvgScore),
        engagement_responses: engTotal,
        cqc_mandated_training_rate: Math.round(cqcMandatedRate),
        severe_open_incidents: severeOpen,
        total_incidents: incTotal,
        staffing_adequacy_rate: Math.round(staffingAdequacyRate),
        total_uncovered_shifts: totalShifts - adequatelyStaffed,
      },
      generated_at: new Date().toISOString()
    };
  }

  /**
   * Wales: CIW's twelve lines of enquiry, scored on their own terms.
   *
   * CIW describes what it looks at in terms of outcomes for people and the
   * quality of the service delivered, so the weighting here leans on outcomes
   * and on what staff are evidenced to do, rather than on the CQC statement
   * numbering it used to be handed.
   *
   * `LOE-9` (Environment) is only ever scored for service types CIW rates
   * Environment for; a domiciliary provider's domains are filtered before
   * scoring, so it never reaches here.
   */
  private static scoreCiwStatement(
    statementId: string,
    ctx: {
      trainingRate: number; docRate: number; compRate: number; satRate: number;
      satTotal: number; engAvgScore: number; engTotal: number; incRate: number; totalStaff: number;
    },
    evidence: string[]
  ): number {
    const { trainingRate, docRate, compRate, satRate, satTotal, engAvgScore, incRate, totalStaff } = ctx;
    const anyStaff = totalStaff > 0;
    // CIW's focus is explicitly on people's experiences and outcomes, so where
    // we have outcome data it leads, and training or competency stands in for
    // it only when we do not.
    const outcomes = satRate > 0 ? satRate : (trainingRate > 0 ? BASELINE_RATE : 0);
    const competent = safeAvg(trainingRate, compRate);

    switch (statementId) {
      // Well-being — whether people are achieving positive outcomes in their lives
      case 'LOE-1': evidence.push('satisfaction surveys'); return outcomes;
      case 'LOE-2': evidence.push('satisfaction surveys'); return satRate > 0 ? clampRate(satRate + WEIGHT_MINOR_BONUS) : (anyStaff ? BASELINE_RATE : NO_DATA_RATE);
      case 'LOE-3': evidence.push('incidents'); return incRate;
      case 'LOE-4': return satRate > 0 ? satRate : (anyStaff ? BASELINE_RATE : NO_DATA_RATE);
      // Care and support — quality delivered by knowledgeable, skilled staff
      case 'LOE-5': evidence.push('competency assessments'); return compRate;
      case 'LOE-6': evidence.push('training records'); return competent;
      case 'LOE-7': return compRate > 0 ? compRate : (trainingRate > 0 ? BASELINE_RATE : NO_DATA_RATE);
      case 'LOE-8': evidence.push('identity documents', 'training records'); return safeAvg(docRate, competent);
      // Environment — premises-based services only
      case 'LOE-9': return docRate;
      // Leadership and management
      case 'LOE-10': evidence.push('staff engagement'); return engAvgScore > 0 ? engAvgScore : (anyStaff ? BASELINE_RATE : NO_DATA_RATE);
      case 'LOE-11': evidence.push('training records'); return trainingRate;
      case 'LOE-12': evidence.push('competency assessments', 'staff engagement'); return safeAvg(compRate, engAvgScore > 0 ? engAvgScore : BASELINE_RATE);
      default: return this.scoreGenericStatement('well-being', ctx);
    }
  }

  private static scoreCqcStatement(
    statementId: string,
    ctx: {
      trainingRate: number; docRate: number; compRate: number; cqcMandatedRate: number;
      compStatementMap: Record<string, number>; satRate: number; satTotal: number;
      satAvgRating: number; engAvgScore: number; engTotal: number; incRate: number;
      totalStaff: number; staffingAdequacyRate: number;
    },
    evidence: string[]
  ): number {
    const { trainingRate, docRate, compRate, cqcMandatedRate, compStatementMap,
            satRate, satTotal, satAvgRating, engAvgScore, engTotal, incRate, totalStaff,
            staffingAdequacyRate } = ctx;

    switch (statementId) {
      // Safe domain
      case 'S1': return clampRate(trainingRate);
      case 'S2': return safeAvg(trainingRate, docRate);
      case 'S3': return docRate;
      case 'S4': return compRate;
      case 'S5': return staffingAdequacyRate > 0 ? clampRate(staffingAdequacyRate) : clampRate(trainingRate);
      case 'S6': return cqcMandatedRate > 0 ? cqcMandatedRate : weightedScore(docRate, 1, WEIGHT_MINOR_BONUS);
      case 'S7': return clampRate(trainingRate);
      case 'S8': return compRate;

      // Effective domain
      case 'E1': return weightedScore(trainingRate, 0.9, 10);
      case 'E2': return compStatementMap['E2'] ?? weightedScore(compRate, 0.9, 10);
      case 'E3': return trainingRate > 0 ? 75 : NO_DATA_RATE;
      case 'E4': return totalStaff > 0 ? 70 : NO_DATA_RATE;
      case 'E5': return compStatementMap['E5'] ?? (compRate > 0 ? 75 : NO_DATA_RATE);
      case 'E6': return trainingRate > 0 ? 80 : NO_DATA_RATE;
      case 'E7': return 65;

      // Caring domain
      case 'C1': return satRate > 0 ? satRate : (totalStaff > 0 ? BASELINE_RATE : NO_DATA_RATE);
      case 'C2': return satRate > 0 ? clampRate(satRate + WEIGHT_MINOR_BONUS) : (totalStaff > 0 ? BASELINE_RATE : NO_DATA_RATE);
      case 'C3': return satRate > 0 ? clampRate(satRate + WEIGHT_MINOR_BONUS) : (totalStaff > 0 ? BASELINE_RATE : NO_DATA_RATE);
      case 'C4': return satRate > 0 ? satRate : (trainingRate > 0 ? BASELINE_RATE : NO_DATA_RATE);
      case 'C5': return engAvgScore > 0 ? engAvgScore : (totalStaff > 0 ? BASELINE_RATE : NO_DATA_RATE);

      // Responsive domain
      case 'R1': return incRate;
      case 'R2': return clampRate(trainingRate);
      case 'R3': return incRate > 50 ? 75 : incRate;
      case 'R4': return incRate;
      case 'R5': return docRate;
      case 'R6': return weightedScore(docRate, 0.9, 0);
      case 'R7': return incRate > 50 ? 70 : incRate;

      // Well-led domain
      case 'W1': return engAvgScore > 0 ? engAvgScore : (totalStaff > 0 ? BASELINE_RATE : NO_DATA_RATE);
      case 'W2': return engAvgScore > 0 ? clampRate(engAvgScore + WEIGHT_MINOR_BONUS) : (totalStaff > 0 ? BASELINE_RATE : NO_DATA_RATE);
      case 'W3': return engAvgScore > 0 ? engAvgScore : 60;
      case 'W4': return engAvgScore > 0 ? clampRate(engAvgScore + WEIGHT_MINOR_BONUS) : 60;
      case 'W5': return compRate > 0 ? 70 : NO_DATA_RATE;
      case 'W6': return engAvgScore > 0 ? engAvgScore : 60;
      case 'W7': return 60;

      default: return this.scoreGenericStatement('safe', { trainingRate, docRate, compRate, satRate, incRate, engAvgScore, totalStaff });
    }
  }

  private static scoreCareInspectorateStatement(
    statementId: string,
    ctx: { trainingRate: number; docRate: number; compRate: number; satRate: number; incRate: number; engAvgScore: number; totalStaff: number }
  ): number {
    const { trainingRate, docRate, compRate, satRate, incRate, engAvgScore, totalStaff } = ctx;
    switch (statementId) {
      // Quality of Care and Support
      case 'QC1': return satRate > 0 ? satRate : (trainingRate > 0 ? BASELINE_RATE : NO_DATA_RATE);
      case 'QC2': return safeAvg(docRate, compRate);
      case 'QC3': return clampRate(trainingRate);
      case 'QC4': return safeAvg(compRate, trainingRate);
      // Quality of Environment
      case 'QE1': return docRate;
      case 'QE2': return satRate > 0 ? satRate : (totalStaff > 0 ? BASELINE_RATE : NO_DATA_RATE);
      // Quality of Staffing
      case 'QS1': return totalStaff > 0 ? 75 : NO_DATA_RATE;
      case 'QS2': return clampRate(trainingRate);
      case 'QS3': return engAvgScore > 0 ? engAvgScore : (totalStaff > 0 ? BASELINE_RATE : NO_DATA_RATE);
      // Quality of Management and Leadership
      case 'QM1': return engAvgScore > 0 ? engAvgScore : (totalStaff > 0 ? BASELINE_RATE : NO_DATA_RATE);
      case 'QM2': return compRate > 0 ? 70 : NO_DATA_RATE;
      case 'QM3': return satRate > 0 ? satRate : (engAvgScore > 0 ? BASELINE_RATE : NO_DATA_RATE);
      default: return this.scoreGenericStatement('quality-care-support', ctx);
    }
  }

  /**
   * Northern Ireland: RQIA's four domains, scored on their own terms.
   *
   * The identifiers below are MeticleCare's, and deliberately do not look like
   * RQIA's. RQIA publishes no numbered quality statements, so there is nothing
   * real for a `NI-S1` to point at — the previous set of fourteen invented
   * identifiers is gone rather than renamed.
   */
  private static scoreRqiaStatement(
    statementId: string,
    ctx: { trainingRate: number; docRate: number; compRate: number; satRate: number; incRate: number; engAvgScore: number; totalStaff: number }
  ): number {
    const { trainingRate, docRate, compRate, satRate, incRate, engAvgScore, totalStaff } = ctx;
    const anyStaff = totalStaff > 0;
    switch (statementId) {
      // Is care safe?
      case 'safe-1': return incRate;
      case 'safe-2': return safeAvg(docRate, trainingRate);
      case 'safe-3': return trainingRate;
      case 'safe-4': return docRate;
      // Is care effective?
      case 'effective-1': return compRate;
      case 'effective-2': return safeAvg(trainingRate, compRate);
      case 'effective-3': return satRate > 0 ? satRate : (anyStaff ? BASELINE_RATE : NO_DATA_RATE);
      // Is care compassionate?
      case 'compassionate-1': return satRate > 0 ? satRate : (anyStaff ? BASELINE_RATE : NO_DATA_RATE);
      case 'compassionate-2': return satRate > 0 ? clampRate(satRate + WEIGHT_MINOR_BONUS) : (anyStaff ? BASELINE_RATE : NO_DATA_RATE);
      // Is the service well led?
      case 'well-led-1': return engAvgScore > 0 ? engAvgScore : (docRate > 0 ? docRate : (anyStaff ? BASELINE_RATE : NO_DATA_RATE));
      case 'well-led-2': return engAvgScore > 0 ? engAvgScore : (anyStaff ? BASELINE_RATE : NO_DATA_RATE);
      case 'well-led-3': return compRate > 0 ? 70 : NO_DATA_RATE;
      default: return this.scoreGenericStatement('safe', ctx);
    }
  }

  private static scoreGenericStatement(
    domainKey: string,
    ctx: { trainingRate: number; docRate: number; compRate: number; satRate: number; incRate: number; engAvgScore: number; totalStaff: number }
  ): number {
    const { trainingRate, docRate, compRate, satRate, incRate, engAvgScore, totalStaff } = ctx;
    switch (domainKey) {
      case 'safe':
      case 'quality-care-support':
      case 'well-being':
        return safeAvg(trainingRate, docRate);
      case 'effective':
      case 'quality-environment':
      case 'environment':
        return weightedScore(compRate, 0.8, 20);
      case 'caring':
      case 'compassionate':
      case 'quality-staffing':
        return satRate > 0 ? satRate : (totalStaff > 0 ? clampRate(trainingRate) : 50);
      case 'responsive':
      case 'quality-management':
      case 'care-and-support':
        return incRate > 0 ? incRate : (docRate > 0 ? weightedScore(docRate, 1, WEIGHT_MINOR_BONUS) : 50);
      case 'leadership-and-management':
      case 'well-led':
      default:
        return engAvgScore > 0 ? engAvgScore : (totalStaff > 0 ? BASELINE_RATE : 30);
    }
  }
}

function overallRatingLabel(framework: FrameworkDef, overall: number): string {
  if (framework.ratings && framework.ratings.length > 0) {
    for (const r of framework.ratings) {
      if (overall >= r.min) return r.label
    }
    return framework.ratings[framework.ratings.length - 1].label
  }
  return overall >= 81 ? 'Good' : overall >= 61 ? 'Requires Improvement' : 'Inadequate'
}

function buildGapMessages(
  framework: FrameworkDef,
  ctx: {
    trainingRate: number; docRate: number; compRate: number; cqcMandatedRate: number;
    expiringCount: number; satTotal: number; engTotal: number; severeOpen: number; totalStaff: number;
    staffingAdequacyRate: number; totalUncoveredShifts: number;
    backgroundCheckCoverage: number; vettingCheckName: string;
  }
): string[] {
  const { trainingRate, docRate, compRate, cqcMandatedRate, expiringCount, satTotal, engTotal, severeOpen, totalStaff, staffingAdequacyRate, totalUncoveredShifts, backgroundCheckCoverage, vettingCheckName } = ctx;
  const gaps: string[] = [];

  // Phrased by the check's real name, so a Scottish provider is not told to go
  // and get DBS certificates.
  if (totalStaff > 0 && backgroundCheckCoverage < TARGET_RATE) {
    gaps.push(
      `${Math.round(backgroundCheckCoverage)}% of active staff hold a valid ${vettingCheckName} — target ${TARGET_RATE}%+`,
    );
  }

  if (trainingRate < TARGET_RATE) gaps.push(`Training completion is ${Math.round(trainingRate)}% — target ${TARGET_RATE}%+`);
  if (docRate < TARGET_RATE) gaps.push(`Identity document compliance is ${Math.round(docRate)}% — target ${TARGET_RATE}%+`);
  if (compRate < TARGET_RATE) gaps.push(`Competency assessment pass rate is ${Math.round(compRate)}% — target ${TARGET_RATE}%+`);
  if (expiringCount > 0) gaps.push(`${expiringCount} training records expiring within 30 days`);

  // Framework-specific mandated-training wording
  if (framework.id === 'cqc' && cqcMandatedRate < TARGET_RATE) {
    gaps.push(`CQC-mandated training completion is ${Math.round(cqcMandatedRate)}% — target ${TARGET_RATE}%+`);
  } else if (framework.id === 'ciw' && cqcMandatedRate < TARGET_RATE) {
    gaps.push(`Statutory training completion is ${Math.round(cqcMandatedRate)}% — target ${TARGET_RATE}%+`);
  } else if ((framework.id === 'care-inspectorate' || framework.id === 'rqia') && cqcMandatedRate < TARGET_RATE) {
    gaps.push(`Mandatory training completion is ${Math.round(cqcMandatedRate)}% — target ${TARGET_RATE}%+`);
  }

  // Framework-specific domain wording for survey/incident gaps. Resolved from
  // the framework's own domain keys, so a Welsh gap names Well-being and a
  // Northern Irish one names "Is care compassionate?" — not CQC's "Caring".
  const domainLabel = (key: string, fallback: string) =>
    framework.domains.find(d => d.key === key)?.label ?? fallback;
  const ev = framework.evidenceDomains;
  const caringLabel = domainLabel(ev?.experience ?? 'caring', 'Caring');
  const wellLedLabel = domainLabel(ev?.leadership ?? 'well-led', 'Well-led');
  const responsiveLabel = domainLabel(ev?.incidents ?? 'responsive', 'Responsive');

  if (satTotal === 0) gaps.push(`No satisfaction surveys recorded — add feedback to improve the ${caringLabel} domain`);
  if (engTotal === 0) gaps.push(`No staff engagement surveys recorded — measure workforce wellbeing for the ${wellLedLabel} domain`);
  if (severeOpen > 0) gaps.push(`${severeOpen} severe open incidents need resolution to improve the ${responsiveLabel} domain`);
  if (totalStaff === 0) gaps.push('No active staff records found');
  if (totalUncoveredShifts > 0) gaps.push(`${totalUncoveredShifts} shifts were uncovered or understaffed in the last 90 days — staffing adequacy is ${Math.round(staffingAdequacyRate)}%`);

  return gaps;
}

// ---- CQC Action Items ----
export class CqcActionRepository {
  static async getActionItems(orgId: string, filters?: { status?: string; staff_id?: string }) {
    let sql = `SELECT ai.*, COALESCE(sp.first_name || ' ' || sp.last_name, '') as staff_name,
               (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = ai.created_by) as created_by_name
               FROM cqc_action_items ai
               LEFT JOIN staff_profiles sp ON ai.staff_id = sp.id
               WHERE ai.organization_id = $1`;
    const params: any[] = [orgId]; let idx = 2;
    if (filters?.status) { sql += ` AND ai.status = $${idx++}`; params.push(filters.status); }
    if (filters?.staff_id) { sql += ` AND ai.staff_id = $${idx++}`; params.push(filters.staff_id); }
    sql += ' ORDER BY CASE ai.priority WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 ELSE 3 END, ai.created_at DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async createActionItem(orgId: string, data: any) {
    const result = await query(
      `INSERT INTO cqc_action_items (organization_id, staff_id, cqc_statement, description, status, priority, due_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [orgId, data.staff_id || null, data.cqc_statement, data.description, 'open', data.priority || 'medium', data.due_date || null, data.created_by || null]
    );
    return result.rows[0];
  }

  static async updateActionItem(id: string, orgId: string, data: any) {
    const fields: string[] = []; const params: any[] = []; let idx = 1;
    const allowed = new Set(['staff_id', 'status', 'priority', 'due_date', 'description']);
    for (const [k, v] of Object.entries(data)) {
      if (!allowed.has(k)) continue;
      if (k === 'status' && v === 'completed') fields.push('completed_at = NOW()');
      fields.push(`${k} = $${idx++}`); params.push(v);
    }
    if (fields.length === 0) return null;
    params.push(id, orgId);
    const result = await query(`UPDATE cqc_action_items SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx++} AND organization_id = $${idx} RETURNING *`, params);
    return result.rows[0] || null;
  }

  static async deleteActionItem(id: string, orgId: string) {
    const result = await query('DELETE FROM cqc_action_items WHERE id = $1 AND organization_id = $2 RETURNING id', [id, orgId]);
    return result.rows[0] || null;
  }
}
