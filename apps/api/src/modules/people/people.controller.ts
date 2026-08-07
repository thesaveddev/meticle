import { Request, Response } from 'express';
import pool from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import { PersonRepository } from './people.repository';
import { requirePersonInOrg } from '../../shared/database/tenant';
import { EMedicationRepository } from '../emedication/emedication.repository';
import { AuditRepository } from '../audit/audit.repository';

export class PersonController {
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

  // ---- People ----
  static async list(req: Request, res: Response) {
    const orgId = PersonController.getOrgId(req);
    const { status, search } = req.query as any;
    const users = await PersonRepository.findAll(orgId, { status, search });
    res.json(users.map(PersonController.decorate));
  }

  static async getById(req: Request, res: Response) {
    const orgId = PersonController.getOrgId(req);
    const userId = PersonController.getUserId(req);
    const user = await PersonRepository.findById(req.params.id, orgId);
    if (!user) throw new AppError(404, 'Person not found');
    await pool.query(
      'INSERT INTO person_access_log (person_id, accessed_by, action, ip_address) VALUES ($1, $2, $3, $4)',
      [req.params.id, userId, 'view', req.ip]
    );
    res.json(PersonController.decorate(user));
  }

  static async create(req: Request, res: Response) {
    const orgId = PersonController.getOrgId(req);
    await PersonController.assertLocationInOrg(orgId, req.body?.location_id);
    const user = await PersonRepository.create({ ...PersonController.staffingFor(req.body), organization_id: orgId });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'person', entity_id: user.id, ip_address: req.ip }).catch(() => {});
    // Auto-create monthly MAR
    await EMedicationRepository.ensureMonthlyMar(orgId, user.id, req.user!.userId);
    res.status(201).json(PersonController.decorate(user));
  }

  static async update(req: Request, res: Response) {
    const orgId = PersonController.getOrgId(req);
    await PersonController.assertLocationInOrg(orgId, req.body?.location_id);
    const user = await PersonRepository.update(req.params.id, PersonController.staffingFor(req.body), orgId);
    if (!user) throw new AppError(404, 'Person not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'person', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(PersonController.decorate(user));
  }

  static async uploadPhoto(req: Request, res: Response) {
    if (!req.file) throw new AppError(400, 'No photo file uploaded');
    const orgId = PersonController.getOrgId(req);
    const url = '/files/private/' + req.file.filename;
    await PersonRepository.update(req.params.id, { photo_url: url } as any, orgId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'person', entity_id: req.params.id, new_data: { photo_url: url }, ip_address: req.ip }).catch(() => {});
    res.json({ url });
  }

  static async bulkStatus(req: Request, res: Response) {
    const orgId = PersonController.getOrgId(req);
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) throw new AppError(400, 'ids array required');
    if (!['active', 'discharged', 'deceased'].includes(status)) throw new AppError(400, 'Invalid status');
    const result = await PersonRepository.bulkUpdateStatus(ids, status, orgId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'bulk_update', entity_type: 'person', entity_id: ids.join(','), new_data: { status, count: ids.length }, ip_address: req.ip }).catch(() => {});
    res.json({ updated: result.rowCount });
  }

  static async bulkDischarge(req: Request, res: Response) {
    const orgId = PersonController.getOrgId(req);
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) throw new AppError(400, 'ids array required');
    const result = await PersonRepository.bulkUpdateStatus(ids, 'discharged', orgId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'bulk_discharge', entity_type: 'person', entity_id: ids.join(','), new_data: { count: ids.length }, ip_address: req.ip }).catch(() => {});
    res.json({ updated: result.rowCount });
  }

  static async delete(req: Request, res: Response) {
    const orgId = PersonController.getOrgId(req);
    const userId = PersonController.getUserId(req);
    const existing = await PersonRepository.findById(req.params.id, orgId);
    if (!existing) throw new AppError(404, 'Person not found');
    await PersonRepository.deletePerson(req.params.id);
    await pool.query(
      'INSERT INTO person_access_log (person_id, accessed_by, action, ip_address) VALUES ($1, $2, $3, $4)',
      [req.params.id, userId, 'delete', req.ip]
    );
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'person', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Person deleted' });
  }

  // ---- Care Plans ----
  static async createCarePlan(req: Request, res: Response) {
    const user = req.user!;
    const { personId } = req.params;
    await requirePersonInOrg(user, personId);
    await pool.query('INSERT INTO person_access_log (person_id, accessed_by, action, ip_address) VALUES ($1, $2, $3, $4)', [personId, user.userId, 'create_care_plan', req.ip]);
    const plan = await PersonRepository.createCarePlan({ ...req.body, person_id: personId });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'care_plan', entity_id: plan.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(plan);
  }

  static async updateCarePlan(req: Request, res: Response) {
    const user = req.user!;
    // Verify care plan's parent person belongs to org
    const planRows = await pool.query(
      'SELECT su.id FROM care_plans cp JOIN people su ON cp.person_id = su.id WHERE cp.id = $1 AND su.organization_id = $2',
      [req.params.id, user.organizationId]
    );
    if (planRows.rows.length === 0) throw new AppError(404, 'Care plan not found');
    const plan = await PersonRepository.updateCarePlan(req.params.id, req.body);
    if (!plan) throw new AppError(404, 'Care plan not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'care_plan', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(plan);
  }

  static async deleteCarePlan(req: Request, res: Response) {
    const user = req.user!;
    const planRows = await pool.query(
      'SELECT su.id FROM care_plans cp JOIN people su ON cp.person_id = su.id WHERE cp.id = $1 AND su.organization_id = $2',
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
      'SELECT su.id FROM daily_notes dn JOIN people su ON dn.person_id = su.id WHERE dn.id = $1 AND su.organization_id = $2',
      [req.params.id, user.organizationId]
    );
    if (rows.rows.length === 0) throw new AppError(404, 'Daily note not found');
    const note = await PersonRepository.updateDailyNote(req.params.id, req.body);
    if (!note) throw new AppError(404, 'Daily note not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'daily_note', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(note);
  }

  static async deleteRiskAssessment(req: Request, res: Response) {
    const user = req.user!;
    const rows = await pool.query(
      'SELECT su.id FROM risk_assessments ra JOIN people su ON ra.person_id = su.id WHERE ra.id = $1 AND su.organization_id = $2',
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
    const { personId } = req.params;
    await requirePersonInOrg(user, personId);
    await pool.query('INSERT INTO person_access_log (person_id, accessed_by, action, ip_address) VALUES ($1, $2, $3, $4)', [personId, user.userId, 'create_note', req.ip]);
    const note = await PersonRepository.createDailyNote({
      ...req.body,
      person_id: personId,
      author_id: PersonController.getUserId(req),
    });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'daily_note', entity_id: note.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(note);
  }

  static async getDailyNotes(req: Request, res: Response) {
    const user = req.user!;
    const { personId } = req.params;
    await requirePersonInOrg(user, personId);
    await pool.query('INSERT INTO person_access_log (person_id, accessed_by, action, ip_address) VALUES ($1, $2, $3, $4)', [personId, user.userId, 'view_notes', req.ip]);
    const notes = await PersonRepository.getDailyNotes(personId);
    res.json(notes);
  }

  // ---- Risk Assessments ----
  static async createRiskAssessment(req: Request, res: Response) {
    const user = req.user!;
    const { personId } = req.params;
    await requirePersonInOrg(user, personId);
    await pool.query('INSERT INTO person_access_log (person_id, accessed_by, action, ip_address) VALUES ($1, $2, $3, $4)', [personId, user.userId, 'create_risk_assessment', req.ip]);
    const ra = await PersonRepository.createRiskAssessment({ ...req.body, person_id: personId });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'risk_assessment', entity_id: ra.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(ra);
  }

  static async updateRiskAssessment(req: Request, res: Response) {
    const user = req.user!;
    // Verify risk assessment's parent person belongs to org
    const raRows = await pool.query(
      'SELECT su.id FROM risk_assessments ra JOIN people su ON ra.person_id = su.id WHERE ra.id = $1 AND su.organization_id = $2',
      [req.params.id, user.organizationId]
    );
    if (raRows.rows.length === 0) throw new AppError(404, 'Risk assessment not found');
    const ra = await PersonRepository.updateRiskAssessment(req.params.id, req.body);
    if (!ra) throw new AppError(404, 'Risk assessment not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'risk_assessment', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(ra);
  }

  // ---- Family Contacts ----
  static async createFamilyContact(req: Request, res: Response) {
    const user = req.user!;
    const { personId } = req.params;
    await requirePersonInOrg(user, personId);
    const contact = await PersonRepository.createFamilyContact({ ...req.body, person_id: personId });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'family_contact', entity_id: contact.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(contact);
  }

  static async updateFamilyContact(req: Request, res: Response) {
    const user = req.user!;
    // Verify family contact's parent person belongs to org
    const fcRows = await pool.query(
      'SELECT su.id FROM family_contacts fc JOIN people su ON fc.person_id = su.id WHERE fc.id = $1 AND su.organization_id = $2',
      [req.params.id, user.organizationId]
    );
    if (fcRows.rows.length === 0) throw new AppError(404, 'Family contact not found');
    const contact = await PersonRepository.updateFamilyContact(req.params.id, req.body);
    if (!contact) throw new AppError(404, 'Family contact not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'family_contact', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(contact);
  }

  static async deleteFamilyContact(req: Request, res: Response) {
    const user = req.user!;
    const fcRows = await pool.query(
      'SELECT su.id FROM family_contacts fc JOIN people su ON fc.person_id = su.id WHERE fc.id = $1 AND su.organization_id = $2',
      [req.params.id, user.organizationId]
    );
    if (fcRows.rows.length === 0) throw new AppError(404, 'Family contact not found');
    await PersonRepository.deleteFamilyContact(req.params.id);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'family_contact', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Family contact deleted' });
  }

  private static async getStaffProfileId(userId: string): Promise<string | null> {
    const result = await pool.query('SELECT id FROM staff_profiles WHERE user_id = $1', [userId]);
    return result.rows[0]?.id || null;
  }

  // ---- Care Assessments ----
  static async listAssessments(req: Request, res: Response) {
    const { personId } = req.params;
    const user = req.user!;
    await requirePersonInOrg(user, personId);
    await pool.query('INSERT INTO person_access_log (person_id, accessed_by, action, ip_address) VALUES ($1, $2, $3, $4)', [personId, user.userId, 'view_assessments', req.ip]);
    const assessments = await PersonRepository.findAssessments(personId);
    res.json(assessments);
  }

  static async getAssessment(req: Request, res: Response) {
    const user = req.user!;
    const assessment = await PersonRepository.findAssessmentById(req.params.id);
    if (!assessment) throw new AppError(404, 'Assessment not found');
    await requirePersonInOrg(user, assessment.person_id);
    res.json(assessment);
  }

  static async createAssessment(req: Request, res: Response) {
    const user = req.user!;
    const { personId } = req.params;
    await requirePersonInOrg(user, personId);
    await pool.query('INSERT INTO person_access_log (person_id, accessed_by, action, ip_address) VALUES ($1, $2, $3, $4)', [personId, user.userId, 'create_assessment', req.ip]);
    const assessment = await PersonRepository.createAssessment(user.organizationId!, {
      ...req.body,
      person_id: personId,
      created_by: PersonController.getUserId(req),
    });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'care_assessment', entity_id: assessment.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(assessment);
  }

  static async updateAssessment(req: Request, res: Response) {
    const user = req.user!;
    const assRows = await pool.query(
      'SELECT su.id FROM care_assessments ca JOIN people su ON ca.person_id = su.id WHERE ca.id = $1 AND su.organization_id = $2',
      [req.params.id, user.organizationId]
    );
    if (assRows.rows.length === 0) throw new AppError(404, 'Assessment not found');
    const assessment = await PersonRepository.updateAssessment(req.params.id, req.body);
    if (!assessment) throw new AppError(404, 'Assessment not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'care_assessment', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(assessment);
  }

  static async deleteAssessment(req: Request, res: Response) {
    const user = req.user!;
    const assRows = await pool.query(
      'SELECT su.id FROM care_assessments ca JOIN people su ON ca.person_id = su.id WHERE ca.id = $1 AND su.organization_id = $2',
      [req.params.id, user.organizationId]
    );
    if (assRows.rows.length === 0) throw new AppError(404, 'Assessment not found');
    await PersonRepository.deleteAssessment(req.params.id);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'care_assessment', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Assessment deleted' });
  }

  // ---- Body Map Entries ----
  static async listBodyMapEntries(req: Request, res: Response) {
    const user = req.user!;
    await requirePersonInOrg(user, req.params.personId);
    const entries = await PersonRepository.findBodyMapEntries(req.params.personId);
    res.json(entries);
  }

  static async createBodyMapEntry(req: Request, res: Response) {
    const user = req.user!;
    const { personId } = req.params;
    const entry = await PersonRepository.createBodyMapEntry({
      ...req.body,
      person_id: personId,
      created_by: user.userId,
    });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'body_map_entry', entity_id: entry.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(entry);
  }

  static async updateBodyMapEntry(req: Request, res: Response) {
    const entry = await PersonRepository.updateBodyMapEntry(req.params.entryId, req.body);
    if (!entry) throw new AppError(404, 'Body map entry not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'body_map_entry', entity_id: req.params.entryId, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(entry);
  }

  static async deleteBodyMapEntry(req: Request, res: Response) {
    await PersonRepository.deleteBodyMapEntry(req.params.entryId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'body_map_entry', entity_id: req.params.entryId, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Body map entry deleted' });
  }

  // ---- Memory Book Entries ----
  static async listMemoryBook(req: Request, res: Response) {
    const user = req.user!;
    await requirePersonInOrg(user, req.params.personId);
    const entries = await PersonRepository.findMemoryBookEntries(req.params.personId);
    res.json(entries);
  }

  static async createMemoryBookEntry(req: Request, res: Response) {
    const user = req.user!;
    const { personId } = req.params;
    const files = req.files as Express.Multer.File[] | undefined;
    const image_urls = files && files.length > 0 ? files.map(f => '/files/private/' + f.filename) : [];
    const image_url = image_urls.length > 0 ? image_urls[0] : undefined;
    const entry = await PersonRepository.createMemoryBookEntry({
      person_id: personId,
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
    const entry = await PersonRepository.updateMemoryBookEntry(req.params.entryId, req.body);
    if (!entry) throw new AppError(404, 'Memory book entry not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'memory_book_entry', entity_id: req.params.entryId, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(entry);
  }

  static async deleteMemoryBookEntry(req: Request, res: Response) {
    await PersonRepository.deleteMemoryBookEntry(req.params.entryId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'memory_book_entry', entity_id: req.params.entryId, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Memory book entry deleted' });
  }

  static async getTimeline(req: Request, res: Response) {
    const user = req.user!;
    const { personId } = req.params;
    await requirePersonInOrg(user, personId);
    const timeline = await PersonRepository.getTimeline(personId);
    res.json(timeline);
  }

  // ---- Clinical Scores ----
  static async getClinicalScores(req: Request, res: Response) {
    const user = req.user!;
    const { personId } = req.params;
    await requirePersonInOrg(user, personId);
    const scores = await PersonRepository.getClinicalScores(personId);
    res.json(scores);
  }

  static async createClinicalScore(req: Request, res: Response) {
    const user = req.user!;
    const { personId } = req.params;
    await requirePersonInOrg(user, personId);
    const score = await PersonRepository.createClinicalScore({
      ...req.body,
      person_id: personId,
      recorded_by: user.userId,
    });
    AuditRepository.log({ user_id: user.userId, action: 'create', entity_type: 'clinical_score', entity_id: score.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(score);
  }

  static async deleteClinicalScore(req: Request, res: Response) {
    await PersonRepository.deleteClinicalScore(req.params.id);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'clinical_score', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Clinical score deleted' });
  }

  // ---- Person Documents ----
  static async getDocuments(req: Request, res: Response) {
    const user = req.user!;
    const { personId } = req.params;
    await requirePersonInOrg(user, personId);
    const docs = await PersonRepository.getDocuments(personId);
    res.json(docs);
  }

  static async createDocument(req: Request, res: Response) {
    const user = req.user!;
    const { personId } = req.params;
    await requirePersonInOrg(user, personId);
    const doc = await PersonRepository.createDocument({
      ...req.body,
      person_id: personId,
      uploaded_by: user.userId,
    });
    AuditRepository.log({ user_id: user.userId, action: 'create', entity_type: 'person_document', entity_id: doc.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(doc);
  }

  static async deleteDocument(req: Request, res: Response) {
    await PersonRepository.deleteDocument(req.params.id);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'person_document', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Document deleted' });
  }

  static async updateClinicalScore(req: Request, res: Response) {
    const updated = await PersonRepository.updateClinicalScore(req.params.id, req.body);
    if (!updated) throw new AppError(404, 'Clinical score not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'clinical_score', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(updated);
  }

  static async listWellbeing(req: Request, res: Response) {
    const user = req.user!;
    await requirePersonInOrg(user, req.params.personId);
    const entries = await PersonRepository.findWellbeing(req.params.personId);
    res.json(entries);
  }

  static async createWellbeing(req: Request, res: Response) {
    const user = req.user!;
    const { personId } = req.params;
    await requirePersonInOrg(user, personId);
    const entry = await PersonRepository.createWellbeing({
      ...req.body, person_id: personId, recorded_by: user.userId,
    });
    AuditRepository.log({ user_id: user.userId, action: 'create', entity_type: 'wellbeing', entity_id: entry.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(entry);
  }

  static async deleteWellbeing(req: Request, res: Response) {
    await PersonRepository.deleteWellbeing(req.params.id);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'wellbeing', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Wellbeing entry deleted' });
  }

  static async listCommunicationLog(req: Request, res: Response) {
    const user = req.user!;
    await requirePersonInOrg(user, req.params.personId);
    const entries = await PersonRepository.findCommunicationLog(req.params.personId);
    res.json(entries);
  }

  static async createCommunicationLog(req: Request, res: Response) {
    const user = req.user!;
    const { personId } = req.params;
    await requirePersonInOrg(user, personId);
    const entry = await PersonRepository.createCommunicationLog({
      ...req.body, person_id: personId, recorded_by: user.userId,
    });
    AuditRepository.log({ user_id: user.userId, action: 'create', entity_type: 'communication_log', entity_id: entry.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(entry);
  }

  static async deleteCommunicationLog(req: Request, res: Response) {
    await PersonRepository.deleteCommunicationLog(req.params.id);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'communication_log', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Communication log deleted' });
  }

  static async updateCommunicationLog(req: Request, res: Response) {
    const updated = await PersonRepository.updateCommunicationLog(req.params.id, req.body);
    if (!updated) throw new AppError(404, 'Communication log entry not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'communication_log', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(updated);
  }

  static async listCapacityAssessments(req: Request, res: Response) {
    const user = req.user!;
    await requirePersonInOrg(user, req.params.personId);
    const items = await PersonRepository.findCapacityAssessments(req.params.personId);
    res.json(items);
  }

  static async createCapacityAssessment(req: Request, res: Response) {
    const user = req.user!;
    const { personId } = req.params;
    await requirePersonInOrg(user, personId);
    const item = await PersonRepository.createCapacityAssessment({
      ...req.body, person_id: personId, recorded_by: user.userId,
    });
    AuditRepository.log({ user_id: user.userId, action: 'create', entity_type: 'capacity_assessment', entity_id: item.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(item);
  }

  static async updateCapacityAssessment(req: Request, res: Response) {
    const user = req.user!;
    const rows = await pool.query(
      'SELECT su.id FROM person_capacity_assessments ca JOIN people su ON ca.person_id = su.id WHERE ca.id = $1 AND su.organization_id = $2',
      [req.params.id, user.organizationId]
    );
    if (rows.rows.length === 0) throw new AppError(404, 'Capacity assessment not found');
    const item = await PersonRepository.updateCapacityAssessment(req.params.id, req.body);
    if (!item) throw new AppError(404, 'Capacity assessment not found');
    AuditRepository.log({ user_id: user.userId, action: 'update', entity_type: 'capacity_assessment', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(item);
  }

  static async deleteCapacityAssessment(req: Request, res: Response) {
    await PersonRepository.deleteCapacityAssessment(req.params.id);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'capacity_assessment', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Capacity assessment deleted' });
  }

  static async listCarePathways(req: Request, res: Response) {
    const user = req.user!;
    await requirePersonInOrg(user, req.params.personId);
    const items = await PersonRepository.findCarePathways(req.params.personId);
    res.json(items);
  }

  static async createCarePathway(req: Request, res: Response) {
    const user = req.user!;
    const { personId } = req.params;
    await requirePersonInOrg(user, personId);
    const item = await PersonRepository.createCarePathway({
      ...req.body, person_id: personId, recorded_by: user.userId,
    });
    AuditRepository.log({ user_id: user.userId, action: 'create', entity_type: 'care_pathway', entity_id: item.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(item);
  }

  static async updateCarePathway(req: Request, res: Response) {
    const user = req.user!;
    const rows = await pool.query(
      'SELECT su.id FROM person_care_pathways cp JOIN people su ON cp.person_id = su.id WHERE cp.id = $1 AND su.organization_id = $2',
      [req.params.id, user.organizationId]
    );
    if (rows.rows.length === 0) throw new AppError(404, 'Care pathway not found');
    const item = await PersonRepository.updateCarePathway(req.params.id, req.body);
    if (!item) throw new AppError(404, 'Care pathway not found');
    AuditRepository.log({ user_id: user.userId, action: 'update', entity_type: 'care_pathway', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(item);
  }

  static async deleteCarePathway(req: Request, res: Response) {
    await PersonRepository.deleteCarePathway(req.params.id);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'care_pathway', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Care pathway deleted' });
  }

  static async requireTimeAwayInOrg(user: any, timeAwayId: string) {
    const rows = await pool.query(
      'SELECT ta.id FROM person_time_away ta JOIN people p ON p.id = ta.person_id WHERE ta.id = $1 AND p.organization_id = $2',
      [timeAwayId, user.organizationId]
    );
    if (rows.rows.length === 0) throw new AppError(404, 'Time away not found');
  }

  static async requireChecklistItemInOrg(user: any, itemId: string) {
    const rows = await pool.query(
      `SELECT dc.id FROM person_discharge_checklist dc JOIN people p ON p.id = dc.person_id WHERE dc.id = $1 AND p.organization_id = $2`,
      [itemId, user.organizationId]
    );
    if (rows.rows.length === 0) throw new AppError(404, 'Checklist item not found');
  }

  static async listTimeAway(req: Request, res: Response) {
    const user = req.user!;
    await requirePersonInOrg(user, req.params.personId);
    const records = await PersonRepository.findTimeAway(req.params.personId);
    res.json(records);
  }

  static async createTimeAway(req: Request, res: Response) {
    const user = req.user!;
    const { personId } = req.params;
    await requirePersonInOrg(user, personId);
    const record = await PersonRepository.createTimeAway({ ...req.body, person_id: personId, created_by: user.userId });
    AuditRepository.log({ user_id: user.userId, action: 'create', entity_type: 'time_away', entity_id: record.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.status(201).json(record);
  }

  static async updateTimeAway(req: Request, res: Response) {
    const user = req.user!;
    await PersonController.requireTimeAwayInOrg(user, req.params.id);
    const record = await PersonRepository.updateTimeAway(req.params.id, req.body);
    if (!record) throw new AppError(404, 'Time away not found');
    AuditRepository.log({ user_id: user.userId, action: 'update', entity_type: 'time_away', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(record);
  }

  static async deleteTimeAway(req: Request, res: Response) {
    const user = req.user!;
    await PersonController.requireTimeAwayInOrg(user, req.params.id);
    await PersonRepository.deleteTimeAway(req.params.id);
    AuditRepository.log({ user_id: user.userId, action: 'delete', entity_type: 'time_away', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Time away deleted' });
  }

  static async listTimeAwayChecklist(req: Request, res: Response) {
    const user = req.user!;
    await PersonController.requireTimeAwayInOrg(user, req.params.id);
    const items = await PersonRepository.findDischargeChecklistByTimeAway(req.params.id);
    res.json(items);
  }

  static async createTimeAwayChecklistItem(req: Request, res: Response) {
    const user = req.user!;
    await PersonController.requireTimeAwayInOrg(user, req.params.id);
    const record = await PersonRepository.findTimeAwayById(req.params.id);
    if (!record) throw new AppError(404, 'Time away not found');
    const item = await PersonRepository.createDischargeChecklistItem({
      ...req.body, person_id: record.person_id, time_away_id: req.params.id,
    });
    AuditRepository.log({ user_id: user.userId, action: 'create', entity_type: 'discharge_checklist', entity_id: item.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.status(201).json(item);
  }

  static async updateDischargeChecklist(req: Request, res: Response) {
    const user = req.user!;
    await PersonController.requireChecklistItemInOrg(user, req.params.id);
    const item = await PersonRepository.updateDischargeChecklistItem(req.params.id, {
      ...req.body, completed_by: req.body.is_complete ? user.userId : null,
    });
    if (!item) throw new AppError(404, 'Checklist item not found');
    AuditRepository.log({ user_id: user.userId, action: 'update', entity_type: 'discharge_checklist', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(item);
  }

  static async deleteDischargeChecklist(req: Request, res: Response) {
    const user = req.user!;
    await PersonController.requireChecklistItemInOrg(user, req.params.id);
    await PersonRepository.deleteDischargeChecklistItem(req.params.id);
    AuditRepository.log({ user_id: user.userId, action: 'delete', entity_type: 'discharge_checklist', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Checklist item deleted' });
  }
}
