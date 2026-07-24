import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });
const pool = require('../src/shared/database').default;

async function verify() {
  const tables = [
    'organizations', 'users', 'staff_profiles', 'locations', 'departments', 'teams',
    'service_users', 'care_plans', 'incidents', 'policies', 'appointments', 'tasks',
    'shifts', 'shift_assignments', 'leave_types', 'leave_balances', 'leave_requests',
    'training_modules', 'training_records', 'compliance_config', 'compliance_records',
    'notifications', 'audit_logs', 'emergency_contacts', 'qualifications', 'skills',
  ];
  for (const t of tables) {
    const r = await pool.query(`SELECT count(*) FROM ${t}`);
    console.log(`${t.padEnd(25)} ${r.rows[0].count}`);
  }
  await pool.end();
}
verify();
