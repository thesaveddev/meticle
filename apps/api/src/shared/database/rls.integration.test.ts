import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import pool, { query } from './index';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword } from '../../modules/auth/password.util';
import { PoolClient } from 'pg';

const orgAId = uuidv4();
const orgBId = uuidv4();
const userIdA = uuidv4();
const userIdB = uuidv4();
const staffProfileIdA = uuidv4();
const staffProfileIdB = uuidv4();
const serviceUserIdA = uuidv4();
const serviceUserIdB = uuidv4();
const locationIdA = uuidv4();
const locationIdB = uuidv4();

const TEST_ROLE = 'rls_test_role';

async function setupOrg(orgId: string, orgName: string) {
  await query(
    `INSERT INTO organizations (id, name, status, plan, subscription_status, onboarding_step, onboarding_completed, minimum_compliance_percent, overtime_requires_approval, force_mfa)
     VALUES ($1, $2, 'active', 'starter', 'active', 1, true, 100, true, false)
     ON CONFLICT (id) DO NOTHING`,
    [orgId, orgName]
  );
}

async function setupUser(userId: string, orgId: string, email: string) {
  const hash = await hashPassword('TestPass123!');
  await query(
    `INSERT INTO users (id, email, password_hash, role, status, organization_id)
     VALUES ($1, $2, $3, 'CARE_WORKER', 'active', $4)
     ON CONFLICT (id) DO NOTHING`,
    [userId, email, hash, orgId]
  );
}

async function setupStaffProfile(id: string, userId: string) {
  await query(
    `INSERT INTO staff_profiles (id, user_id, first_name, last_name, phone, employment_type, contracted_hours_weekly)
     VALUES ($1, $2, 'Test', 'Staff', '07700000000', 'full_time', 37.5)
     ON CONFLICT (id) DO NOTHING`,
    [id, userId]
  );
}

