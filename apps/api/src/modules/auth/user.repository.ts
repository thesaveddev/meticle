import { query, migrateQuery } from '../../shared/database';
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
  /**
   * Find user by email — cross-tenant operation (login, register, password reset).
   * Uses migrateQuery (superuser) because auth routes must find users regardless of org.
   */
  static async findByEmail(email: string): Promise<UserRow | null> {
    const result = await migrateQuery('SELECT * FROM users WHERE email = $1 ORDER BY created_at DESC LIMIT 1', [email]);
    return result.rows[0] || null;
  }

  /**
   * Find user by ID — used by auth refresh (no RLS context) and authenticate (has RLS context).
   * Uses migrateQuery (superuser) because refresh runs outside the authenticated middleware,
   * and the authenticate middleware has its own inline user lookup with RLS vars set.
   */
  static async findById(id: string): Promise<UserRow | null> {
    const result = await migrateQuery('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  /**
   * Create a new user — cross-tenant operation (registration).
   * Uses migrateQuery (superuser) because registration creates users across orgs.
   */
  static async create(data: Partial<UserRow>): Promise<UserRow> {
    const { email, password_hash, role, organization_id } = data;
    const result = await migrateQuery(
      'INSERT INTO users (email, password_hash, role, organization_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [email, password_hash, role, organization_id]
    );
    return result.rows[0];
  }
}
