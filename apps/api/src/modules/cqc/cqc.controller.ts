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
      gaps.push({ area: 'Satisfaction Surveys', statement: 'C1 — Kindness, compassion and dignity (Caring)', current_state: 'No satisfaction surveys have been collected', recommended_action: 'Send email invitations to service users and families for feedback', priority: 'MEDIUM', domain: 'caring', effort: 'Set up and send invitations' });
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
