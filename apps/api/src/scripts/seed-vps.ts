// Production seed — creates a full "1-year-old" org on the VPS database.
// Run against the SSH tunnel:
//   $env:DATABASE_URL='postgres://meticle:<pwd>@localhost:55432/meticle'
//   npx tsx src/scripts/seed-vps.ts
//
// Only the 3 real staff emails are used (password: Password123$). Every other
// seeded email (family contacts, invitations, surveys) reuses those addresses
// so SMTP deliverability is never at risk. All timestamps are backdated so the
// org looks like it has been live for ~14 months.

import { Client } from 'pg'
import { v4 as uuid } from 'uuid'
import bcrypt from 'bcryptjs'

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

const client = new Client({ connectionString: DB_URL, connectionTimeoutMillis: 20000 })
client.on('error', e => {
  console.error('\nDB connection error:', e.message)
  process.exit(1)
})
const q = (text: string, params?: any[]) => client.query(text, params)

const DAY = 86400000
const tsAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString()
const dateAgo = (n: number) => tsAgo(n).split('T')[0]
const dateIn = (n: number) => new Date(Date.now() + n * DAY).toISOString().split('T')[0]
const time = (d: Date, h: number, m = 0) => {
  const x = new Date(d)
  x.setHours(h, m, 0, 0)
  return x.toISOString()
}

const PWH = bcrypt.hashSync('Password123$', 10)

// The ONLY emails that may ever appear in the dataset:
const EMAIL_ADMIN = 'itsopeyemi@gmail.com'
const EMAIL_ADMIN2 = 'gistline2@gmail.com'
const EMAIL_CARER = 'opeyemiolorunfemy@gmail.com'

const STAFF_DEF = [
  { email: EMAIL_ADMIN, first: 'Opeyemi', last: 'Olorunfemi', role: 'ORG_ADMIN', locIdx: 0, deptIdx: 3, teamIdx: 3, phone: '07586215433', birth: '1992-04-26', addr: '12 Maple Avenue, London SE5 8AF' },
  { email: EMAIL_ADMIN2, first: 'Grace', last: 'Roberts', role: 'ORG_ADMIN', locIdx: 1, deptIdx: 1, teamIdx: 1, phone: '07700900123', birth: '1988-09-14', addr: '8 Cedar Walk, Croydon CR0 3JD' },
  { email: EMAIL_CARER, first: 'Jane', last: 'Dylan', role: 'CARE_WORKER', locIdx: 0, deptIdx: 0, teamIdx: 0, phone: '07700900456', birth: '1995-03-02', addr: '27 Birch Road, London SW4 9LL' },
]

const PERM_MODULES = ['dashboard', 'staff_directory', 'compliance', 'scheduling', 'marketplace', 'reporting', 'settings', 'leave']
const NOTIF_TYPES = ['compliance', 'training', 'documents', 'leave', 'shift', 'swap', 'overtime', 'survey', 'delegation', 'general']

const SHIFT_TYPES = ['day', 'day', 'wake_night']
const SUPPORT_LEVELS = ['independent', 'minimal', 'one_to_one', 'two_to_one', 'complex']

let totalRows = 0
async function insert(text: string, params?: any[], label?: string) {
  await q(text, params)
  totalRows++
}

