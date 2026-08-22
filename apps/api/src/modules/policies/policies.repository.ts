import { query, transaction } from '../../shared/database';

export interface PolicyRow {
  id: string;
  organization_id: string;
  title: string;
  category: string;
  content: string;
  version: string;
  status: string;
  updated_by?: string;
  updated_by_name?: string;
  review_due_at?: string;
  created_at: string;
  updated_at?: string;
}

const policyContent = (purpose: string, scope: string, responsibilities: string, process: string) =>
  `Purpose\n${purpose}\n\nScope\n${scope}\n\nResponsibilities\n${responsibilities}\n\nRequired practice\n${process}\n\nRecords and review\nRecord decisions, actions, and exceptions in the relevant Meticle module. The registered manager reviews this policy at least annually and after any serious incident, regulatory change, or identified learning.`;

export const STANDARD_POLICIES = [
  { title: 'Risk Assessment Policy', category: 'Risk Management', content: policyContent('To identify hazards early and reduce avoidable harm to people, staff, and visitors.', 'All care, domestic, medication, staffing, environmental, and community activities.', 'Managers ensure assessments are completed by competent people. Staff report new hazards and follow control measures.', 'Assess the hazard, who may be harmed, existing controls, further actions, owner, and due date. Reassess after an incident, a significant change, or when controls are not effective.') },
  { title: 'Complaints & Compliments Policy', category: 'Human Resources', content: policyContent('To make it easy for people and families to raise concerns and for the service to learn from feedback.', 'Complaints, concerns, compliments, and informal feedback received in any format.', 'All staff listen respectfully and escalate concerns. The manager acknowledges, investigates, responds, and records learning.', 'Acknowledge promptly, agree the expected response route, keep the person informed, investigate fairly, and close the loop with actions and outcomes. Escalate safeguarding or immediate safety concerns without delay.') },
  { title: 'Lone Working Policy', category: 'Health & Safety', content: policyContent('To protect staff who work without direct supervision and ensure help can be summoned quickly.', 'Visits, transport, out-of-hours work, call-outs, and any activity where a worker may be alone.', 'Managers assess lone-working risks and provide check-in arrangements. Workers follow them and report missed check-ins or unsafe conditions.', 'Complete a dynamic risk check before work, carry a charged phone, share the expected location and finish time, use agreed check-ins, and leave or escalate when conditions become unsafe.') },
  { title: 'Data Protection & GDPR Policy', category: 'GDPR & Data Protection', content: policyContent('To protect personal information and use it lawfully, fairly, transparently, and only when needed.', 'All personal, health, workforce, financial, and recorded information held or shared by the service.', 'The organisation controls access and retention. Staff use approved systems, protect credentials, and report suspected breaches immediately.', 'Collect the minimum necessary information, verify recipients, use secure Meticle records, avoid unapproved exports, follow retention rules, and report a loss or mis-send to the manager immediately.') },
  { title: 'Whistleblowing Policy', category: 'Human Resources', content: policyContent('To enable staff to raise serious concerns about wrongdoing, unsafe care, or regulatory breaches without fear of detriment.', 'Concerns that cannot be resolved through normal supervision or where using the usual route would be inappropriate.', 'Managers respond confidentially and protect the person raising the concern. Staff may use an alternative senior, safeguarding, regulator, or emergency route.', 'Record the concern factually, preserve evidence, acknowledge it, assess immediate risk, and agree an investigation owner. Never retaliate against or discourage a person from speaking up.') },
  { title: 'Infection Prevention & Control Policy', category: 'Infection Control', content: policyContent('To reduce transmission of infection and protect people, staff, and visitors.', 'Personal care, food handling, cleaning, laundry, waste, outbreaks, and clinical procedures.', 'All staff follow hand hygiene and PPE guidance. Managers monitor incidents, supplies, training, and outbreak escalation.', 'Use standard precautions, clean shared equipment, manage waste safely, isolate or seek clinical advice when indicated, and report suspected outbreaks promptly to the manager and relevant health professionals.') },
  { title: 'Equality, Diversity & Inclusion Policy', category: 'Equality & Diversity', content: policyContent('To provide fair, person-centred care and a respectful workplace free from discrimination, harassment, and victimisation.', 'People using the service, families, visitors, applicants, and all staff interactions.', 'Leaders model inclusive behaviour and make reasonable adjustments. Everyone challenges discriminatory conduct and records concerns.', 'Ask about communication, culture, faith, identity, accessibility, and preferred support. Make reasonable adjustments, involve the person in decisions, and escalate repeated or serious concerns through the appropriate route.') },
  { title: 'Mental Capacity Act (MCA) & DoLS Policy', category: 'Mental Health', content: policyContent('To uphold autonomy, choice, and legal safeguards whenever a person may have difficulty making a specific decision.', 'Capacity assessments, consent, best-interest decisions, restrictions, and deprivation of liberty.', 'Only trained staff assess capacity for a specific decision. Managers ensure least-restrictive practice, documentation, and lawful authorisation.', 'Start by presuming capacity, support the person to decide, record the functional test when needed, make a best-interest decision with the right people, and escalate proposed restrictions for authorisation.') },
  { title: 'Fire Safety & Emergency Evacuation Policy', category: 'Fire Safety', content: policyContent('To prevent fire and ensure everyone can evacuate or be supported to safety during an emergency.', 'All premises, shifts, visitors, contractors, fire equipment, and personal emergency evacuation plans.', 'Managers maintain drills, equipment checks, staff training, and evacuation plans. Staff keep routes clear and know their assigned actions.', 'Raise alarms, call emergency services, close doors where safe, do not use lifts, follow the person-specific evacuation plan, report to the assembly point, and never re-enter until authorised.') },
  { title: 'Medication Management & Administration Policy', category: 'Medication', content: policyContent('To ensure medicines are prescribed, stored, administered, recorded, and disposed of safely.', 'Regular, PRN, controlled, covert, topical, rescue, and time-critical medicines.', 'Only trained and authorised staff administer medicines. Managers monitor competency, stock, errors, missed doses, and review requirements.', 'Check the right person, medicine, dose, route, time, and record; follow the MAR and prescription; report omissions or errors immediately; secure controlled drugs; and document any required follow-up.') },
  { title: 'Safeguarding Adults Policy', category: 'Safeguarding', content: policyContent('To prevent abuse and neglect and act quickly when an adult may be at risk of harm.', 'Physical, emotional, sexual, financial, discriminatory, organisational abuse, neglect, self-neglect, and exploitation.', 'Every worker recognises and reports concerns. The safeguarding lead coordinates referrals, protection planning, recording, and liaison with authorities.', 'Make the person safe, listen without leading questions, preserve evidence, record facts and exact words, report immediately through the safeguarding route, and never investigate beyond your role.') },
  { title: 'Health & Safety Policy', category: 'Health & Safety', content: policyContent('To provide a safe environment and reduce injury, ill health, and preventable risk.', 'Premises, equipment, manual handling, slips and trips, work activities, visitors, and occupational health.', 'The organisation provides resources and training. Managers complete checks and actions; staff use equipment correctly and report defects.', 'Follow safe systems of work, use appropriate PPE, report hazards and near misses, stop unsafe work, complete required checks, and review controls after incidents or changes.') },
];

