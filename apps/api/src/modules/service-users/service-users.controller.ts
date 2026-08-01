import { Request, Response } from 'express';
import pool from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import { ServiceUserRepository } from './service-users.repository';
import { requireServiceUserInOrg } from '../../shared/database/tenant';
import { EMedicationRepository } from '../emedication/emedication.repository';
import { AuditRepository } from '../audit/audit.repository';

export class ServiceUserController {
  static getOrgId(req: Request): string {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new AppError(403, 'Organization context required');
    return orgId;
  }

  static getUserId(req: Request): string {
    return req.user!.userId;
  }

  private static staffingFor(body: any): any {
    const level = body?.support_level;
    if (level === undefined || level === null) return body;
    const data = { ...body };
    if (level === 'one_to_one') data.min_staff_required = 1;
    else if (level === 'two_to_one') data.min_staff_required = 2;
    else if (level === 'three_to_one') data.min_staff_required = 3;
    else if (level === 'complex') {
      const ms = Math.round(Number(data.min_staff_required));
      data.min_staff_required = ms > 0 && ms <= 6 ? ms : 1;
    } else {
      data.min_staff_required = null;
    }
    return data;
  }

  private static decorate(row: any): any {
    if (!row) return row;
    if (row.min_staff_required == null && row.support_level) {
      if (row.support_level === 'one_to_one') row.min_staff_required = 1;
      else if (row.support_level === 'two_to_one') row.min_staff_required = 2;
      else if (row.support_level === 'three_to_one') row.min_staff_required = 3;
      else if (row.support_level === 'complex') row.min_staff_required = 1;
    }
    return row;
  }

  private static async assertLocationInOrg(orgId: string, locationId?: string | null) {
    if (!locationId) return;
    const r = await pool.query(`SELECT id FROM locations WHERE id = $1 AND organization_id = $2`, [locationId, orgId]);
    if (r.rows.length === 0) throw new AppError(400, 'Location not found in your organization');
  }

  // ---- Service Users ----
  static async list(req: Request, res: Response) {
    const orgId = ServiceUserController.getOrgId(req);
    const { status, search } = req.query as any;
    const users = await ServiceUserRepository.findAll(orgId, { status, search });
    res.json(users.map(ServiceUserController.decorate));
  }

  static async getById(req: Request, res: Response) {
    const orgId = ServiceUserController.getOrgId(req);
    const userId = ServiceUserController.getUserId(req);
    const user = await ServiceUserRepository.findById(req.params.id, orgId);
    if (!user) throw new AppError(404, 'Service user not found');
    await pool.query(
      'INSERT INTO service_user_access_log (service_user_id, accessed_by, action, ip_address) VALUES ($1, $2, $3, $4)',
      [req.params.id, userId, 'view', req.ip]
    );
    res.json(ServiceUserController.decorate(user));
  }

