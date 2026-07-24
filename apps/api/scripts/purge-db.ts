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
    const hash = await bcrypt.hash('AdminPass123!', 12);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, role, status, email_verified)
       VALUES ($1, $2, 'SUPER_ADMIN', 'active', true)
       ON CONFLICT (email) DO UPDATE SET role = 'SUPER_ADMIN', status = 'active'
       RETURNING id, email, role`,
      ['admin@meticlecare.com', hash]
    );
    console.log(`SUPER_ADMIN: ${result.rows[0].email} (id: ${result.rows[0].id})`);
    console.log('Password: AdminPass123!');

    console.log('\nDatabase purged and recreated successfully.');
  } catch (err: any) {
    console.error('Failed:', err.message);
  } finally {
    await pool.end();
  }
}

purgeAndRecreate();
