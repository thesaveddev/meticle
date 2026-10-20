// Grants platform-admin access to one account: upserts it as SUPER_ADMIN so it
// can open /platform-admin. A fresh address becomes an org-less account (so it
// survives org deletion); an existing org user is promoted in place and keeps
// its organization membership alongside the platform role.
// Run (DATABASE_URL must point at the target database, e.g. over the SSH tunnel):
//   ADMIN_EMAIL='you@example.com' ADMIN_PASSWORD='...' npx tsx src/scripts/add-super-admin.ts
//
// Both values come from the operator at run time and never exist in source: a
// password committed here is a real credential for every database this script
// can reach. The password must meet the same 12-char minimum the seeds enforce.
//
// Safe to re-run: an existing address is promoted to SUPER_ADMIN in place
// (role re-asserted, account re-activated, password replaced) and keeps its
// organization membership; a fresh address becomes an org-less SUPER_ADMIN.

if (!process.env.ADMIN_EMAIL || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(process.env.ADMIN_EMAIL)) {
  console.error("Refusing to run without ADMIN_EMAIL — e.g. ADMIN_EMAIL='you@example.com'.");
  process.exit(1);
}

if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) {
  console.error('Refusing to run without ADMIN_PASSWORD (min 12 chars).');
  process.exit(1);
}

import pool from '../shared/database';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';

const EMAIL = process.env.ADMIN_EMAIL!.trim().toLowerCase();
const PWH = bcrypt.hashSync(process.env.ADMIN_PASSWORD!, 12);

// Bypass RLS: this runs outside any request, so every query carries the
// super-admin session vars the way the seed scripts do.
const __seedPoolQuery = pool.query.bind(pool);
(pool as any).query = (text: string, params?: any[]) => {
  if (typeof text === 'string') {
    return (async () => {
      const client = await pool.connect();
      try {
        await client.query(`SELECT set_config('app.current_org_id', $1, false)`, ['']);
        await client.query(`SELECT set_config('app.current_user_id', $1, false)`, ['00000000-0000-0000-0000-000000000000']);
        await client.query(`SELECT set_config('app.current_user_role', $1, false)`, ['SUPER_ADMIN']);
        return await client.query(text, params);
      } finally {
        client.release();
      }
    })();
  }
  return __seedPoolQuery(text as any, params);
};

async function main() {
  const existing = await pool.query(
    `SELECT id, organization_id, role, status FROM users WHERE email = $1`,
    [EMAIL],
  );
  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    // Promoting keeps the organization membership: SUPER_ADMIN is additive —
    // the account gains /platform-admin without losing its org, which is what
    // an owner-operator wants (one login for the business and the platform).
    // A fresh address gets the org-less variant that survives org deletion.
    await pool.query(
      `UPDATE users SET role = 'SUPER_ADMIN', password_hash = $1, status = 'active', email_verified = true WHERE id = $2`,
      [PWH, row.id],
    );
    console.log(`\n  ✓ ${EMAIL} promoted to platform SUPER_ADMIN (password replaced, account active` +
      (row.organization_id ? ', organization membership kept' : ', org-less account') + `)\n`);
  } else {
    await pool.query(
      `INSERT INTO users (id, organization_id, email, role, status, password_hash, email_verified) VALUES ($1, NULL, $2, 'SUPER_ADMIN', 'active', $3, true)`,
      [uuid(), EMAIL, PWH],
    );
    console.log(`\n  ✓ ${EMAIL} created as platform SUPER_ADMIN\n`);
  }
  console.log('  Sign in at /login, then open /platform-admin.\n');
  await pool.end();
}

main().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
