import { Request, Response } from 'express';
import pool from '../../shared/database';
import { CqcRepository } from './cqc.repository';
import { CqcActionRepository } from './cqc.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { getFrameworkList } from './frameworks';

export class CqcController {
  static async getReadiness(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID required');
    const orgResult = await pool.query('SELECT regulator FROM organizations WHERE id = $1', [orgId]);
    const regulator = orgResult.rows[0]?.regulator || 'cqc';
    const readiness = await CqcRepository.calculateReadiness(orgId, regulator);
    res.json({ data: readiness });
  }

  static async getFrameworks(_req: Request, res: Response) {
    res.json(getFrameworkList());
  }

  static async getGapAnalysis(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID required');

    const orgResult = await pool.query('SELECT regulator, name FROM organizations WHERE id = $1', [orgId]);
    const regulator = orgResult.rows[0]?.regulator || 'cqc';
    const readiness = await CqcRepository.calculateReadiness(orgId, regulator);

    const trainingStats = await pool.query(
      `SELECT
        COUNT(DISTINCT tr.id) as total_records,
        COUNT(DISTINCT tr.id) FILTER (WHERE tr.status = 'completed') as passed_records,
        COUNT(DISTINCT tm.id) as total_modules
       FROM training_modules tm
       LEFT JOIN training_records tr ON tm.id = tr.module_id
       LEFT JOIN staff_profiles sp ON tr.staff_id = sp.id
       LEFT JOIN users u ON sp.user_id = u.id
       WHERE u.organization_id = $1`, [orgId]
    );

    const compStats = await pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE passed = true) as passed
       FROM competency_assessments ca
       JOIN competency_templates ct ON ca.template_id = ct.id
       WHERE ct.organization_id = $1`, [orgId]
    );

    const docStats = await pool.query(
      `SELECT
        COUNT(DISTINCT sp.id) as total_staff,
        COUNT(DISTINCT d.staff_id) as with_docs,
        COUNT(*) FILTER (WHERE d.expiry_date < CURRENT_DATE) as expired,
        COUNT(*) FILTER (WHERE d.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30) as expiring_soon
       FROM staff_profiles sp
       JOIN users u ON sp.user_id = u.id
       LEFT JOIN documents d ON d.staff_id = sp.id AND d.type IN ('DBS','PASSPORT','VISA','RIGHT_TO_WORK')
       WHERE u.organization_id = $1 AND u.status = 'active'`, [orgId]
    );

    const incidentStats = await pool.query(
      `SELECT COUNT(*) as total FROM incidents WHERE organization_id = $1`, [orgId]
    );

    const satisfactionStats = await pool.query(
      `SELECT AVG(rating)::numeric(10,2) as avg_rating, COUNT(*) as total
       FROM satisfaction_surveys WHERE organization_id = $1`, [orgId]
    );

    const engagementStats = await pool.query(
      `SELECT COUNT(*) as total FROM staff_engagement_surveys ses
       LEFT JOIN engagement_templates et ON ses.template_id = et.id
       WHERE ses.organization_id = $1`, [orgId]
    );

    // Build domain scores map from domains array
    const domainScores: Record<string, any> = {}
    for (const d of (readiness as any).domains || []) {
      domainScores[d.key] = d
    }
    const gaps: any[] = [];

    const getScore = (key: string) => domainScores[key]?.score ?? 0;

    const safeScore = getScore('safe');
    const effectiveScore = getScore('effective');
    const caringScore = getScore('caring');
    const responsiveScore = getScore('responsive');
    const wellLedScore = getScore('well-led');

    const expiredDocs = parseInt(docStats.rows[0]?.expired || '0');
    const expiringDocs = parseInt(docStats.rows[0]?.expiring_soon || '0');
    if (expiredDocs > 0) {
      gaps.push({ area: 'Identity Documents', statement: 'S4 — Involving people to manage risks (Safe)', current_state: `${expiredDocs} staff have expired identity documents`, recommended_action: 'Request renewal of expired documents and follow up within 7 days', priority: 'HIGH', domain: 'safe', effort: `${expiredDocs} renewals to process` });
    }
    if (expiringDocs > 0) {
      gaps.push({ area: 'Identity Documents', statement: 'S4 — Involving people to manage risks (Safe)', current_state: `${expiringDocs} documents expiring within 30 days`, recommended_action: 'Send renewal reminders and schedule renewals before expiry dates', priority: 'MEDIUM', domain: 'safe', effort: `${expiringDocs} reminders to send` });
    }

    const trainingPassed = parseInt(trainingStats.rows[0]?.passed_records || '0');
    const trainingTotal = parseInt(trainingStats.rows[0]?.total_records || '0');
    const totalModules = parseInt(trainingStats.rows[0]?.total_modules || '0');
    const trainingRate = trainingTotal > 0 ? (trainingPassed / trainingTotal) * 100 : 0;
    if (totalModules === 0) {
      gaps.push({ area: 'Training', statement: 'E2 — Evidence-based care and treatment (Effective)', current_state: 'No training modules have been created or assigned', recommended_action: 'Create training modules aligned to staff roles and CQC requirements', priority: 'HIGH', domain: 'effective', effort: 'Create modules + assign to roles' });
    } else if (trainingRate < 80) {
      gaps.push({ area: 'Training', statement: 'E2 — Evidence-based care and treatment (Effective)', current_state: `Training pass rate is ${Math.round(trainingRate)}%`, recommended_action: 'Review training content, provide remedial sessions for failed staff, retest within 30 days', priority: 'HIGH', domain: 'effective', effort: `${trainingTotal - trainingPassed} staff need retraining` });
    } else if (trainingRate < 95) {
      gaps.push({ area: 'Training', statement: 'E2 — Evidence-based care and treatment (Effective)', current_state: `Training pass rate is ${Math.round(trainingRate)}%`, recommended_action: 'Monitor remaining gaps and schedule catch-up sessions', priority: 'LOW', domain: 'effective', effort: 'Few staff to address' });
    }

    const compTotal = parseInt(compStats.rows[0]?.total || '0');
    const compPassed = parseInt(compStats.rows[0]?.passed || '0');
    const compRate = compTotal > 0 ? (compPassed / compTotal) * 100 : 0;
    if (compTotal === 0) {
      gaps.push({ area: 'Competency Assessments', statement: 'E5 — Monitoring and improving outcomes (Effective)', current_state: 'No competency assessments have been recorded', recommended_action: 'Set up competency templates and schedule initial assessments for all staff', priority: 'HIGH', domain: 'effective', effort: 'Create templates + assess all staff' });
    } else if (compRate < 70) {
      gaps.push({ area: 'Competency Assessments', statement: 'E5 — Monitoring and improving outcomes (Effective)', current_state: `Competency pass rate is ${Math.round(compRate)}%`, recommended_action: 'Review assessment criteria, provide targeted training for failed competencies, reassess within 60 days', priority: 'MEDIUM', domain: 'effective', effort: `${compTotal - compPassed} assessments to redo` });
    }

    const satStats = satisfactionStats.rows[0];
    const avgSat = parseFloat(satStats?.avg_rating || '0');
    const satTotal = parseInt(satStats?.total || '0');
    if (satTotal === 0) {
      gaps.push({ area: 'Satisfaction Surveys', statement: 'C1 — Kindness, compassion and dignity (Caring)', current_state: 'No satisfaction surveys have been collected', recommended_action: 'Send email invitations to people and families for feedback', priority: 'MEDIUM', domain: 'caring', effort: 'Set up and send invitations' });
    } else if (avgSat < 4) {
      gaps.push({ area: 'Satisfaction Surveys', statement: 'C1 — Kindness, compassion and dignity (Caring)', current_state: `Average satisfaction rating is ${avgSat}/5`, recommended_action: 'Review negative feedback, investigate common themes, create improvement plan', priority: 'HIGH', domain: 'caring', effort: 'Review and action feedback' });
    }

    const incidentTotal = parseInt(incidentStats.rows[0]?.total || '0');
    if (incidentTotal === 0) {
      gaps.push({ area: 'Incident Reporting', statement: 'R4 — Listening to and involving people (Responsive)', current_state: 'No incidents have been reported', recommended_action: 'Ensure staff are trained on incident reporting procedures and encouraged to report all incidents', priority: 'LOW', domain: 'responsive', effort: 'Staff training on reporting' });
    }

    const engagementTotal = parseInt(engagementStats.rows[0]?.total || '0');
    if (engagementTotal === 0) {
      gaps.push({ area: 'Staff Engagement', statement: 'Well-led domain evidence', current_state: 'No staff engagement surveys have been conducted', recommended_action: 'Create an engagement survey template and send to all active staff', priority: 'MEDIUM', domain: 'well-led', effort: 'Create + send survey' });
    }

    const priorityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    gaps.sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));

    const highCount = gaps.filter(g => g.priority === 'HIGH').length;
    const medCount = gaps.filter(g => g.priority === 'MEDIUM').length;

    res.json({
      gaps,
      summary: {
        total_gaps: gaps.length,
        high_priority: highCount,
        medium_priority: medCount,
        overall_rate: (readiness as any).overall || 0,
      }
    });
  }

  // ---- Homecare Compliance Dashboard ----
  static async getHomecareCompliance(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID required');

    // 1. Visit completion rate (last 30 days)
    const visitResult = await pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'missed') as missed,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress
       FROM homecare_visits
       WHERE organization_id = $1 AND scheduled_start >= CURRENT_DATE - INTERVAL '30 days'`, [orgId]
    );
    const visits = visitResult.rows[0];
    const visitTotal = parseInt(visits.total || '0');
    const visitCompleted = parseInt(visits.completed || '0');
    const visitMissed = parseInt(visits.missed || '0');
    const visitRate = visitTotal > 0 ? Math.round((visitCompleted / visitTotal) * 100) : 0;

    // 2. Care plan review status
    const carePlanResult = await pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE review_date IS NULL OR review_date < CURRENT_DATE) as overdue,
        COUNT(*) FILTER (WHERE review_date >= CURRENT_DATE AND review_date <= CURRENT_DATE + 14) as due_soon
       FROM care_plans cp
       JOIN people p ON cp.person_id = p.id
       WHERE p.organization_id = $1 AND cp.status = 'active'`, [orgId]
    );
    const carePlans = carePlanResult.rows[0];
    const cpTotal = parseInt(carePlans.total || '0');
    const cpOverdue = parseInt(carePlans.overdue || '0');
    const cpDueSoon = parseInt(carePlans.due_soon || '0');

    // 3. Incident summary (last 30 days)
    const incidentResult = await pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE severity = 'critical' OR severity = 'high') as serious,
        COUNT(*) FILTER (WHERE status = 'open' OR status = 'investigating') as open
       FROM incidents
       WHERE organization_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '30 days'`, [orgId]
    );
    const incidents = incidentResult.rows[0];
    const incidentTotal = parseInt(incidents.total || '0');
    const incidentSerious = parseInt(incidents.serious || '0');
    const incidentOpen = parseInt(incidents.open || '0');

    // 4. Staff training compliance
    const staffTrainingResult = await pool.query(
      `SELECT
        COUNT(DISTINCT sp.user_id) as total_staff,
        COUNT(DISTINCT sp.user_id) FILTER (
          WHERE NOT EXISTS (
            SELECT 1 FROM training_records tr
            JOIN training_modules tm ON tr.module_id = tm.id
            WHERE tr.staff_id = sp.id AND tr.status = 'completed'
              AND (tr.expires_at IS NULL OR tr.expires_at > CURRENT_DATE)
          )
        ) as non_compliant
       FROM staff_profiles sp
       JOIN users u ON sp.user_id = u.id
       WHERE u.organization_id = $1 AND u.status = 'active'`, [orgId]
    );
    const staffTraining = staffTrainingResult.rows[0];
    const totalStaff = parseInt(staffTraining.total_staff || '0');
    const nonCompliantStaff = parseInt(staffTraining.non_compliant || '0');
    const staffComplianceRate = totalStaff > 0 ? Math.round(((totalStaff - nonCompliantStaff) / totalStaff) * 100) : 100;

    // 5. DBS / identity document status
    const dbsResult = await pool.query(
      `SELECT
        COUNT(DISTINCT sp.user_id) as total,
        COUNT(DISTINCT sp.user_id) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM documents d
            WHERE d.staff_id = sp.id AND d.type = 'DBS'
              AND d.status IN ('approved', 'pending')
              AND (d.expiry_date IS NULL OR d.expiry_date > CURRENT_DATE)
          )
        ) as compliant
       FROM staff_profiles sp
       JOIN users u ON sp.user_id = u.id
       WHERE u.organization_id = $1 AND u.status = 'active'`, [orgId]
    );
    const dbs = dbsResult.rows[0];
    const dbsTotal = parseInt(dbs.total || '0');
    const dbsCompliant = parseInt(dbs.compliant || '0');
    const dbsRate = dbsTotal > 0 ? Math.round((dbsCompliant / dbsTotal) * 100) : 100;

    // 6. Missed visits requiring follow-up
    const missedVisitsResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM homecare_visits
       WHERE organization_id = $1 AND status = 'missed'
         AND scheduled_start >= CURRENT_DATE - INTERVAL '7 days'`, [orgId]
    );
    const missedVisits7d = parseInt(missedVisitsResult.rows[0]?.count || '0');

    // 7. Overdue risk assessments
    const riskResult = await pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE next_review_date IS NULL OR next_review_date < CURRENT_DATE) as overdue
       FROM risk_assessments ra
       JOIN people p ON ra.person_id = p.id
       WHERE p.organization_id = $1 AND ra.status = 'active'`, [orgId]
    );
    const risks = riskResult.rows[0];
    const riskTotal = parseInt(risks.total || '0');
    const riskOverdue = parseInt(risks.overdue || '0');

    // 8. Supervision / appraisal tracking
    const supervisionResult = await pool.query(
      `SELECT
        COUNT(DISTINCT sp.user_id) as total,
        COUNT(DISTINCT sp.user_id) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM audit_logs al
            WHERE al.user_id = sp.user_id AND al.action = 'supervision'
              AND al.created_at >= CURRENT_DATE - INTERVAL '6 months'
          )
        ) as supervised
       FROM staff_profiles sp
       JOIN users u ON sp.user_id = u.id
       WHERE u.organization_id = $1 AND u.status = 'active'`, [orgId]
    );
    const supervision = supervisionResult.rows[0];
    const supervisionTotal = parseInt(supervision.total || '0');
    const supervisionDone = parseInt(supervision.supervised || '0');
    const supervisionRate = supervisionTotal > 0 ? Math.round((supervisionDone / supervisionTotal) * 100) : 0;

    // KLOE domain scores (reuse existing readiness calculation)
    const readiness = await CqcRepository.calculateReadiness(orgId, 'cqc');

    res.json({
      visitCompletion: { total: visitTotal, completed: visitCompleted, missed: visitMissed, rate: visitRate },
      carePlans: { total: cpTotal, overdue: cpOverdue, dueSoon: cpDueSoon },
      incidents: { total: incidentTotal, serious: incidentSerious, open: incidentOpen },
      staffTraining: { total: totalStaff, nonCompliant: nonCompliantStaff, rate: staffComplianceRate },
      dbs: { total: dbsTotal, compliant: dbsCompliant, rate: dbsRate },
      missedVisits7d,
      riskAssessments: { total: riskTotal, overdue: riskOverdue },
      supervision: { total: supervisionTotal, done: supervisionDone, rate: supervisionRate },
      kloeScores: (readiness as any).domains || [],
      overallScore: (readiness as any).overall || 0,
    });
  }

  // ---- Action Items ----
  static async getActionItems(req: Request, res: Response) {
    const items = await CqcActionRepository.getActionItems(req.user!.organizationId!, req.query);
    res.json(items);
  }

  static async createActionItem(req: Request, res: Response) {
    const item = await CqcActionRepository.createActionItem(req.user!.organizationId!, { ...req.body, created_by: req.user!.userId });
    res.status(201).json(item);
  }

  static async updateActionItem(req: Request, res: Response) {
    const item = await CqcActionRepository.updateActionItem(req.params.id, req.user!.organizationId!, req.body);
    if (!item) throw new AppError(404, 'Action item not found');
    res.json(item);
  }

  static async deleteActionItem(req: Request, res: Response) {
    const deleted = await CqcActionRepository.deleteActionItem(req.params.id, req.user!.organizationId!);
    if (!deleted) throw new AppError(404, 'Action item not found');
    res.json({ message: 'Action item deleted' });
  }
}
