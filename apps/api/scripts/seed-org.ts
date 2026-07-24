import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = require('../src/shared/database').default;

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function seed() {
  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.hash('Password123$', 12);

  const orgId = uuid();
  const locationIds = [uuid(), uuid(), uuid()];
  const deptIds = [uuid(), uuid(), uuid(), uuid()];
  const userIds = [uuid(), uuid(), uuid(), uuid()];
  const staffProfileIds = [uuid(), uuid(), uuid(), uuid()];
  const teamIds = [uuid(), uuid(), uuid()];

  try {
    // ─── Organization ───
    await pool.query(
      `INSERT INTO organizations (id, name, status, plan, subscription_status, trial_ends_at, onboarding_step, onboarding_completed, minimum_compliance_percent, overtime_requires_approval, force_mfa)
       VALUES ($1, $2, 'active', 'professional', 'active', NULL, 6, true, 95, true, false)`,
      [orgId, 'Reydesk Care Services']
    );
    console.log('✓ Organization: Reydesk Care Services');

    // ─── Locations ───
    const locations = [
      { id: locationIds[0], name: 'Sunrise House - Brixton', addr: '42 Atlantic Road, Brixton, London SW9 8PU', min: 3 },
      { id: locationIds[1], name: 'Sunrise House - Camberwell', addr: '118 Peckham Road, Camberwell, London SE5 5PT', min: 4 },
      { id: locationIds[2], name: 'Reydesk Community Hub', addr: '7 Vauxhall Walk, Vauxhall, London SE11 6LH', min: 2 },
    ];
    for (const loc of locations) {
      await pool.query(
        `INSERT INTO locations (id, organization_id, name, address, minimum_staff_per_day) VALUES ($1, $2, $3, $4, $5)`,
        [loc.id, orgId, loc.name, loc.addr, loc.min]
      );
    }
    console.log('✓ 3 locations');

    // ─── Departments ───
    const depts = [
      { id: deptIds[0], loc: locationIds[0], name: 'Residential Care' },
      { id: deptIds[1], loc: locationIds[0], name: 'Domiciliary Care' },
      { id: deptIds[2], loc: locationIds[1], name: 'Supported Living' },
      { id: deptIds[3], loc: locationIds[2], name: 'Day Services' },
    ];
    for (const d of depts) {
      await pool.query(
        `INSERT INTO departments (id, location_id, name) VALUES ($1, $2, $3)`,
        [d.id, d.loc, d.name]
      );
    }
    console.log('✓ 4 departments');

    // ─── Teams ───
    const teams = [
      { id: teamIds[0], name: 'Morning Team' },
      { id: teamIds[1], name: 'Evening Team' },
      { id: teamIds[2], name: 'Weekend Team' },
    ];
    for (const t of teams) {
      await pool.query(
        `INSERT INTO teams (id, organization_id, name) VALUES ($1, $2, $3)`,
        [t.id, orgId, t.name]
      );
    }
    console.log('✓ 3 teams');

    // ─── Users ───
    const users = [
      { id: userIds[0], email: 'itsopeyemi@gmail.com', role: 'ORG_ADMIN', firstName: 'Opeyemi', lastName: 'Olorunfemi' },
      { id: userIds[1], email: 'gistline2@gmail.com', role: 'MANAGER', firstName: 'Oluwagbemiga', lastName: 'Akinola' },
      { id: userIds[2], email: 'linkhopey@gmail.com', role: 'CARE_WORKER', firstName: 'Hope', lastName: 'Ezekiel' },
      { id: userIds[3], email: 'faithopey@gmail.com', role: 'COMPLIANCE_OFFICER', firstName: 'Faith', lastName: 'Opeyemi' },
    ];
    for (const u of users) {
      await pool.query(
        `INSERT INTO users (id, email, password_hash, role, organization_id, status, email_verified)
         VALUES ($1, $2, $3, $4, $5, 'active', true)`,
        [u.id, u.email, hash, u.role, orgId]
      );
    }
    console.log('✓ 4 users (all password: Password123$)');

    // ─── Staff Profiles ───
    const profiles = [
      { id: staffProfileIds[0], userId: userIds[0], first: 'Opeyemi', last: 'Olorunfemi', phone: '+44 7700 900100', city: 'London', country: 'United Kingdom', postal: 'SW9 8PU' },
      { id: staffProfileIds[1], userId: userIds[1], first: 'Oluwagbemiga', last: 'Akinola', phone: '+44 7700 900200', city: 'London', country: 'United Kingdom', postal: 'SE5 5PT' },
      { id: staffProfileIds[2], userId: userIds[2], first: 'Hope', last: 'Ezekiel', phone: '+44 7700 900300', city: 'London', country: 'United Kingdom', postal: 'SE11 6LH' },
      { id: staffProfileIds[3], userId: userIds[3], first: 'Faith', last: 'Opeyemi', phone: '+44 7700 900400', city: 'London', country: 'United Kingdom', postal: 'SE15 3TQ' },
    ];
    for (const p of profiles) {
      await pool.query(
        `INSERT INTO staff_profiles (id, user_id, first_name, last_name, phone, city, country, postal_code, employment_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'permanent')`,
        [p.id, p.userId, p.first, p.last, p.phone, p.city, p.country, p.postal]
      );
    }
    console.log('✓ 4 staff profiles');

    // ─── Emergency Contacts ───
    await pool.query(
      `INSERT INTO emergency_contacts (staff_id, name, relationship, phone) VALUES ($1, $2, $3, $4)`,
      [staffProfileIds[0], 'Adebayo Olorunfemi', 'Spouse', '+44 7700 900101']
    );
    await pool.query(
      `INSERT INTO emergency_contacts (staff_id, name, relationship, phone) VALUES ($1, $2, $3, $4)`,
      [staffProfileIds[1], 'Funke Akinola', 'Sister', '+44 7700 900201']
    );
    console.log('✓ 2 emergency contacts');

    // ─── Qualifications ───
    const quals = [
      { staffId: staffProfileIds[0], name: 'NVQ Level 3 Health & Social Care', issued: '2021-06-15', expires: '2026-06-15' },
      { staffId: staffProfileIds[1], name: 'NVQ Level 5 Leadership in Care', issued: '2022-03-20', expires: '2027-03-20' },
      { staffId: staffProfileIds[2], name: 'NVQ Level 2 Health & Social Care', issued: '2023-09-10', expires: '2026-09-10' },
      { staffId: staffProfileIds[3], name: 'CQC Compliance Awareness Certificate', issued: '2024-01-15', expires: '2026-01-15' },
      { staffId: staffProfileIds[2], name: 'Medication Administration (MAP)', issued: '2024-02-20', expires: '2026-02-20' },
    ];
    for (const q of quals) {
      await pool.query(
        `INSERT INTO qualifications (staff_id, name, issue_date, expiry_date) VALUES ($1, $2, $3, $4)`,
        [q.staffId, q.name, q.issued, q.expires]
      );
    }
    console.log('✓ 5 qualifications');

    // ─── Skills ───
    const skills = [
      { staffId: staffProfileIds[0], name: 'Person-Centred Care' },
      { staffId: staffProfileIds[0], name: 'Safeguarding Adults' },
      { staffId: staffProfileIds[1], name: 'Rota Management' },
      { staffId: staffProfileIds[1], name: 'Incident Investigation' },
      { staffId: staffProfileIds[2], name: 'Personal Care' },
      { staffId: staffProfileIds[2], name: 'Medication Administration' },
      { staffId: staffProfileIds[3], name: 'CQC Inspection Prep' },
      { staffId: staffProfileIds[3], name: 'Policy Development' },
    ];
    for (const s of skills) {
      await pool.query(`INSERT INTO skills (staff_id, name) VALUES ($1, $2)`, [s.staffId, s.name]);
    }
    console.log('✓ 8 skills');

    // ─── Leave Types ───
    const leaveTypeIds = [uuid(), uuid(), uuid(), uuid()];
    const leaveTypes = [
      { id: leaveTypeIds[0], name: 'Annual Leave', days: 28, hours: 0 },
      { id: leaveTypeIds[1], name: 'Sick Leave', days: 10, hours: 0 },
      { id: leaveTypeIds[2], name: 'Personal Leave', days: 3, hours: 0 },
      { id: leaveTypeIds[3], name: 'Study Leave', days: 5, hours: 0 },
    ];
    for (const lt of leaveTypes) {
      await pool.query(
        `INSERT INTO leave_types (id, organization_id, name, days_allowed, hours_allowed, duration_type) VALUES ($1, $2, $3, $4, $5, 'days')`,
        [lt.id, orgId, lt.name, lt.days, lt.hours]
      );
    }
    console.log('✓ 4 leave types');

    // ─── Leave Balances ───
    for (const staffId of staffProfileIds) {
      for (const lt of leaveTypes) {
        const taken = Math.floor(Math.random() * 5);
        await pool.query(
          `INSERT INTO leave_balances (id, staff_id, leave_type_id, year, days_allocated, days_taken, hours_allocated, hours_taken)
           VALUES ($1, $2, $3, 2026, $4, $5, 0, 0)`,
          [uuid(), staffId, lt.id, lt.days, taken]
        );
      }
    }
    console.log('✓ 16 leave balances');

    // ─── Leave Requests ───
    const leaveRequests = [
      { staffId: staffProfileIds[2], typeId: leaveTypeIds[0], start: '2026-08-11', end: '2026-08-15', status: 'approved' },
      { staffId: staffProfileIds[1], typeId: leaveTypeIds[2], start: '2026-07-28', end: '2026-07-29', status: 'approved' },
      { staffId: staffProfileIds[3], typeId: leaveTypeIds[3], start: '2026-09-01', end: '2026-09-03', status: 'pending' },
    ];
    for (const lr of leaveRequests) {
      await pool.query(
        `INSERT INTO leave_requests (staff_id, leave_type_id, start_date, end_date, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [lr.staffId, lr.typeId, lr.start, lr.end, lr.status]
      );
    }
    console.log('✓ 3 leave requests');

    // ─── Training Modules ───
    const trainingModuleIds = [uuid(), uuid(), uuid(), uuid(), uuid(), uuid()];
    const trainingModules = [
      { id: trainingModuleIds[0], name: 'Safeguarding Adults Level 2', category: 'Compliance', freq: 12 },
      { id: trainingModuleIds[1], name: 'Fire Safety Awareness', category: 'Health & Safety', freq: 12 },
      { id: trainingModuleIds[2], name: 'Manual Handling', category: 'Health & Safety', freq: 12 },
      { id: trainingModuleIds[3], name: 'Medication Administration', category: 'Clinical', freq: 12 },
      { id: trainingModuleIds[4], name: 'Infection Prevention & Control', category: 'Health & Safety', freq: 12 },
      { id: trainingModuleIds[5], name: 'Mental Capacity Act & DoLS', category: 'Compliance', freq: 24 },
    ];
    for (const tm of trainingModules) {
      await pool.query(
        `INSERT INTO training_modules (id, organization_id, name, category, description, is_mandatory, frequency_days)
         VALUES ($1, $2, $3, $4, $5, true, $6)`,
        [tm.id, orgId, tm.name, tm.category, `Standard ${tm.category.toLowerCase()} training module for all care staff.`, tm.freq * 30]
      );
    }
    console.log('✓ 6 training modules');

    // ─── Training Records ───
    const trainingRecords = [
      { staffId: staffProfileIds[0], moduleId: trainingModuleIds[0], completed: '2025-11-15', expires: '2026-11-15', status: 'completed' },
      { staffId: staffProfileIds[0], moduleId: trainingModuleIds[1], completed: '2025-10-20', expires: '2026-10-20', status: 'completed' },
      { staffId: staffProfileIds[1], moduleId: trainingModuleIds[0], completed: '2025-12-01', expires: '2026-12-01', status: 'completed' },
      { staffId: staffProfileIds[1], moduleId: trainingModuleIds[2], completed: '2025-09-30', expires: '2026-09-30', status: 'completed' },
      { staffId: staffProfileIds[2], moduleId: trainingModuleIds[0], completed: '2025-08-10', expires: '2026-08-10', status: 'completed' },
      { staffId: staffProfileIds[2], moduleId: trainingModuleIds[3], completed: '2025-07-20', expires: '2026-07-20', status: 'completed' },
      { staffId: staffProfileIds[2], moduleId: trainingModuleIds[4], completed: '2025-06-15', expires: '2026-06-15', status: 'completed' },
      { staffId: staffProfileIds[3], moduleId: trainingModuleIds[0], completed: '2026-01-10', expires: '2027-01-10', status: 'completed' },
      { staffId: staffProfileIds[3], moduleId: trainingModuleIds[5], completed: '2025-11-25', expires: '2027-11-25', status: 'completed' },
    ];
    for (const tr of trainingRecords) {
      await pool.query(
        `INSERT INTO training_records (module_id, staff_id, completed_at, expires_at, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [tr.moduleId, tr.staffId, tr.completed, tr.expires, tr.status]
      );
    }
    console.log('✓ 9 training records');

    // ─── Compliance Configs ───
    const complianceConfigIds = [uuid(), uuid(), uuid(), uuid()];
    const complianceConfigs = [
      { id: complianceConfigIds[0], name: 'DBS Check', days_warning: 30 },
      { id: complianceConfigIds[1], name: 'Right to Work', days_warning: 60 },
      { id: complianceConfigIds[2], name: 'Immunisation (Hep B)', days_warning: 90 },
      { id: complianceConfigIds[3], name: 'Moving & Handling Refresher', days_warning: 30 },
    ];
    for (const cc of complianceConfigs) {
      await pool.query(
        `INSERT INTO compliance_config (id, organization_id, name, description, is_mandatory, days_warning)
         VALUES ($1, $2, $3, $4, true, $5)`,
        [cc.id, orgId, cc.name, `Compliance requirement: ${cc.name}`, cc.days_warning]
      );
    }
    console.log('✓ 4 compliance configs');

    // ─── Compliance Records ───
    const complianceRecords = [
      { staffId: staffProfileIds[0], configId: complianceConfigIds[0], status: 'complete', issued: '2025-06-15', expires: '2026-06-15' },
      { staffId: staffProfileIds[1], configId: complianceConfigIds[0], status: 'complete', issued: '2025-03-20', expires: '2026-03-20' },
      { staffId: staffProfileIds[2], configId: complianceConfigIds[0], status: 'incomplete', issued: '2025-05-10', expires: '2026-07-10' },
      { staffId: staffProfileIds[3], configId: complianceConfigIds[0], status: 'complete', issued: '2026-01-15', expires: '2027-01-15' },
      { staffId: staffProfileIds[0], configId: complianceConfigIds[1], status: 'complete', issued: '2024-01-01', expires: '2026-01-01' },
      { staffId: staffProfileIds[2], configId: complianceConfigIds[2], status: 'expired', issued: null, expires: null },
    ];
    for (const cr of complianceRecords) {
      await pool.query(
        `INSERT INTO compliance_records (staff_id, requirement_id, status, issued_at, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [cr.staffId, cr.configId, cr.status, cr.issued, cr.expires]
      );
    }
    console.log('✓ 6 compliance records');

    // ─── Shifts ───
    const shiftTypes: Array<'day' | 'sleep' | 'wake_night'> = ['day', 'sleep', 'wake_night'];
    for (let d = 0; d < 14; d++) {
      const date = new Date();
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().split('T')[0];

      for (let s = 0; s < 3; s++) {
        const shiftId = uuid();
        const shiftType = shiftTypes[s];
        const startHour = shiftType === 'day' ? 7 : shiftType === 'wake_night' ? 19 : 7;
        const endHour = shiftType === 'day' ? 15 : shiftType === 'wake_night' ? 23 : 7;
        const startTime = `${dateStr}T${String(startHour).padStart(2, '0')}:00:00.000Z`;
        const endTime = `${dateStr}T${String(endHour).padStart(2, '0')}:00:00.000Z`;

        await pool.query(
          `INSERT INTO shifts (id, location_id, department_id, shift_type, start_time, end_time, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'open')`,
          [shiftId, locationIds[0], deptIds[0], shiftType, startTime, endTime]
        );

        // Assign staff to shifts
        const staffToAssign = s === 0 ? staffProfileIds[0] : s === 1 ? staffProfileIds[1] : staffProfileIds[2];
        await pool.query(
          `INSERT INTO shift_assignments (id, shift_id, staff_id, status)
           VALUES ($1, $2, $3, 'assigned')`,
          [uuid(), shiftId, staffToAssign]
        );
      }
    }
    console.log('✓ 42 shifts (14 days × 3 per day) with assignments');

    // ─── Service Users ───
    const suIds = [uuid(), uuid(), uuid(), uuid(), uuid()];
    const serviceUsers = [
      { id: suIds[0], firstName: 'Margaret', lastName: 'Thompson', dob: '1942-03-15', loc: locationIds[0] },
      { id: suIds[1], firstName: 'John', lastName: 'Williams', dob: '1938-11-22', loc: locationIds[0] },
      { id: suIds[2], firstName: 'Patricia', lastName: 'Jenkins', dob: '1945-07-08', loc: locationIds[1] },
      { id: suIds[3], firstName: 'David', lastName: 'Okonkwo', dob: '1950-01-30', loc: locationIds[1] },
      { id: suIds[4], firstName: 'Grace', lastName: 'Moyo', dob: '1955-09-12', loc: locationIds[2] },
    ];
    for (const su of serviceUsers) {
      await pool.query(
        `INSERT INTO service_users (id, organization_id, first_name, last_name, date_of_birth, status)
         VALUES ($1, $2, $3, $4, $5, 'active')`,
        [su.id, orgId, su.firstName, su.lastName, su.dob]
      );
    }
    console.log('✓ 5 service users');

    // ─── Care Plans ───
    for (const su of serviceUsers) {
      await pool.query(
        `INSERT INTO care_plans (id, service_user_id, title, category, description, status)
         VALUES ($1, $2, $3, $4, $5, 'active')`,
        [uuid(), su.id, 'Daily Living', 'personal_care', `Personalised care plan for ${su.firstName} ${su.lastName} covering daily living activities, preferences, and routines.`]
      );
      await pool.query(
        `INSERT INTO care_plans (id, service_user_id, title, category, description, status)
         VALUES ($1, $2, $3, $4, $5, 'active')`,
        [uuid(), su.id, 'Health & Wellbeing', 'health', `Health and wellbeing care plan for ${su.firstName} ${su.lastName} including medication, nutrition, and health monitoring.`]
      );
    }
    console.log('✓ 10 care plans (2 per service user)');

    // ─── Incidents ───
    await pool.query(
      `INSERT INTO incidents (id, organization_id, title, description, severity, status, incident_date, incident_time, location, reported_by)
       VALUES ($1, $2, 'Fall in communal area', 'Service user M. Thompson slipped in the dining room at 09:45. Minor bruising to left wrist. First aid administered. No hospital visit required.', 'medium', 'closed', '2026-07-10', '09:45:00', 'Sunrise House - Brixton dining room', $3)`,
      [uuid(), orgId, userIds[1]]
    );
    await pool.query(
      `INSERT INTO incidents (id, organization_id, title, description, severity, status, incident_date, incident_time, location, reported_by)
       VALUES ($1, $2, 'Medication administration delay', 'J. Williams evening medication administered 45 minutes late due to staff shortage. Service user was informed and no adverse effects observed.', 'low', 'reported', '2026-07-15', '18:30:00', 'Sunrise House - Brixton', $3)`,
      [uuid(), orgId, userIds[1]]
    );
    await pool.query(
      `INSERT INTO incidents (id, organization_id, title, description, severity, status, incident_date, incident_time, location, reported_by)
       VALUES ($1, $2, 'Safeguarding concern raised', 'Staff member noticed unexplained bruising on D. Okonkwo''s upper arm during personal care. Safeguarding referral submitted to local authority.', 'critical', 'investigating', '2026-07-18', '14:20:00', 'Sunrise House - Camberwell', $3)`,
      [uuid(), orgId, userIds[3]]
    );
    console.log('✓ 3 incidents');

    // ─── Policies ───
    const policies = [
      'Safeguarding Adults Policy',
      'Health & Safety Policy',
      'Medication Management Policy',
      'Infection Prevention & Control Policy',
      'Data Protection & GDPR Policy',
      'Whistleblowing Policy',
      'Equal Opportunities Policy',
      'Complaints Procedure',
    ];
    for (const p of policies) {
      await pool.query(
        `INSERT INTO policies (id, organization_id, title, category, content, status, version)
         VALUES ($1, $2, $3, 'Operational', $4, 'active', '1.0')`,
        [uuid(), orgId, p, `Official ${p.toLowerCase()} for Reydesk Care Services. This policy outlines the procedures, responsibilities, and standards that all staff must follow.`]
      );
    }
    console.log('✓ 8 policies');

    // ─── Appointments ───
    const appointments = [
      { title: 'CQC Inspection Prep Meeting', date: '2026-07-25T10:00:00.000Z', loc: locationIds[0] },
      { title: 'Staff Supervision - Hope E.', date: '2026-07-28T14:00:00.000Z', loc: locationIds[1] },
      { title: 'Medication Round Audit', date: '2026-07-30T09:00:00.000Z', loc: locationIds[0] },
      { title: 'Team Meeting - Morning Team', date: '2026-08-01T08:30:00.000Z', loc: locationIds[0] },
    ];
    for (const a of appointments) {
      await pool.query(
        `INSERT INTO appointments (id, organization_id, title, start_time, end_time, location_id, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7)`,
        [uuid(), orgId, a.title, a.date, new Date(new Date(a.date).getTime() + 3600000).toISOString(), a.loc, userIds[0]]
      );
    }
    console.log('✓ 4 appointments');

    // ─── Tasks ───
    const tasks = [
      { title: 'Complete DBS renewal for Hope Ezekiel', status: 'in_progress', assignee: staffProfileIds[2] },
      { title: 'Update Safeguarding Policy v2.1', status: 'pending', assignee: staffProfileIds[3] },
      { title: 'Submit monthly CQC compliance report', status: 'pending', assignee: staffProfileIds[3] },
      { title: 'Arrange fire drill for Brixton site', status: 'pending', assignee: staffProfileIds[1] },
      { title: 'Review medication stock at Camberwell', status: 'completed', assignee: staffProfileIds[2] },
    ];
    for (const t of tasks) {
      await pool.query(
        `INSERT INTO tasks (id, organization_id, title, status, assigned_to, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuid(), orgId, t.title, t.status, t.assignee, userIds[0]]
      );
    }
    console.log('✓ 5 tasks');

    // ─── Notifications ───
    for (const uid of userIds) {
      await pool.query(
        `INSERT INTO notifications (id, user_id, title, message, type)
         VALUES ($1, $2, 'Welcome to Meticle', 'Your account has been set up. Explore the dashboard to get started.', 'info')`,
        [uuid(), uid]
      );
    }
    console.log('✓ 4 notifications');

    // ─── Audit Logs ───
    for (const uid of userIds) {
      await pool.query(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id)
         VALUES ($1, $2, 'register', 'user', $3)`,
        [uuid(), uid, uid]
      );
    }
    console.log('✓ 4 audit logs');

    // ─── Summary ───
    console.log('\n═══════════════════════════════════════════');
    console.log('  SEED COMPLETE');
    console.log('═══════════════════════════════════════════');
    console.log('  Organization: Reydesk Care Services');
    console.log('  Plan:         Professional (Active)');
    console.log('');
    console.log('  Users (all password: Password123$):');
    console.log('  ─────────────────────────────────────');
    console.log('  itsopeyemi@gmail.com    → ORG_ADMIN');
    console.log('  gistline2@gmail.com     → MANAGER');
    console.log('  linkhopey@gmail.com     → CARE_WORKER');
    console.log('  faithopey@gmail.com     → COMPLIANCE_OFFICER');
    console.log('═══════════════════════════════════════════');

  } catch (err: any) {
    console.error('Failed:', err.message);
    console.error(err.stack);
  } finally {
    await pool.end();
  }
}

seed();
