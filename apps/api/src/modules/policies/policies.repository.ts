import { query } from '../../shared/database';

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
  created_at: string;
  updated_at?: string;
}

export const STANDARD_POLICIES = [
  { title: 'Risk Assessment Policy', category: 'Risk Management', content: 'This policy sets out the organisation\'s approach to identifying, assessing, and managing risks to ensure the safety and wellbeing of service users and staff.' },
  { title: 'Complaints & Compliments Policy', category: 'Human Resources', content: 'This policy sets out how the organisation receives, handles, and learns from complaints and compliments from service users, families, and others.' },
  { title: 'Lone Working Policy', category: 'Health & Safety', content: 'This policy sets out arrangements to protect staff who work alone without direct supervision as part of their normal duties.' },
  { title: 'Data Protection & GDPR Policy', category: 'GDPR & Data Protection', content: 'This policy sets out how the organisation collects, uses, stores, and protects personal and sensitive data in accordance with data protection law.' },
  { title: 'Whistleblowing Policy', category: 'Human Resources', content: 'This policy encourages and enables staff to raise concerns about malpractice, wrongdoing, or risks to service users without fear of detriment.' },
  { title: 'Infection Prevention & Control Policy', category: 'Infection Control', content: 'This policy sets out the organisation\'s approach to preventing and controlling the spread of infection to protect the health of service users, staff, and visitors.' },
  { title: 'Equality, Diversity & Inclusion Policy', category: 'Equality & Diversity', content: 'This policy sets out the organisation\'s commitment to promoting equality, valuing diversity, and ensuring inclusion for all service users and staff.' },
  { title: 'Mental Capacity Act (MCA) & DoLS Policy', category: 'Mental Health', content: 'This policy sets out how the organisation upholds the rights of service users under the Mental Capacity Act 2005 and Deprivation of Liberty Safeguards (DoLS).' },
  { title: 'Fire Safety & Emergency Evacuation Policy', category: 'Fire Safety', content: 'This policy sets out the organisation\'s approach to fire safety and emergency evacuation to protect staff, service users, and visitors.' },
  { title: 'Medication Management & Administration Policy', category: 'Medication', content: 'This policy ensures the safe and lawful management, administration, storage, and disposal of medication for all service users.' },
  { title: 'Safeguarding Adults Policy', category: 'Safeguarding', content: 'This policy sets out the organisation\'s approach to safeguarding adults at risk of abuse or neglect.' },
  { title: 'Health & Safety Policy', category: 'Health & Safety', content: 'This policy sets out the organisation\'s commitment to providing a safe and healthy working environment for all staff, service users, and visitors.' },
];

export class PolicyRepository {
  private static readonly POLICY_UPDATE_COLUMNS = new Set(['title', 'category', 'content', 'version', 'status', 'updated_by']);
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
    const { organization_id, title, category, content, version, status, updated_by } = data;
    const result = await query(
      `INSERT INTO policies (organization_id, title, category, content, version, status, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [organization_id, title, category, content, version || '1.0', status || 'active', updated_by]
    );
    return result.rows[0];
  }

  static async update(id: string, data: Partial<PolicyRow>, orgId: string) {
    const fields: string[] = []; const params: any[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (!PolicyRepository.POLICY_UPDATE_COLUMNS.has(k)) continue;
      fields.push(`${k} = $${idx++}`);
      params.push(v);
    }
    params.push(id, orgId);
    const result = await query(
      `UPDATE policies SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} AND organization_id = $${idx + 1} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  static async delete(id: string, orgId: string) {
    await query('DELETE FROM policies WHERE id = $1 AND organization_id = $2', [id, orgId]);
  }

  static async getCategories(orgId: string) {
    const result = await query('SELECT DISTINCT category FROM policies WHERE organization_id = $1 ORDER BY category', [orgId]);
    return result.rows.map(r => r.category);
  }

  static async seedStandardPolicies(orgId: string) {
    const existing = await query('SELECT COUNT(*)::int as count FROM policies WHERE organization_id = $1', [orgId]);
    if (existing.rows[0]?.count > 0) return { seeded: 0 };
    let seeded = 0;
    for (const policy of STANDARD_POLICIES) {
      await query(
        `INSERT INTO policies (organization_id, title, category, content) VALUES ($1, $2, $3, $4)`,
        [orgId, policy.title, policy.category, policy.content]
      );
      seeded++;
    }
    return { seeded };
  }
}
