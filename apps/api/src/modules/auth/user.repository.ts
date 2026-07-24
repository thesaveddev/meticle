import { query } from '../../shared/database';
import { UserRole } from '@meticle/shared';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  organization_id?: string;
  status: string;
  force_password_reset?: boolean;
  mfa_enabled?: boolean;
  mfa_secret?: string;
  backup_codes?: string[];
  created_at: Date;
}

export class UserRepository {
  static async findByEmail(email: string): Promise<UserRow | null> {
    const result = await query('SELECT * FROM users WHERE email = $1 AND status != $2 ORDER BY created_at DESC LIMIT 1', [email, 'deactivated']);
    return result.rows[0] || null;
  }

  static async findById(id: string): Promise<UserRow | null> {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async create(data: Partial<UserRow>): Promise<UserRow> {
    const { email, password_hash, role, organization_id } = data;
    const result = await query(
      'INSERT INTO users (email, password_hash, role, organization_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [email, password_hash, role, organization_id]
    );
    return result.rows[0];
  }
}
