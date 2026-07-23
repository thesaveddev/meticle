import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

// Import pool AFTER dotenv so DATABASE_URL is available
const pool = require('../src/shared/database').default;

async function createSuperAdmin() {
  const bcrypt = await import('bcryptjs');
  const email = process.argv[2] || 'admin@caredesk.app';
  const password = process.argv[3] || 'AdminPass123!';

  try {
    const existing = await pool.query('SELECT id, role FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      if (user.role === 'SUPER_ADMIN') {
        console.log(`${email} is already a SUPER_ADMIN`);
        return;
      }
      await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['SUPER_ADMIN', user.id]);
      console.log(`Promoted ${email} to SUPER_ADMIN`);
      return;
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, role, status, email_verified)
       VALUES ($1, $2, 'SUPER_ADMIN', 'active', true)
       RETURNING id, email, role`,
      [email, hash]
    );
    console.log(`Created SUPER_ADMIN: ${result.rows[0].email} (id: ${result.rows[0].id})`);
    console.log(`Password: ${password}`);
  } catch (err: any) {
    console.error('Failed:', err.message);
  } finally {
    await pool.end();
  }
}

createSuperAdmin();
