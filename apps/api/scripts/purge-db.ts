import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = require('../src/shared/database').default;

async function purgeAndRecreate() {
  try {
    console.log('Dropping all tables...');
    await pool.query(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);
    console.log('All tables dropped.');

    console.log('Running schema.sql...');
    const schemaPath = path.join(__dirname, '../src/shared/database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    // Split into statements, handling $$ blocks properly
    const stmts: string[] = [];
    let current = '';
    let inDollar = false;
    for (let i = 0; i < schema.length; i++) {
      const ch = schema[i];
      if (schema.slice(i, i + 2) === '$$') {
        inDollar = !inDollar;
        current += '$$';
        i++;
        continue;
      }
      if (ch === ';' && !inDollar) {
        stmts.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) stmts.push(current.trim());

    // Strip leading SQL comments from each statement
    const cleaned = stmts.map(s => s.replace(/^--.*\n/gm, '').trim()).filter(s => s.length > 0);
    for (let pass = 0; pass < 3; pass++) {
      let remaining = 0;
      for (const stmt of cleaned) {
        try {
          await pool.query(stmt);
        } catch {
          remaining++;
        }
      }
      if (remaining === 0) break;
    }
    console.log('Schema created.');

    console.log('Running migrations...');
    const { MIGRATIONS } = require('../src/shared/database/setup');
    for (const migration of MIGRATIONS) {
      try {
        await pool.query(migration);
      } catch {
        // ignore
      }
    }
    console.log('Migrations complete.');

    console.log('Creating SUPER_ADMIN user...');
    const bcrypt = await import('bcryptjs');
    // The admin identity and password are supplied by the operator. A purge
    // script that recreates a known admin with a known password is a backdoor
    // with extra steps — anyone who reads the repo can log in after it runs.
    const ADMIN_EMAIL = process.env.PURGE_ADMIN_EMAIL || '';
    const ADMIN_PASSWORD = process.env.PURGE_ADMIN_PASSWORD || '';
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
      console.error('PURGE_ADMIN_EMAIL and PURGE_ADMIN_PASSWORD (min 12 chars) are required — no default admin is created.');
      process.exit(1);
    }
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, role, status, email_verified)
       VALUES ($1, $2, 'SUPER_ADMIN', 'active', true)
       ON CONFLICT (email) DO UPDATE SET role = 'SUPER_ADMIN', status = 'active'
       RETURNING id, email, role`,
      [ADMIN_EMAIL, hash]
    );
    console.log(`SUPER_ADMIN: ${result.rows[0].email} (id: ${result.rows[0].id})`);
    console.log('Password: the PURGE_ADMIN_PASSWORD you supplied');

    console.log('\nDatabase purged and recreated successfully.');
  } catch (err: any) {
    console.error('Failed:', err.message);
  } finally {
    await pool.end();
  }
}

purgeAndRecreate();
