import { Request, Response } from 'express';
import { migrateQuery } from '../../shared/database';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { generateAccessToken, generateRefreshToken } from '../auth/jwt.service';
import { markOrgAsDemo } from '../../shared/middleware/demoGuard';
import { UserRole } from '@meticle/shared';

const DEMO_EMAIL = 'demo@meticlecare.com';
const DEMO_PASSWORD = 'DemoAccess2026!';
const DEMO_PASSWORD_HASH = bcrypt.hashSync(DEMO_PASSWORD, 10);

// Flag to track if demo data has been seeded in this process
let demoSeeded = false;

/**
 * Ensure demo org and user exist, seed data if needed, return login tokens.
 * POST /api/demo/access
 */
export async function demoAccess(req: Request, res: Response) {
  // Find or create demo organization
  let orgResult = await migrateQuery(
    `SELECT id, name FROM organizations WHERE is_demo = TRUE LIMIT 1`
  );

  let orgId: string;
  let orgName: string;

  if (orgResult.rows.length === 0) {
    // Create demo organization
    orgId = uuid();
    orgName = 'MeticleCare Demo Organisation';
    await migrateQuery(
      `INSERT INTO organizations (id, name, status, plan, subscription_status, trial_ends_at, is_demo, onboarding_completed, minimum_compliance_percent)
       VALUES ($1, $2, 'active', 'professional', 'active', $3, TRUE, TRUE, 70)`,
      [orgId, orgName, new Date(Date.now() + 365 * 86400000).toISOString()]
    );

    // Create headquarters location and departments, then seed
    const setupResult = await setupDemoLocation(orgId);
    await seedDemoData(orgId, setupResult.locId, setupResult.deptIds);
    demoSeeded = true;
  } else {
    orgId = orgResult.rows[0].id;
    orgName = orgResult.rows[0].name;

    // Check if demo data needs seeding (org exists but is empty)
    const peopleCount = await migrateQuery(
      `SELECT COUNT(*)::int AS count FROM people WHERE organization_id = $1`,
      [orgId]
    );

    if ((peopleCount.rows[0]?.count ?? 0) === 0) {
      const setupResult = await setupDemoLocation(orgId);
      await seedDemoData(orgId, setupResult.locId, setupResult.deptIds);
      demoSeeded = true;
    }
  }

  // Find or create demo user
  let userResult = await migrateQuery(
    `SELECT id, email, role, organization_id, status FROM users WHERE email = $1`,
    [DEMO_EMAIL]
  );

  let userId: string;

  if (userResult.rows.length === 0) {
    userId = uuid();
    await migrateQuery(
      `INSERT INTO users (id, organization_id, email, role, status, password_hash, email_verified)
       VALUES ($1, $2, $3, 'ORG_ADMIN', 'active', $4, TRUE)`,
      [userId, orgId, DEMO_EMAIL, DEMO_PASSWORD_HASH]
    );

    // Create staff profile
    await migrateQuery(
      `INSERT INTO staff_profiles (id, user_id, first_name, last_name)
       VALUES ($1, $2, 'Demo', 'Administrator') ON CONFLICT (user_id) DO NOTHING`,
      [uuid(), userId]
    );
  } else {
    userId = userResult.rows[0].id;
  }

  // Generate tokens
  const tokenPayload = {
    userId,
    email: DEMO_EMAIL,
    role: UserRole.ORG_ADMIN,
    organizationId: orgId,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Mark this org as demo in the cache so the demo guard blocks mutations
  markOrgAsDemo(orgId);

  res.json({
    user: {
      id: userId,
      email: DEMO_EMAIL,
      role: 'ORG_ADMIN',
      organizationId: orgId,
      status: 'active',
      first_name: 'Demo',
      last_name: 'Administrator',
    },
    organization: {
      id: orgId,
      name: orgName,
      plan: 'professional',
      subscription_status: 'active',
      is_demo: true,
    },
    accessToken,
    refreshToken,
    isDemo: true,
    message: 'Welcome to the MeticleCare demo! This is a read-only sandbox with sample data.',
  });
}

/**
 * Create the demo location and departments if they don't exist.
 */
async function setupDemoLocation(orgId: string): Promise<{ locId: string; deptIds: string[] }> {
  let locResult = await migrateQuery(
    `SELECT id FROM locations WHERE organization_id = $1 LIMIT 1`,
    [orgId]
  );

  let locId: string;
  if (locResult.rows.length === 0) {
    locId = uuid();
    await migrateQuery(
      `INSERT INTO locations (id, organization_id, name, address, minimum_staff_per_day)
       VALUES ($1, $2, 'MeticleCare House', '10 Downing Street, London SW1A 2AA', 3)`,
      [locId, orgId]
    );
  } else {
    locId = locResult.rows[0].id;
  }

  let deptResult = await migrateQuery(
    `SELECT id FROM departments WHERE location_id = $1 LIMIT 1`,
    [locId]
  );

  const deptIds: string[] = [];
  if (deptResult.rows.length === 0) {
    for (const name of ['Clinical Services', 'Residential Care', 'Administration']) {
      const did = uuid();
      await migrateQuery(`INSERT INTO departments (id, location_id, name) VALUES ($1, $2, $3)`, [did, locId, name]);
      deptIds.push(did);
    }
  } else {
    for (const row of deptResult.rows) deptIds.push(row.id);
  }

  return { locId, deptIds };
}

/**
 * Seed comprehensive demo data for the public demo account
 */
async function seedDemoData(orgId: string, locId: string, deptIds: string[]) {
  const staffData = [
    { first: 'James', last: 'Mercer', role: 'ORG_ADMIN' as const },
    { first: 'Sarah', last: 'Chen', role: 'MANAGER' as const },
    { first: 'Michael', last: 'Okonkwo', role: 'MANAGER' as const },
    { first: 'Emily', last: 'Thornton', role: 'MANAGER' as const },
    { first: 'David', last: 'Patel', role: 'CARE_WORKER' as const },
    { first: 'Rebecca', last: 'Jones', role: 'CARE_WORKER' as const },
    { first: 'Daniel', last: 'Khan', role: 'CARE_WORKER' as const },
    { first: 'Laura', last: 'Bennett', role: 'CARE_WORKER' as const },
    { first: 'Thomas', last: "O'Brien", role: 'CARE_WORKER' as const },
    { first: 'Hannah', last: 'Wilson', role: 'CARE_WORKER' as const },
    { first: 'Olivia', last: 'Taylor', role: 'CARE_WORKER' as const },
    { first: 'Ryan', last: 'Clarke', role: 'CARE_WORKER' as const },
  ];

  const staffIds: string[] = [];
  const userIds: string[] = [];

  for (const s of staffData) {
    const uid = uuid();
    const spId = uuid();
    const email = `${s.first.toLowerCase()}.${s.last.toLowerCase()}@meticlecare-demo.com`;

    await migrateQuery(
      `INSERT INTO users (id, organization_id, email, role, status, password_hash, email_verified)
       VALUES ($1, $2, $3, $4, 'active', $5, TRUE)`,
      [uid, orgId, email, s.role, DEMO_PASSWORD_HASH]
    );

    await migrateQuery(
      `INSERT INTO staff_profiles (id, user_id, first_name, last_name, location_id, employment_type, contracted_hours_weekly)
       VALUES ($1, $2, $3, $4, $5, 'full_time', 37.5)`,
      [spId, uid, s.first, s.last, locId]
    );

    staffIds.push(spId);
    userIds.push(uid);
  }

  // People (residents)
  const peopleData = [
    { first: 'Arthur', last: 'Clarke', room: '101', nhs: 'A12345678', dob: '1942-03-15', allergies: 'Penicillin', diet: 'Soft diet only', support: 'two_to_one', gp: 'Dr Patel' },
    { first: 'Margaret', last: 'Silva', room: '102', nhs: 'A23456789', dob: '1938-07-22', allergies: '', diet: 'Diabetic', support: 'one_to_one', gp: 'Dr Evans' },
    { first: 'George', last: 'Okonkwo', room: '103', nhs: 'A34567890', dob: '1955-11-08', allergies: 'Latex', diet: 'Halal', support: 'minimal', gp: 'Dr Khan' },
    { first: 'Florence', last: 'Nightingale', room: '104', nhs: 'A45678901', dob: '1940-05-12', allergies: 'Aspirin', diet: 'Modified texture', support: 'two_to_one', gp: 'Dr Miller' },
    { first: 'Winston', last: 'Churchill', room: '105', nhs: 'A56789012', dob: '1930-11-30', allergies: '', diet: 'Low sodium', support: 'one_to_one', gp: 'Dr Adams' },
    { first: 'Agatha', last: 'Christie', room: '201', nhs: 'A67890123', dob: '1945-09-15', allergies: 'Peanuts', diet: 'Regular', support: 'minimal', gp: 'Dr Brown' },
    { first: 'Alan', last: 'Turing', room: '202', nhs: 'A78901234', dob: '1950-06-23', allergies: '', diet: 'Regular', support: 'one_to_one', gp: 'Dr Green' },
    { first: 'Isaac', last: 'Newton', room: '203', nhs: 'A89012345', dob: '1943-01-04', allergies: 'Sulfa', diet: 'Fortified', support: 'minimal', gp: 'Dr White' },
    { first: 'Jane', last: 'Austen', room: '301', nhs: 'A01234567', dob: '1947-12-16', allergies: 'Penicillin', diet: 'Regular', support: 'independent', gp: 'Dr Scott' },
    { first: 'William', last: 'Shakespeare', room: '302', nhs: 'A12345679', dob: '1936-04-23', allergies: '', diet: 'Soft diet', support: 'one_to_one', gp: 'Dr King' },
    { first: 'Mary', last: 'Seacole', room: '303', nhs: 'A23456780', dob: '1941-05-15', allergies: 'Latex', diet: 'Diabetic, soft', support: 'two_to_one', gp: 'Dr Lewis' },
    { first: 'Nelson', last: 'Mandela', room: '206', nhs: 'A67890124', dob: '1937-06-18', allergies: 'Penicillin', diet: 'Soft, fortified', support: 'two_to_one', gp: 'Dr Black' },
  ];

  const personIds: string[] = [];
  for (const p of peopleData) {
    const pid = uuid();
    await migrateQuery(
      `INSERT INTO people (id, organization_id, first_name, last_name, date_of_birth, nhs_number, room_number,
        status, allergies, dietary_requirements, support_level, location_id, gp_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $10, $11, $12)`,
      [pid, orgId, p.first, p.last, p.dob, p.nhs, p.room,
       JSON.stringify(p.allergies ? p.allergies.split(', ') : []), p.diet, p.support, locId, p.gp]
    );
    personIds.push(pid);
  }

  // Care plans
  const planCats = ['personal_care', 'medication', 'mobility', 'nutrition', 'mental_health'];
  let carePlanCount = 0;
  for (const pid of personIds) {
    const cats = [...planCats].sort(() => Math.random() - 0.5).slice(0, 2);
    for (const cat of cats) {
      await migrateQuery(
        `INSERT INTO care_plans (id, person_id, title, category, description, risk_assessment, review_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')`,
        [uuid(), pid, `${cat.replace(/_/g, ' ')} support plan`, cat,
         `Individualised support plan. Reviewed monthly with family involvement.`,
         'Low risk with regular monitoring.',
         new Date(Date.now() + (60 + Math.random() * 120) * 86400000).toISOString().split('T')[0]]
      );
      carePlanCount++;
    }
  }

  // Daily notes
  const noteCats = ['wellbeing', 'nutrition', 'hydration', 'mobility', 'mood', 'medication'];
  const noteTemplates = [
    'Had a good day. Participated in morning activities and ate well at lunch.',
    'Mood stable. Engaged socially with others during afternoon tea.',
    'Required assistance with personal care this morning. Mobility slightly reduced.',
    'Ate 75% of breakfast and lunch. Hydration encouraged throughout the day.',
    'Slept well through the night. No incidents reported.',
    'Physiotherapy session went well. Improved mobility with walking frame.',
    'Family visited today. Person was very happy and animated.',
    'Mood low this morning but improved after lunch.',
    'Assisted with medication at 0800 and 2000. No issues.',
    'Skin integrity checked — pressure areas clear.',
  ];

  for (let i = 0; i < 60; i++) {
    const pid = personIds[Math.floor(Math.random() * personIds.length)];
    const daysAgo = Math.floor(Math.random() * 30);
    await migrateQuery(
      `INSERT INTO daily_notes (id, person_id, author_id, note_date, shift, category, content, support_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [uuid(), pid, userIds[Math.floor(Math.random() * userIds.length)],
       new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0],
       Math.random() < 0.5 ? 'day' : 'night',
       noteCats[Math.floor(Math.random() * noteCats.length)],
       noteTemplates[Math.floor(Math.random() * noteTemplates.length)],
       ['independent', 'minimal', 'one_to_one', 'two_to_one'][Math.floor(Math.random() * 4)]]
    );
  }

  // Risk assessments
  const riskTypes = ['falls', 'pressure_sore', 'nutrition', 'behaviour', 'medication'];
  for (const pid of personIds) {
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      await migrateQuery(
        `INSERT INTO risk_assessments (id, person_id, type, risk_level, details, mitigation_actions, review_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuid(), pid, riskTypes[Math.floor(Math.random() * riskTypes.length)],
         ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
         'Risk assessment completed during demo seeding.',
         'Regular monitoring and staff awareness.',
         new Date(Date.now() + (30 + Math.random() * 90) * 86400000).toISOString().split('T')[0]]
      );
    }
  }

  // Incidents
  const incidents = [
    { title: 'Fall in bathroom — minor bruising', sev: 'medium', status: 'resolved', days: 45 },
    { title: 'Medication error — wrong dose administered', sev: 'high', status: 'investigating', days: 3 },
    { title: 'Altercation in communal area', sev: 'low', status: 'resolved', days: 20 },
    { title: 'Pressure sore discovered on sacrum', sev: 'medium', status: 'reported', days: 7 },
    { title: 'Slip in corridor — no injury', sev: 'low', status: 'resolved', days: 60 },
    { title: 'Aggressive behaviour towards staff', sev: 'high', status: 'investigating', days: 5 },
    { title: 'Medication refusal', sev: 'medium', status: 'resolved', days: 12 },
    { title: 'Person reported missing — found in garden', sev: 'critical', status: 'closed', days: 30 },
  ];

  for (const inc of incidents) {
    await migrateQuery(
      `INSERT INTO incidents (id, organization_id, title, severity, status, incident_date, location, reported_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [uuid(), orgId, inc.title, inc.sev, inc.status,
       new Date(Date.now() - inc.days * 86400000).toISOString().split('T')[0],
       'MeticleCare House',
       userIds[Math.floor(Math.random() * userIds.length)]]
    );
  }

  // Training modules
  const trainingModules = [
    { name: 'Safeguarding Adults Level 2', cat: 'Safeguarding', freq: 365 },
    { name: 'Infection Prevention & Control', cat: 'Infection Control', freq: 365 },
    { name: 'Fire Safety Awareness', cat: 'Fire Safety', freq: 365 },
    { name: 'Moving & Handling People', cat: 'Manual Handling', freq: 365 },
    { name: 'Medication Management', cat: 'Medication', freq: 365 },
    { name: 'Emergency First Aid at Work', cat: 'First Aid', freq: 365 },
    { name: 'GDPR & Data Protection', cat: 'Mandatory', freq: 365 },
    { name: 'Mental Capacity Act & DoLS', cat: 'Mandatory', freq: 365 },
  ];

  const modIds: string[] = [];
  for (const m of trainingModules) {
    const id = uuid();
    await migrateQuery(
      `INSERT INTO training_modules (id, organization_id, name, category, frequency_days, is_mandatory)
       VALUES ($1, $2, $3, $4, $5, TRUE)`,
      [id, orgId, m.name, m.cat, m.freq]
    );
    modIds.push(id);
  }

  // Training records
  for (const sid of staffIds) {
    for (const mid of modIds) {
      if (Math.random() < 0.15) continue;
      const daysAgo = Math.floor(Math.random() * 300);
      const completedAt = new Date(Date.now() - daysAgo * 86400000);
      const expiresAt = new Date(completedAt.getTime() + 365 * 86400000);
      await migrateQuery(
        `INSERT INTO training_records (module_id, staff_id, completed_at, expires_at, status)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [mid, sid, completedAt.toISOString(), expiresAt.toISOString(), 'completed']
      );
    }
  }

  // Compliance config
  const reqNames = ['DBS Check', 'Safeguarding Training', 'Manual Handling', 'Medication Competency', 'First Aid Certificate', 'Fire Safety'];
  for (const rn of reqNames) {
    await migrateQuery(
      `INSERT INTO compliance_config (id, organization_id, name, description, days_warning, days_overdue, is_mandatory)
       VALUES ($1, $2, $3, $4, 30, 0, TRUE)`,
      [uuid(), orgId, rn, `${rn} compliance requirement for all care staff`]
    );
  }

  // Policies
  const policies = [
    { title: 'Safeguarding Adults Policy', cat: 'Safeguarding' },
    { title: 'Risk Assessment Policy', cat: 'Health & Safety' },
    { title: 'Complaints Procedure', cat: 'HR' },
    { title: 'GDPR & Data Protection Policy', cat: 'Data Protection' },
    { title: 'Infection Control Policy', cat: 'Clinical' },
    { title: 'Fire Safety Policy', cat: 'Health & Safety' },
  ];

  for (const p of policies) {
    await migrateQuery(
      `INSERT INTO policies (id, organization_id, title, category, content, version)
       VALUES ($1, $2, $3, $4, $5, '1.0')`,
      [uuid(), orgId, p.title, p.cat,
       `# ${p.title}\n\nThis policy outlines the approach of MeticleCare Demo to ${p.title.toLowerCase()}.\n\n## Purpose\nTo ensure compliance with CQC regulations and promote best practice.\n\n## Scope\nThis policy applies to all staff, contractors, and volunteers.\n\n## Review\nThis policy will be reviewed annually.`]
    );
  }

  // Tasks
  const tasks = [
    { title: 'Review all care plans for Q1', pri: 'high', days: -5, status: 'completed' },
    { title: 'Order medication supplies', pri: 'high', days: 0, status: 'in_progress' },
    { title: 'Fire safety check — all floors', pri: 'low', days: -2, status: 'completed' },
    { title: 'Update risk assessments after incident', pri: 'high', days: 3, status: 'pending' },
    { title: 'Staff supervision — David Patel', pri: 'medium', days: 7, status: 'pending' },
    { title: 'Prepare for CQC inspection', pri: 'high', days: 30, status: 'pending' },
  ];

  for (const td of tasks) {
    await migrateQuery(
      `INSERT INTO tasks (id, organization_id, title, assigned_to, priority, status, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [uuid(), orgId, td.title, staffIds[Math.floor(Math.random() * staffIds.length)],
       td.pri, td.status, new Date(Date.now() + td.days * 86400000).toISOString().split('T')[0]]
    );
  }

  // Leave types
  const leaveTypes = [
    { name: 'Annual Leave', color: '#0F4C81', days: 20 },
    { name: 'Sick Leave', color: '#DC2626', days: 6 },
    { name: 'Training Leave', color: '#16A34A', days: 3 },
  ];

  const ltIds: string[] = [];
  for (const lt of leaveTypes) {
    const ltId = uuid();
    await migrateQuery(
      `INSERT INTO leave_types (id, organization_id, name, color, days_allowed, duration_type)
       VALUES ($1, $2, $3, $4, $5, 'days')`,
      [ltId, orgId, lt.name, lt.color, lt.days]
    );
    ltIds.push(ltId);
  }

  // Leave requests
  const leaveStatuses = ['approved', 'approved', 'pending', 'approved', 'rejected'];
  for (let i = 0; i < 8; i++) {
    const sid = staffIds[i % staffIds.length];
    const ltId = ltIds[i % ltIds.length];
    const start = new Date(Date.now() + (i < 4 ? -30 : 10 + Math.floor(Math.random() * 20)) * 86400000);
    const end = new Date(start.getTime() + (1 + Math.floor(Math.random() * 3)) * 86400000);
    await migrateQuery(
      `INSERT INTO leave_requests (id, staff_id, leave_type_id, start_date, end_date, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [uuid(), sid, ltId, start.toISOString().split('T')[0], end.toISOString().split('T')[0],
       ['Family holiday', 'Medical appointment', 'Personal reasons', 'Study leave'][i % 4],
       leaveStatuses[i % leaveStatuses.length]]
    );
  }

  console.log(`  ✓ Demo data seeded: ${staffData.length} staff, ${peopleData.length} people, ${carePlanCount} care plans, 60 daily notes, ${incidents.length} incidents`);
}