async function seed() {
  console.log('\n=== Seeding VPS org: "Orbis Care Ltd" (14 months of history) ===\n')
  await client.connect()
  await client.query('BEGIN')

  const existing = await q(`SELECT id FROM organizations WHERE name = 'Orbis Care Ltd'`)
  if (existing.rows.length > 0) {
    throw new Error('Organization "Orbis Care Ltd" already exists — aborting to avoid duplicates')
  }

  const orgId = uuid()
  const locIds = [uuid(), uuid(), uuid()]
  const deptIds = [uuid(), uuid(), uuid(), uuid()]
  const teamIds = [uuid(), uuid(), uuid(), uuid()]
  const leaveTypeIds = [uuid(), uuid(), uuid(), uuid()]
  const compProfileIds = [uuid(), uuid(), uuid()]

  // ── 1. Organization ──
  await insert(`INSERT INTO organizations (id,name,status,plan,regulator,primary_color,secondary_color,accent_color,
      minimum_compliance_percent,compliance_alert_threshold,auto_approve_documents,onboarding_completed,onboarding_step,
      leave_start_month,default_hours_per_leave_day,base_contracted_hours,base_leave_hours,daily_shift_audit_enabled,
      dspt_status,created_at) VALUES ($1,$2,'active','professional','cqc','#0F4C81','#B8860B','#D4AF35',
      70,70,true,true,6,4,7.5,37.5,28,true,'in_progress',$3)`,
    [orgId, 'Orbis Care Ltd', tsAgo(430)])
  console.log('  ✓ Organization created (430 days ago)')

  // ── 2. Locations ──
  const locations = [
    { id: locIds[0], name: 'Orbis House', address: '1-3 Victoria Road, London SW1A 1AA', minStaff: 4, minDay: 3, minNight: 1 },
    { id: locIds[1], name: 'Willow Court', address: '45 Willow Lane, Croydon CR0 2AB', minStaff: 3, minDay: 2, minNight: 1 },
    { id: locIds[2], name: 'Meadow View', address: '78 Meadow Road, Bromley BR1 3CD', minStaff: 2, minDay: 2, minNight: 0 },
  ]
  for (const l of locations)
    await insert(`INSERT INTO locations (id,organization_id,name,address,minimum_staff_per_day,min_day_staff,min_night_staff,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [l.id, orgId, l.name, l.address, l.minStaff, l.minDay, l.minNight, tsAgo(420)])
  console.log('  ✓ 3 locations created')

  // ── 3. Departments ──
  const depts = [
    { id: deptIds[0], name: 'Clinical Services', lid: locIds[0] },
    { id: deptIds[1], name: 'Residential Care', lid: locIds[1] },
    { id: deptIds[2], name: 'Domiciliary Support', lid: locIds[2] },
    { id: deptIds[3], name: 'Administration', lid: locIds[0] },
  ]
  for (const d of depts)
    await insert(`INSERT INTO departments (id,location_id,name,created_at) VALUES ($1,$2,$3,$4)`, [d.id, d.lid, d.name, tsAgo(420)])
  console.log('  ✓ 4 departments created')

  // ── 4. Teams ──
  const teams = [
    { id: teamIds[0], name: 'Morning Care Team', desc: 'Early shift care support' },
    { id: teamIds[1], name: 'Night Care Team', desc: 'Night shift care support' },
    { id: teamIds[2], name: 'Activities Team', desc: 'Social and activities coordination' },
    { id: teamIds[3], name: 'Management Team', desc: 'Leadership and clinical oversight' },
  ]
  for (const t of teams)
    await insert(`INSERT INTO teams (id,organization_id,name,description,created_at) VALUES ($1,$2,$3,$4,$5)`, [t.id, orgId, t.name, t.desc, tsAgo(420)])
  console.log('  ✓ 4 teams created')

  // ── 5. Compliance profiles (needed before staff) ──
  const compProfiles = [
    { id: compProfileIds[0], name: 'Care Worker', desc: 'Front-line care staff requirements', role: 'CARE_WORKER' },
    { id: compProfileIds[1], name: 'Team Manager', desc: 'Registered manager and team leads', role: 'MANAGER' },
    { id: compProfileIds[2], name: 'Senior Leadership', desc: 'Directors and senior administrators', role: 'ORG_ADMIN' },
  ]
  for (const cp of compProfiles)
    await insert(`INSERT INTO compliance_profiles (id,organization_id,name,description,role_name,created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [cp.id, orgId, cp.name, cp.desc, cp.role, tsAgo(420)])
  console.log('  ✓ 3 compliance profiles created')

  // ── 6. Staff (3 real accounts) ──
  const staff: { id: string; userId: string; profileId: string; role: string; email: string; name: string[]; locIdx: number }[] = []
  const staffProfiles: Record<string, string> = {}
  for (let idx = 0; idx < STAFF_DEF.length; idx++) {
    const s = STAFF_DEF[idx]
    const uid = uuid(), spId = uuid()
    await insert(`INSERT INTO users (id,organization_id,email,role,status,password_hash,email_verified,force_password_reset,created_at) VALUES ($1,$2,$3,$4,'active',$5,true,false,$6)`,
      [uid, orgId, s.email, s.role, PWH, tsAgo(410 - idx * 10)])
    await insert(`INSERT INTO staff_profiles (id,user_id,first_name,last_name,location_id,department_id,employment_status,employment_type,
        contracted_hours_weekly,birth_date,phone,address,city,country,postal_code,compliance_profile_id,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,'active','full_time',37.5,$7,$8,$9,'London','United Kingdom','SW1A 1AA',$10,$11)`,
      [spId, uid, s.first, s.last, locIds[s.locIdx], deptIds[s.deptIdx], s.birth, s.phone, s.addr, compProfileIds[idx === 2 ? 0 : 2], tsAgo(410 - idx * 10)])
    await insert(`INSERT INTO team_members (team_id,user_id,role,created_at) VALUES ($1,$2,$3,$4)`, [teamIds[s.teamIdx], uid, s.role, tsAgo(400)])
    staff.push({ id: spId, userId: uid, profileId: spId, role: s.role, email: s.email, name: [s.first, s.last], locIdx: s.locIdx })
    staffProfiles[s.email] = spId

    const skills = idx === 0
      ? ['Safeguarding Lead', 'Service Management', 'CQC Compliance']
      : idx === 1 ? ['Wound Care', 'Medication Management', 'Safeguarding', 'Dementia Care'] : ['Medication Administration', 'Moving & Handling', 'Dementia Care', 'Personal Care']
    for (const sk of skills)
      await insert(`INSERT INTO skills (id,staff_id,name,created_at) VALUES ($1,$2,$3,$4)`, [uuid(), spId, sk, tsAgo(390)])

    const quals = idx === 0
      ? [{ n: 'NVQ Level 5 Leadership & Management', i: 380, e: 0 }, { n: 'Registered Manager Award', i: 350, e: 0 }]
      : idx === 1 ? [{ n: 'NVQ Level 4 Adult Care', i: 360, e: 0 }, { n: 'Medication Administration Certificate', i: 300, e: 60 }]
      : [{ n: 'NVQ Level 2 Health & Social Care', i: 340, e: 0 }, { n: 'Care Certificate', i: 320, e: 0 }]
    for (const qq of quals)
      await insert(`INSERT INTO qualifications (id,staff_id,name,issue_date,expiry_date,created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
        [uuid(), spId, qq.n, dateAgo(qq.i), qq.e ? dateIn(qq.e) : null, tsAgo(qq.i)])

    await insert(`INSERT INTO emergency_contacts (id,staff_id,name,relationship,phone,created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [uuid(), spId, `Emergency Contact ${s.first}`, 'Spouse', '07900000111', tsAgo(400)])

    for (const nt of NOTIF_TYPES)
      await insert(`INSERT INTO notification_preferences (user_id,notification_type,enabled) VALUES ($1,$2,$3)`,
        [uid, nt, !(nt === 'swap' || nt === 'overtime')])

    for (const m of PERM_MODULES)
      await insert(`INSERT INTO user_permissions (user_id,module,permission_level) VALUES ($1,$2,$3)`,
        [uid, m, s.role === 'ORG_ADMIN' ? 'edit' : (m === 'staff_directory' || m === 'reporting') ? 'none' : 'view'])
  }
  // Extra team membership for Opeyemi
  await insert(`INSERT INTO team_members (team_id,user_id,role,created_at) VALUES ($1,$2,$3,$4)`, [teamIds[1], staff[0].userId, 'ORG_ADMIN', tsAgo(400)])

  // Carer preferences for Jane
  await insert(`INSERT INTO carer_preferences (user_id,availability,preferred_locations,min_pay_rate,max_travel_distance,updated_at) VALUES ($1,$2,$3,$4,$5,$6)`,
    [staff[2].userId, JSON.stringify([{ day: 1, start: '07:00', end: '21:00' }, { day: 2, start: '07:00', end: '21:00' }, { day: 3, start: '07:00', end: '21:00' }, { day: 4, start: '07:00', end: '21:00' }, { day: 5, start: '07:00', end: '21:00' }, { day: 6, start: '07:00', end: '21:00' }, { day: 0, start: '07:00', end: '21:00' }]), [locIds[0]], 12.5, 15, tsAgo(30)])

  // Staff availability for Jane (7 days)
  for (let d = 0; d < 7; d++)
    await insert(`INSERT INTO staff_availability (id,staff_id,day_of_week,start_time,end_time,is_available,created_at) VALUES ($1,$2,$3,$4,$5,true,$6)`,
      [uuid(), staff[2].profileId, d, '07:00:00', '21:00:00', tsAgo(60)])

  // Location managers
  await q(`UPDATE locations SET manager_id = $1 WHERE id = $2`, [staff[0].userId, locIds[0]])
  await q(`UPDATE locations SET manager_id = $1 WHERE id = $2`, [staff[1].userId, locIds[1]])

  console.log('  ✓ 3 staff + skills/qualifications/contacts/preferences created')

  // ── 7. Leave types + balances ──
  const leaveTypes = [
    { id: leaveTypeIds[0], name: 'Annual Leave', color: '#0F4C81', days: 20, dur: 'days' },
    { id: leaveTypeIds[1], name: 'Sick Leave', color: '#DC2626', days: 6, dur: 'days' },
    { id: leaveTypeIds[2], name: 'Training Leave', color: '#16A34A', days: 3, dur: 'days' },
    { id: leaveTypeIds[3], name: 'Compassionate Leave', color: '#D97706', days: 3, dur: 'days' },
  ]
  for (const lt of leaveTypes)
    await insert(`INSERT INTO leave_types (id,organization_id,name,color,days_allowed,hours_allowed,duration_type,created_at) VALUES ($1,$2,$3,$4,$5,0,$6,$7)`,
      [lt.id, orgId, lt.name, lt.color, lt.days, lt.dur, tsAgo(400)])

  for (const s of staff) {
    for (const ltId of leaveTypeIds) {
      const taken = s.role === 'CARE_WORKER' && ltId === leaveTypeIds[0] ? 12 : 0
      await insert(`INSERT INTO leave_balances (id,staff_id,leave_type_id,year,days_allocated,days_taken,hours_allocated,hours_taken,created_at) VALUES ($1,$2,$3,2026,28,$4,224,$5,$6) ON CONFLICT DO NOTHING`,
        [uuid(), s.profileId, ltId, taken, taken * 7.5, tsAgo(340)])
    }
  }
  console.log('  ✓ 4 leave types + 12 balances created')

  // ── 8. People (16, all fields) ──
  const suData = [
    { first: 'Arthur', last: 'Clarke', room: '101', nhs: 'A12345678', dob: '1942-03-15', gender: 'Male', pronouns: 'he/him', marital: 'Widowed', religion: 'Catholic', lang: 'English', interp: false, comm: 'verbal', diet: 'Soft diet only', allergies: ['Penicillin'], support: 'two_to_one', locIdx: 0, flags: ['falls_risk', 'dnr'], tags: ['respite'], admitted: 380, funding: 'la_funded', fundingDetails: 'LB Southwark — care package reviewed quarterly', dnacpr: 'no_dnacpr', advDecision: 'Refuses blood transfusions', gp: 'Dr Patel', gpSurg: 'Victoria Road Surgery', gpPhone: '020 7946 0101' },
    { first: 'Margaret', last: 'Silva', room: '102', nhs: 'A23456789', dob: '1938-07-22', gender: 'Female', pronouns: 'she/her', marital: 'Married', religion: 'Church of England', lang: 'English', interp: false, comm: 'verbal', diet: 'Diabetic', allergies: [], support: 'one_to_one', locIdx: 0, flags: ['mca_dols', 'behaviour'], tags: [], admitted: 360, funding: 'self_funded', fundingDetails: 'Privately funded via family trust', dnacpr: 'dnacpr', advDecision: 'None recorded', gp: 'Dr Evans', gpSurg: 'Victoria Road Surgery', gpPhone: '020 7946 0101' },
    { first: 'George', last: 'Okonkwo', room: '103', nhs: 'A34567890', dob: '1955-11-08', gender: 'Male', pronouns: 'he/him', marital: 'Divorced', religion: 'Muslim', lang: 'Yoruba', interp: true, comm: 'verbal', diet: 'Halal', allergies: ['Latex'], support: 'minimal', locIdx: 0, flags: ['diabetic'], tags: ['diabetic'], admitted: 420, funding: 'ccg', fundingDetails: 'NHS continuing healthcare in review', dnacpr: 'no_dnacpr', advDecision: 'None recorded', gp: 'Dr Khan', gpSurg: 'Brixton Health Centre', gpPhone: '020 7946 0202' },
    { first: 'Florence', last: 'Nightingale', room: '104', nhs: 'A45678901', dob: '1940-05-12', gender: 'Female', pronouns: 'she/her', marital: 'Single', religion: 'Church of England', lang: 'English', interp: false, comm: 'verbal', diet: 'Modified texture', allergies: ['Aspirin', 'Penicillin'], support: 'two_to_one', locIdx: 0, flags: ['falls_risk', 'choking'], tags: [], admitted: 300, funding: 'nhs_chc', fundingDetails: 'CHC funded — fast-track review', dnacpr: 'dnacpr', advDecision: 'None recorded', gp: 'Dr Miller', gpSurg: 'Brixton Health Centre', gpPhone: '020 7946 0202' },
    { first: 'Winston', last: 'Churchill', room: '105', nhs: 'A56789012', dob: '1930-11-30', gender: 'Male', pronouns: 'he/him', marital: 'Married', religion: 'Anglican', lang: 'English', interp: false, comm: 'verbal', diet: 'Low sodium', allergies: [], support: 'one_to_one', locIdx: 0, flags: ['dnr'], tags: [], admitted: 330, funding: 'self_funded', fundingDetails: 'Self-funded annuity income', dnacpr: 'dnacpr', advDecision: 'None recorded', gp: 'Dr Adams', gpSurg: 'Central London Practice', gpPhone: '020 7946 0303' },
    { first: 'Agatha', last: 'Christie', room: '201', nhs: 'A67890123', dob: '1945-09-15', gender: 'Female', pronouns: 'she/her', marital: 'Married', religion: 'Catholic', lang: 'English', interp: false, comm: 'verbal', diet: 'Regular', allergies: ['Peanuts'], support: 'minimal', locIdx: 1, flags: [], tags: [], admitted: 350, funding: 'mixed', fundingDetails: 'Mixed local authority + top-up', dnacpr: 'no_dnacpr', advDecision: 'None recorded', gp: 'Dr Brown', gpSurg: 'Willow Lane Medical', gpPhone: '020 8645 0101' },
    { first: 'Alan', last: 'Turing', room: '202', nhs: 'A78901234', dob: '1950-06-23', gender: 'Male', pronouns: 'he/him', marital: 'Single', religion: 'Atheist', lang: 'English', interp: false, comm: 'verbal', diet: 'Regular', allergies: [], support: 'one_to_one', locIdx: 1, flags: ['behaviour'], tags: [], admitted: 290, funding: 'self_funded', fundingDetails: 'Self-funded', dnacpr: 'no_dnacpr', advDecision: 'None recorded', gp: 'Dr Green', gpSurg: 'Willow Lane Medical', gpPhone: '020 8645 0101' },
    { first: 'Isaac', last: 'Newton', room: '203', nhs: 'A89012345', dob: '1943-01-04', gender: 'Male', pronouns: 'he/him', marital: 'Widowed', religion: 'Anglican', lang: 'English', interp: false, comm: 'verbal', diet: 'Fortified', allergies: ['Sulfa'], support: 'minimal', locIdx: 1, flags: ['falls_risk'], tags: [], admitted: 400, funding: 'la_funded', fundingDetails: 'LB Croydon', dnacpr: 'no_dnacpr', advDecision: 'None recorded', gp: 'Dr White', gpSurg: 'Croydon University Hospital', gpPhone: '020 8645 0202' },
    { first: 'Charles', last: 'Darwin', room: '204', nhs: 'A90123456', dob: '1939-02-12', gender: 'Male', pronouns: 'he/him', marital: 'Married', religion: 'Agnostic', lang: 'English', interp: false, comm: 'verbal', diet: 'Gluten free', allergies: [], support: 'two_to_one', locIdx: 1, flags: ['epilepsy'], tags: ['epilepsy'], admitted: 310, funding: 'ccg', fundingDetails: 'CCG funded', dnacpr: 'no_dnacpr', advDecision: 'None recorded', gp: 'Dr Black', gpSurg: 'Croydon Health Centre', gpPhone: '020 8645 0303' },
    { first: 'Jane', last: 'Austen', room: '301', nhs: 'A01234567', dob: '1947-12-16', gender: 'Female', pronouns: 'she/her', marital: 'Single', religion: 'Catholic', lang: 'English', interp: false, comm: 'verbal', diet: 'Regular', allergies: ['Penicillin', 'Peanuts'], support: 'independent', locIdx: 2, flags: [], tags: [], admitted: 250, funding: 'self_funded', fundingDetails: 'Self-funded', dnacpr: 'no_dnacpr', advDecision: 'None recorded', gp: 'Dr Scott', gpSurg: 'Bromley Medical Centre', gpPhone: '020 8466 0101' },
    { first: 'William', last: 'Shakespeare', room: '302', nhs: 'A12345679', dob: '1936-04-23', gender: 'Male', pronouns: 'he/him', marital: 'Married', religion: 'Anglican', lang: 'English', interp: false, comm: 'verbal', diet: 'Soft diet', allergies: [], support: 'one_to_one', locIdx: 2, flags: ['mca_dols'], tags: [], admitted: 280, funding: 'la_funded', fundingDetails: 'LB Bromley', dnacpr: 'no_dnacpr', advDecision: 'None recorded', gp: 'Dr King', gpSurg: 'Bromley Medical Centre', gpPhone: '020 8466 0101' },
    { first: 'Mary', last: 'Seacole', room: '303', nhs: 'A23456780', dob: '1941-05-15', gender: 'Female', pronouns: 'she/her', marital: 'Widowed', religion: 'Catholic', lang: 'English', interp: false, comm: 'verbal', diet: 'Diabetic, soft', allergies: ['Latex', 'Aspirin'], support: 'two_to_one', locIdx: 2, flags: ['diabetic', 'choking'], tags: ['diabetic'], admitted: 370, funding: 'nhs_chc', fundingDetails: 'CHC funded', dnacpr: 'dnacpr', advDecision: 'None recorded', gp: 'Dr Lewis', gpSurg: 'Bromley Community Health', gpPhone: '020 8466 0202' },
    { first: 'Rosa', last: 'Parks', room: '106', nhs: 'A34567891', dob: '1948-02-04', gender: 'Female', pronouns: 'she/her', marital: 'Married', religion: 'Methodist', lang: 'English', interp: false, comm: 'verbal', diet: 'Regular', allergies: [], support: 'minimal', locIdx: 0, flags: ['falls_risk'], tags: [], admitted: 240, funding: 'la_funded', fundingDetails: 'LB Southwark', dnacpr: 'no_dnacpr', advDecision: 'None recorded', gp: 'Dr Patel', gpSurg: 'Victoria Road Surgery', gpPhone: '020 7946 0101' },
    { first: 'Emmeline', last: 'Pankhurst', room: '107', nhs: 'A56789013', dob: '1946-10-11', gender: 'Female', pronouns: 'she/her', marital: 'Widowed', religion: 'Atheist', lang: 'English', interp: false, comm: 'verbal', diet: 'Regular', allergies: [], support: 'one_to_one', locIdx: 0, flags: ['mca_dols', 'behaviour'], tags: [], admitted: 220, funding: 'self_funded', fundingDetails: 'Self-funded', dnacpr: 'no_dnacpr', advDecision: 'None recorded', gp: 'Dr Adams', gpSurg: 'Central London Practice', gpPhone: '020 7946 0303' },
    { first: 'Marie', last: 'Curie', room: '304', nhs: 'A78901235', dob: '1949-11-07', gender: 'Female', pronouns: 'she/her', marital: 'Single', religion: 'Agnostic', lang: 'French', interp: true, comm: 'verbal', diet: 'Regular', allergies: [], support: 'minimal', locIdx: 2, flags: ['epilepsy'], tags: ['epilepsy'], admitted: 200, funding: 'la_funded', fundingDetails: 'LB Bromley', dnacpr: 'no_dnacpr', advDecision: 'None recorded', gp: 'Dr Scott', gpSurg: 'Bromley Medical Centre', gpPhone: '020 8466 0101' },
    { first: 'Albert', last: 'Einstein', room: '108', nhs: 'A89012346', dob: '1935-03-14', gender: 'Male', pronouns: 'he/him', marital: 'Widowed', religion: 'Jewish', lang: 'German', interp: true, comm: 'verbal', diet: 'Liquidised', allergies: ['Sulfa', 'Penicillin'], support: 'complex', locIdx: 0, flags: ['choking'], tags: [], admitted: 390, funding: 'self_funded', fundingDetails: 'Self-funded', dnacpr: 'no_dnacpr', advDecision: 'None recorded', gp: 'Dr Khan', gpSurg: 'Brixton Health Centre', gpPhone: '020 7946 0202', discharged: 45, dischargeReason: 'Transferred to specialist nursing home', dischargeSummary: 'Stable on discharge. Full handover completed with receiving home.', dischargeDest: 'St Catherine\'s Nursing Home' },
    { first: 'Frederick', last: 'Douglass', room: '205', nhs: 'A45678902', dob: '1944-07-14', gender: 'Male', pronouns: 'he/him', marital: 'Married', religion: 'Christian', lang: 'English', interp: false, comm: 'verbal', diet: 'Regular', allergies: ['Codeine'], support: 'minimal', locIdx: 1, flags: [], tags: [], admitted: 180, funding: 'ccg', fundingDetails: 'CCG funded — short-term enablement', dnacpr: 'no_dnacpr', advDecision: 'None recorded', gp: 'Dr Brown', gpSurg: 'Willow Lane Medical', gpPhone: '020 8645 0101', discharged: 20, dischargeReason: 'Returned home after rehabilitation', dischargeSummary: 'Mobility improved. Community package arranged.', dischargeDest: 'Own home' },
  ]
  const sus: any[] = []
  for (const su of suData) {
    const id = uuid()
    const minStaff = su.support === 'one_to_one' ? 1 : su.support === 'two_to_one' ? 2 : su.support === 'complex' ? 2 : null
    await insert(`INSERT INTO people (id,organization_id,first_name,last_name,date_of_birth,nhs_number,room_number,status,gp_name,gp_surgery,gp_phone,
        dietary_requirements,allergies,support_level,created_at,pharmacy_name,pharmacy_phone,pharmacy_address,social_worker_name,social_worker_phone,social_worker_email,
        gp_email,gp_address,gender,pronouns,marital_status,religion,communication_language,communication_interpreter,communication_method,admission_date,admission_source,
        funding_type,funding_details,flags,tags,dnacpr_status,dnacpr_date,dnacpr_review_date,dnacpr_details,advance_decision,advance_decision_date,
        discharge_date,discharge_reason,discharge_summary,discharge_destination,location_id,min_staff_required,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48)`,
      [id, orgId, su.first, su.last, su.dob, su.nhs, su.room, su.gp, su.gpSurg, su.gpPhone, su.diet, JSON.stringify(su.allergies), su.support,
       tsAgo(Math.max(su.admitted, su.discharged ?? 0) + 30),
       'CarePlus Pharmacy', '020 7450 9988', 'CarePlus Pharmacy, 44 High Street, London SW1A 1AA',
       su.first === 'Arthur' ? 'Mr A Peters' : 'Ms L Grant', '020 7946 0999', su.locIdx === 0 ? EMAIL_ADMIN : EMAIL_ADMIN2,
       su.locIdx === 0 ? EMAIL_ADMIN : EMAIL_ADMIN2, 'Victoria Road Surgery',
       su.gender, su.pronouns, su.marital, su.religion, su.lang, su.interp, su.comm,
       dateAgo(su.admitted), su.first === 'George' ? 'Hospital discharge' : 'Family referral',
       su.funding, su.fundingDetails, JSON.stringify(su.flags), JSON.stringify(su.tags),
       su.dnacpr, dateAgo(Math.max(su.admitted - 5, 30)), dateAgo(su.admitted - 60), su.dnacpr === 'dnacpr' ? 'Valid DNACPR form held in care plan. Reviewed with GP and family.' : null,
       su.advDecision, dateAgo(Math.max(su.admitted - 10, 30)),
       su.discharged ? dateAgo(su.discharged) : null, su.dischargeReason ?? null, su.dischargeSummary ?? null, su.dischargeDest ?? null,
       locIds[su.locIdx], minStaff, tsAgo(5)])
    sus.push({ id, name: `${su.first} ${su.last}`, room: su.room, locIdx: su.locIdx, allergies: su.allergies, diet: su.diet })
  }
  console.log('  ✓ 16 people created (all fields, admissions 6-14 months ago)')

  // ── 9. Care Plans (~32, full fields) ──
  const planCats = ['personal_care', 'medication', 'mobility', 'nutrition', 'mental_health', 'behaviour', 'skin_care', 'communication']
  const planTitles: Record<string, string> = {
    personal_care: 'Personal care & hygiene support', medication: 'Medication management', mobility: 'Mobility & transfers support',
    nutrition: 'Nutrition & hydration support', mental_health: 'Mental health & wellbeing', behaviour: 'Positive behaviour support',
    skin_care: 'Skin integrity & pressure care', communication: 'Communication support',
  }
  for (const su of sus) {
    if (su.locIdx === 0 && su.name === 'Albert Einstein') continue // discharged
    const cats = [...planCats].sort(() => Math.random() - 0.5).slice(0, 2)
    for (const cat of cats) {
      await insert(`INSERT INTO care_plans (id,person_id,title,category,description,risk_assessment,review_date,reviewed_by,reviewed_at,status,created_at,
          mobility_level,mobility_aids,communication_needs,capacity_status,sleep_pattern,emergency_info,personal_goals,likes_dislikes,cultural_needs,version)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,1)`,
        [uuid(), su.id, planTitles[cat], cat,
         `Individualised ${cat.replace(/_/g, ' ')} plan for ${su.name}. Reviewed quarterly with family involvement and updated after every incident.`,
         cat === 'falls_risk' || cat === 'mobility' ? 'Medium risk — supervision and equipment in place. Family aware.' : 'Low risk with regular monitoring.',
         dateIn(30 + Math.floor(Math.random() * 120)), staff[Math.floor(Math.random() * 2)].userId, tsAgo(Math.floor(Math.random() * 60)),
         Math.random() < 0.12 ? 'archived' : 'active', tsAgo(200 + Math.floor(Math.random() * 100)),
         ['independent', 'supervision', 'assist', 'dependent'][Math.floor(Math.random() * 4)],
         cat === 'mobility' ? 'Walking frame + transfer belt' : null,
         'Verbal communication. May require repetition for complex instructions.',
         ['has_capacity', 'lacks_capacity', 'fluctuating'][Math.floor(Math.random() * 3)],
         'Sleeps 22:00-06:30. Occasional night-time restlessness.',
         'Son (David) is first point of contact. Call 07700 900 123.',
         `Maintain independence and dignity; keep connected to family.`,
         'Enjoys classical music and crossword puzzles. Dislikes loud noise.',
         su.name === 'George Okonkwo' ? 'Halal dietary needs observed. Prayer times respected.' : 'None specific.'])
    }
  }
  console.log('  ✓ ~32 care plans created')

  // ── 10. Daily Notes (~150 spanning a year) ──
  const noteCats = ['wellbeing', 'nutrition', 'hydration', 'mobility', 'mood', 'medication', 'personal_care']
  const shifts = ['day', 'night']
  const noteTemplates = [
    'Had a good day. Participated in morning activities and ate well at lunch.',
    'Mood stable. Engaged socially with others during afternoon tea.',
    'Required assistance with personal care this morning. Mobility slightly reduced.',
    'Ate 75% of breakfast and lunch. Hydration encouraged throughout the day.',
    'Slept well through the night. No incidents reported.',
    'Physiotherapy session went well. Improved mobility with walking frame.',
    'Family visited today. Person was very happy and animated.',
    'Mood low this morning but improved after lunch. Encouraged to join group activity.',
    'Assisted with medication at 0800 and 2000. No issues.',
    'Skin integrity checked — pressure areas clear. Repositioned regularly.',
    'Engaged well with music therapy session. Sang along to familiar songs.',
    'Needed full assistance with personal care. Responded well to gentle approach.',
    'Appetite poor at breakfast but improved at lunch. Fortified drinks offered.',
    'Physio exercises completed in bedroom. Walking distance improved to 20m.',
    'Spent time in the garden. Enjoyed the sunshine and bird watching.',
  ]
  for (let i = 0; i < 150; i++) {
    const su = sus[Math.floor(Math.random() * (sus.length - 2))]
    const daysAgoN = Math.floor(Math.random() * 380)
    const author = Math.random() < 0.85 ? staff[2].userId : staff[Math.floor(Math.random() * 2)].userId
    await insert(`INSERT INTO daily_notes (id,person_id,author_id,note_date,shift,category,content,support_level,generated_by_ai,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,$9)`,
      [uuid(), su.id, author, dateAgo(daysAgoN), shifts[Math.floor(Math.random() * shifts.length)],
       noteCats[Math.floor(Math.random() * noteCats.length)],
       noteTemplates[Math.floor(Math.random() * noteTemplates.length)],
       SUPPORT_LEVELS[Math.floor(Math.random() * SUPPORT_LEVELS.length)], tsAgo(daysAgoN)])
  }
  console.log('  ✓ 150 daily notes created')

  // ── 11. Risk Assessments (~32) ──
  const riskTypes = ['falls', 'pressure_sore', 'nutrition', 'behaviour', 'mobility', 'medication', 'choking', 'skin_integrity']
  const riskLevels = ['low', 'medium', 'high', 'critical']
  for (const su of sus) {
    if (su.name === 'Albert Einstein') continue
    const n = 1 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) {
      const type = riskTypes[Math.floor(Math.random() * riskTypes.length)]
      const level = riskLevels[Math.floor(Math.random() * (type === 'falls' ? 3 : 2))]
      await insert(`INSERT INTO risk_assessments (id,person_id,type,risk_level,details,mitigation_actions,review_date,reviewed_by,reviewed_at,created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [uuid(), su.id, type, level,
         `${type.replace(/_/g, ' ')} assessment completed ${level === 'high' ? 'following recent incident' : 'as part of quarterly review'}.`,
         level === 'high' ? 'Daily monitoring, family informed, equipment in place.' : 'Weekly review, staff awareness.',
         dateIn(30 + Math.floor(Math.random() * 90)), staff[Math.floor(Math.random() * 2)].userId, tsAgo(Math.floor(Math.random() * 30)), tsAgo(20 + Math.floor(Math.random() * 120))])
    }
  }
  console.log('  ✓ ~32 risk assessments created')

  // ── 12. Family Contacts + Family Members ──
  const relationships = ['Daughter', 'Son', 'Spouse', 'Niece', 'Nephew', 'Grandchild', 'Sibling', 'Friend']
  const relEmails = [EMAIL_ADMIN, EMAIL_ADMIN2, EMAIL_CARER]
  const fContactIds: string[] = []
  for (const su of sus) {
    const n = 1 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) {
      const rel = relationships[Math.floor(Math.random() * relationships.length)]
      const fcid = uuid()
      fContactIds.push(fcid)
      await insert(`INSERT INTO family_contacts (id,person_id,name,relationship,phone,email,is_emergency_contact,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [fcid, su.id, `${['Anne', 'John', 'Mary', 'Peter', 'Susan', 'Robert', 'Catherine', 'Paul'][Math.floor(Math.random() * 8)]} ${su.name.split(' ')[1]}`,
         rel, `07${Math.floor(100000000 + Math.random() * 899999999)}`, relEmails[i % relEmails.length], i === 0, tsAgo(300)])
    }
  }
  for (const su of sus) {
    const n = 1 + Math.floor(Math.random() * 2)
    for (let i = 0; i < n; i++) {
      await insert(`INSERT INTO family_members (id,organization_id,person_id,name,email,relationship,phone,access_token,token_expires_at,status,created_by,created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,$11)`,
        [uuid(), orgId, su.id, `Family of ${su.name.split(' ')[0]}`, relEmails[(i + su.locIdx) % 3],
         relationships[i % relationships.length], `07${Math.floor(100000000 + Math.random() * 899999999)}`,
         uuid(), dateIn(180), staff[0].userId, tsAgo(150 + Math.floor(Math.random() * 200))])
    }
  }
  console.log('  ✓ family contacts + family portal members created')

  // ── 13. Training modules + records ──
  const trainingModules = [
    { name: 'Safeguarding Adults Level 2', cat: 'Safeguarding', roles: ['CARE_WORKER', 'MANAGER', 'ORG_ADMIN'], freq: 365 },
    { name: 'Infection Prevention & Control', cat: 'Infection Control', roles: ['CARE_WORKER', 'MANAGER'], freq: 365 },
    { name: 'Fire Safety Awareness', cat: 'Fire Safety', roles: ['CARE_WORKER', 'MANAGER', 'ORG_ADMIN'], freq: 365 },
    { name: 'Moving & Handling People', cat: 'Manual Handling', roles: ['CARE_WORKER'], freq: 365 },
    { name: 'Medication Management', cat: 'Medication', roles: ['CARE_WORKER', 'MANAGER'], freq: 365 },
    { name: 'Emergency First Aid at Work', cat: 'First Aid', roles: ['CARE_WORKER', 'MANAGER', 'ORG_ADMIN'], freq: 365 },
    { name: 'GDPR & Data Protection', cat: 'Mandatory', roles: ['CARE_WORKER', 'MANAGER', 'ORG_ADMIN'], freq: 365 },
    { name: 'Mental Capacity Act & DoLS', cat: 'Mandatory', roles: ['CARE_WORKER', 'MANAGER'], freq: 365 },
    { name: 'Food Safety & Hygiene Level 2', cat: 'Food Safety', roles: ['CARE_WORKER'], freq: 365 },
    { name: 'Health & Safety at Work', cat: 'Health & Safety', roles: ['CARE_WORKER', 'MANAGER', 'ORG_ADMIN'], freq: 365 },
    { name: 'Dementia Awareness', cat: 'Dementia', roles: ['CARE_WORKER'], freq: 730 },
    { name: 'End of Life Care', cat: 'Palliative', roles: ['CARE_WORKER', 'MANAGER'], freq: 730 },
  ]
  const modIds: string[] = []
  for (const m of trainingModules) {
    const id = uuid()
    await insert(`INSERT INTO training_modules (id,organization_id,name,category,description,frequency_days,is_mandatory,cqc_mandated,cqc_mandated_for_roles,created_at) VALUES ($1,$2,$3,$4,$5,$6,true,true,$7,$8)`,
      [id, orgId, m.name, m.cat, `${m.name} — ${m.freq / 365} year renewal cycle`, m.freq, JSON.stringify(m.roles), tsAgo(400)])
    modIds.push(id)
  }
  let trCount = 0
  for (const s of staff) {
    for (const mid of modIds) {
      const mod = trainingModules[modIds.indexOf(mid)]
      if (!mod.roles.includes(s.role) && Math.random() < 0.7) continue
      const completedDaysAgo = Math.floor(Math.random() * 360)
      const completed = new Date(Date.now() - completedDaysAgo * DAY)
      const status = completedDaysAgo > 330 ? 'expired' : Math.random() < 0.06 ? 'incomplete' : 'completed'
      await insert(`INSERT INTO training_records (id,module_id,staff_id,completed_at,expires_at,status,competency_passed,trainer_name,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
        [uuid(), mid, s.profileId,
         status === 'completed' ? dateAgo(completedDaysAgo) : null,
         status === 'expired' ? dateAgo(Math.floor(Math.random() * 40)) : dateIn(365 - completedDaysAgo),
         status, status === 'completed' ? Math.random() < 0.9 : null,
         'Sarah Mitchell Training Ltd', tsAgo(completedDaysAgo)])
      trCount++
    }
  }
  console.log(`  ✓ 12 training modules + ${trCount} training records created`)

  // ── 14. Identity documents + DBS checks ──
  for (const s of staff) {
    for (const type of ['DBS', 'PASSPORT', 'RIGHT_TO_WORK']) {
      const expired = Math.random() < 0.18
      await insert(`INSERT INTO documents (id,staff_id,type,url,expiry_date,status,created_at,renewal_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [uuid(), s.profileId, type, '/files/private/vps-doc.pdf',
         expired ? dateAgo(Math.floor(Math.random() * 60)) : dateIn(Math.floor(Math.random() * 365)),
         expired ? 'expired' : 'approved', tsAgo(200 + Math.floor(Math.random() * 100)), expired ? 'due' : 'ok'])
    }
    await insert(`INSERT INTO dbs_checks (id,organization_id,staff_id,level,workforce,status,application_reference,certificate_number,disclosure_date,cost_pence,submitted_at,completed_at,created_at) VALUES ($1,$2,$3,'enhanced','adult','clear',concat('DBS-',left($4::text,8)),'Cert-'||left($4::text,6),$5,4900,$6,$7,$8)`,
      [uuid(), orgId, s.profileId, uuid().slice(0, 8), dateIn(20), tsAgo(20), tsAgo(20), tsAgo(220)])
  }
  console.log('  ✓ 9 identity documents + 3 DBS checks created')

  // ── 15. Compliance config, requirements, records, snapshots ──
  const reqNames = [
    'DBS Check', 'Safeguarding Training', 'Manual Handling', 'Medication Competency',
    'First Aid Certificate', 'Infection Control', 'Fire Safety', 'MCA & DoLS',
    'GDPR Training', 'Food Hygiene', 'Professional Registration', 'Health Assessment',
  ]
  const reqIds: string[] = []
  for (const rn of reqNames) {
    const id = uuid()
    await insert(`INSERT INTO compliance_config (id,organization_id,name,description,category,days_warning,days_overdue,is_mandatory,created_at) VALUES ($1,$2,$3,$4,$5,30,0,true,$6)`,
      [id, orgId, rn, `${rn} compliance requirement for all care staff`, rn.includes('Training') || rn.includes('Hygiene') ? 'training' : rn.includes('DBS') || rn.includes('Registration') ? 'background_check' : 'clinical', tsAgo(400)])
    const rid = uuid()
    await insert(`INSERT INTO compliance_requirements (id,organization_id,name,description,is_mandatory,created_at) VALUES ($1,$2,$3,$4,true,$5)`,
      [rid, orgId, rn, `${rn} - required for all staff`, tsAgo(400)])
    reqIds.push(id)
    // Profile requirements: care worker profile requires most
    const profileIdx = rn === 'Professional Registration' || rn === 'Health Assessment' ? 2 : 0
    await insert(`INSERT INTO compliance_profile_requirements (id,profile_id,requirement_id) VALUES ($1,$2,$3)`,
      [uuid(), compProfileIds[profileIdx], id])
  }
  let crCount = 0
  for (const s of staff) {
    for (const rid of reqIds) {
      if (Math.random() < 0.15) continue
      const issuedDaysAgo = Math.floor(Math.random() * 300)
      const status = Math.random() < 0.12 ? 'incomplete' : 'complete'
      await insert(`INSERT INTO compliance_records (id,staff_id,requirement_id,status,issued_at,expires_at,notes,last_checked_at,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
        [uuid(), s.profileId, rid, status, issuedDaysAgo > 300 ? null : dateAgo(issuedDaysAgo),
         issuedDaysAgo > 300 ? null : dateIn(365 - issuedDaysAgo),
         status === 'complete' ? 'Verified on upload' : 'Awaiting evidence', tsAgo(1), tsAgo(issuedDaysAgo)])
      crCount++
    }
    // Monthly compliance snapshots for the last 12 months
    for (let m = 1; m <= 12; m++) {
      await insert(`INSERT INTO compliance_snapshots (id,staff_id,organization_id,overall_score,snapshot_date,created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
        [uuid(), s.profileId, orgId, 62 + Math.floor(Math.random() * 36), dateAgo(m * 30), tsAgo(m * 30)])
    }
  }
  console.log(`  ✓ 12 compliance configs + ${crCount} records + 36 monthly snapshots created`)

  // ── 16. Incidents ──
  const incCategories = [
    { name: 'Fall', severity: 'medium', cqc: true },
    { name: 'Medication', severity: 'high', cqc: true },
    { name: 'Behaviour', severity: 'medium', cqc: false },
    { name: 'Pressure Damage', severity: 'medium', cqc: true },
    { name: 'Missing Person', severity: 'critical', cqc: true },
  ]
  const incCatIds: Record<string, string> = {}
  for (const ic of incCategories) {
    const id = uuid()
    incCatIds[ic.name] = id
    await insert(`INSERT INTO incident_categories (id,organization_id,name,severity,is_cqc_reportable,is_active,created_at) VALUES ($1,$2,$3,$4,$5,true,$6)`,
      [id, orgId, ic.name, ic.severity, ic.cqc, tsAgo(400)])
  }
  const incidents = [
    { title: 'Fall in bathroom — minor bruising', sev: 'medium', status: 'resolved', days: 45, su: 0, cat: 'Fall' },
    { title: 'Medication error — wrong dose administered', sev: 'high', status: 'investigating', days: 3, su: 2, cat: 'Medication' },
    { title: 'Altercation in communal area', sev: 'low', status: 'resolved', days: 20, su: 1, cat: 'Behaviour' },
    { title: 'Pressure sore discovered on sacrum', sev: 'medium', status: 'reported', days: 7, su: 3, cat: 'Pressure Damage' },
    { title: 'Slip in corridor — no injury', sev: 'low', status: 'resolved', days: 60, su: 5, cat: 'Fall' },
    { title: 'Aggressive behaviour towards staff', sev: 'high', status: 'investigating', days: 5, su: 13, cat: 'Behaviour' },
    { title: 'Medication refusal', sev: 'medium', status: 'resolved', days: 12, su: 8, cat: 'Medication' },
    { title: 'Person reported missing — found in garden', sev: 'critical', status: 'closed', days: 30, su: 10, cat: 'Missing Person' },
    { title: 'Choking incident at mealtime', sev: 'high', status: 'closed', days: 80, su: 15, cat: 'Medication' },
    { title: 'Scald from hot drink', sev: 'medium', status: 'resolved', days: 15, su: 3, cat: 'Fall' },
    { title: 'Unauthorised visitor on premises', sev: 'low', status: 'resolved', days: 90, su: 0, cat: 'Behaviour' },
    { title: 'Concussion following fall', sev: 'high', status: 'reported', days: 2, su: 4, cat: 'Fall' },
    { title: 'Tripping hazard from trailing cable', sev: 'low', status: 'closed', days: 140, su: 0, cat: 'Fall' },
    { title: 'Medication timing discrepancy', sev: 'low', status: 'resolved', days: 210, su: 7, cat: 'Medication' },
    { title: 'Fall from chair in communal lounge', sev: 'high', status: 'closed', days: 300, su: 14, cat: 'Fall' },
    { title: 'Behavioural incident during personal care', sev: 'medium', status: 'resolved', days: 370, su: 2, cat: 'Behaviour' },
  ]
  for (const inc of incidents) {
    const incId = uuid()
    await insert(`INSERT INTO incidents (id,organization_id,category_id,title,description,incident_date,incident_time,location,severity,status,is_cqc_reportable,reported_to_cqc_at,cqc_reference,root_cause,outcomes,reported_by,created_at,investigation_notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [incId, orgId, incCatIds[inc.cat], inc.title, `${inc.title}. Full investigation logged and shared with management.`, dateAgo(inc.days), '14:30:00',
       ['Orbis House', 'Willow Court', 'Meadow View'][Math.floor(Math.random() * 3)], inc.sev, inc.status,
       inc.sev === 'high' || inc.sev === 'critical', inc.sev === 'high' || inc.sev === 'critical' ? tsAgo(inc.days - 1) : null,
       inc.sev === 'high' || inc.sev === 'critical' ? `CQC-REF-${1000 + inc.days}` : null,
       'Root cause analysis completed. Staff refresher training scheduled.',
       inc.status === 'closed' || inc.status === 'resolved' ? 'Outcome documented and family informed.' : null,
       staff[Math.floor(Math.random() * 3)].userId, tsAgo(inc.days), 'See incident report.'])
    if (Math.random() < 0.6) {
      await insert(`INSERT INTO incident_actions (id,incident_id,action,assigned_to,due_date,completed_at,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [uuid(), incId, 'Review risk assessment and update mitigation plan', staff[Math.floor(Math.random() * 2)].userId,
         dateIn(7 + Math.floor(Math.random() * 14)), Math.random() < 0.5 ? tsAgo(Math.floor(Math.random() * 10)) : null,
         Math.random() < 0.5 ? 'completed' : 'in_progress', tsAgo(inc.days)])
    }
    const involved = sus[inc.su]
    if (involved) await insert(`INSERT INTO incident_involved_residents (id,incident_id,person_id,involvement_type,notes,created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [uuid(), incId, involved.id, 'involved', 'Directly involved in incident', tsAgo(inc.days)])
  }
  console.log('  ✓ 5 incident categories + 16 incidents (+actions/residents) created')

  // ── 17. Competency ──
  const compTemplates = [
    { name: 'Medication Administration', cqc: 'safe', roles: ['CARE_WORKER'] },
    { name: 'Moving & Handling', cqc: 'safe', roles: ['CARE_WORKER'] },
    { name: 'Dementia Communication', cqc: 'caring', roles: ['CARE_WORKER'] },
    { name: 'Nutrition & Hydration', cqc: 'effective', roles: ['CARE_WORKER'] },
    { name: 'Pressure Area Care', cqc: 'responsive', roles: ['CARE_WORKER'] },
    { name: 'End of Life Care', cqc: 'caring', roles: ['CARE_WORKER', 'MANAGER'] },
  ]
  const compTemplateIds: string[] = []
  for (const ct of compTemplates) {
    const id = uuid()
    await insert(`INSERT INTO competency_templates (id,organization_id,name,category,description,requires_reassessment_days,is_active,cqc_statement_id,required_for_roles,created_at) VALUES ($1,$2,$3,'clinical',$4,365,true,$5,$6,$7)`,
      [id, orgId, ct.name, `${ct.name} competency assessment template`, ct.cqc, JSON.stringify(ct.roles), tsAgo(400)])
    compTemplateIds.push(id)
  }
  for (const s of staff) {
    if (s.role === 'ORG_ADMIN') continue
    const n = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) {
      const ctId = compTemplateIds[Math.floor(Math.random() * compTemplateIds.length)]
      const passed = Math.random() < 0.85
      await insert(`INSERT INTO competency_assessments (id,template_id,staff_id,assessor_id,assessed_at,reassessment_date,passed,score,max_score,notes,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,100,$9,$10) ON CONFLICT DO NOTHING`,
        [uuid(), ctId, s.profileId, staff[0].userId, dateAgo(Math.floor(Math.random() * 120)), dateIn(245),
         passed, passed ? 88 + Math.floor(Math.random() * 12) : 55,
         passed ? 'Demonstrated good knowledge and practice.' : 'Requires additional training and reassessment.',
         tsAgo(Math.floor(Math.random() * 120))])
    }
  }
  console.log('  ✓ 6 competency templates + assessments created')

  // ── 18. Policies ──
  const standardPolicies = [
    { title: 'Safeguarding Adults Policy', cat: 'Safeguarding' },
    { title: 'Risk Assessment Policy', cat: 'Health & Safety' },
    { title: 'Complaints Procedure', cat: 'HR' },
    { title: 'Lone Working Policy', cat: 'Health & Safety' },
    { title: 'GDPR & Data Protection Policy', cat: 'Data Protection' },
    { title: 'Whistleblowing Policy', cat: 'HR' },
    { title: 'Infection Control Policy', cat: 'Clinical' },
    { title: 'Equality & Diversity Policy', cat: 'HR' },
    { title: 'Mental Capacity Act & DoLS Policy', cat: 'Clinical' },
    { title: 'Fire Safety Policy', cat: 'Health & Safety' },
    { title: 'Medication Management Policy', cat: 'Clinical' },
    { title: 'Health & Safety at Work Policy', cat: 'Health & Safety' },
  ]
  for (const p of standardPolicies) {
    await insert(`INSERT INTO policies (id,organization_id,title,category,content,version,status,created_at,updated_by) VALUES ($1,$2,$3,$4,$5,'2.1','active',$6,$7)`,
      [uuid(), orgId, p.title, p.cat,
       `# ${p.title}\n\nThis policy outlines the approach of Orbis Care Ltd to ${p.title.toLowerCase()}.\n\n## Purpose\nTo ensure compliance with CQC regulations and promote best practice.\n\n## Scope\nApplies to all staff, contractors, and volunteers.\n\n## Responsibilities\n- **Senior Leadership**: Overall accountability\n- **Team Managers**: Implementation and monitoring\n- **Care Workers**: Compliance with policy requirements\n\n## Review\nReviewed annually or following any significant incident. Last reviewed by Opeyemi Olorunfemi.`,
       tsAgo(350 + Math.floor(Math.random() * 60)), staff[0].userId])
  }
  console.log('  ✓ 12 standard policies created')

  // ── 19. Appointments ──
  const appointmentTypes = ['GP Appointment', 'Dentist Checkup', 'Physiotherapy', 'Optician Appointment', 'Podiatry', 'Audiology', 'Chiropody', 'Counselling Session']
  for (let i = 0; i < 16; i++) {
    const su = sus[i % sus.length]
    const daysOffset = Math.floor((i - 8) * 3)
    const start = new Date(Date.now() + daysOffset * DAY)
    await insert(`INSERT INTO appointments (id,organization_id,person_id,title,start_time,end_time,status,location_id,created_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [uuid(), orgId, su.id, appointmentTypes[i % appointmentTypes.length],
       time(start, 9 + Math.floor(Math.random() * 4)), time(start, 10 + Math.floor(Math.random() * 4)),
       daysOffset < 0 ? 'completed' : 'scheduled', locIds[su.locIdx], staff[Math.floor(Math.random() * 3)].userId, tsAgo(Math.abs(daysOffset) + 14)])
  }
  console.log('  ✓ 16 appointments created')

  // ── 20. Goals + milestones + progress history ──
  const goalTemplates = [
    'Increase mobility to 50m walking daily', 'Improve nutrition intake to 80% of meals',
    'Social engagement — attend 3 group activities weekly', 'Personal hygiene independence',
    'Medication adherence without prompting', 'Reduce falls risk through exercises',
    'Improve fluid intake to 1.5L daily', 'Build confidence in communal areas',
  ]
  const goalIds: string[] = []
  for (let i = 0; i < 24; i++) {
    const su = sus[i % sus.length]
    const progress = Math.min(100, Math.floor(Math.random() * 120))
    const gid = uuid()
    goalIds.push(gid)
    await insert(`INSERT INTO person_goals (id,organization_id,person_id,title,description,target_date,review_date,status,progress,cqc_domain,created_by,frequency,goal_category,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [gid, orgId, su.id, goalTemplates[i % goalTemplates.length],
       `Working towards: ${goalTemplates[i % goalTemplates.length].toLowerCase()}. Reviewed fortnightly with key worker.`,
       progress >= 100 ? dateAgo(10) : dateIn(45), dateIn(30), progress >= 100 ? 'completed' : 'active',
       Math.min(progress, 100), ['safe', 'effective', 'caring', 'responsive', 'well-led'][i % 5],
       staff[Math.floor(Math.random() * 3)].userId, 'weekly', ['mobility', 'nutrition', 'social', 'personal_care', 'medication'][i % 5],
       tsAgo(150 + i * 5), tsAgo(5)])
    const milestones = ['Initial baseline assessment', 'First progress check', 'Half-way review']
    for (let mi = 0; mi < milestones.length; mi++) {
      await insert(`INSERT INTO goal_milestones (id,goal_id,title,is_completed,completed_at,completed_by,sort_order,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [uuid(), gid, milestones[mi], mi < 2, mi < 2 ? tsAgo((2 - mi) * 30) : null, mi < 2 ? staff[2].userId : null, mi, tsAgo(140)])
    }
    const steps = Math.min(progress, 100) / 20
    for (let pi = 0; pi < steps; pi++) {
      await insert(`INSERT INTO goal_progress_history (id,goal_id,progress,notes,recorded_by,recorded_at) VALUES ($1,$2,$3,$4,$5,$6)`,
        [uuid(), gid, (pi + 1) * 20, `Progress update ${pi + 1}`, staff[2].userId, tsAgo(120 - pi * 25)])
    }
  }
  console.log('  ✓ 24 goals + milestones + progress history created')

  // ── 21. Room checks ──
  const roomNumbers = ['101', '102', '103', '104', '105', '106', '107', '108', '201', '202', '203', '204', '205', '301', '302', '303', '304']
  for (let i = 0; i < 24; i++) {
    const pass = Math.random() < 0.8
    await insert(`INSERT INTO room_checks (id,organization_id,location_id,room_number,checked_by,check_date,status,cleanliness_rating,safety_rating,notes,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [uuid(), orgId, locIds[Math.floor(i / 8) % 3], roomNumbers[i % roomNumbers.length],
       staff[Math.floor(Math.random() * 3)].profileId, dateAgo(Math.floor(Math.random() * 14)),
       pass ? 'pass' : Math.random() < 0.5 ? 'needs_attention' : 'fail',
       pass ? 4 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 2),
       pass ? 5 : 2 + Math.floor(Math.random() * 2),
       pass ? '' : 'Minor maintenance required — reported to facilities team', tsAgo(Math.floor(Math.random() * 14))])
  }
  console.log('  ✓ 24 room checks created')

  // ── 22. Tasks ──
  const taskData = [
    { title: 'Review all care plans for Q1', pri: 'high', days: -5, status: 'completed', su: true },
    { title: 'Order medication supplies', pri: 'high', days: 0, status: 'in_progress', su: false },
    { title: 'Fire safety check — all floors', pri: 'low', days: -2, status: 'completed', su: false },
    { title: 'Update risk assessments after incident', pri: 'high', days: 3, status: 'pending', su: true },
    { title: 'Staff supervision — Jane Dylan', pri: 'medium', days: 7, status: 'pending', su: false },
    { title: 'Window repair — Room 204', pri: 'urgent', days: -7, status: 'completed', su: true },
    { title: 'Garden maintenance check', pri: 'low', days: 10, status: 'pending', su: false },
    { title: 'New person assessment — Room 108', pri: 'medium', days: 2, status: 'in_progress', su: true },
    { title: 'Quarterly medication audit', pri: 'high', days: 14, status: 'pending', su: false },
    { title: 'Staff training compliance review', pri: 'medium', days: 5, status: 'pending', su: false },
    { title: 'Update family contact details', pri: 'low', days: -3, status: 'completed', su: true },
    { title: 'Prepare for CQC inspection', pri: 'high', days: 30, status: 'pending', su: false },
    { title: 'Muster point drill — all locations', pri: 'medium', days: 21, status: 'pending', su: false },
    { title: 'Review complaints log', pri: 'medium', days: -10, status: 'completed', su: false },
    { title: 'Deep clean schedule — Willow Court', pri: 'low', days: 4, status: 'in_progress', su: false },
    { title: 'Update emergency contact list', pri: 'medium', days: -1, status: 'completed', su: true },
    { title: 'Monthly safeguarding audit', pri: 'medium', days: -30, status: 'completed', su: false },
    { title: 'Annual staff appraisals due', pri: 'medium', days: -90, status: 'completed', su: false },
  ]
  for (const td of taskData) {
    await insert(`INSERT INTO tasks (id,organization_id,title,description,assigned_to,person_id,priority,status,due_date,completed_at,created_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [uuid(), orgId, td.title, td.title, staff[Math.floor(Math.random() * 3)].profileId,
       td.su ? sus[Math.floor(Math.random() * sus.length)].id : null,
       td.pri, td.status, dateIn(td.days), td.status === 'completed' ? tsAgo(Math.abs(td.days)) : null,
       staff[0].userId, tsAgo(Math.abs(td.days) + 10)])
  }
  console.log('  ✓ 18 tasks created')

  // ── 23. Leave requests ──
  const leaveStatuses = ['approved', 'approved', 'pending', 'rejected', 'approved', 'approved', 'pending', 'approved', 'approved', 'pending', 'approved', 'approved']
  const leaveReasons = ['Family holiday', 'Medical appointment', 'Personal reasons', 'Study leave', 'Childcare', 'Compassionate reasons']
  const approvingAdmin = (requesterIdx: number) => staff[requesterIdx === 0 ? 1 : 0].userId
  for (let i = 0; i < 12; i++) {
    const s = staff[i % staff.length]
    const lt = leaveTypeIds[i % 4]
    const inPast = i < 8
    const start = inPast ? new Date(Date.now() - (90 - i * 8) * DAY) : new Date(Date.now() + (7 + Math.floor(Math.random() * 30)) * DAY)
    const end = new Date(start.getTime() + (1 + Math.floor(Math.random() * 3)) * DAY)
    const status = leaveStatuses[i]
    const reviewedBy = status !== 'pending' ? approvingAdmin(staff.indexOf(s)) : null
    await insert(`INSERT INTO leave_requests (id,staff_id,leave_type_id,start_date,end_date,hours_requested,duration_type,status,reason,notes,reviewed_by,reviewed_at,created_at) VALUES ($1,$2,$3,$4,$5,$6,'days',$7,$8,$9,$10,$11,$12)`,
      [uuid(), s.profileId, lt, start.toISOString().split('T')[0], end.toISOString().split('T')[0],
       (1 + Math.floor(Math.random() * 3)) * 7.5, status, leaveReasons[i % leaveReasons.length],
       status === 'rejected' ? 'Insufficient cover on requested dates.' : null,
       reviewedBy, reviewedBy ? tsAgo(5) : null, inPast ? tsAgo(95 - i * 8) : tsAgo(3)])
  }
  console.log('  ✓ 12 leave requests created')

  // ── 24. Shift templates + shifts + assignments ──
  const shiftTemplateDefs = [
    { name: 'Morning Shift', start: '07:00', end: '15:00' },
    { name: 'Day Shift', start: '09:00', end: '21:00' },
    { name: 'Night Shift', start: '21:00', end: '07:00' },
    { name: 'Wake Night', start: '22:00', end: '08:00' },
  ]
  for (const st of shiftTemplateDefs)
    await insert(`INSERT INTO shift_templates (id,name,start_time,end_time,organization_id,created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [uuid(), st.name, st.start, st.end, orgId, tsAgo(400)])

  // Agency workers for uncovered shifts
  const agencyIds: string[] = []
  const agencyWorkerIds: string[] = []
  for (const [ai, an] of [['CareStaff Solutions', 'cs@carestaff.co.uk'], ['NursePlus 24/7', 'ops@nurseplus.com']]) {
    const aid = uuid()
    agencyIds.push(aid)
    await insert(`INSERT INTO agencies (id,organization_id,name,contact_name,contact_phone,contact_email,address,notes,status,contract_start_date,created_at) VALUES ($1,$2,$3,'Regional Coordinator','020 7000 1234',$4,'1 Commerce Way, London','Approved framework supplier','active','${dateAgo(380)}',$5)`,
      [aid, orgId, an, ai === 'cs@carestaff.co.uk' ? EMAIL_ADMIN : EMAIL_ADMIN2, tsAgo(380)])
    for (let wi = 0; wi < 3; wi++) {
      const wid = uuid()
      agencyWorkerIds.push(wid)
      await insert(`INSERT INTO agency_workers (id,agency_id,organization_id,first_name,last_name,role,phone,email,dbs_check_date,dbs_expiry_date,mandatory_training_completed,status,rating,notes,created_at) VALUES ($1,$2,$3,$4,$5,'Senior Support Worker','07900 0'||${100 + wi}||'',$6,'${dateAgo(300)}','${dateIn(65)}',true,'available',4.5,'Reliable, good availability','${tsAgo(370)}')`,
        [wid, aid, orgId, ['Emma', 'Daniel', 'Priya'][wi], ['Stone', 'Beck', 'Sharma'][wi], ai === 'cs@carestaff.co.uk' ? EMAIL_ADMIN : EMAIL_ADMIN2])
    }
    await insert(`INSERT INTO agency_rates (id,agency_id,organization_id,shift_type,rate_per_hour,effective_from,created_at) VALUES ($1,$2,$3,'day',18.5,'${dateAgo(380)}','${tsAgo(380)}')`, [uuid(), aid, orgId])
    await insert(`INSERT INTO agency_rates (id,agency_id,organization_id,shift_type,rate_per_hour,effective_from,created_at) VALUES ($1,$2,$3,'wake_night',21.0,'${dateAgo(380)}','${tsAgo(380)}')`, [uuid(), aid, orgId])
    await insert(`INSERT INTO agency_rates (id,agency_id,organization_id,shift_type,rate_per_hour,effective_from,created_at) VALUES ($1,$2,$3,'sleep',20.0,'${dateAgo(380)}','${tsAgo(380)}')`, [uuid(), aid, orgId])
  }

  let shiftCount = 0
  for (let d = -45; d < 15; d++) {
    const day = new Date(Date.now() + d * DAY)
    const isPast = d < 0
    // loc0: day shift always; loc1: day shift; loc2: day shift; loc0 wake_night every other day
    const plan = [
      { locIdx: 0, type: 'day', hour: 9, dur: 12 },
      { locIdx: 1, type: 'day', hour: 8, dur: 12 },
      { locIdx: 2, type: 'day', hour: 8, dur: 12 },
    ]
    if (d % 2 === 0) plan.push({ locIdx: 0, type: 'wake_night', hour: 21, dur: 12 })
    for (const p of plan) {
      const shId = uuid()
      const start = new Date(day); start.setHours(p.hour, 0, 0, 0)
      const end = new Date(start); end.setHours((p.hour + p.dur) % 24, 0, 0, 0)
      if (p.hour + p.dur >= 24) end.setDate(end.getDate() + 1)
      // Determine coverage: Jane covers loc0 day; agency covers others sporadically
      let assigned = false
      let agency: string | null = null
      let agencyWorker: string | null = null
      if (p.locIdx === 0 && p.type === 'day') {
        assigned = true // Jane
      } else if (Math.random() < 0.35) {
        assigned = true
        agency = agencyIds[Math.floor(Math.random() * agencyIds.length)]
        agencyWorker = agencyWorkerIds[Math.floor(Math.random() * agencyWorkerIds.length)]
      }
      const status = assigned ? (isPast ? 'completed' : 'assigned') : 'open'
      await insert(`INSERT INTO shifts (id,location_id,department_id,start_time,end_time,status,published_at,shift_type,created_at,updated_at,agency_id,agency_cost,agency_worker_id,agency_check_in,agency_check_out,agency_status,agency_covered)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [shId, locIds[p.locIdx], deptIds[p.locIdx], start.toISOString(), end.toISOString(), status,
         isPast ? tsAgo(Math.abs(d) + 3) : tsAgo(3), p.type, tsAgo(Math.abs(d) + 3), tsAgo(1),
         agency, agency ? (p.type === 'wake_night' ? 21.0 : 18.5) : null, agencyWorker,
         agency && isPast ? start.toISOString() : null, agency && isPast ? end.toISOString() : null,
         agency ? (isPast ? 'completed' : 'accepted') : null, !!agency])
      if (assigned && !agency) {
        await insert(`INSERT INTO shift_assignments (id,shift_id,staff_id,status,is_overtime,created_at) VALUES ($1,$2,$3,$4,false,$5)`,
          [uuid(), shId, staff[2].profileId, isPast ? 'completed' : 'assigned', tsAgo(Math.abs(d) + 3)])
      }
      shiftCount++
    }
  }
  console.log(`  ✓ 4 shift templates + ${shiftCount} shifts (+ assignments/agency coverage) created`)

  // ── 25. Memory book ──
  const memoryData = [
    { title: 'Birthday celebration!', desc: 'Enjoyed cake and singing with family and friends.', days: 45 },
    { title: 'Trip to the seaside', desc: 'Wonderful day at Brighton beach. Fish and chips for lunch!', days: 60 },
    { title: 'Gardening club', desc: 'Planted spring bulbs in the garden. Loved being outdoors.', days: 20 },
    { title: 'Music therapy session', desc: 'Sang along to old favourites. Brought back happy memories.', days: 10 },
    { title: 'Visit from granddaughter', desc: 'Spent the afternoon looking at photo albums together.', days: 5 },
    { title: 'Art class masterpiece', desc: 'Painted a beautiful landscape. Now displayed in the communal area.', days: 30 },
    { title: 'Afternoon tea with mayor', desc: 'The local mayor visited for afternoon tea. Very proud moment.', days: 90 },
    { title: 'Christmas celebrations', desc: 'Carols around the piano. Mince pies and mulled juice for all.', days: 200 },
    { title: 'Pet therapy visit', desc: 'Loved the golden retriever. So much tail wagging and smiles!', days: 15 },
    { title: 'Birthday afternoon tea', desc: 'Special tea party with favourite cakes. Cards from everyone.', days: 100 },
    { title: 'Summer BBQ', desc: 'Beautiful weather for the annual BBQ. Burgers, music and dancing.', days: 150 },
    { title: 'Reminiscence therapy', desc: 'Looked through old photos from the 1950s. Shared wonderful stories.', days: 25 },
    { title: 'Armchair exercise class', desc: 'Joined the seated exercise class. Managed 20 minutes!', days: 8 },
    { title: 'Film afternoon — Singin\' in the Rain', desc: 'Classic film afternoon with popcorn. Sang along to every song.', days: 35 },
    { title: 'New books from the library', desc: 'Visited the mobile library. Chose three new books to read.', days: 12 },
    { title: 'Knit and natter group', desc: 'Started knitting a scarf for the winter charity drive.', days: 18 },
    { title: 'Birthday flowers', desc: 'Received a beautiful bouquet from the team. Made the room look lovely.', days: 70 },
    { title: 'Armistice Day observance', desc: 'Two-minute silence observed. Remembered family members who served.', days: 250 },
    { title: 'Fish and chip Friday', desc: 'Traditional fish and chips for lunch. Everyone enjoyed it.', days: 6 },
    { title: 'Chair yoga session', desc: 'Gentle yoga stretches. Felt relaxed and refreshed afterwards.', days: 14 },
    { title: 'Visit from school children', desc: 'Local primary school came to sing. Brought handmade cards.', days: 40 },
    { title: 'Medicine review completed', desc: 'Annual medication review with GP. No changes needed.', days: 55 },
    { title: 'Hairdresser visit', desc: 'Had hair washed and styled. Felt wonderful afterwards.', days: 9 },
    { title: 'Picture of favourite flowers', desc: 'Drew a picture of roses from memory. Very talented!', days: 22 },
    { title: 'Walk in the park', desc: 'Short walk to local park. Sat and watched the ducks.', days: 11 },
    { title: 'Pancake Day celebration', desc: 'Enjoyed pancakes with lemon and sugar. Traditional recipe.', days: 180 },
    { title: 'Family video call', desc: 'Video call with grandson in Australia. Brought so much joy.', days: 4 },
    { title: 'Reading group', desc: 'Discussed this month\'s book. Everyone had different views!', days: 28 },
    { title: 'Physiotherapy milestone', desc: 'Walked to the dining room with just a walking stick today!', days: 3 },
    { title: 'Birthday surprise party', desc: 'Family organised a surprise party. Cake, balloons and a sing-along!', days: 85 },
  ]
  const memoryImgs = ['/files/private/memory1.jpg', '/files/private/memory2.jpg', null, '/files/private/memory3.jpg', null]
  for (const md of memoryData) {
    const su = sus[Math.floor(Math.random() * (sus.length - 2))]
    const imgUrl = memoryImgs[Math.floor(Math.random() * memoryImgs.length)]
    await insert(`INSERT INTO memory_book_entries (id,person_id,title,description,image_url,image_urls,support_level,recorded_date,created_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [uuid(), su.id, md.title, md.desc, imgUrl, imgUrl ? JSON.stringify([imgUrl]) : '[]',
       SUPPORT_LEVELS[Math.floor(Math.random() * 4)], dateAgo(md.days),
       staff[Math.floor(Math.random() * 3)].userId, tsAgo(md.days)])
  }
  console.log('  ✓ 30 memory book entries created')

  // ── 26. Satisfaction surveys ──
  const relationships2 = ['Daughter', 'Son', 'Spouse', 'Niece', 'Friend', 'Sibling']
  const surveyComments = [
    'Very happy with the care provided. Staff are wonderful.',
    'Some concerns about communication but overall good.',
    'Excellent standard of care. Would recommend.',
    'Room could be warmer but care is first class.',
    'Staff are always kind and patient. Very grateful.',
    'Communication with family could be better.',
    'Outstanding care. Mum is thriving here.',
    'Good activities programme but more variety needed.',
    'Very professional team. Always kept informed.',
    'Care plan reviews are thorough and inclusive.',
    'Beautiful environment. Dad has settled in well.',
    'Meal times could be more flexible.',
  ]
  for (let i = 0; i < 12; i++) {
    await insert(`INSERT INTO satisfaction_surveys (id,organization_id,person_id,respondent_name,relationship,rating,comments,created_at,invitation_token) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [uuid(), orgId, sus[i % sus.length].id, `Family Member of ${sus[i % sus.length].name.split(' ')[0]}`,
       relationships2[i % relationships2.length], [2, 3, 4, 4, 5, 3, 5, 4, 5, 4, 5, 3][i], surveyComments[i],
       tsAgo(30 + i * 12), uuid()])
  }
  console.log('  ✓ 12 satisfaction surveys created')

  // ── 27. Care assessments ──
  const assessmentTypes = ['initial', 'annual', 'review', 'specialist']
  for (const su of sus) {
    if (su.name === 'Albert Einstein') continue
    const n = 1 + Math.floor(Math.random() * 2)
    for (let i = 0; i < n; i++) {
      await insert(`INSERT INTO care_assessments (id,organization_id,person_id,assessment_type,assessor_name,assessment_date,next_review_date,findings,recommendations,status,created_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [uuid(), orgId, su.id, assessmentTypes[Math.floor(Math.random() * assessmentTypes.length)],
         staff[Math.floor(Math.random() * 2)].name.join(' '), dateAgo(Math.floor(Math.random() * 120)), dateIn(180),
         `Comprehensive assessment of ${su.name}. All care needs identified and documented.`,
         'Continue current care plan. Review mobility support requirements.',
         Math.random() < 0.2 ? 'draft' : 'completed', staff[Math.floor(Math.random() * 3)].userId,
         tsAgo(Math.floor(Math.random() * 120))])
    }
  }
  console.log('  ✓ ~28 care assessments created')

  // ── 28. Clinical scores ──
  const scoreTypes = ['waterlow', 'must', 'bmi']
  for (const su of sus) {
    if (su.name === 'Albert Einstein') continue
    const n = 1 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) {
      const st = scoreTypes[Math.floor(Math.random() * scoreTypes.length)]
      const score = Math.floor(Math.random() * 20) + 5
      await insert(`INSERT INTO clinical_scores (id,person_id,score_type,score,risk_level,recorded_date,notes,recorded_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [uuid(), su.id, st, score, score < 10 ? 'low' : score < 15 ? 'medium' : 'high',
         dateAgo(Math.floor(Math.random() * 60)), `Routine ${st.toUpperCase()} assessment completed.`,
         staff[Math.floor(Math.random() * 3)].userId, tsAgo(Math.floor(Math.random() * 60))])
    }
  }
  console.log('  ✓ ~36 clinical scores created')

  // ── 29. Wellbeing / mood ──
  const wellbeingDomains = ['mood', 'engagement', 'sleep', 'appetite', 'pain', 'mobility', 'social', 'overall']
  for (let i = 0; i < 60; i++) {
    const su = sus[Math.floor(Math.random() * (sus.length - 2))]
    await insert(`INSERT INTO person_wellbeing (id,person_id,recorded_date,domain,score,notes,recorded_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [uuid(), su.id, dateAgo(Math.floor(Math.random() * 21)), wellbeingDomains[Math.floor(Math.random() * wellbeingDomains.length)],
       Math.floor(Math.random() * 5) + 6, 'Good day. Positive engagement with staff and peers.',
       staff[Math.floor(Math.random() * 3)].userId, tsAgo(Math.floor(Math.random() * 21))])
  }
  console.log('  ✓ 60 wellbeing entries created')

  // ── 30. Communication log ──
  const commMethods = ['phone', 'email', 'visit', 'letter']
  const commDirections = ['inbound', 'outbound']
  for (let i = 0; i < 30; i++) {
    const su = sus[Math.floor(Math.random() * (sus.length - 2))]
    await insert(`INSERT INTO person_communication_log (id,person_id,contact_name,relationship,contact_method,direction,summary,follow_up_actions,recorded_date,recorded_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [uuid(), su.id, `Family of ${su.name}`, relationships2[Math.floor(Math.random() * relationships2.length)],
       commMethods[Math.floor(Math.random() * commMethods.length)], commDirections[Math.floor(Math.random() * commDirections.length)],
       'Discussed wellbeing and upcoming care plan review. Family satisfied with care.',
       'Arrange care plan review meeting', dateAgo(Math.floor(Math.random() * 30)),
       staff[Math.floor(Math.random() * 3)].userId, tsAgo(Math.floor(Math.random() * 30))])
  }
  console.log('  ✓ 30 communication log entries created')

  // ── 31. Capacity assessments ──
  const hasCapacity = [true, false, true, true, false, true, false, true, false, true, true, false]
  for (let i = 0; i < 12; i++) {
    const su = sus[i % sus.length]
    await insert(`INSERT INTO person_capacity_assessments (id,person_id,assessment_date,decision_to_be_made,capacity_found,capacity_status,best_interest_decision,review_date,recorded_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [uuid(), su.id, dateAgo(Math.floor(Math.random() * 180)), 'Capacity to make decisions about care and residence',
       hasCapacity[i], hasCapacity[i] ? 'has_capacity' : 'lacks_capacity',
       hasCapacity[i] ? null : 'Best interest decision made with family involvement. Remains in current placement.',
       dateIn(90), staff[Math.floor(Math.random() * 3)].userId, tsAgo(Math.floor(Math.random() * 180))])
  }
  console.log('  ✓ 12 capacity assessments created')

  // ── 32. Care pathways ──
  const pathwayTypes = ['hospital_admission', 'hospital_discharge', 'short_break', 'transition', 'assessment_unit']
  for (let i = 0; i < 10; i++) {
    const su = sus[Math.floor(Math.random() * (sus.length - 2))]
    await insert(`INSERT INTO person_care_pathways (id,person_id,pathway_type,title,start_date,end_date,location_name,referral_reason,discharge_notes,status,recorded_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [uuid(), su.id, pathwayTypes[i % pathwayTypes.length], `${pathwayTypes[i % pathwayTypes.length].replace(/_/g, ' ')} pathway`,
       dateAgo(Math.floor(Math.random() * 60)), i < 5 ? dateAgo(Math.floor(Math.random() * 30)) : null,
       i < 7 ? ['St Thomas\' Hospital', 'Croydon University Hospital', 'Royal Brompton'][Math.floor(Math.random() * 3)] : null,
       'Admission following acute episode', i < 5 ? 'Completed successfully, no ongoing issues.' : null,
       i < 5 ? 'completed' : Math.random() < 0.5 ? 'active' : 'cancelled',
       staff[Math.floor(Math.random() * 3)].userId, tsAgo(Math.floor(Math.random() * 60))])
  }
  console.log('  ✓ 10 care pathways created')

  // ── 33. Time Away records + checklists ──
  const checklistCategories = ['documentation', 'medication', 'equipment', 'notification', 'property', 'other']
  const timeAwayRecords = [
    { title: 'Going to mum\'s house for the weekend', type: 'family_visit', destination: 'Mum\'s house, Croydon', offset: 14, days: 2 },
    { title: 'Weekend respite at Stonebridge', type: 'short_break', destination: 'Stonebridge Short Breaks Centre', offset: 5, days: 3 },
    { title: 'Hospital admission for assessment', type: 'hospital_admission', destination: 'St Thomas\' Hospital, London', offset: 28, days: 7 },
    { title: 'Moving to supported living at Rose Court', type: 'discharge', destination: 'Rose Court Supported Living', offset: 40, days: 0 },
  ]
  const timeAwayIds: { id: string; personId: string }[] = []
  for (const rec of timeAwayRecords) {
    const su = sus[Math.floor(Math.random() * sus.length)]
    const start = new Date(); start.setDate(start.getDate() + rec.offset)
    const end = new Date(start); end.setDate(end.getDate() + rec.days)
    const id = uuid()
    timeAwayIds.push({ id, personId: su.id })
    await insert(`INSERT INTO person_time_away (id,person_id,title,time_away_type,destination,start_date,end_date,created_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, su.id, rec.title, rec.type, rec.destination, start.toISOString().split('T')[0], rec.days > 0 ? end.toISOString().split('T')[0] : null,
       staff[Math.floor(Math.random() * 3)].userId, tsAgo(Math.floor(Math.random() * 30))])
  }
  const checklistItems = [
    { item: 'GP discharge summary completed', qty: 1, unit: 'copy' },
    { item: 'Medication supply arranged', qty: 2, unit: 'weeks' },
    { item: 'Follow-up appointment booked', qty: null, unit: null },
    { item: 'Family notified of dates', qty: 2, unit: 'people' },
    { item: 'Personal belongings packed', qty: 3, unit: 'bags' },
    { item: 'Transport arranged', qty: null, unit: null },
    { item: 'Incontinence pads packed', qty: 30, unit: 'pads' },
    { item: 'District nurse notified', qty: null, unit: null },
    { item: 'Equipment collected from home', qty: 2, unit: 'items' },
    { item: 'Social worker informed', qty: null, unit: null },
    { item: 'Community care team referral sent', qty: null, unit: null },
    { item: 'Funding confirmed for ongoing care', qty: 1, unit: 'letter' },
  ]
  for (let i = 0; i < 12; i++) {
    const taw = timeAwayIds[Math.floor(Math.random() * timeAwayIds.length)]
    const items = checklistItems[i % checklistItems.length]
    await insert(`INSERT INTO person_discharge_checklist (id,person_id,time_away_id,item,category,quantity,unit,is_complete,completed_at,completed_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [uuid(), taw.personId, taw.id, items.item, checklistCategories[i % checklistCategories.length],
       items.qty, items.unit, i < 7, i < 7 ? tsAgo(Math.floor(Math.random() * 10)) : null,
       i < 7 ? staff[Math.floor(Math.random() * 3)].userId : null, tsAgo(Math.floor(Math.random() * 30))])
  }
  console.log('  ✓ 4 time away records + 12 checklist items created')

  // ── 34. Notifications ──
  const notifTypes = ['compliance', 'training', 'leave', 'scheduling', 'system', 'incident', 'shift']
  const notifMessages = [
    'Training record expiring soon: Safeguarding Adults', 'New incident report requires review',
    'Leave request pending approval', 'Compliance rate below threshold for 2 staff members',
    'Shift unassigned for tomorrow — Orbis House night shift', 'DBS check expiring for Jane Dylan',
    'New care plan review due for Arthur Clarke', 'Room check flagged — Room 204 needs attention',
    'Medication audit due this week', 'Staff supervision overdue for care worker',
  ]
  for (let i = 0; i < 15; i++) {
    const recipient = staff[Math.floor(Math.random() * 3)]
    await insert(`INSERT INTO notifications (id,user_id,title,message,type,read,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [uuid(), recipient.userId, notifTypes[i % notifTypes.length].toUpperCase(), notifMessages[i % notifMessages.length],
       notifTypes[i % notifTypes.length], i > 8, tsAgo(Math.floor(Math.random() * 14))])
  }
  console.log('  ✓ 15 notifications created')

  // ── 35. Person documents ──
  const docTypes = ['care_plan', 'assessment', 'referral', 'consent_form', 'correspondence', 'other']
  for (let i = 0; i < 24; i++) {
    const su = sus[i % sus.length]
    await insert(`INSERT INTO person_documents (id,person_id,title,document_type,file_url,description,upload_date,uploaded_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [uuid(), su.id, `${docTypes[i % docTypes.length].replace(/_/g, ' ')} document — ${dateAgo(i * 15)}`,
       docTypes[i % docTypes.length], '/files/private/vps-document.pdf', 'Uploaded document',
       dateAgo(i * 15), staff[Math.floor(Math.random() * 3)].userId, tsAgo(i * 15)])
  }
  console.log('  ✓ 24 person documents created')

  // ── 36. Manager delegation + audit ──
  const delId = uuid()
  await insert(`INSERT INTO manager_delegations (id,organization_id,primary_manager_id,delegate_manager_id,starts_at,ends_at,is_active,created_at) VALUES ($1,$2,$3,$4,$5,$6,true,$7)`,
    [delId, orgId, staff[0].userId, staff[1].userId, tsAgo(60), dateIn(120), tsAgo(60)])
  await insert(`INSERT INTO delegation_audit_logs (id,delegation_id,delegate_user_id,primary_manager_id,action,entity_type,details,created_at) VALUES ($1,$2,$3,$4,'delegated','leave', 'Delegated leave approvals to Grace Roberts','${tsAgo(60)}')`,
    [uuid(), delId, staff[1].userId, staff[0].userId])
  await insert(`INSERT INTO delegation_audit_logs (id,delegation_id,delegate_user_id,primary_manager_id,action,entity_type,details,created_at) VALUES ($1,$2,$3,$4,'approved','leave','Approved annual leave on behalf of primary manager','${tsAgo(20)}')`,
    [uuid(), delId, staff[1].userId, staff[0].userId])
  console.log('  ✓ delegation + audit trail created')

  // ── 37. Audit log ──
  const auditActions = ['create', 'update', 'view', 'delete']
  const auditEntities = ['person', 'care_plan', 'daily_note', 'incident', 'training_record', 'compliance_record', 'shift']
  for (let i = 0; i < 40; i++) {
    const daysN = Math.floor(Math.random() * 400)
    await insert(`INSERT INTO audit_logs (id,user_id,action,entity_type,entity_id,ip_address,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [uuid(), staff[Math.floor(Math.random() * 3)].userId, auditActions[Math.floor(Math.random() * 3)],
       auditEntities[i % auditEntities.length], uuid(), '185.71.76.' + Math.floor(Math.random() * 255), tsAgo(daysN)])
  }
  console.log('  ✓ 40 audit log entries created')

  // ── 38. Body map ──
  const bodyConditions = ['bruise', 'wound', 'rash', 'swelling', 'burn', 'pressure_sore', 'scar', 'skin_tear']
  const bodyParts = ['left_arm', 'right_arm', 'left_leg', 'right_leg', 'chest', 'back', 'abdomen', 'head']
  for (let i = 0; i < 15; i++) {
    const su = sus[Math.floor(Math.random() * (sus.length - 2))]
    await insert(`INSERT INTO body_map_entries (id,person_id,body_view,body_zone,condition_type,description,severity,status,recorded_date,created_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [uuid(), su.id, Math.random() < 0.5 ? 'front' : 'back', bodyParts[Math.floor(Math.random() * bodyParts.length)],
       bodyConditions[Math.floor(Math.random() * bodyConditions.length)], 'Minor noted during personal care.',
       ['mild', 'moderate', 'severe'][Math.floor(Math.random() * 3)], Math.random() < 0.6 ? 'active' : 'resolved',
       dateAgo(Math.floor(Math.random() * 14)), staff[Math.floor(Math.random() * 3)].userId, tsAgo(Math.floor(Math.random() * 14))])
  }
  console.log('  ✓ 15 body map entries created')

  // ── 39. Engagement ──
  const engagementThemes = ['Workplace satisfaction', 'Workload balance', 'Team communication', 'Training needs', 'Career development', 'Wellbeing support']
  for (const theme of engagementThemes) {
    await insert(`INSERT INTO engagement_templates (id,organization_id,name,questions,is_active,created_at) VALUES ($1,$2,$3,$4,true,$5)`,
      [uuid(), orgId, theme + ' Survey',
       JSON.stringify([
         { question: `How satisfied are you with ${theme.toLowerCase()}?`, type: 'slider', min: 1, max: 10 },
         { question: 'What could be improved?', type: 'text' },
       ]), tsAgo(200)])
  }
  for (let i = 0; i < 3; i++) {
    await insert(`INSERT INTO staff_engagement_surveys (id,organization_id,respondent_id,ratings,comments,is_anonymous,created_at,template_id) VALUES ($1,$2,$3,$4,$5,false,$6,$7)`,
      [uuid(), orgId, staff[i].userId, JSON.stringify({ 'Workplace satisfaction': 8, 'Team communication': 7, 'Wellbeing support': 8 }),
       'Generally positive. Would value more training opportunities.', tsAgo(150), null])
  }
  for (const s of staff) {
    await insert(`INSERT INTO survey_invitations (id,organization_id,type,email,token,person_name,sent_at,completed_at,expires_at,used,created_at) VALUES ($1,$2,'engagement',$3,$4,NULL,$5,$6,$7,true,$8)`,
      [uuid(), orgId, s.email, uuid(), tsAgo(150), tsAgo(140), tsAgo(120), tsAgo(150)])
  }
  console.log('  ✓ 6 engagement templates + 3 responses + 3 invitations created')

  // ── 40. eMAR ──
  const marIds = [uuid(), uuid(), uuid(), uuid()]
  const medNames = [
    { name: 'Paracetamol 500mg', freq: '4 times daily', route: 'oral', prn: false },
    { name: 'Omeprazole 20mg', freq: 'Once daily', route: 'oral', prn: false },
    { name: 'Bisoprolol 5mg', freq: 'Once daily', route: 'oral', prn: false },
    { name: 'Lansoprazole 15mg', freq: 'Once daily', route: 'oral', prn: false },
    { name: 'Salbutamol Inhaler', freq: 'As required', route: 'inhaled', prn: true },
    { name: 'GTN Spray 400mcg', freq: 'As required', route: 'sublingual', prn: true },
    { name: 'Buprenorphine Patch 10mcg/hr', freq: 'Weekly', route: 'transdermal', prn: false },
    { name: 'Furosemide 40mg', freq: 'Once daily', route: 'oral', prn: false },
    { name: 'Amlodipine 5mg', freq: 'Once daily', route: 'oral', prn: false },
    { name: 'Warfarin 3mg', freq: 'Once daily', route: 'oral', prn: false },
    { name: 'Mirtazapine 15mg', freq: 'Once daily at night', route: 'oral', prn: false },
    { name: 'Senna 7.5mg', freq: 'As required', route: 'oral', prn: true },
  ]
  // Stock
  const emedStockIds: string[] = []
  for (const med of medNames) {
    const stockId = uuid()
    emedStockIds.push(stockId)
    await insert(`INSERT INTO emedication_stock (id,organization_id,medication_name,dosage,unit,batch_number,expiry_date,quantity,quantity_unit,reorder_level,location,person_id,status,created_at) VALUES ($1,$2,$3,$4,$5,concat('B',floor(random()*9000)+1000),'${dateIn(90 + Math.floor(Math.random() * 150))}',$6,'tablet',30,'Orbis House',NULL,'active','${tsAgo(200)}')`,
      [stockId, orgId, med.name, med.name.includes('mcg') ? med.name.match(/\d+/)?.[0] + ' mcg' : med.name.match(/\d+/)?.[0] + ' mg', med.name.includes('mcg') ? 'mcg' : 'mg', 60 + Math.floor(Math.random() * 80)])
  }
  // Deliveries
  for (let d = 0; d < 4; d++) {
    const delId = uuid()
    await insert(`INSERT INTO emedication_deliveries (id,organization_id,supplier,delivery_note,delivery_date,received_by,notes,created_at) VALUES ($1,$2,'AAH Pharmaceuticals','DN-${1000 + d * 5}','${dateAgo(d * 30 + 15)}',$3,'Monthly delivery','${tsAgo(d * 30 + 15)}')`,
      [delId, orgId, staff[2].name.join(' ')])
    for (let di = 0; di < 3; di++) {
      const med = medNames[(d * 3 + di) % medNames.length]
      await insert(`INSERT INTO emedication_delivery_items (id,delivery_id,medication_name,dosage,unit,batch_number,expiry_date,quantity,quantity_unit,created_at) VALUES ($1,$2,$3,$4,$5,concat('B',floor(random()*9000)+1000),'${dateIn(120)}',56,'tablet',$6)`,
        [uuid(), delId, med.name, med.name.includes('mcg') ? med.name.match(/\d+/)?.[0] + ' mcg' : med.name.match(/\d+/)?.[0] + ' mg', med.name.includes('mcg') ? 'mcg' : 'mg', tsAgo(d * 30 + 15)])
    }
  }
  // Daily counts moved after MAR items are created (below)
  // Stock adjustments
  for (let a = 0; a < 4; a++) {
    await insert(`INSERT INTO emedication_stock_adjustments (id,organization_id,stock_item_id,adjustment_type,quantity_adjusted,reason,adjusted_by,created_at) VALUES ($1,$2,$3,'expired',40,'Monthly stock top-up','Jane Dylan','${tsAgo(a * 30 + 10)}')`,
      [uuid(), orgId, emedStockIds[a % emedStockIds.length]])
  }
  // Audit log
  for (let a = 0; a < 6; a++) {
    await insert(`INSERT INTO emedication_audit_log (id,organization_id,action,entity_type,entity_id,user_id,changes,ip_address,created_at) VALUES ($1,$2,'create','emedication_item',$3,$4,$5,'185.71.76.21','${tsAgo(a * 20)}')`,
      [uuid(), orgId, uuid(), staff[2].userId, JSON.stringify({ action: 'created', by: 'Jane Dylan' })])
  }
  // MAR charts + items + administrations
  const emedItemIds: string[] = []
  for (let mi = 0; mi < marIds.length; mi++) {
    const su = sus[mi * 3]
    await insert(`INSERT INTO emedication_records (id,organization_id,person_id,title,start_date,end_date,status,created_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8)`,
      [marIds[mi], orgId, su.id, `MAR Chart - ${su.name}`, dateAgo(30), dateIn(24), staff[0].userId, tsAgo(30)])
    for (let medIdx = mi * 3; medIdx < mi * 3 + 3; medIdx++) {
      const med = medNames[medIdx % medNames.length]
      const itemId = uuid()
      emedItemIds.push(itemId)
      await insert(`INSERT INTO emedication_items (id,emedication_record_id,name,dosage,unit,route,frequency,times,instructions,is_prn,is_active,created_by,created_at,is_controlled_drug,prescriber_name,prescriber_phone,prescription_ref) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11,$12,false,'Dr Patel','020 7946 0101',concat('RX-',floor(random()*90000)+10000))`,
        [itemId, marIds[mi], med.name,
         med.name.includes('mg') ? med.name.match(/\d+/)?.[0] + ' mg' : med.name.includes('mcg') ? med.name.match(/\d+/)?.[0] + ' mcg' : '1 dose',
         med.name.includes('mcg') ? 'mcg' : 'mg', med.route, med.freq,
         JSON.stringify(['08:00', '13:00', '18:00', '22:00']),
         med.prn ? 'As required. Record PRN reason.' : 'Give as prescribed.', med.prn, staff[0].userId, tsAgo(30)])
      for (let d = -14; d <= 0; d++) {
        if (med.prn && Math.random() > 0.3) continue
        const sched = new Date(Date.now() + d * DAY); sched.setHours(8, 0, 0, 0)
        const given = Math.random() < 0.92
        await insert(`INSERT INTO emedication_administrations (id,emedication_item_id,staff_id,scheduled_time,administered_time,status,notes,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [uuid(), itemId, staff[2].profileId, sched.toISOString(),
           given ? new Date(sched.getTime() + Math.floor(Math.random() * 30) * 60000).toISOString() : null,
           given ? 'given' : 'missed', given ? 'Administered as prescribed' : 'Medication refused', tsAgo(-d)])
      }
    }
  }
  // Daily counts (after items exist)
  for (let d = 0; d < 4; d++) {
    const dcId = uuid()
    const su = sus[d]
    await insert(`INSERT INTO emedication_daily_counts (id,organization_id,person_id,count_date,staff_name,matches_physical,notes,created_at) VALUES ($1,$2,$3,$4,'Jane Dylan',true,'All stock verified',$5)`,
      [dcId, orgId, su.id, dateAgo(d * 7 + 2), tsAgo(d * 7 + 2)])
    for (let ci = 0; ci < 3; ci++) {
      await insert(`INSERT INTO emedication_daily_count_items (id,daily_count_id,medication_item_id,medication_name,expected_quantity,actual_quantity,created_at) VALUES ($1,$2,$3,$4,56,56,$5)`,
        [uuid(), dcId, emedItemIds[(d * 3 + ci) % emedItemIds.length], medNames[(d * 3 + ci) % medNames.length].name, tsAgo(d * 7 + 2)])
    }
  }
  console.log('  ✓ eMAR: 4 charts, 12 meds, stock/deliveries/counts/adjustments/audit + administrations created')

  // ── 41. Evidence mappings ──
  const sourceTypes = ['training', 'documents', 'competency', 'care_plans', 'incidents', 'satisfaction']
  const domains = ['safe', 'effective', 'caring', 'responsive', 'well-led']
  for (const domain of domains) {
    for (let i = 0; i < 3; i++) {
      await insert(`INSERT INTO evidence_mappings (id,organization_id,source_type,source_category,target_domain,created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [uuid(), orgId, sourceTypes[Math.floor(Math.random() * sourceTypes.length)], ['mandatory', 'clinical', 'general'][Math.floor(Math.random() * 3)], domain, tsAgo(200)])
    }
  }
  console.log('  ✓ 15 evidence mappings created')

  // ── 42. Health ──
  const obsCats = ['general', 'skin', 'medication', 'sleep', 'pain', 'weight']
  for (let i = 0; i < 30; i++) {
    const su = sus[Math.floor(Math.random() * (sus.length - 2))]
    await insert(`INSERT INTO health_observations (id,person_id,observation_date,category,notes,severity,recorded_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [uuid(), su.id, dateAgo(Math.floor(Math.random() * 21)), obsCats[i % obsCats.length],
       'Observation within expected range. No concerns noted.', 'normal',
       staff[Math.floor(Math.random() * 3)].userId, tsAgo(Math.floor(Math.random() * 21))])
  }
  for (let i = 0; i < 24; i++) {
    const su = sus[Math.floor(Math.random() * (sus.length - 2))]
    await insert(`INSERT INTO bowel_movements (id,person_id,recorded_date,recorded_time,bristol_type,color,consistency,notes,recorded_by,created_at) VALUES ($1,$2,$3,'08:30:00',$4,'brown','formed','Normal bowel movement', $5,$6)`,
      [uuid(), su.id, dateAgo(Math.floor(Math.random() * 14)), 3 + Math.floor(Math.random() * 3), staff[2].userId, tsAgo(Math.floor(Math.random() * 14))])
  }
  for (let i = 0; i < 6; i++) {
    const su = sus[i % sus.length]
    await insert(`INSERT INTO dental_records (id,person_id,checkup_date,dentist_name,findings,actions_taken,next_checkup_date,notes,recorded_by,created_at) VALUES ($1,$2,$3,'Dr N. Singh','Dentures fitting well. Gums healthy.','No action required.','${dateIn(180)}','Annual dental review', $4,$5)`,
      [uuid(), su.id, dateAgo(i * 60 + 30), staff[Math.floor(Math.random() * 3)].userId, tsAgo(i * 60 + 30)])
  }
  for (let i = 0; i < 30; i++) {
    const su = sus[Math.floor(Math.random() * (sus.length - 2))]
    await insert(`INSERT INTO fluid_intake (id,person_id,recorded_date,recorded_time,amount_ml,fluid_type,notes,recorded_by,created_at) VALUES ($1,$2,$3,'12:00:00',${150 + Math.floor(Math.random() * 150)},'water','Hydration encouraged', $4,$5)`,
      [uuid(), su.id, dateAgo(Math.floor(Math.random() * 10)), staff[2].userId, tsAgo(Math.floor(Math.random() * 10))])
  }
  console.log('  ✓ health observations, bowel, dental, fluid intake created')

  // ── 44. DSPT ──
  const dsptYears = [
    { year: '2024/25', status: 'standards_met', submitted: 400, notes: 'Full submission completed — all standards met' },
    { year: '2025/26', status: 'submitted', submitted: 30, notes: 'Annual self-assessment in progress' },
  ]
  const dsptStandards = ['A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2']
  for (const dy of dsptYears) {
    const dsptId = uuid()
    await insert(`INSERT INTO dspt_assessments (id,organization_id,assessment_year,status,submitted_at,notes,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [dsptId, orgId, dy.year, dy.status, dy.status === 'standards_met' ? tsAgo(dy.submitted) : null, dy.notes, tsAgo(dy.submitted)])
    for (let si = 0; si < dsptStandards.length; si++) {
      const st = dy.status === 'standards_met' ? (si % 3 === 0 ? 'exceeded' : 'met') : ['met', 'partially', 'not_assessed'][si % 3]
      await insert(`INSERT INTO dspt_standard_status (id,assessment_id,standard_key,status,evidence_notes,evidence_files,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [uuid(), dsptId, dsptStandards[si], st, `Evidence for ${dsptStandards[si]} documented in policy register.`, '[]', tsAgo(dy.submitted)])
    }
  }
  console.log('  ✓ DSPT assessments (2 years × 10 standards) created')

  // ── 45. Petty cash + expenses ──
  for (let li = 0; li < 3; li++) {
    await insert(`INSERT INTO petty_cash_balances (id,organization_id,location_id,current_balance_pence,last_reconciled_at,created_at) VALUES ($1,$2,$3,20000,$4,$5)`,
      [uuid(), orgId, locIds[li], tsAgo(3), tsAgo(200)])
  }
  const expenseCats = ['food', 'activities', 'clothing', 'personal', 'transport', 'other']
  for (let i = 0; i < 15; i++) {
    const su = sus[i % sus.length]
    const amount = (250 + Math.floor(Math.random() * 2000)) * 100
    await insert(`INSERT INTO person_expenses (id,organization_id,person_id,location_id,category,amount_pence,description,receipt_url,incurred_date,created_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,$8,$9,$10)`,
      [uuid(), orgId, su.id, locIds[su.locIdx], expenseCats[i % expenseCats.length], amount,
       `${expenseCats[i % expenseCats.length]} purchase for ${su.name}`, dateAgo(Math.floor(Math.random() * 30)),
       staff[Math.floor(Math.random() * 3)].userId, tsAgo(Math.floor(Math.random() * 30))])
  }
  let balance = 20000
  for (let i = 0; i < 12; i++) {
    const isTopUp = i % 3 === 0
    const amount = isTopUp ? 20000 : -(800 + Math.floor(Math.random() * 1500)) * 100
    const prev = balance
    balance += amount
    await insert(`INSERT INTO petty_cash_transactions (id,organization_id,location_id,type,amount_pence,previous_balance_pence,new_balance_pence,notes,performed_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
       [uuid(), orgId, locIds[i % 3], isTopUp ? 'top_up' : 'adjustment', amount, prev, balance,
       isTopUp ? 'Weekly cash float top-up' : 'Purchased supplies for people',
       staff[Math.floor(Math.random() * 3)].userId, tsAgo(i * 25 + 5)])
  }
  console.log('  ✓ petty cash balances/transactions + 15 expenses created')

  // ── 46. CQC action items ──
  const cqcActions = [
    { stmt: 'S1', desc: 'Complete quarterly medication audits for all locations', pri: 'high', days: 14 },
    { stmt: 'S5', desc: 'Recruit additional care workers for Willow Court night cover', pri: 'high', days: 45 },
    { stmt: 'E2', desc: 'Roll out updated care plan review templates', pri: 'medium', days: 30 },
    { stmt: 'C1', desc: 'Run dignity and respect refresher for all care staff', pri: 'medium', days: 21 },
    { stmt: 'R4', desc: 'Update communication preference profiles after annual reviews', pri: 'medium', days: 60 },
    { stmt: 'W1', desc: 'Publish quarterly governance report to staff noticeboard', pri: 'low', days: 90 },
  ]
  for (const ca of cqcActions) {
    await insert(`INSERT INTO cqc_action_items (id,organization_id,staff_id,cqc_statement,description,status,priority,due_date,assigned_at,created_by,created_at) VALUES ($1,$2,$3,$4,$5,'open',$6,$7,$8,$9,$10)`,
      [uuid(), orgId, staff[0].profileId, ca.stmt, ca.desc, ca.pri, dateIn(ca.days), tsAgo(10), staff[0].userId, tsAgo(10)])
  }
  console.log('  ✓ 6 CQC action items created')

  // ── 47. Location certificates ──
  const certDefs = [
    { name: 'CQC Registration', type: 'registration', body: 'CQC', num: 'CQC-1-123456789' },
    { name: 'Fire Risk Assessment', type: 'fire_safety', body: 'London Fire Brigade', num: 'FRA-2025-01' },
    { name: 'Electrical Safety Certificate', type: 'compliance', body: 'NICEIC', num: 'EICR-2025-77' },
  ]
  for (let li = 0; li < 3; li++) {
    const cd = certDefs[li]
    await insert(`INSERT INTO location_certificates (id,location_id,name,certificate_type,issuing_body,certificate_number,issue_date,expiry_date,status,file_url,notes,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'valid','/files/private/certificate.pdf','Verified on issue','${tsAgo(300)}')`,
      [uuid(), locIds[li], cd.name, cd.type, cd.body, cd.num, dateAgo(300), dateIn(60)])
  }
  console.log('  ✓ 3 location certificates created')

  // ── 48. Mobile check-ins ──
  for (let i = 0; i < 6; i++) {
    await insert(`INSERT INTO mobile_check_ins (id,user_id,organization_id,latitude,longitude,accuracy,checked_in_at) VALUES ($1,$2,$3,$4,$5,12,$6)`,
      [uuid(), staff[2].userId, orgId, 51.5074 + Math.random() * 0.01, -0.1278 + Math.random() * 0.01, tsAgo(i * 2 + 1)])
  }
  console.log('  ✓ 6 mobile check-ins created')

  // ── 49. Chat ──
  const generalChannelId = uuid()
  const leadershipChannelId = uuid()
  const dmChannelId = uuid()
  await insert(`INSERT INTO chat_channels (id,organization_id,name,type,created_by,created_at) VALUES ($1,$2,'General','general',$3,$4)`, [generalChannelId, orgId, staff[0].userId, tsAgo(400)])
  await insert(`INSERT INTO chat_channels (id,organization_id,name,type,created_by,created_at) VALUES ($1,$2,'Leadership Team','group',$3,$4)`, [leadershipChannelId, orgId, staff[0].userId, tsAgo(300)])
  await insert(`INSERT INTO chat_channels (id,organization_id,name,type,created_by,created_at) VALUES ($1,$2,'Direct','dm',$3,$4)`, [dmChannelId, orgId, staff[0].userId, tsAgo(280)])
  for (const s of staff)
    await insert(`INSERT INTO chat_members (id,channel_id,user_id,joined_at,last_read_at) VALUES ($1,$2,$3,$4,$5)`, [uuid(), generalChannelId, s.userId, tsAgo(400), tsAgo(1)])
  for (let i = 0; i < 2; i++)
    await insert(`INSERT INTO chat_members (id,channel_id,user_id,joined_at,last_read_at) VALUES ($1,$2,$3,$4,$5)`, [uuid(), leadershipChannelId, staff[i].userId, tsAgo(300), tsAgo(1)])
  await insert(`INSERT INTO chat_members (id,channel_id,user_id,joined_at,last_read_at) VALUES ($1,$2,$3,$4,$5)`, [uuid(), dmChannelId, staff[0].userId, tsAgo(280), tsAgo(2)])
  await insert(`INSERT INTO chat_members (id,channel_id,user_id,joined_at,last_read_at) VALUES ($1,$2,$3,$4,$5)`, [uuid(), dmChannelId, staff[1].userId, tsAgo(280), tsAgo(2)])
  const generalMsgs: [string, number][] = [
    ['Good morning team, welcome to the day shift.', 5],
    ['Morning! Ready for a busy one.', 5],
    ['Reminder: fire drill tomorrow at 10am. Please check rota for your role.', 20],
    ['Thanks all — new care plan templates are live. Review by end of month.', 40],
    ['Can someone confirm the medication audit is booked for Thursday?', 60],
    ['Medication audit confirmed for Thursday 9am with Opeyemi.', 60],
    ['Great news — our latest satisfaction survey is at 4.6/5 overall!', 90],
    ['Well done everyone, that reflects the care you deliver every day.', 90],
    ['DBS renewals due for 2 staff — please check the compliance hub.', 120],
    ['Jane, can you cover the morning shift at Orbis House on Saturday?', 150],
    ['I can do that, no problem.', 150],
    ['New staff checklist updated — see policies folder for latest version.', 200],
    ['CQC readiness review scheduled for next Friday.', 220],
    ['Please complete your infection control e-learning by the end of the month.', 250],
    ['Thanks for the reminder — completing mine today.', 250],
    ['Safeguarding alert: please report any concerns immediately, no matter how small.', 300],
    ['Fire safety: new muster point maps are on the noticeboard.', 330],
    ['Wellbeing check-in: how is everyone doing this week?', 350],
    ['All good here, thank you for asking.', 350],
    ['Reminder: leave requests for summer need approval by next week.', 380],
    ['Enjoy the long weekend everyone!', 400],
  ]
  for (const [content, days] of generalMsgs) {
    await insert(`INSERT INTO chat_messages (id,channel_id,sender_id,content,created_at) VALUES ($1,$2,$3,$4,$5)`,
      [uuid(), generalChannelId, staff[Math.floor(Math.random() * 3)].userId, content, tsAgo(days)])
  }
  const leadershipMsgs: [string, number][] = [
    ['Monthly staffing report is ready — headcount up 1, turnover steady.', 15],
    ['Thanks Grace. Reviewing now, will circulate notes.', 15],
    ['Compliance snapshot improved to 89% this month.', 45],
    ['CQC inspection window opens next quarter — draft evidence pack ready.', 75],
    ['Budget review: agency spend within target this month.', 110],
    ['Safeguarding review complete. One recommendation for training.', 180],
    ['Noted. Adding to next training cycle.', 180],
    ['Incident this week at Willow Court — RCA complete, family informed.', 220],
    ['Appreciate the update. Let us discuss mitigations Monday.', 220],
    ['DSPT 2025/26 submission is 60% complete.', 280],
  ]
  for (const [content, days] of leadershipMsgs) {
    await insert(`INSERT INTO chat_messages (id,channel_id,sender_id,content,created_at) VALUES ($1,$2,$3,$4,$5)`,
      [uuid(), leadershipChannelId, staff[Math.floor(Math.random() * 2)].userId, content, tsAgo(days)])
  }
  const dmMsgs: [string, number][] = [
    ['Hi Opeyemi, could you review the new rota template before I roll it out?', 6],
    ['Of course — looks good, one tweak to the night shift overlap. Sent back.', 6],
    ['Thanks! Will update and share with the team.', 6],
    ['Reminder: Jane\'s supervision is due next week.', 30],
    ['Booked in for Thursday afternoon.', 30],
    ['Leave approvals are all caught up. Thanks for covering while I was away.', 90],
    ['Any time — happy to help.', 90],
  ]
  for (const [content, days] of dmMsgs) {
    await insert(`INSERT INTO chat_messages (id,channel_id,sender_id,content,created_at) VALUES ($1,$2,$3,$4,$5)`,
      [uuid(), dmChannelId, staff[Math.floor(Math.random() * 2)].userId, content, tsAgo(days)])
  }
  console.log('  ✓ chat: General + Leadership + DM with members and messages created')

  // ── 50. Invitations (all to real staff emails, already accepted) ──
  await insert(`INSERT INTO invitations (id,organization_id,email,role,token,status,expires_at,created_at,location_id) VALUES ($1,$2,$3,'ORG_ADMIN',$4,'accepted','${dateIn(-30)}',$5,$6)`,
    [uuid(), orgId, EMAIL_ADMIN2, uuid(), tsAgo(340), locIds[0]])
  await insert(`INSERT INTO invitations (id,organization_id,email,role,token,status,expires_at,created_at,location_id) VALUES ($1,$2,$3,'CARE_WORKER',$4,'accepted','${dateIn(-30)}',$5,$6)`,
    [uuid(), orgId, EMAIL_CARER, uuid(), tsAgo(320), locIds[0]])
  console.log('  ✓ 2 accepted invitations created')

  // ── 51. Invoices ──
  for (let i = 0; i < 6; i++) {
    await insert(`INSERT INTO invoices (id,organization_id,invoice_number,description,amount,currency,status,issued_at,due_at,paid_at,created_at) VALUES ($1,$2,concat('INV-2026-',${1000 + i}),'Monthly subscription — Professional plan',$3,'GBP','paid',$4,$5,$6,$7)`,
      [uuid(), orgId, 79900, dateAgo(i * 30 + 15), dateIn(-i * 30 + 15), tsAgo(i * 30 + 15), tsAgo(i * 30 + 15)])
  }
  console.log('  ✓ 6 paid invoices created')

  // ── 52. Person access log ──
  for (let i = 0; i < 20; i++) {
    const su = sus[i % sus.length]
    await insert(`INSERT INTO person_access_log (id,person_id,accessed_by,action,ip_address,created_at) VALUES ($1,$2,$3,$4,'185.71.76.${20 + Math.floor(Math.random() * 20)}',$5)`,
      [uuid(), su.id, staff[Math.floor(Math.random() * 3)].userId, Math.random() < 0.7 ? 'view' : 'update', tsAgo(Math.floor(Math.random() * 60))])
  }
  console.log('  ✓ 20 access log entries created')

  await client.query('COMMIT')
  await client.end()
  console.log('\n' + '='.repeat(56))
  console.log('✓ "Orbis Care Ltd" VPS SEEDED SUCCESSFULLY')
  console.log('='.repeat(56))
  console.log(`  Organization ID: ${orgId}`)
  console.log(`  Staff logins (password: Password123$):`)
  console.log(`    - ${EMAIL_ADMIN}   (ORG_ADMIN)`)
  console.log(`    - ${EMAIL_ADMIN2}   (ORG_ADMIN)`)
  console.log(`    - ${EMAIL_CARER}   (CARE_WORKER)`)
  console.log(`\n  ${staff.length} staff, ${sus.length} people`)
  console.log(`  ${trCount} training records, ${crCount} compliance records`)
  console.log(`  ${shiftCount} shifts across ${locations.length} locations`)
  console.log(`  ~${totalRows} rows inserted total\n`)
}

seed().catch(async e => {
  try {
    await client.query('ROLLBACK')
  } catch {}
  try {
    await client.end()
  } catch {}
  console.error('\nSeed failed (rolled back):', e)
  process.exit(1)
})
