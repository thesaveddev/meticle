import { Request, Response } from 'express';
import pool from '../../shared/database';
import { DsptRepository, DSPT_STANDARDS } from './dspt.repository';
import { AppError } from '../../shared/middleware/error.middleware';

export class DsptController {
  static async getStatus(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID required');
    const status = await DsptRepository.getStatus(orgId);
    const activeAssessment = await pool.query(
      `SELECT da.*,
        (SELECT COUNT(*) FROM dspt_standard_status dss WHERE dss.assessment_id = da.id AND dss.status IN ('met', 'exceeded')) as met_count,
        (SELECT COUNT(*) FROM dspt_standard_status dss WHERE dss.assessment_id = da.id) as total_count
       FROM dspt_assessments da
       WHERE da.organization_id = $1 AND da.assessment_year = '2025-26'
       ORDER BY da.created_at DESC LIMIT 1`,
      [orgId]
    );
    res.json({
      status,
      standards: DSPT_STANDARDS,
      activeAssessment: activeAssessment.rows[0] || null,
      deadline: '2026-06-30',
    });
  }

  static async createAssessment(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID required');
    const assessment = await DsptRepository.createAssessment(orgId);
    await DsptRepository.updateStatus(orgId, 'in_progress');
    res.status(201).json(assessment);
  }

  static async getAssessmentDetail(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID required');
    const { id } = req.params;
    const detail = await DsptRepository.getAssessmentDetail(id, orgId);
    if (!detail) throw new AppError(404, 'Assessment not found');
    res.json(detail);
  }

  static async updateStandardStatus(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID required');
    const { id, standardKey } = req.params;
    const { status, evidence_notes } = req.body;

    const assessment = await DsptRepository.getAssessmentDetail(id, orgId);
    if (!assessment) throw new AppError(404, 'Assessment not found');

    const updated = await DsptRepository.updateStandardStatus(id, standardKey, { status, evidence_notes });
    if (!updated) throw new AppError(404, 'Standard not found for this assessment');
    res.json(updated);
  }

  static async submitAssessment(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID required');
    const { id } = req.params;
    const assessment = await DsptRepository.submitAssessment(id, orgId);
    if (!assessment) throw new AppError(404, 'Assessment not found');
    res.json(assessment);
  }
}