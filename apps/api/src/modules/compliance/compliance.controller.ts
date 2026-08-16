import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import pool from '../../shared/database';
import { ComplianceRepository } from './compliance.repository';
import { ComplianceNotificationService } from './compliance.notifications';
import { AppError } from '../../shared/middleware/error.middleware';
import { requireSameOrgForStaff } from '../../shared/database/tenant';
import { uploadDir } from '../../shared/middleware/upload.middleware';
import { NotificationsController } from '../notifications/notifications.controller';
import { AuditRepository } from '../audit/audit.repository';
import { generatePdf, buildEvidencePackHtml } from './compliance.pdf';

async function streamDocumentToResponse(user: any, docUrl: string, res: Response) {
  const filename = docUrl.replace('/files/private/', '').replace('/files/', '');
  const actualPath = path.join(uploadDir, filename);
  const resolvedPath = path.resolve(actualPath);
  const resolvedUploadDir = path.resolve(uploadDir);
  if (!resolvedPath.startsWith(resolvedUploadDir + path.sep) && resolvedPath !== resolvedUploadDir) {
    throw new AppError(403, 'Access denied');
  }
  if (!fs.existsSync(actualPath)) throw new AppError(404, 'File not found on disk');

  const ext = path.extname(actualPath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  const contentType = mimeMap[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', ext === '.svg' ? 'attachment' : 'inline');
  const stream = fs.createReadStream(actualPath);
  stream.pipe(res);
}

async function findFileOrg(fileUrl: string): Promise<string | null> {
  const direct: [string, string, string | null][] = [
    ['organizations', 'logo_url', 'id'],
    ['room_checks', 'photo_url', null],
    ['people', 'photo_url', null],
    ['person_expenses', 'receipt_url', null],
  ];
  for (const [table, col, orgCol] of direct) {
    const org = orgCol || 'organization_id';
    const r = await pool.query(`SELECT ${org} FROM ${table} WHERE ${col} = $1 LIMIT 1`, [fileUrl]);
    if (r.rows.length > 0) return r.rows[0][org];
  }

  const joined = [
    `SELECT u.organization_id FROM documents d JOIN staff_profiles sp ON d.staff_id = sp.id JOIN users u ON sp.user_id = u.id WHERE d.url = $1 LIMIT 1`,
    `SELECT u.organization_id FROM compliance_records cr JOIN staff_profiles sp ON cr.staff_id = sp.id JOIN users u ON sp.user_id = u.id WHERE cr.file_url = $1 LIMIT 1`,
    `SELECT su.organization_id FROM care_plans cp JOIN people su ON cp.person_id = su.id WHERE cp.file_url = $1 LIMIT 1`,
    `SELECT su.organization_id FROM risk_assessments ra JOIN people su ON ra.person_id = su.id WHERE ra.file_url = $1 LIMIT 1`,
    `SELECT su.organization_id FROM person_documents sud JOIN people su ON sud.person_id = su.id WHERE sud.file_url = $1 LIMIT 1`,
    `SELECT u.organization_id FROM staff_profiles sp JOIN users u ON sp.user_id = u.id WHERE sp.profile_picture_url = $1 LIMIT 1`,
    `SELECT u.organization_id FROM training_records tr JOIN staff_profiles sp ON tr.staff_id = sp.id JOIN users u ON sp.user_id = u.id WHERE tr.file_url = $1 LIMIT 1`,
    `SELECT u.organization_id FROM competency_assessments ca JOIN staff_profiles sp ON ca.staff_id = sp.id JOIN users u ON sp.user_id = u.id WHERE ca.evidence_url = $1 LIMIT 1`,
    `SELECT ch.organization_id FROM chat_messages chm JOIN chat_channels ch ON chm.channel_id = ch.id WHERE chm.file_url = $1 LIMIT 1`,
    `SELECT ch.organization_id FROM chat_files chf JOIN chat_channels ch ON chf.channel_id = ch.id WHERE chf.file_url = $1 LIMIT 1`,
    `SELECT l.organization_id FROM location_certificates lc JOIN locations l ON lc.location_id = l.id WHERE lc.file_url = $1 LIMIT 1`,
    `SELECT su.organization_id FROM body_map_entries bme JOIN people su ON bme.person_id = su.id WHERE bme.image_url = $1 LIMIT 1`,
    `SELECT i.organization_id FROM incident_attachments ia JOIN incidents i ON ia.incident_id = i.id WHERE ia.file_url = $1 LIMIT 1`,
    `SELECT su.organization_id FROM memory_book_entries mbe JOIN people su ON mbe.person_id = su.id WHERE mbe.image_url = $1 LIMIT 1`,
    `SELECT su.organization_id FROM memory_book_entries mbe CROSS JOIN jsonb_array_elements_text(mbe.image_urls) img JOIN people su ON mbe.person_id = su.id WHERE img = $1 LIMIT 1`,
    `SELECT da.organization_id FROM dspt_standard_status dss CROSS JOIN jsonb_array_elements(dss.evidence_files) ev JOIN dspt_assessments da ON dss.assessment_id = da.id WHERE ev = $1 LIMIT 1`,
  ];
  for (const sql of joined) {
    const r = await pool.query(sql, [fileUrl]);
    if (r.rows.length > 0) return r.rows[0].organization_id;
  }

  return null;
}

export class ComplianceController {
  static async uploadDocument(req: Request, res: Response) {
    const user = req.user!;
    const { staffId, type, expiryDate } = req.body;
    const file = req.file;

    if (!file) {
      throw new AppError(400, 'No file uploaded');
    }

    // Verify staff belongs to org
    await requireSameOrgForStaff(user, staffId);

    const doc = await ComplianceRepository.createDocument({
      staff_id: staffId,
      type,
      url: '/files/private/' + file.filename,
      expiry_date: expiryDate
    });

    // Auto-approve if organization has the setting enabled
    const org = await pool.query('SELECT auto_approve_documents FROM organizations WHERE id = $1', [user.organizationId]);
    if (org.rows[0]?.auto_approve_documents) {
      await ComplianceRepository.updateDocumentStatus(doc.id, user.organizationId!, 'approved');
      doc.status = 'approved';
    }

    AuditRepository.log({ user_id: user.userId, action: 'upload', entity_type: 'document', entity_id: doc.id, new_data: { staffId, type, expiryDate }, ip_address: req.ip }).catch(() => {});
    res.status(201).json(doc);
  }

  static async getStaffCompliance(req: Request, res: Response) {
    const user = req.user!;
    const { staffId } = req.params;
    await requireSameOrgForStaff(user, staffId);
    const compliance = await ComplianceRepository.getStaffCompliance(staffId);
    res.json(compliance);
  }

  static async getAllDocuments(req: Request, res: Response) {
    const user = req.user!;
    const page = parseInt(req.query.page as string) || 0;
    const limit = parseInt(req.query.limit as string) || 50;
    const docs = await ComplianceRepository.getAllDocuments(user.organizationId!, page, limit);
    const countResult = await pool.query(
      `SELECT COUNT(*)::int as total
       FROM documents d
       JOIN staff_profiles sp ON d.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       WHERE u.organization_id = $1`,
      [user.organizationId]
    );
    res.json({ data: docs, total: countResult.rows[0].total });
  }

  static async getExpiringDocuments(req: Request, res: Response) {
    const user = req.user!;
    const days = parseInt(req.query.days as string) || 30;
    const docs = await ComplianceRepository.getExpiringDocuments(days, user.organizationId!);
    res.json(docs);
  }

  static async getEvidencePack(req: Request, res: Response) {
    const user = req.user!;
    const staffId = req.query.staffId as string | undefined;
    const pack = await ComplianceRepository.getEvidencePack(user.organizationId!, staffId);
    res.json(pack);
  }

  static async generateEvidencePackPdf(req: Request, res: Response) {
    const user = req.user!;
    const staffId = req.query.staffId as string | undefined;
    const pack = await ComplianceRepository.getEvidencePack(user.organizationId!, staffId);
    const orgResult = await pool.query('SELECT name FROM organizations WHERE id = $1', [user.organizationId]);
    const orgName = orgResult.rows[0]?.name;
    const html = buildEvidencePackHtml(pack, orgName);
    const pdf = await generatePdf(html);
    const filename = `evidence-pack-${new Date().toISOString().split('T')[0]}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(pdf)
  }

  static async getIdentityDashboard(req: Request, res: Response) {
    const user = req.user!;
    const dashboard = await ComplianceRepository.getIdentityDashboard(user.organizationId!);
    res.json(dashboard);
  }

  static async updateDocumentStatus(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected', 'expired'].includes(status)) {
      throw new AppError(400, 'Invalid status');
    }
    const doc = await ComplianceRepository.updateDocumentStatus(id, user.organizationId!, status);
    if (!doc) throw new AppError(404, 'Document not found');
    AuditRepository.log({ user_id: user.userId, action: `set_${status}`, entity_type: 'document', entity_id: id, ip_address: req.ip }).catch(() => {});
    res.json(doc);
  }

  static async updateRecord(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const { status, notes, last_checked_at } = req.body;

    const record = await pool.query('SELECT * FROM compliance_records WHERE id = $1', [id]);
    if (record.rows.length === 0) {
      throw new AppError(404, 'Compliance record not found');
    }
    const staffId: string = record.rows[0].staff_id;

    // Verify org isolation
    const orgCheck = await pool.query(
      `SELECT 1 FROM staff_profiles sp
       JOIN users u ON sp.user_id = u.id
       WHERE sp.id = $1 AND u.organization_id = $2`,
      [staffId, user.organizationId]
    );
    if (orgCheck.rows.length === 0) throw new AppError(404, 'Record not found');

    const updated = await ComplianceRepository.updateRecord(id, staffId, { status, notes, last_checked_at });
    if (!updated) throw new AppError(404, 'Compliance record not found');
    res.json(updated);
  }

  static async sendRenewalReminder(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const result = await pool.query(
      `SELECT d.*, sp.first_name, sp.last_name, u.id as user_id, u.email
       FROM documents d
       JOIN staff_profiles sp ON d.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       WHERE d.id = $1 AND u.organization_id = $2`,
      [id, user.organizationId]
    );
    if (result.rows.length === 0) throw new AppError(404, 'Document not found');
    const doc = result.rows[0];
    await NotificationsController.createNotification(
      doc.user_id,
      `${doc.type} Renewal Required`,
      `Your ${doc.type}${doc.expiry_date ? ` expires on ${new Date(doc.expiry_date).toLocaleDateString()}` : ''}. Please upload a renewed copy.`,
      'compliance'
    );
    AuditRepository.log({ user_id: user.userId, action: 'send_renewal_reminder', entity_type: 'document', entity_id: id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Reminder sent' });
  }

  static async requestRenewal(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const result = await pool.query(
      `SELECT d.*, sp.first_name, sp.last_name, u.id as user_id, u.email
       FROM documents d
       JOIN staff_profiles sp ON d.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       WHERE d.id = $1 AND u.organization_id = $2`,
      [id, user.organizationId]
    );
    if (result.rows.length === 0) throw new AppError(404, 'Document not found');
    const doc = result.rows[0];
    if (doc.renewal_status === 'requested') throw new AppError(409, 'Renewal already requested');
    if (doc.renewal_status === 'renewed') throw new AppError(400, 'Document already renewed');

    await pool.query(
      `UPDATE documents SET renewal_status = 'requested', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    await NotificationsController.createNotification(
      doc.user_id,
      `${doc.type} Renewal Requested`,
      `Your ${doc.type} renewal has been requested. Please upload a renewed copy.`,
      'compliance'
    );
    AuditRepository.log({ user_id: user.userId, action: 'request_renewal', entity_type: 'document', entity_id: id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Renewal requested' });
  }

  static async submitRenewal(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const file = req.file;
    if (!file) throw new AppError(400, 'No file uploaded');

    const result = await pool.query(
      `SELECT d.*, sp.first_name, sp.last_name, u.id as user_id, u.email
       FROM documents d
       JOIN staff_profiles sp ON d.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       WHERE d.id = $1 AND u.organization_id = $2`,
      [id, user.organizationId]
    );
    if (result.rows.length === 0) throw new AppError(404, 'Document not found');
    const oldDoc = result.rows[0];

    const newDoc = await pool.query(
      `INSERT INTO documents (staff_id, type, url, expiry_date, renewal_status)
       VALUES ($1, $2, $3, $4, 'submitted') RETURNING *`,
      [oldDoc.staff_id, oldDoc.type, '/files/private/' + file.filename, req.body.expiryDate || null]
    );

    await pool.query(
      `UPDATE documents SET renewal_status = 'renewed', replaced_by = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newDoc.rows[0].id, id]
    );

    // Auto-approve renewal if org setting is enabled
    const org = await pool.query('SELECT auto_approve_documents FROM organizations WHERE id = $1', [user.organizationId]);
    if (org.rows[0]?.auto_approve_documents) {
      await pool.query('UPDATE documents SET status = $1 WHERE id = $2', ['approved', newDoc.rows[0].id]);
      newDoc.rows[0].status = 'approved';
    }

    await NotificationsController.createNotification(
      oldDoc.user_id,
      `${oldDoc.type} Renewal Submitted`,
      `Your renewed ${oldDoc.type} has been received and is pending review.`,
      'compliance'
    );
    AuditRepository.log({ user_id: user.userId, action: 'submit_renewal', entity_type: 'document', entity_id: id, new_data: { new_doc_id: newDoc.rows[0].id }, ip_address: req.ip }).catch(() => {});
    res.status(201).json(newDoc.rows[0]);
  }

  static async runNotifications(req: Request, res: Response) {
    const user = req.user!;
    if (!user.organizationId) {
      throw new AppError(400, 'Organization ID is required');
    }
    const results = await ComplianceNotificationService.runAllChecks(user.organizationId);
    res.json({ message: 'Compliance notifications sent', results });
  }

  static async getTrends(req: Request, res: Response) {
    const user = req.user!;
    const staffId = req.query.staffId as string | undefined;
    const days = parseInt(req.query.days as string) || 30;

    let sql: string;
    let params: any[];

    if (staffId) {
      sql = `SELECT cs.*, sp.first_name, sp.last_name
             FROM compliance_snapshots cs
             JOIN staff_profiles sp ON cs.staff_id = sp.id
             JOIN users u ON sp.user_id = u.id
             WHERE u.organization_id = $1 AND cs.staff_id = $2
               AND cs.snapshot_date >= CURRENT_DATE - interval '1 day' * $3
             ORDER BY cs.snapshot_date ASC`;
      params = [user.organizationId, staffId, days];
    } else {
      sql = `SELECT cs.snapshot_date,
                    ROUND(AVG(cs.overall_score), 2) as average_score
             FROM compliance_snapshots cs
             WHERE cs.organization_id = $1
               AND cs.snapshot_date >= CURRENT_DATE - interval '1 day' * $2
             GROUP BY cs.snapshot_date
             ORDER BY cs.snapshot_date ASC`;
      params = [user.organizationId, days];
    }

    const result = await pool.query(sql, params);
    res.json(result.rows);
  }

  static async serveFile(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const result = await pool.query(
      `SELECT d.* FROM documents d
       JOIN staff_profiles sp ON d.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       WHERE d.id = $1 AND u.organization_id = $2`,
      [id, user.organizationId]
    );
    if (result.rows.length === 0) throw new AppError(404, 'Document not found');
    await streamDocumentToResponse(user, result.rows[0].url, res);
  }

  static async servePrivateFile(req: Request, res: Response) {
    const user = req.user!;
    const url = '/files/private/' + req.params.filename;

    const orgId = await findFileOrg(url);
    if (!orgId) throw new AppError(404, 'File not found');
    if (orgId !== user.organizationId) throw new AppError(403, 'Access denied');
    await streamDocumentToResponse(user, url, res);
  }

  // ---- Evidence Mappings ----
  static async getEvidenceMappings(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID is required');
    const mappings = await ComplianceRepository.getEvidenceMappings(orgId);
    res.json(mappings);
  }

  static async upsertEvidenceMapping(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID is required');
    const mapping = await ComplianceRepository.upsertEvidenceMapping(orgId, req.body);
    res.status(201).json(mapping);
  }

  static async deleteEvidenceMapping(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID is required');
    const deleted = await ComplianceRepository.deleteEvidenceMapping(req.params.id, orgId);
    if (!deleted) throw new AppError(404, 'Evidence mapping not found');
    res.json({ message: 'Mapping deleted' });
  }

  static async getAllRecords(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const result = await pool.query(
      `SELECT cr.*, sp.first_name || ' ' || sp.last_name as staff_name, cc.name as requirement_name
       FROM compliance_records cr
       JOIN staff_profiles sp ON cr.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       LEFT JOIN compliance_config cc ON cr.requirement_id = cc.id
       WHERE u.organization_id = $1
       ORDER BY sp.first_name, cc.name`,
      [orgId]
    );
    res.json(result.rows);
  }

  static async seedRecords(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const count = await ComplianceRepository.seedRecords(orgId);
    res.json({ message: `Seeded ${count} compliance records`, count });
  }
}