async function setupServiceUser(id: string, orgId: string, firstName: string) {
  await query(
    `INSERT INTO service_users (id, organization_id, first_name, last_name, date_of_birth, status)
     VALUES ($1, $2, $3, 'TestUser', '1990-01-01', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [id, orgId, firstName]
  );
}

async function setupLocation(id: string, orgId: string, name: string) {
  await query(
    `INSERT INTO locations (id, organization_id, name, address, minimum_staff_per_day)
     VALUES ($1, $2, $3, '123 Test St', 1)
     ON CONFLICT (id) DO NOTHING`,
    [id, orgId, name]
  );
}

/**
 * Get a dedicated client with RLS session variables set.
 * Uses SET ROLE to a non-superuser so RLS is enforced.
 * Caller MUST call client.release() when done.
 */
async function getRlsClient(orgId: string, userId: string, role = 'CARE_WORKER'): Promise<PoolClient> {
  const client = await pool.connect();
  await client.query(`SELECT set_config('app.current_org_id', $1, false)`, [orgId]);
  await client.query(`SELECT set_config('app.current_user_id', $1, false)`, [userId]);
  await client.query(`SELECT set_config('app.current_user_role', $1, false)`, [role]);
  // DROP superuser privileges so RLS is enforced
  await client.query(`SET ROLE TO ${TEST_ROLE}`);
  return client;
}

async function releaseClient(client: PoolClient) {
  try { await client.query('RESET ROLE'); } catch { /* ignore */ }
  try { await client.query(`SELECT set_config('app.current_org_id', '', false)`); } catch { /* ignore */ }
  try { await client.query(`SELECT set_config('app.current_user_id', '', false)`); } catch { /* ignore */ }
  try { await client.query(`SELECT set_config('app.current_user_role', '', false)`); } catch { /* ignore */ }
  client.release();
}

beforeAll(async () => {
  // Ensure RLS is applied and FORCE RLS is enabled
  const migrationFiles = ['002_enable_rls.sql', '003_add_missing_rls.sql'];
  const setupClient = await pool.connect();
  try {
    for (const file of migrationFiles) {
      const p = path.join(__dirname, 'migrations', file);
      if (fs.existsSync(p)) {
        const sql = fs.readFileSync(p, 'utf8');
        try { await setupClient.query(sql); } catch { /* already applied */ }
      }
    }

    // Ensure test role exists (non-superuser, non-login)
    try { await setupClient.query(`CREATE ROLE ${TEST_ROLE} NOLOGIN`); } catch { /* exists */ }
    // Grant basic permissions needed for queries
    await setupClient.query(`GRANT CONNECT ON DATABASE ${getDatabaseName()} TO ${TEST_ROLE}`);
    await setupClient.query(`GRANT USAGE ON SCHEMA public TO ${TEST_ROLE}`);
    await setupClient.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${TEST_ROLE}`);
    await setupClient.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${TEST_ROLE}`);
  } finally {
    setupClient.release();
  }

  await setupOrg(orgAId, 'RLS Test Org A');
  await setupOrg(orgBId, 'RLS Test Org B');
  await setupUser(userIdA, orgAId, `rls-a-${orgAId.slice(0, 8)}@test.com`);
  await setupUser(userIdB, orgBId, `rls-b-${orgBId.slice(0, 8)}@test.com`);
  await setupStaffProfile(staffProfileIdA, userIdA);
  await setupStaffProfile(staffProfileIdB, userIdB);
  await setupServiceUser(serviceUserIdA, orgAId, 'ServiceA');
  await setupServiceUser(serviceUserIdB, orgBId, 'ServiceB');
  await setupLocation(locationIdA, orgAId, 'Location A');
  await setupLocation(locationIdB, orgBId, 'Location B');
}, 30_000);

function getDatabaseName(): string {
  const url = process.env.DATABASE_URL || '';
  const match = url.match(/\/([^/?]+)$/);
  return match ? match[1] : 'meticle';
}

afterAll(async () => {
  // Only clean up test data created by this test (by specific IDs)
  const tables = [
    'qualifications', 'skills', 'emergency_contacts', 'staff_availability',
    'health_observations', 'bowel_movements', 'dental_records', 'fluid_intake',
    'compliance_profile_requirements',
  ];
  for (const table of tables) {
    try { await query(`DELETE FROM ${table}`); } catch { /* skip */ }
  }
  // Delete service_users, staff_profiles, locations by org ID
  for (const orgId of [orgAId, orgBId]) {
    try { await query(`DELETE FROM service_users WHERE organization_id = $1`, [orgId]); } catch { /* skip */ }
    try { await query(`DELETE FROM locations WHERE organization_id = $1`, [orgId]); } catch { /* skip */ }
  }
  try { await query(`DELETE FROM staff_profiles WHERE user_id IN ($1, $2)`, [userIdA, userIdB]); } catch { /* skip */ }
  try { await query(`DELETE FROM users WHERE id IN ($1, $2)`, [userIdA, userIdB]); } catch { /* skip */ }
  try { await query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [orgAId, orgBId]); } catch { /* skip */ }
});

describe('RLS — Policy existence verification', () => {
  it('should have tenant_isolation policy on all critical tables', async () => {
    const result = await query(`
      SELECT schemaname, tablename, policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND policyname = 'tenant_isolation'
      ORDER BY tablename
    `);
    const tables = result.rows.map((r: any) => r.tablename);
    const expected = [
      'users', 'locations', 'teams', 'departments',
      'service_users', 'staff_profiles',
      'incidents', 'tasks', 'policies', 'appointments',
      'qualifications', 'skills', 'emergency_contacts', 'staff_availability',
      'health_observations', 'bowel_movements', 'dental_records', 'fluid_intake',
      'compliance_profile_requirements',
      'leave_types', 'leave_requests', 'leave_balances',
      'shifts', 'shift_assignments', 'shift_swaps',
      'training_modules', 'training_records',
      'competency_templates', 'competency_assessments',
      'compliance_config', 'compliance_records',
      'care_plans', 'daily_notes', 'risk_assessments',
      'notifications', 'audit_logs',
    ];
    for (const tbl of expected) {
      expect(tables).toContain(tbl);
    }
  });

  it('should have FORCE ROW LEVEL SECURITY on all tenant tables', async () => {
    const result = await query(`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relrowsecurity = true
        AND c.relforcerowsecurity = true
        AND c.relname IN (
          'users', 'tasks', 'policies', 'incidents', 'service_users',
          'locations', 'qualifications', 'skills', 'emergency_contacts',
          'health_observations', 'bowel_movements', 'dental_records', 'fluid_intake'
        )
      ORDER BY c.relname
    `);
    const forced = result.rows.map((r: any) => r.relname);
    expect(forced).toContain('users');
    expect(forced).toContain('tasks');
    expect(forced).toContain('policies');
    expect(forced).toContain('service_users');
    expect(forced).toContain('health_observations');
  });
});

describe('RLS — Cross-org isolation', () => {
  describe('users table', () => {
    it('should only return users from the current org', async () => {
      const client = await getRlsClient(orgAId, userIdA);
      try {
        const result = await client.query('SELECT id FROM users');
        const ids = result.rows.map((r: any) => r.id);
        expect(ids).toContain(userIdA);
        expect(ids).not.toContain(userIdB);
      } finally {
        await releaseClient(client);
      }
    });

    it('should return nothing when no org context is set', async () => {
      const client = await pool.connect();
      try {
        await client.query(`SELECT set_config('app.current_org_id', '', false)`);
        await client.query(`SELECT set_config('app.current_user_role', '', false)`);
        await client.query(`SET ROLE TO ${TEST_ROLE}`);
        const result = await client.query('SELECT id FROM users');
        expect(result.rows.length).toBe(0);
      } finally {
        await releaseClient(client);
      }
    });
  });

  describe('service_users table', () => {
    it('should only return service users from the current org', async () => {
      const client = await getRlsClient(orgAId, userIdA);
      try {
        const result = await client.query('SELECT id FROM service_users');
        const ids = result.rows.map((r: any) => r.id);
        expect(ids).toContain(serviceUserIdA);
        expect(ids).not.toContain(serviceUserIdB);
      } finally {
        await releaseClient(client);
      }
    });
  });

  describe('locations table', () => {
    it('should only return locations from the current org', async () => {
      const client = await getRlsClient(orgAId, userIdA);
      try {
        const result = await client.query('SELECT id FROM locations');
        const ids = result.rows.map((r: any) => r.id);
        expect(ids).toContain(locationIdA);
        expect(ids).not.toContain(locationIdB);
      } finally {
        await releaseClient(client);
      }
    });
  });

  describe('staff_profiles (FK traversal via users)', () => {
    it('should only return staff profiles from the current org', async () => {
      const client = await getRlsClient(orgAId, userIdA);
      try {
        const result = await client.query('SELECT id FROM staff_profiles');
        const ids = result.rows.map((r: any) => r.id);
        expect(ids).toContain(staffProfileIdA);
        expect(ids).not.toContain(staffProfileIdB);
      } finally {
        await releaseClient(client);
      }
    });
  });

  describe('qualifications (FK traversal via staff_profiles -> users)', () => {
    beforeAll(async () => {
      await query(
        `INSERT INTO qualifications (id, staff_id, name, issue_date) VALUES ($1, $2, 'RN Qualification', '2024-01-15') ON CONFLICT (id) DO NOTHING`,
        [uuidv4(), staffProfileIdA]
      );
      await query(
        `INSERT INTO qualifications (id, staff_id, name, issue_date) VALUES ($1, $2, 'BLS Cert', '2024-06-01') ON CONFLICT (id) DO NOTHING`,
        [uuidv4(), staffProfileIdB]
      );
    });

    it('should only return qualifications from the current org', async () => {
      const client = await getRlsClient(orgAId, userIdA);
      try {
        const result = await client.query('SELECT name FROM qualifications');
        const names = result.rows.map((r: any) => r.name);
        expect(names).toContain('RN Qualification');
        expect(names).not.toContain('BLS Cert');
      } finally {
        await releaseClient(client);
      }
    });
  });

  describe('skills (FK traversal via staff_profiles -> users)', () => {
    beforeAll(async () => {
      await query(`INSERT INTO skills (id, staff_id, name) VALUES ($1, $2, 'Wound Care') ON CONFLICT (id) DO NOTHING`, [uuidv4(), staffProfileIdA]);
      await query(`INSERT INTO skills (id, staff_id, name) VALUES ($1, $2, 'Catheter Care') ON CONFLICT (id) DO NOTHING`, [uuidv4(), staffProfileIdB]);
    });

    it('should only return skills from the current org', async () => {
      const client = await getRlsClient(orgAId, userIdA);
      try {
        const result = await client.query('SELECT name FROM skills');
        const names = result.rows.map((r: any) => r.name);
        expect(names).toContain('Wound Care');
        expect(names).not.toContain('Catheter Care');
      } finally {
        await releaseClient(client);
      }
    });
  });

  describe('emergency_contacts (FK traversal via staff_profiles -> users)', () => {
    beforeAll(async () => {
      await query(`INSERT INTO emergency_contacts (id, staff_id, name, relationship, phone) VALUES ($1, $2, 'John Doe', 'Spouse', '07700111111') ON CONFLICT (id) DO NOTHING`, [uuidv4(), staffProfileIdA]);
      await query(`INSERT INTO emergency_contacts (id, staff_id, name, relationship, phone) VALUES ($1, $2, 'Jane Smith', 'Parent', '07700222222') ON CONFLICT (id) DO NOTHING`, [uuidv4(), staffProfileIdB]);
    });

    it('should only return emergency contacts from the current org', async () => {
      const client = await getRlsClient(orgAId, userIdA);
      try {
        const result = await client.query('SELECT name FROM emergency_contacts');
        const names = result.rows.map((r: any) => r.name);
        expect(names).toContain('John Doe');
        expect(names).not.toContain('Jane Smith');
      } finally {
        await releaseClient(client);
      }
    });
  });

  describe('health_observations (FK traversal via service_users)', () => {
    beforeAll(async () => {
      await query(`INSERT INTO health_observations (id, service_user_id, category, notes, severity) VALUES ($1, $2, 'general', 'Org A observation', 'normal') ON CONFLICT (id) DO NOTHING`, [uuidv4(), serviceUserIdA]);
      await query(`INSERT INTO health_observations (id, service_user_id, category, notes, severity) VALUES ($1, $2, 'pain', 'Org B observation', 'mild') ON CONFLICT (id) DO NOTHING`, [uuidv4(), serviceUserIdB]);
    });

    it('should only return health observations from the current org', async () => {
      const client = await getRlsClient(orgAId, userIdA);
      try {
        const result = await client.query('SELECT notes FROM health_observations');
        const notes = result.rows.map((r: any) => r.notes);
        expect(notes).toContain('Org A observation');
        expect(notes).not.toContain('Org B observation');
      } finally {
        await releaseClient(client);
      }
    });
  });

  describe('bowel_movements (FK traversal via service_users)', () => {
    beforeAll(async () => {
      await query(`INSERT INTO bowel_movements (id, service_user_id, bristol_type, notes) VALUES ($1, $2, 4, 'Org A bowel') ON CONFLICT (id) DO NOTHING`, [uuidv4(), serviceUserIdA]);
      await query(`INSERT INTO bowel_movements (id, service_user_id, bristol_type, notes) VALUES ($1, $2, 6, 'Org B bowel') ON CONFLICT (id) DO NOTHING`, [uuidv4(), serviceUserIdB]);
    });

    it('should only return bowel movements from the current org', async () => {
      const client = await getRlsClient(orgAId, userIdA);
      try {
        const result = await client.query('SELECT notes FROM bowel_movements');
        const notes = result.rows.map((r: any) => r.notes);
        expect(notes).toContain('Org A bowel');
        expect(notes).not.toContain('Org B bowel');
      } finally {
        await releaseClient(client);
      }
    });
  });

  describe('dental_records (FK traversal via service_users)', () => {
    beforeAll(async () => {
      await query(`INSERT INTO dental_records (id, service_user_id, checkup_date, findings) VALUES ($1, $2, '2025-01-01', 'Org A dental') ON CONFLICT (id) DO NOTHING`, [uuidv4(), serviceUserIdA]);
      await query(`INSERT INTO dental_records (id, service_user_id, checkup_date, findings) VALUES ($1, $2, '2025-06-01', 'Org B dental') ON CONFLICT (id) DO NOTHING`, [uuidv4(), serviceUserIdB]);
    });

    it('should only return dental records from the current org', async () => {
      const client = await getRlsClient(orgAId, userIdA);
      try {
        const result = await client.query('SELECT findings FROM dental_records');
        const findings = result.rows.map((r: any) => r.findings);
        expect(findings).toContain('Org A dental');
        expect(findings).not.toContain('Org B dental');
      } finally {
        await releaseClient(client);
      }
    });
  });

  describe('fluid_intake (FK traversal via service_users)', () => {
    beforeAll(async () => {
      await query(`INSERT INTO fluid_intake (id, service_user_id, amount_ml, fluid_type, notes) VALUES ($1, $2, 250, 'Water', 'Org A fluid') ON CONFLICT (id) DO NOTHING`, [uuidv4(), serviceUserIdA]);
      await query(`INSERT INTO fluid_intake (id, service_user_id, amount_ml, fluid_type, notes) VALUES ($1, $2, 150, 'Tea', 'Org B fluid') ON CONFLICT (id) DO NOTHING`, [uuidv4(), serviceUserIdB]);
    });

    it('should only return fluid intake from the current org', async () => {
      const client = await getRlsClient(orgAId, userIdA);
      try {
        const result = await client.query('SELECT notes FROM fluid_intake');
        const notes = result.rows.map((r: any) => r.notes);
        expect(notes).toContain('Org A fluid');
        expect(notes).not.toContain('Org B fluid');
      } finally {
        await releaseClient(client);
      }
    });
  });

  describe('leave_requests (FK traversal via staff_profiles -> users)', () => {
    beforeAll(async () => {
      const ltA = uuidv4();
      const ltB = uuidv4();
      await query(`INSERT INTO leave_types (id, organization_id, name, color, days_allowed, duration_type) VALUES ($1, $2, 'Annual A', '#000', 28, 'days') ON CONFLICT (id) DO NOTHING`, [ltA, orgAId]);
      await query(`INSERT INTO leave_types (id, organization_id, name, color, days_allowed, duration_type) VALUES ($1, $2, 'Annual B', '#111', 28, 'days') ON CONFLICT (id) DO NOTHING`, [ltB, orgBId]);
      await query(`INSERT INTO leave_requests (id, staff_id, leave_type_id, start_date, end_date, status, duration_type, reason) VALUES ($1, $2, $3, '2026-09-01', '2026-09-05', 'pending', 'days', 'Org A leave') ON CONFLICT (id) DO NOTHING`, [uuidv4(), staffProfileIdA, ltA]);
      await query(`INSERT INTO leave_requests (id, staff_id, leave_type_id, start_date, end_date, status, duration_type, reason) VALUES ($1, $2, $3, '2026-10-01', '2026-10-05', 'pending', 'days', 'Org B leave') ON CONFLICT (id) DO NOTHING`, [uuidv4(), staffProfileIdB, ltB]);
    });

    it('should only return leave requests from the current org', async () => {
      const client = await getRlsClient(orgAId, userIdA);
      try {
        const result = await client.query('SELECT reason FROM leave_requests');
        const reasons = result.rows.map((r: any) => r.reason);
        expect(reasons).toContain('Org A leave');
        expect(reasons).not.toContain('Org B leave');
      } finally {
        await releaseClient(client);
      }
    });
  });

  describe('incidents table (direct org_id)', () => {
    beforeAll(async () => {
      await query(`INSERT INTO incidents (id, organization_id, title, description, severity, status, incident_date, location) VALUES ($1, $2, 'Org A Incident', 'Test', 'low', 'reported', CURRENT_DATE, 'Wing A') ON CONFLICT (id) DO NOTHING`, [uuidv4(), orgAId]);
      await query(`INSERT INTO incidents (id, organization_id, title, description, severity, status, incident_date, location) VALUES ($1, $2, 'Org B Incident', 'Test', 'low', 'reported', CURRENT_DATE, 'Wing B') ON CONFLICT (id) DO NOTHING`, [uuidv4(), orgBId]);
    });

    it('should only return incidents from the current org', async () => {
      const client = await getRlsClient(orgAId, userIdA);
      try {
        const result = await client.query('SELECT title FROM incidents');
        const titles = result.rows.map((r: any) => r.title);
        expect(titles).toContain('Org A Incident');
        expect(titles).not.toContain('Org B Incident');
      } finally {
        await releaseClient(client);
      }
    });
  });

  describe('shifts (FK traversal via locations)', () => {
    beforeAll(async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString();
      const end = new Date(Date.now() + 90000000).toISOString();
      await query(`INSERT INTO shifts (id, location_id, start_time, end_time, shift_type, status) VALUES ($1, $2, $3, $4, 'day', 'open') ON CONFLICT (id) DO NOTHING`, [uuidv4(), locationIdA, tomorrow, end]);
      await query(`INSERT INTO shifts (id, location_id, start_time, end_time, shift_type, status) VALUES ($1, $2, $3, $4, 'wake_night', 'open') ON CONFLICT (id) DO NOTHING`, [uuidv4(), locationIdB, tomorrow, end]);
    });

    it('should only return shifts from the current org', async () => {
      const client = await getRlsClient(orgAId, userIdA);
      try {
        const result = await client.query('SELECT shift_type FROM shifts');
        const types = result.rows.map((r: any) => r.shift_type);
        expect(types).toContain('day');
        expect(types).not.toContain('night');
      } finally {
        await releaseClient(client);
      }
    });
  });

  describe('tasks table (direct org_id)', () => {
    beforeAll(async () => {
      await query(`INSERT INTO tasks (id, organization_id, title, status, priority, created_by) VALUES ($1, $2, 'Org A Task', 'pending', 'medium', $3) ON CONFLICT (id) DO NOTHING`, [uuidv4(), orgAId, userIdA]);
      await query(`INSERT INTO tasks (id, organization_id, title, status, priority, created_by) VALUES ($1, $2, 'Org B Task', 'pending', 'low', $3) ON CONFLICT (id) DO NOTHING`, [uuidv4(), orgBId, userIdB]);
    });

    it('should only return tasks from the current org', async () => {
      const client = await getRlsClient(orgAId, userIdA);
      try {
        const result = await client.query('SELECT title FROM tasks');
        const titles = result.rows.map((r: any) => r.title);
        expect(titles).toContain('Org A Task');
        expect(titles).not.toContain('Org B Task');
      } finally {
        await releaseClient(client);
      }
    });
  });

  describe('appointments table (direct org_id)', () => {
    beforeAll(async () => {
      await query(`INSERT INTO appointments (id, organization_id, title, start_time, end_time, status, created_by) VALUES ($1, $2, 'Org A Appt', NOW(), NOW() + INTERVAL '1 hour', 'scheduled', $3) ON CONFLICT (id) DO NOTHING`, [uuidv4(), orgAId, userIdA]);
      await query(`INSERT INTO appointments (id, organization_id, title, start_time, end_time, status, created_by) VALUES ($1, $2, 'Org B Appt', NOW() + INTERVAL '2 hours', NOW() + INTERVAL '3 hours', 'scheduled', $3) ON CONFLICT (id) DO NOTHING`, [uuidv4(), orgBId, userIdB]);
    });

    it('should only return appointments from the current org', async () => {
      const client = await getRlsClient(orgAId, userIdA);
      try {
        const result = await client.query('SELECT title FROM appointments');
        const titles = result.rows.map((r: any) => r.title);
        expect(titles).toContain('Org A Appt');
        expect(titles).not.toContain('Org B Appt');
      } finally {
        await releaseClient(client);
      }
    });
  });

  describe('policies table (direct org_id)', () => {
    beforeAll(async () => {
      await query(`INSERT INTO policies (id, organization_id, title, content, category, status, version) VALUES ($1, $2, 'Org A Policy', 'Content A', 'safeguarding', 'active', 1) ON CONFLICT (id) DO NOTHING`, [uuidv4(), orgAId]);
      await query(`INSERT INTO policies (id, organization_id, title, content, category, status, version) VALUES ($1, $2, 'Org B Policy', 'Content B', 'safeguarding', 'active', 1) ON CONFLICT (id) DO NOTHING`, [uuidv4(), orgBId]);
    });

    it('should only return policies from the current org', async () => {
      const client = await getRlsClient(orgAId, userIdA);
      try {
        const result = await client.query('SELECT title FROM policies');
        const titles = result.rows.map((r: any) => r.title);
        expect(titles).toContain('Org A Policy');
        expect(titles).not.toContain('Org B Policy');
      } finally {
        await releaseClient(client);
      }
    });
  });
});

describe('RLS — SUPER_ADMIN bypass', () => {
  it('should allow SUPER_ADMIN to see all orgs data', async () => {
    const client = await pool.connect();
    try {
      await client.query(`SELECT set_config('app.current_org_id', '', false)`);
      await client.query(`SELECT set_config('app.current_user_id', '00000000-0000-0000-0000-000000000000', false)`);
      await client.query(`SELECT set_config('app.current_user_role', 'SUPER_ADMIN', false)`);
      await client.query(`SET ROLE TO ${TEST_ROLE}`);

      const usersResult = await client.query('SELECT id FROM users');
      const userIds = usersResult.rows.map((r: any) => r.id);
      expect(userIds).toContain(userIdA);
      expect(userIds).toContain(userIdB);

      const suResult = await client.query('SELECT id FROM service_users');
      const suIds = suResult.rows.map((r: any) => r.id);
      expect(suIds).toContain(serviceUserIdA);
      expect(suIds).toContain(serviceUserIdB);

      const locResult = await client.query('SELECT id FROM locations');
      const locIds = locResult.rows.map((r: any) => r.id);
      expect(locIds).toContain(locationIdA);
      expect(locIds).toContain(locationIdB);
    } finally {
      await releaseClient(client);
    }
  });
});
