import { Request, Response } from 'express';
import { CompetencyRepository } from './competency.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { requireSameOrgForStaff } from '../../shared/database/tenant';
import { AuditRepository } from '../audit/audit.repository';
import pool from '../../shared/database';

export class CompetencyController {
  static async getTemplates(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const templates = await CompetencyRepository.getTemplates(orgId!);
    res.json(templates);
  }

  static async createTemplate(req: Request, res: Response) {
    const user = req.user!;
    const orgId = user.organizationId;
    const { name, category, description, criteria, requires_reassessment_days, cqc_statement_id, required_for_roles } = req.body;
    if (!name?.trim()) throw new AppError(400, 'Template name is required');
    const template = await CompetencyRepository.createTemplate({
      organization_id: orgId!, name, category, description, criteria, requires_reassessment_days, cqc_statement_id, required_for_roles
    });
    AuditRepository.log({ user_id: user.userId, action: 'create', entity_type: 'competency_template', entity_id: template.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.status(201).json(template);
  }

  static async updateTemplate(req: Request, res: Response) {
    const user = req.user!;
    const orgId = user.organizationId;
    const template = await CompetencyRepository.updateTemplate(req.params.id, orgId!, req.body);
    if (!template) throw new AppError(404, 'Template not found');
    AuditRepository.log({ user_id: user.userId, action: 'update', entity_type: 'competency_template', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(template);
  }

  static async deleteTemplate(req: Request, res: Response) {
    const user = req.user!;
    const orgId = user.organizationId;
    const deleted = await CompetencyRepository.deleteTemplate(req.params.id, orgId!);
    if (!deleted) throw new AppError(404, 'Template not found');
    AuditRepository.log({ user_id: user.userId, action: 'delete', entity_type: 'competency_template', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Template deleted' });
  }

  static async getAssessments(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const { templateId, staffId } = req.query as any;
    const assessments = await CompetencyRepository.getAssessments(orgId!, templateId, staffId);
    res.json(assessments);
  }

  static async createAssessment(req: Request, res: Response) {
    const user = req.user!;
    const orgId = user.organizationId;
    const userId = user.userId;
    const { template_id, staff_id, passed, assessed_at, reassessment_date, assessor_id, involved_parties, notes, score, max_score, rubric_responses, evidence_url } = req.body;
    if (!template_id || !staff_id || passed === undefined) {
      throw new AppError(400, 'template_id, staff_id, and passed are required');
    }
    await requireSameOrgForStaff(user, staff_id);
    const templateCheck = await pool.query('SELECT 1 FROM competency_templates WHERE id = $1 AND organization_id = $2', [template_id, orgId]);
    if (templateCheck.rows.length === 0) throw new AppError(404, 'Competency template not found');
    const assessment = await CompetencyRepository.createAssessment({
      template_id, staff_id, assessor_id: assessor_id || userId,
      passed: Boolean(passed), assessed_at: assessed_at || null, reassessment_date, involved_parties, notes,
      score, max_score, rubric_responses, evidence_url
    });
    AuditRepository.log({ user_id: user.userId, action: 'assess', entity_type: 'competency_assessment', entity_id: assessment.id, new_data: { template_id, staff_id, passed }, ip_address: req.ip }).catch(() => {});
    res.status(201).json(assessment);
  }

  static async deleteAssessment(req: Request, res: Response) {
    const user = req.user!;
    const orgId = user.organizationId;
    const deleted = await CompetencyRepository.deleteAssessment(req.params.id, orgId!);
    if (!deleted) throw new AppError(404, 'Assessment not found');
    AuditRepository.log({ user_id: user.userId, action: 'delete', entity_type: 'competency_assessment', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Assessment deleted' });
  }

  static async getPending(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const pending = await CompetencyRepository.getPending(orgId!);
    res.json(pending);
  }
}
