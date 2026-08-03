import { Request, Response } from 'express';
import { OutcomesRepository } from './outcomes.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { AuditRepository } from '../audit/audit.repository';

export class OutcomesController {
  static getOrgId(req: Request): string {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new AppError(403, 'Organization context required');
    return orgId;
  }

  // ─── Scales ───

  static async listScales(req: Request, res: Response) {
    const orgId = OutcomesController.getOrgId(req);
    const scales = await OutcomesRepository.findScales(orgId);
    res.json(scales);
  }

  static async getScale(req: Request, res: Response) {
    const orgId = OutcomesController.getOrgId(req);
    const scale = await OutcomesRepository.findScaleById(req.params.id, orgId);
    if (!scale) throw new AppError(404, 'Scale not found');
    res.json(scale);
  }

  static async createScale(req: Request, res: Response) {
    const orgId = OutcomesController.getOrgId(req);
    const scale = await OutcomesRepository.createScale(orgId, req.body);
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'outcome_scale', entity_id: scale.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(scale);
  }

  static async updateScale(req: Request, res: Response) {
    const orgId = OutcomesController.getOrgId(req);
    const scale = await OutcomesRepository.updateScale(req.params.id, req.body, orgId);
    if (!scale) throw new AppError(404, 'Scale not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'outcome_scale', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json(scale);
  }

  static async deleteScale(req: Request, res: Response) {
    const orgId = OutcomesController.getOrgId(req);
    await OutcomesRepository.deleteScale(req.params.id, orgId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'outcome_scale', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Scale deleted' });
  }

  // ─── Assessments ───

  static async recordAssessment(req: Request, res: Response) {
    const result = await OutcomesRepository.recordAssessment({ ...req.body, assessed_by: req.user!.userId });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'outcome_scale_result', entity_id: result.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(result);
  }

  static async listResults(req: Request, res: Response) {
    const { person_id, date_from, date_to } = req.query as any;
    const results = await OutcomesRepository.findResults(req.params.scaleId, { person_id, date_from, date_to });
    res.json(results);
  }

  static async getResult(req: Request, res: Response) {
    const result = await OutcomesRepository.findResultById(req.params.resultId);
    if (!result) throw new AppError(404, 'Result not found');
    res.json(result);
  }

  static async deleteResult(req: Request, res: Response) {
    await OutcomesRepository.deleteResult(req.params.id);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'outcome_scale_result', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Result deleted' });
  }

  static async listAllResults(req: Request, res: Response) {
    const orgId = OutcomesController.getOrgId(req);
    const { person_id } = req.query as any;
    const results = await OutcomesRepository.findAllResults(orgId, { person_id });
    res.json(results);
  }

  static async recordAssessmentFromBody(req: Request, res: Response) {
    const { scale_id, person_id, score, notes } = req.body;
    if (!scale_id || !person_id || score == null) throw new AppError(400, 'scale_id, person_id, and score are required');
    const result = await OutcomesRepository.recordAssessment({
      scale_id, person_id, total_score: score, assessed_by: req.user!.userId, notes,
    });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'outcome_scale_result', entity_id: result.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(result);
  }

  // ─── Analytics ───

  static async getPersonSummary(req: Request, res: Response) {
    const summary = await OutcomesRepository.getPersonSummary(req.params.personId);
    res.json(summary);
  }

  static async getPersonTrend(req: Request, res: Response) {
    const { scale_id, days } = req.query as any;
    const trend = await OutcomesRepository.getPersonTrend(req.params.personId, scale_id, days ? parseInt(days) : 90);
    res.json(trend);
  }

  static async getOrgSummary(req: Request, res: Response) {
    const orgId = OutcomesController.getOrgId(req);
    const summary = await OutcomesRepository.getOrgSummary(orgId);
    res.json(summary);
  }
}
