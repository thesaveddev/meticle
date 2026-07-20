import { query } from '../../shared/database';

export const DSPT_STANDARDS = [
  { key: 'A1', theme: 'Managing Data Protection', label: 'Leaders are accountable', description: 'Senior leaders take ownership of data protection and security, with clear accountability and governance structures.' },
  { key: 'A2', theme: 'Managing Data Protection', label: 'Data Protection Officer', description: 'A suitably qualified Data Protection Officer (or equivalent) is appointed and has authority to advise on data protection matters.' },
  { key: 'A3', theme: 'Managing Data Protection', label: 'Staff Training & Awareness', description: 'All staff receive regular data protection and security training proportionate to their role.' },
  { key: 'A4', theme: 'Managing Data Protection', label: 'Data Subject Rights', description: 'Processes are in place to manage data subject rights requests (access, rectification, erasure, portability) within statutory timescales.' },
  { key: 'A5', theme: 'Managing Data Protection', label: 'Records Management & DPIAs', description: 'Data Protection Impact Assessments are conducted for high-risk processing; records of processing activities are maintained.' },
  { key: 'B1', theme: 'Confidentiality & Data Security', label: 'Access Controls', description: 'Identity and access management controls ensure only authorised individuals can access personal data and systems.' },
  { key: 'B2', theme: 'Confidentiality & Data Security', label: 'Preventing Data Breaches', description: 'Technical and organisational measures are in place to prevent, detect, and contain data breaches.' },
  { key: 'C1', theme: 'Protecting & Sharing Information', label: 'Data Sharing', description: 'Personal data is shared only for lawful and appropriate purposes, with lawful bases documented and data sharing agreements in place.' },
  { key: 'C2', theme: 'Protecting & Sharing Information', label: 'Cyber Security', description: 'Cyber security defences (firewalls, patching, anti-malware, vulnerability management) protect IT systems from threats.' },
  { key: 'D1', theme: 'Minimising Impact', label: 'Incident Response', description: 'An incident response plan is in place, tested regularly, and staff know how to report suspected breaches.' },
  { key: 'D2', theme: 'Minimising Impact', label: 'Business Continuity', description: 'Business continuity and disaster recovery plans are documented and tested to ensure services can be restored after disruption.' },
]

export class DsptRepository {
  static async getStatus(organizationId: string) {
    const org = await query('SELECT dspt_status FROM organizations WHERE id = $1', [organizationId])
    return org.rows[0]?.dspt_status || 'not_started'
  }

  static async updateStatus(organizationId: string, status: string) {
    await query('UPDATE organizations SET dspt_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, organizationId])
  }

  static async getAssessments(organizationId: string) {
    const result = await query(
      `SELECT da.*,
        (SELECT COUNT(*) FROM dspt_standard_status dss WHERE dss.assessment_id = da.id) as standards_count,
        (SELECT COUNT(*) FROM dspt_standard_status dss WHERE dss.assessment_id = da.id AND dss.status IN ('met', 'exceeded')) as met_count
       FROM dspt_assessments da
       WHERE da.organization_id = $1
       ORDER BY da.created_at DESC`,
      [organizationId]
    )
    return result.rows
  }

  static async createAssessment(organizationId: string) {
    const year = '2025-26'
    const result = await query(
      `INSERT INTO dspt_assessments (organization_id, assessment_year) VALUES ($1, $2) RETURNING *`,
      [organizationId, year]
    )
    const assessment = result.rows[0]
    // Seed default standard status rows
    for (const std of DSPT_STANDARDS) {
      await query(
        `INSERT INTO dspt_standard_status (assessment_id, standard_key) VALUES ($1, $2)`,
        [assessment.id, std.key]
      )
    }
    return assessment
  }

  static async getAssessmentDetail(assessmentId: string, organizationId: string) {
    const assessment = await query(
      `SELECT * FROM dspt_assessments WHERE id = $1 AND organization_id = $2`,
      [assessmentId, organizationId]
    )
    if (assessment.rows.length === 0) return null
    const standards = await query(
      `SELECT * FROM dspt_standard_status WHERE assessment_id = $1 ORDER BY standard_key`,
      [assessmentId]
    )
    return { ...assessment.rows[0], standards: standards.rows }
  }

  static async updateStandardStatus(assessmentId: string, standardKey: string, data: { status?: string; evidence_notes?: string }) {
    const result = await query(
      `UPDATE dspt_standard_status SET
        status = COALESCE($1, status),
        evidence_notes = COALESCE($2, evidence_notes),
        updated_at = CURRENT_TIMESTAMP
       WHERE assessment_id = $3 AND standard_key = $4 RETURNING *`,
      [data.status || null, data.evidence_notes || null, assessmentId, standardKey]
    )
    return result.rows[0] || null
  }

  static async submitAssessment(assessmentId: string, organizationId: string) {
    const result = await query(
      `UPDATE dspt_assessments SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [assessmentId, organizationId]
    )
    if (result.rows.length > 0) {
      await this.updateStatus(organizationId, 'in_progress')
    }
    return result.rows[0] || null
  }
}