export class PolicyRepository {
  private static readonly POLICY_UPDATE_COLUMNS = new Set(['title', 'category', 'content', 'version', 'status', 'review_due_at', 'updated_by']);

  static async findAll(orgId: string, category?: string, search?: string) {
    let sql = `SELECT p.*, u.email as updated_by_name FROM policies p LEFT JOIN users u ON p.updated_by = u.id WHERE p.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (category) { sql += ` AND p.category = $${idx++}`; params.push(category); }
    if (search) { sql += ` AND (LOWER(p.title) LIKE LOWER($${idx}) OR LOWER(p.content) LIKE LOWER($${idx}))`; params.push(`%${search}%`); idx++; }
    sql += ' ORDER BY p.category, p.title';
    const result = await query(sql, params);
    return result.rows;
  }

  static async findById(id: string, orgId: string) {
    const result = await query('SELECT p.*, u.email as updated_by_name FROM policies p LEFT JOIN users u ON p.updated_by = u.id WHERE p.id = $1 AND p.organization_id = $2', [id, orgId]);
    return result.rows[0] || null;
  }

  static async create(data: Partial<PolicyRow>) {
    const { organization_id, title, category, content, version, status, review_due_at, updated_by } = data;
    const result = await query(
      `INSERT INTO policies (organization_id, title, category, content, version, status, review_due_at, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [organization_id, title, category, content, version || '1.0', status || 'draft', review_due_at || null, updated_by]
    );
    return result.rows[0];
  }

  static async update(id: string, data: Partial<PolicyRow>, orgId: string) {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(data)) {
      if (!PolicyRepository.POLICY_UPDATE_COLUMNS.has(key)) continue;
      fields.push(`${key} = $${idx++}`);
      params.push(value);
    }
    if (fields.length === 0) return this.findById(id, orgId);
    params.push(id, orgId);
    const result = await query(
      `UPDATE policies SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} AND organization_id = $${idx + 1} RETURNING *`,
      params,
    );
    return result.rows[0] || null;
  }

  static async delete(id: string, orgId: string) {
    await query('DELETE FROM policies WHERE id = $1 AND organization_id = $2', [id, orgId]);
  }

  static async getCategories(orgId: string) {
    const result = await query('SELECT DISTINCT category FROM policies WHERE organization_id = $1 ORDER BY category', [orgId]);
    return result.rows.map((row) => row.category);
  }

  static async ensureDefaults(orgId: string) {
    return transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [orgId]);
      const result = await client.query('SELECT policies_initialized FROM organizations WHERE id = $1 FOR UPDATE', [orgId]);
      if (result.rows[0]?.policies_initialized) return { seeded: 0 };
      const seeded = await this.seedStandardPoliciesWithClient(orgId, client);
      await client.query('UPDATE organizations SET policies_initialized = TRUE WHERE id = $1', [orgId]);
      return seeded;
    });
  }

  static async seedStandardPolicies(orgId: string) {
    return transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [orgId]);
      await client.query('SELECT id FROM organizations WHERE id = $1 FOR UPDATE', [orgId]);
      const seeded = await this.seedStandardPoliciesWithClient(orgId, client);
      await client.query('UPDATE organizations SET policies_initialized = TRUE WHERE id = $1', [orgId]);
      return seeded;
    });
  }

  private static async seedStandardPoliciesWithClient(orgId: string, client: { query: (text: string, params?: any[]) => Promise<any> }) {
    const existing = await client.query('SELECT COUNT(*)::int as count FROM policies WHERE organization_id = $1', [orgId]);
    if (existing.rows[0]?.count > 0) return { seeded: 0 };
    let seeded = 0;
    const reviewDueAt = new Date();
    reviewDueAt.setFullYear(reviewDueAt.getFullYear() + 1);
    for (const policy of STANDARD_POLICIES) {
      await client.query(
        `INSERT INTO policies (organization_id, title, category, content, status, review_due_at) VALUES ($1, $2, $3, $4, 'published', $5)`,
        [orgId, policy.title, policy.category, policy.content, reviewDueAt.toISOString().slice(0, 10)],
      );
      seeded++;
    }
    return { seeded };
  }
}