  static async create(req: Request, res: Response) {
    const orgId = ServiceUserController.getOrgId(req);
    await ServiceUserController.assertLocationInOrg(orgId, req.body?.location_id);
    const user = await ServiceUserRepository.create({ ...ServiceUserController.staffingFor(req.body), organization_id: orgId });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'service_user', entity_id: user.id, ip_address: req.ip }).catch(() => {});
    // Auto-create monthly MAR
    await EMedicationRepository.ensureMonthlyMar(orgId, user.id, req.user!.userId);
    res.status(201).json(ServiceUserController.decorate(user));
  }

  static async update(req: Request, res: Response) {
    const orgId = ServiceUserController.getOrgId(req);
    await ServiceUserController.assertLocationInOrg(orgId, req.body?.location_id);
    const user = await ServiceUserRepository.update(req.params.id, ServiceUserController.staffingFor(req.body), orgId);
    if (!user) throw new AppError(404, 'Service user not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'service_user', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(ServiceUserController.decorate(user));
  }

  static async uploadPhoto(req: Request, res: Response) {
    if (!req.file) throw new AppError(400, 'No photo file uploaded');
    const orgId = ServiceUserController.getOrgId(req);
    const url = '/files/private/' + req.file.filename;
    await ServiceUserRepository.update(req.params.id, { photo_url: url } as any, orgId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'service_user', entity_id: req.params.id, new_data: { photo_url: url }, ip_address: req.ip }).catch(() => {});
    res.json({ url });
  }

  static async bulkStatus(req: Request, res: Response) {
    const orgId = ServiceUserController.getOrgId(req);
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) throw new AppError(400, 'ids array required');
    if (!['active', 'discharged', 'deceased'].includes(status)) throw new AppError(400, 'Invalid status');
    const result = await ServiceUserRepository.bulkUpdateStatus(ids, status, orgId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'bulk_update', entity_type: 'service_user', entity_id: ids.join(','), new_data: { status, count: ids.length }, ip_address: req.ip }).catch(() => {});
    res.json({ updated: result.rowCount });
  }

  static async bulkDischarge(req: Request, res: Response) {
    const orgId = ServiceUserController.getOrgId(req);
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) throw new AppError(400, 'ids array required');
    const result = await ServiceUserRepository.bulkUpdateStatus(ids, 'discharged', orgId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'bulk_discharge', entity_type: 'service_user', entity_id: ids.join(','), new_data: { count: ids.length }, ip_address: req.ip }).catch(() => {});
    res.json({ updated: result.rowCount });
  }

  static async delete(req: Request, res: Response) {
    const orgId = ServiceUserController.getOrgId(req);
    const userId = ServiceUserController.getUserId(req);
    const existing = await ServiceUserRepository.findById(req.params.id, orgId);
    if (!existing) throw new AppError(404, 'Service user not found');
    await ServiceUserRepository.deleteServiceUser(req.params.id);
    await pool.query(
      'INSERT INTO service_user_access_log (service_user_id, accessed_by, action, ip_address) VALUES ($1, $2, $3, $4)',
      [req.params.id, userId, 'delete', req.ip]
    );
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'service_user', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Service user deleted' });
  }

  // ---- Care Plans ----
  static async createCarePlan(req: Request, res: Response) {
    const user = req.user!;
    const { serviceUserId } = req.params;
    await requireServiceUserInOrg(user, serviceUserId);
    await pool.query('INSERT INTO service_user_access_log (service_user_id, accessed_by, action, ip_address) VALUES ($1, $2, $3, $4)', [serviceUserId, user.userId, 'create_care_plan', req.ip]);
    const plan = await ServiceUserRepository.createCarePlan({ ...req.body, service_user_id: serviceUserId });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'care_plan', entity_id: plan.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(plan);
  }

  static async updateCarePlan(req: Request, res: Response) {
    const user = req.user!;
    // Verify care plan's parent service user belongs to org
    const planRows = await pool.query(
      'SELECT su.id FROM care_plans cp JOIN service_users su ON cp.service_user_id = su.id WHERE cp.id = $1 AND su.organization_id = $2',
      [req.params.id, user.organizationId]
    );
    if (planRows.rows.length === 0) throw new AppError(404, 'Care plan not found');
    const plan = await ServiceUserRepository.updateCarePlan(req.params.id, req.body);
    if (!plan) throw new AppError(404, 'Care plan not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'care_plan', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(plan);
  }

  static async deleteCarePlan(req: Request, res: Response) {
    const user = req.user!;
    const planRows = await pool.query(
      'SELECT su.id FROM care_plans cp JOIN service_users su ON cp.service_user_id = su.id WHERE cp.id = $1 AND su.organization_id = $2',
      [req.params.id, user.organizationId]
    );
    if (planRows.rows.length === 0) throw new AppError(404, 'Care plan not found');
    await pool.query('DELETE FROM care_plans WHERE id = $1', [req.params.id]);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'care_plan', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Care plan deleted' });
  }

  static async updateDailyNote(req: Request, res: Response) {
    const user = req.user!;
    const rows = await pool.query(
      'SELECT su.id FROM daily_notes dn JOIN service_users su ON dn.service_user_id = su.id WHERE dn.id = $1 AND su.organization_id = $2',
      [req.params.id, user.organizationId]
    );
    if (rows.rows.length === 0) throw new AppError(404, 'Daily note not found');
    const note = await ServiceUserRepository.updateDailyNote(req.params.id, req.body);
    if (!note) throw new AppError(404, 'Daily note not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'daily_note', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(note);
  }

  static async deleteRiskAssessment(req: Request, res: Response) {
    const user = req.user!;
    const rows = await pool.query(
      'SELECT su.id FROM risk_assessments ra JOIN service_users su ON ra.service_user_id = su.id WHERE ra.id = $1 AND su.organization_id = $2',
      [req.params.id, user.organizationId]
    );
    if (rows.rows.length === 0) throw new AppError(404, 'Risk assessment not found');
    await pool.query('DELETE FROM risk_assessments WHERE id = $1', [req.params.id]);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'risk_assessment', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Risk assessment deleted' });
  }

  // ---- Daily Notes ----
  static async createDailyNote(req: Request, res: Response) {
    const user = req.user!;
    const { serviceUserId } = req.params;
    await requireServiceUserInOrg(user, serviceUserId);
    await pool.query('INSERT INTO service_user_access_log (service_user_id, accessed_by, action, ip_address) VALUES ($1, $2, $3, $4)', [serviceUserId, user.userId, 'create_note', req.ip]);
    const note = await ServiceUserRepository.createDailyNote({
      ...req.body,
      service_user_id: serviceUserId,
      author_id: ServiceUserController.getUserId(req),
    });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'daily_note', entity_id: note.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(note);
  }

  static async getDailyNotes(req: Request, res: Response) {
    const user = req.user!;
    const { serviceUserId } = req.params;
    await requireServiceUserInOrg(user, serviceUserId);
    await pool.query('INSERT INTO service_user_access_log (service_user_id, accessed_by, action, ip_address) VALUES ($1, $2, $3, $4)', [serviceUserId, user.userId, 'view_notes', req.ip]);
    const notes = await ServiceUserRepository.getDailyNotes(serviceUserId);
    res.json(notes);
  }

  // ---- Risk Assessments ----
  static async createRiskAssessment(req: Request, res: Response) {
    const user = req.user!;
    const { serviceUserId } = req.params;
    await requireServiceUserInOrg(user, serviceUserId);
    await pool.query('INSERT INTO service_user_access_log (service_user_id, accessed_by, action, ip_address) VALUES ($1, $2, $3, $4)', [serviceUserId, user.userId, 'create_risk_assessment', req.ip]);
    const ra = await ServiceUserRepository.createRiskAssessment({ ...req.body, service_user_id: serviceUserId });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'risk_assessment', entity_id: ra.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(ra);
  }

  static async updateRiskAssessment(req: Request, res: Response) {
    const user = req.user!;
    // Verify risk assessment's parent service user belongs to org
    const raRows = await pool.query(
      'SELECT su.id FROM risk_assessments ra JOIN service_users su ON ra.service_user_id = su.id WHERE ra.id = $1 AND su.organization_id = $2',
      [req.params.id, user.organizationId]
    );
    if (raRows.rows.length === 0) throw new AppError(404, 'Risk assessment not found');
    const ra = await ServiceUserRepository.updateRiskAssessment(req.params.id, req.body);
    if (!ra) throw new AppError(404, 'Risk assessment not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'risk_assessment', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(ra);
  }

  // ---- Family Contacts ----
  static async createFamilyContact(req: Request, res: Response) {
    const user = req.user!;
    const { serviceUserId } = req.params;
    await requireServiceUserInOrg(user, serviceUserId);
    const contact = await ServiceUserRepository.createFamilyContact({ ...req.body, service_user_id: serviceUserId });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'family_contact', entity_id: contact.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(contact);
  }

  static async updateFamilyContact(req: Request, res: Response) {
    const user = req.user!;
    // Verify family contact's parent service user belongs to org
    const fcRows = await pool.query(
      'SELECT su.id FROM family_contacts fc JOIN service_users su ON fc.service_user_id = su.id WHERE fc.id = $1 AND su.organization_id = $2',
      [req.params.id, user.organizationId]
    );
    if (fcRows.rows.length === 0) throw new AppError(404, 'Family contact not found');
    const contact = await ServiceUserRepository.updateFamilyContact(req.params.id, req.body);
    if (!contact) throw new AppError(404, 'Family contact not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'family_contact', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(contact);
  }

  static async deleteFamilyContact(req: Request, res: Response) {
    const user = req.user!;
    const fcRows = await pool.query(
      'SELECT su.id FROM family_contacts fc JOIN service_users su ON fc.service_user_id = su.id WHERE fc.id = $1 AND su.organization_id = $2',
      [req.params.id, user.organizationId]
    );
    if (fcRows.rows.length === 0) throw new AppError(404, 'Family contact not found');
    await ServiceUserRepository.deleteFamilyContact(req.params.id);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'family_contact', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Family contact deleted' });
  }

  private static async getStaffProfileId(userId: string): Promise<string | null> {
    const result = await pool.query('SELECT id FROM staff_profiles WHERE user_id = $1', [userId]);
    return result.rows[0]?.id || null;
  }

  // ---- Care Assessments ----
  static async listAssessments(req: Request, res: Response) {
    const { serviceUserId } = req.params;
    const user = req.user!;
    await requireServiceUserInOrg(user, serviceUserId);
    await pool.query('INSERT INTO service_user_access_log (service_user_id, accessed_by, action, ip_address) VALUES ($1, $2, $3, $4)', [serviceUserId, user.userId, 'view_assessments', req.ip]);
    const assessments = await ServiceUserRepository.findAssessments(serviceUserId);
    res.json(assessments);
  }

  static async getAssessment(req: Request, res: Response) {
    const user = req.user!;
    const assessment = await ServiceUserRepository.findAssessmentById(req.params.id);
    if (!assessment) throw new AppError(404, 'Assessment not found');
    await requireServiceUserInOrg(user, assessment.service_user_id);
    res.json(assessment);
  }

  static async createAssessment(req: Request, res: Response) {
    const user = req.user!;
    const { serviceUserId } = req.params;
    await requireServiceUserInOrg(user, serviceUserId);
    await pool.query('INSERT INTO service_user_access_log (service_user_id, accessed_by, action, ip_address) VALUES ($1, $2, $3, $4)', [serviceUserId, user.userId, 'create_assessment', req.ip]);
    const assessment = await ServiceUserRepository.createAssessment(user.organizationId!, {
      ...req.body,
      service_user_id: serviceUserId,
      created_by: ServiceUserController.getUserId(req),
    });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'care_assessment', entity_id: assessment.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(assessment);
  }

  static async updateAssessment(req: Request, res: Response) {
    const user = req.user!;
    const assRows = await pool.query(
      'SELECT su.id FROM care_assessments ca JOIN service_users su ON ca.service_user_id = su.id WHERE ca.id = $1 AND su.organization_id = $2',
      [req.params.id, user.organizationId]
    );
    if (assRows.rows.length === 0) throw new AppError(404, 'Assessment not found');
    const assessment = await ServiceUserRepository.updateAssessment(req.params.id, req.body);
    if (!assessment) throw new AppError(404, 'Assessment not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'care_assessment', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(assessment);
  }

  static async deleteAssessment(req: Request, res: Response) {
    const user = req.user!;
    const assRows = await pool.query(
      'SELECT su.id FROM care_assessments ca JOIN service_users su ON ca.service_user_id = su.id WHERE ca.id = $1 AND su.organization_id = $2',
      [req.params.id, user.organizationId]
    );
    if (assRows.rows.length === 0) throw new AppError(404, 'Assessment not found');
    await ServiceUserRepository.deleteAssessment(req.params.id);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'care_assessment', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Assessment deleted' });
  }

  // ---- Body Map Entries ----
  static async listBodyMapEntries(req: Request, res: Response) {
    const user = req.user!;
    await requireServiceUserInOrg(user, req.params.serviceUserId);
    const entries = await ServiceUserRepository.findBodyMapEntries(req.params.serviceUserId);
    res.json(entries);
  }

  static async createBodyMapEntry(req: Request, res: Response) {
    const user = req.user!;
    const { serviceUserId } = req.params;
    const entry = await ServiceUserRepository.createBodyMapEntry({
      ...req.body,
      service_user_id: serviceUserId,
      created_by: user.userId,
    });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'body_map_entry', entity_id: entry.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(entry);
  }

  static async updateBodyMapEntry(req: Request, res: Response) {
    const entry = await ServiceUserRepository.updateBodyMapEntry(req.params.entryId, req.body);
    if (!entry) throw new AppError(404, 'Body map entry not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'body_map_entry', entity_id: req.params.entryId, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(entry);
  }

  static async deleteBodyMapEntry(req: Request, res: Response) {
    await ServiceUserRepository.deleteBodyMapEntry(req.params.entryId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'body_map_entry', entity_id: req.params.entryId, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Body map entry deleted' });
  }

  // ---- Memory Book Entries ----
  static async listMemoryBook(req: Request, res: Response) {
    const user = req.user!;
    await requireServiceUserInOrg(user, req.params.serviceUserId);
    const entries = await ServiceUserRepository.findMemoryBookEntries(req.params.serviceUserId);
    res.json(entries);
  }

  static async createMemoryBookEntry(req: Request, res: Response) {
    const user = req.user!;
    const { serviceUserId } = req.params;
    const files = req.files as Express.Multer.File[] | undefined;
    const image_urls = files && files.length > 0 ? files.map(f => '/files/private/' + f.filename) : [];
    const image_url = image_urls.length > 0 ? image_urls[0] : undefined;
    const entry = await ServiceUserRepository.createMemoryBookEntry({
      service_user_id: serviceUserId,
      title: req.body.title,
      description: req.body.description,
      image_url,
      image_urls,
      recorded_date: req.body.recorded_date,
      created_by: user.userId,
      support_level: req.body.support_level,
    });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'memory_book_entry', entity_id: entry.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(entry);
  }

  static async updateMemoryBookEntry(req: Request, res: Response) {
    const entry = await ServiceUserRepository.updateMemoryBookEntry(req.params.entryId, req.body);
    if (!entry) throw new AppError(404, 'Memory book entry not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'memory_book_entry', entity_id: req.params.entryId, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(entry);
  }

  static async deleteMemoryBookEntry(req: Request, res: Response) {
    await ServiceUserRepository.deleteMemoryBookEntry(req.params.entryId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'memory_book_entry', entity_id: req.params.entryId, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Memory book entry deleted' });
  }

  static async getTimeline(req: Request, res: Response) {
    const user = req.user!;
    const { serviceUserId } = req.params;
    await requireServiceUserInOrg(user, serviceUserId);
    const timeline = await ServiceUserRepository.getTimeline(serviceUserId);
    res.json(timeline);
  }

  // ---- Clinical Scores ----
  static async getClinicalScores(req: Request, res: Response) {
    const user = req.user!;
    const { serviceUserId } = req.params;
    await requireServiceUserInOrg(user, serviceUserId);
    const scores = await ServiceUserRepository.getClinicalScores(serviceUserId);
    res.json(scores);
  }

  static async createClinicalScore(req: Request, res: Response) {
    const user = req.user!;
    const { serviceUserId } = req.params;
    await requireServiceUserInOrg(user, serviceUserId);
    const score = await ServiceUserRepository.createClinicalScore({
      ...req.body,
      service_user_id: serviceUserId,
      recorded_by: user.userId,
    });
    AuditRepository.log({ user_id: user.userId, action: 'create', entity_type: 'clinical_score', entity_id: score.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(score);
  }

  static async deleteClinicalScore(req: Request, res: Response) {
    await ServiceUserRepository.deleteClinicalScore(req.params.id);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'clinical_score', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Clinical score deleted' });
  }

  // ---- Service User Documents ----
  static async getDocuments(req: Request, res: Response) {
    const user = req.user!;
    const { serviceUserId } = req.params;
    await requireServiceUserInOrg(user, serviceUserId);
    const docs = await ServiceUserRepository.getDocuments(serviceUserId);
    res.json(docs);
  }

  static async createDocument(req: Request, res: Response) {
    const user = req.user!;
    const { serviceUserId } = req.params;
    await requireServiceUserInOrg(user, serviceUserId);
    const doc = await ServiceUserRepository.createDocument({
      ...req.body,
      service_user_id: serviceUserId,
      uploaded_by: user.userId,
    });
    AuditRepository.log({ user_id: user.userId, action: 'create', entity_type: 'service_user_document', entity_id: doc.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(doc);
  }

  static async deleteDocument(req: Request, res: Response) {
    await ServiceUserRepository.deleteDocument(req.params.id);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'service_user_document', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Document deleted' });
  }

  static async updateClinicalScore(req: Request, res: Response) {
    const updated = await ServiceUserRepository.updateClinicalScore(req.params.id, req.body);
    if (!updated) throw new AppError(404, 'Clinical score not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'clinical_score', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(updated);
  }

  static async listWellbeing(req: Request, res: Response) {
    const user = req.user!;
    await requireServiceUserInOrg(user, req.params.serviceUserId);
    const entries = await ServiceUserRepository.findWellbeing(req.params.serviceUserId);
    res.json(entries);
  }

  static async createWellbeing(req: Request, res: Response) {
    const user = req.user!;
    const { serviceUserId } = req.params;
    await requireServiceUserInOrg(user, serviceUserId);
    const entry = await ServiceUserRepository.createWellbeing({
      ...req.body, service_user_id: serviceUserId, recorded_by: user.userId,
    });
    AuditRepository.log({ user_id: user.userId, action: 'create', entity_type: 'wellbeing', entity_id: entry.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(entry);
  }

  static async deleteWellbeing(req: Request, res: Response) {
    await ServiceUserRepository.deleteWellbeing(req.params.id);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'wellbeing', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Wellbeing entry deleted' });
  }

  static async listCommunicationLog(req: Request, res: Response) {
    const user = req.user!;
    await requireServiceUserInOrg(user, req.params.serviceUserId);
    const entries = await ServiceUserRepository.findCommunicationLog(req.params.serviceUserId);
    res.json(entries);
  }

  static async createCommunicationLog(req: Request, res: Response) {
    const user = req.user!;
    const { serviceUserId } = req.params;
    await requireServiceUserInOrg(user, serviceUserId);
    const entry = await ServiceUserRepository.createCommunicationLog({
      ...req.body, service_user_id: serviceUserId, recorded_by: user.userId,
    });
    AuditRepository.log({ user_id: user.userId, action: 'create', entity_type: 'communication_log', entity_id: entry.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(entry);
  }

  static async deleteCommunicationLog(req: Request, res: Response) {
    await ServiceUserRepository.deleteCommunicationLog(req.params.id);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'communication_log', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Communication log deleted' });
  }

  static async listCapacityAssessments(req: Request, res: Response) {
    const user = req.user!;
    await requireServiceUserInOrg(user, req.params.serviceUserId);
    const items = await ServiceUserRepository.findCapacityAssessments(req.params.serviceUserId);
    res.json(items);
  }

  static async createCapacityAssessment(req: Request, res: Response) {
    const user = req.user!;
    const { serviceUserId } = req.params;
    await requireServiceUserInOrg(user, serviceUserId);
    const item = await ServiceUserRepository.createCapacityAssessment({
      ...req.body, service_user_id: serviceUserId, recorded_by: user.userId,
    });
    AuditRepository.log({ user_id: user.userId, action: 'create', entity_type: 'capacity_assessment', entity_id: item.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(item);
  }

  static async updateCapacityAssessment(req: Request, res: Response) {
    const user = req.user!;
    const rows = await pool.query(
      'SELECT su.id FROM su_capacity_assessments ca JOIN service_users su ON ca.service_user_id = su.id WHERE ca.id = $1 AND su.organization_id = $2',
      [req.params.id, user.organizationId]
    );
    if (rows.rows.length === 0) throw new AppError(404, 'Capacity assessment not found');
    const item = await ServiceUserRepository.updateCapacityAssessment(req.params.id, req.body);
    if (!item) throw new AppError(404, 'Capacity assessment not found');
    AuditRepository.log({ user_id: user.userId, action: 'update', entity_type: 'capacity_assessment', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(item);
  }

  static async deleteCapacityAssessment(req: Request, res: Response) {
    await ServiceUserRepository.deleteCapacityAssessment(req.params.id);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'capacity_assessment', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Capacity assessment deleted' });
  }

  static async listCarePathways(req: Request, res: Response) {
    const user = req.user!;
    await requireServiceUserInOrg(user, req.params.serviceUserId);
    const items = await ServiceUserRepository.findCarePathways(req.params.serviceUserId);
    res.json(items);
  }

  static async createCarePathway(req: Request, res: Response) {
    const user = req.user!;
    const { serviceUserId } = req.params;
    await requireServiceUserInOrg(user, serviceUserId);
    const item = await ServiceUserRepository.createCarePathway({
      ...req.body, service_user_id: serviceUserId, recorded_by: user.userId,
    });
    AuditRepository.log({ user_id: user.userId, action: 'create', entity_type: 'care_pathway', entity_id: item.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(item);
  }

  static async updateCarePathway(req: Request, res: Response) {
    const user = req.user!;
    const rows = await pool.query(
      'SELECT su.id FROM su_care_pathways cp JOIN service_users su ON cp.service_user_id = su.id WHERE cp.id = $1 AND su.organization_id = $2',
      [req.params.id, user.organizationId]
    );
    if (rows.rows.length === 0) throw new AppError(404, 'Care pathway not found');
    const item = await ServiceUserRepository.updateCarePathway(req.params.id, req.body);
    if (!item) throw new AppError(404, 'Care pathway not found');
    AuditRepository.log({ user_id: user.userId, action: 'update', entity_type: 'care_pathway', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(item);
  }

  static async deleteCarePathway(req: Request, res: Response) {
    await ServiceUserRepository.deleteCarePathway(req.params.id);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'care_pathway', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Care pathway deleted' });
  }

  static async listDischargeChecklist(req: Request, res: Response) {
    const user = req.user!;
    await requireServiceUserInOrg(user, req.params.serviceUserId);
    const items = await ServiceUserRepository.findDischargeChecklist(req.params.serviceUserId);
    res.json(items);
  }

  static async createDischargeChecklist(req: Request, res: Response) {
    const user = req.user!;
    const { serviceUserId } = req.params;
    await requireServiceUserInOrg(user, serviceUserId);
    const item = await ServiceUserRepository.createDischargeChecklistItem({
      ...req.body, service_user_id: serviceUserId,
    });
    AuditRepository.log({ user_id: user.userId, action: 'create', entity_type: 'discharge_checklist', entity_id: item.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(item);
  }

  static async updateDischargeChecklist(req: Request, res: Response) {
    const user = req.user!;
    const item = await ServiceUserRepository.updateDischargeChecklistItem(req.params.id, {
      ...req.body, completed_by: req.body.is_complete ? user.userId : null,
    });
    if (!item) throw new AppError(404, 'Checklist item not found');
    AuditRepository.log({ user_id: user.userId, action: 'update', entity_type: 'discharge_checklist', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(item);
  }

  static async deleteDischargeChecklist(req: Request, res: Response) {
    await ServiceUserRepository.deleteDischargeChecklistItem(req.params.id);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'discharge_checklist', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Checklist item deleted' });
  }
}
