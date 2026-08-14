// Comprehensive demo seed — creates a fresh org with a unique name each run
// Run: npx tsx src/scripts/seed-orbis.ts
// All staff login with: DemoPass123!

import pool from '../shared/database'
import { v4 as uuid } from 'uuid'
import bcrypt from 'bcryptjs'

const PWH = bcrypt.hashSync('DemoPass123!', 10)

// Bypass RLS for seeding: wrap pool.query so every query runs on a connection
// with the super-admin RLS session vars set (seed runs outside the request context).
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
  return __seedPoolQuery(text, params);
};

const ADJECTIVES = ['Apex', 'Bright', 'Clear', 'Crest', 'Crown', 'Fair', 'Golden', 'Grand', 'High', 'Ivy', 'Jade', 'Key', 'Lark', 'Maple', 'North', 'Oak', 'Pine', 'Quest', 'Ridge', 'Silver', 'Stone', 'Summit', 'Tide', 'True', 'Vale', 'West', 'Wise', 'Yew']
const NOUNS = ['Ascot', 'Bridge', 'Brook', 'Chase', 'Cliff', 'Dale', 'Downs', 'Edge', 'Elm', 'Field', 'Garth', 'Glen', 'Grange', 'Grove', 'Hall', 'Haven', 'Heath', 'Holme', 'Hurst', 'Knoll', 'Lea', 'Marsh', 'Meadow', 'Moor', 'Orchards', 'Park', 'Rise', 'Royd', 'Shaw', 'Spring', 'Thorn', 'Vale', 'Wade', 'Ward', 'Wood', 'Worth']

function randomOrgName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const num = Math.floor(Math.random() * 900) + 100
  return `Demo ${adj}${noun} ${num}`
}

type StaffRef = { id: string; userId: string; profileId: string; role: string; name: string[] }

async function seed() {
  const orgName = randomOrgName()
  const domain = `orbisgroup.care`

  console.log(`\n=== Seeding Demo Org: "${orgName}" ===\n`)

  // Clean previous seed data for this domain
  await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`%@${domain}`])
  console.log(`  Cleaned existing users @${domain}`)

  const orgId = uuid()
  const locIds = [uuid(), uuid(), uuid()]
  const deptIds = [uuid(), uuid(), uuid(), uuid()]
  const teamIds = [uuid(), uuid(), uuid(), uuid()]
  const leaveTypeIds = [uuid(), uuid(), uuid(), uuid()]

  // ── 1. Organization ──
  await pool.query(`INSERT INTO organizations (id,name,status,plan,regulator,primary_color,secondary_color,accent_color,minimum_compliance_percent,auto_approve_documents,trial_ends_at) VALUES ($1,$2,'active','professional','cqc','#0F4C81','#B8860B','#D4AF35',70,true,$3)`,
    [orgId, orgName, new Date(Date.now() + 90 * 86400000).toISOString()])
  console.log(`  ✓ "${orgName}" created`)

  // Platform super admin — org-agnostic so it survives org deletion
  await pool.query(`INSERT INTO users (id,organization_id,email,role,status,password_hash) VALUES ($1,NULL,$2,'SUPER_ADMIN','active',$3) ON CONFLICT DO NOTHING`,
    [uuid(), 'caredesk@reydesk.com', PWH])
  console.log('  ✓ Platform super admin ensured (caredesk@reydesk.com)')

  // ── 2. Locations ──
  const locations = [
    { id: locIds[0], name: 'Orbis House', address: '1-3 Victoria Road, London SW1A 1AA', minStaff: 4, minDay: 3, minNight: 1 },
    { id: locIds[1], name: 'Willow Court', address: '45 Willow Lane, Croydon CR0 2AB', minStaff: 3, minDay: 2, minNight: 1 },
    { id: locIds[2], name: 'Meadow View', address: '78 Meadow Road, Bromley BR1 3CD', minStaff: 2, minDay: 2, minNight: 0 },
  ]
  for (const l of locations)
    await pool.query(`INSERT INTO locations (id,organization_id,name,address,minimum_staff_per_day,min_day_staff,min_night_staff) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [l.id, orgId, l.name, l.address, l.minStaff, l.minDay, l.minNight])
  console.log('  ✓ 3 locations created')

  // ── 3. Departments ──
  const depts = [
    { id: deptIds[0], name: 'Clinical Services', lid: locIds[0] },
    { id: deptIds[1], name: 'Residential Care', lid: locIds[1] },
    { id: deptIds[2], name: 'Domiciliary Support', lid: locIds[2] },
    { id: deptIds[3], name: 'Administration', lid: locIds[0] },
  ]
  for (const d of depts)
    await pool.query(`INSERT INTO departments (id,location_id,name) VALUES ($1,$2,$3)`, [d.id, d.lid, d.name])
  console.log('  ✓ 4 departments created')

  // ── 4. Teams ──
  const teams = [
    { id: teamIds[0], name: 'Morning Care Team', desc: 'Early shift care support' },
    { id: teamIds[1], name: 'Night Care Team', desc: 'Night shift care support' },
    { id: teamIds[2], name: 'Activities Team', desc: 'Social and activities coordination' },
    { id: teamIds[3], name: 'Clinical Team', desc: 'Nursing and clinical oversight' },
  ]
  for (const t of teams)
    await pool.query(`INSERT INTO teams (id,organization_id,name,description) VALUES ($1,$2,$3,$4)`, [t.id, orgId, t.name, t.desc])
  console.log('  ✓ 4 teams created')

  // ── 5. Staff (22) ──
  const staffData: { first: string; last: string; role: string; locIdx: number; deptIdx: number; teamIdx: number }[] = [
    { first: 'James', last: 'Mercer', role: 'ORG_ADMIN', locIdx: 0, deptIdx: 3, teamIdx: 0 },
    { first: 'Sarah', last: 'Chen', role: 'MANAGER', locIdx: 0, deptIdx: 0, teamIdx: 3 },
    { first: 'Michael', last: 'Okonkwo', role: 'MANAGER', locIdx: 1, deptIdx: 1, teamIdx: 1 },
    { first: 'Emily', last: 'Thornton', role: 'MANAGER', locIdx: 2, deptIdx: 2, teamIdx: 2 },
    { first: 'David', last: 'Patel', role: 'CARE_WORKER', locIdx: 0, deptIdx: 0, teamIdx: 0 },
    { first: 'Rebecca', last: 'Jones', role: 'CARE_WORKER', locIdx: 0, deptIdx: 0, teamIdx: 0 },
    { first: 'Daniel', last: 'Khan', role: 'CARE_WORKER', locIdx: 0, deptIdx: 0, teamIdx: 3 },
    { first: 'Laura', last: 'Bennett', role: 'CARE_WORKER', locIdx: 0, deptIdx: 0, teamIdx: 0 },
    { first: 'Thomas', last: 'O\'Brien', role: 'CARE_WORKER', locIdx: 1, deptIdx: 1, teamIdx: 1 },
    { first: 'Hannah', last: 'Wilson', role: 'CARE_WORKER', locIdx: 1, deptIdx: 1, teamIdx: 1 },
    { first: 'Christopher', last: 'Davies', role: 'CARE_WORKER', locIdx: 1, deptIdx: 1, teamIdx: 2 },
    { first: 'Olivia', last: 'Taylor', role: 'CARE_WORKER', locIdx: 2, deptIdx: 2, teamIdx: 2 },
    { first: 'Ryan', last: 'Clarke', role: 'CARE_WORKER', locIdx: 2, deptIdx: 2, teamIdx: 0 },
    { first: 'Sophie', last: 'Baker', role: 'CARE_WORKER', locIdx: 0, deptIdx: 0, teamIdx: 3 },
    { first: 'Jack', last: 'Harrison', role: 'CARE_WORKER', locIdx: 0, deptIdx: 0, teamIdx: 0 },
    { first: 'Mia', last: 'Roberts', role: 'CARE_WORKER', locIdx: 1, deptIdx: 1, teamIdx: 1 },
    { first: 'William', last: 'Phillips', role: 'CARE_WORKER', locIdx: 1, deptIdx: 1, teamIdx: 2 },
    { first: 'Isabella', last: 'Campbell', role: 'CARE_WORKER', locIdx: 2, deptIdx: 2, teamIdx: 2 },
    { first: 'George', last: 'Mitchell', role: 'CARE_WORKER', locIdx: 2, deptIdx: 2, teamIdx: 0 },
    { first: 'Amelia', last: 'Morgan', role: 'CARE_WORKER', locIdx: 0, deptIdx: 3, teamIdx: 0 },
    { first: 'Lucas', last: 'Cooper', role: 'CARE_WORKER', locIdx: 0, deptIdx: 0, teamIdx: 3 },
    { first: 'Charlotte', last: 'Reed', role: 'CARE_WORKER', locIdx: 1, deptIdx: 1, teamIdx: 1 },
  ]
  const staff: StaffRef[] = []
  for (let idx = 0; idx < staffData.length; idx++) {
    const s = staffData[idx]
    const uid = uuid(), spId = uuid()
    const email = `${s.first.toLowerCase()}.${s.last.toLowerCase()}@${domain}`
    await pool.query(`INSERT INTO users (id,organization_id,email,role,status,password_hash) VALUES ($1,$2,$3,$4,'active',$5)`,
      [uid, orgId, email, s.role, PWH])
    await pool.query(`INSERT INTO staff_profiles (id,user_id,first_name,last_name,location_id) VALUES ($1,$2,$3,$4,$5)`,
      [spId, uid, s.first, s.last, locIds[s.locIdx]])
    await pool.query(`INSERT INTO team_members (team_id,user_id) VALUES ($1,$2)`, [teamIds[s.teamIdx], uid])
    staff.push({ id: spId, userId: uid, profileId: spId, role: s.role, name: [s.first, s.last] })
  }
  // Add James to admin team
  await pool.query(`INSERT INTO team_members (team_id,user_id) VALUES ($1,$2)`, [teamIds[3], staff[0].userId])
  console.log('  ✓ 22 staff created')

  // ── 6. Leave Types ──
  const leaveTypes = [
    { id: leaveTypeIds[0], name: 'Annual Leave', color: '#0F4C81', days: 28, dur: 'days' },
    { id: leaveTypeIds[1], name: 'Sick Leave', color: '#DC2626', days: 10, dur: 'days' },
    { id: leaveTypeIds[2], name: 'Training Leave', color: '#16A34A', days: 5, dur: 'days' },
    { id: leaveTypeIds[3], name: 'Compassionate Leave', color: '#D97706', days: 5, dur: 'days' },
  ]
  for (const lt of leaveTypes)
    await pool.query(`INSERT INTO leave_types (id,organization_id,name,color,days_allowed,duration_type) VALUES ($1,$2,$3,$4,$5,$6)`,
      [lt.id, orgId, lt.name, lt.color, lt.days, lt.dur])

  // Set leave balances for everyone
  for (const s of staff) {
    for (const ltId of leaveTypeIds) {
      await pool.query(`INSERT INTO leave_balances (staff_id,leave_type_id,year,days_allocated,hours_allocated) VALUES ($1,$2,2026,28,224) ON CONFLICT DO NOTHING`, [s.profileId, ltId])
    }
  }
  console.log('  ✓ Leave types & balances created')

  // ── 7. People (18) ──
  const suData = [
    { first: 'Arthur', last: 'Clarke', room: '101', nhs: 'A12345678', allergies: 'Penicillin', dob: '1942-03-15', gender: 'Male', religion: 'Catholic', funding: 'la_funded', flags: ['falls_risk', 'dnr'], support: 'two_to_one', locIdx: 0, diet: 'Soft diet only', gp: 'Dr Patel', gpSurg: 'Victoria Road Surgery', gpPhone: '020 7946 0101' },
    { first: 'Margaret', last: 'Silva', room: '102', nhs: 'A23456789', allergies: '', dob: '1938-07-22', gender: 'Female', religion: 'Church of England', funding: 'self_funded', flags: ['mca_dols', 'behaviour'], support: 'one_to_one', locIdx: 0, diet: 'Diabetic', gp: 'Dr Evans', gpSurg: 'Victoria Road Surgery', gpPhone: '020 7946 0101' },
    { first: 'George', last: 'Okonkwo', room: '103', nhs: 'A34567890', allergies: 'Latex', dob: '1955-11-08', gender: 'Male', religion: 'Muslim', funding: 'ccg', flags: ['diabetic'], support: 'minimal', locIdx: 0, diet: 'Halal', gp: 'Dr Khan', gpSurg: 'Brixton Health Centre', gpPhone: '020 7946 0202' },
    { first: 'Florence', last: 'Nightingale', room: '104', nhs: 'A45678901', allergies: 'Aspirin, Penicillin', dob: '1940-05-12', gender: 'Female', religion: 'Church of England', funding: 'nhs_chc', flags: ['falls_risk', 'choking'], support: 'two_to_one', locIdx: 0, diet: 'Modified texture', gp: 'Dr Miller', gpSurg: 'Brixton Health Centre', gpPhone: '020 7946 0202' },
    { first: 'Winston', last: 'Churchill', room: '105', nhs: 'A56789012', allergies: '', dob: '1930-11-30', gender: 'Male', religion: 'Anglican', funding: 'self_funded', flags: ['dnr'], support: 'one_to_one', locIdx: 0, diet: 'Low sodium', gp: 'Dr Adams', gpSurg: 'Central London Practice', gpPhone: '020 7946 0303' },
    { first: 'Agatha', last: 'Christie', room: '201', nhs: 'A67890123', allergies: 'Peanuts', dob: '1945-09-15', gender: 'Female', religion: 'Catholic', funding: 'mixed', flags: [], support: 'minimal', locIdx: 1, diet: 'Regular', gp: 'Dr Brown', gpSurg: 'Willow Lane Medical', gpPhone: '020 8645 0101' },
    { first: 'Alan', last: 'Turing', room: '202', nhs: 'A78901234', allergies: '', dob: '1950-06-23', gender: 'Male', religion: 'Atheist', funding: 'self_funded', flags: ['behaviour'], support: 'one_to_one', locIdx: 1, diet: 'Regular', gp: 'Dr Green', gpSurg: 'Willow Lane Medical', gpPhone: '020 8645 0101' },
    { first: 'Isaac', last: 'Newton', room: '203', nhs: 'A89012345', allergies: 'Sulfa', dob: '1943-01-04', gender: 'Male', religion: 'Anglican', funding: 'la_funded', flags: ['falls_risk'], support: 'minimal', locIdx: 1, diet: 'Fortified', gp: 'Dr White', gpSurg: 'Croydon University Hospital', gpPhone: '020 8645 0202' },
    { first: 'Charles', last: 'Darwin', room: '204', nhs: 'A90123456', allergies: '', dob: '1939-02-12', gender: 'Male', religion: 'Agnostic', funding: 'ccg', flags: ['epilepsy'], support: 'two_to_one', locIdx: 1, diet: 'Gluten free', gp: 'Dr Black', gpSurg: 'Croydon Health Centre', gpPhone: '020 8645 0303' },
    { first: 'Jane', last: 'Austen', room: '301', nhs: 'A01234567', allergies: 'Penicillin, Peanuts', dob: '1947-12-16', gender: 'Female', religion: 'Catholic', funding: 'self_funded', flags: [], support: 'independent', locIdx: 2, diet: 'Regular', gp: 'Dr Scott', gpSurg: 'Bromley Medical Centre', gpPhone: '020 8466 0101' },
    { first: 'William', last: 'Shakespeare', room: '302', nhs: 'A12345679', allergies: '', dob: '1936-04-23', gender: 'Male', religion: 'Anglican', funding: 'la_funded', flags: ['mca_dols'], support: 'one_to_one', locIdx: 2, diet: 'Soft diet', gp: 'Dr King', gpSurg: 'Bromley Medical Centre', gpPhone: '020 8466 0101' },
    { first: 'Mary', last: 'Seacole', room: '303', nhs: 'A23456780', allergies: 'Latex, Aspirin', dob: '1941-05-15', gender: 'Female', religion: 'Catholic', funding: 'nhs_chc', flags: ['diabetic', 'choking'], support: 'two_to_one', locIdx: 2, diet: 'Diabetic, soft', gp: 'Dr Lewis', gpSurg: 'Bromley Community Health', gpPhone: '020 8466 0202' },
    { first: 'Rosa', last: 'Parks', room: '106', nhs: 'A34567891', allergies: '', dob: '1948-02-04', gender: 'Female', religion: 'Methodist', funding: 'la_funded', flags: ['falls_risk'], support: 'minimal', locIdx: 0, diet: 'Regular', gp: 'Dr Patel', gpSurg: 'Victoria Road Surgery', gpPhone: '020 7946 0101' },
    { first: 'Frederick', last: 'Douglass', room: '205', nhs: 'A45678902', allergies: 'Codeine', dob: '1944-07-14', gender: 'Male', religion: 'Christian', funding: 'ccg', flags: [], support: 'minimal', locIdx: 1, diet: 'Regular', gp: 'Dr Brown', gpSurg: 'Willow Lane Medical', gpPhone: '020 8645 0101' },
    { first: 'Emmeline', last: 'Pankhurst', room: '107', nhs: 'A56789013', allergies: '', dob: '1946-10-11', gender: 'Female', religion: 'Atheist', funding: 'self_funded', flags: ['mca_dols', 'behaviour'], support: 'one_to_one', locIdx: 0, diet: 'Regular', gp: 'Dr Adams', gpSurg: 'Central London Practice', gpPhone: '020 7946 0303' },
    { first: 'Nelson', last: 'Mandela', room: '206', nhs: 'A67890124', allergies: 'Penicillin', dob: '1937-06-18', gender: 'Male', religion: 'Christian', funding: 'nhs_chc', flags: ['dnr', 'falls_risk'], support: 'two_to_one', locIdx: 1, diet: 'Soft, fortified', gp: 'Dr Black', gpSurg: 'Croydon Health Centre', gpPhone: '020 8645 0303' },
    { first: 'Marie', last: 'Curie', room: '304', nhs: 'A78901235', allergies: '', dob: '1949-11-07', gender: 'Female', religion: 'Agnostic', funding: 'la_funded', flags: ['epilepsy'], support: 'minimal', locIdx: 2, diet: 'Regular', gp: 'Dr Scott', gpSurg: 'Bromley Medical Centre', gpPhone: '020 8466 0101' },
    { first: 'Albert', last: 'Einstein', room: '108', nhs: 'A89012346', allergies: 'Sulfa, Penicillin', dob: '1935-03-14', gender: 'Male', religion: 'Jewish', funding: 'self_funded', flags: ['choking'], support: 'complex', locIdx: 0, diet: 'Liquidised', gp: 'Dr Khan', gpSurg: 'Brixton Health Centre', gpPhone: '020 7946 0202' },
  ]
  const sus: any[] = []
  for (const su of suData) {
    const id = uuid()
    const minStaff = su.support === 'one_to_one' ? 1 : su.support === 'two_to_one' ? 2 : su.support === 'three_to_one' ? 3 : su.support === 'complex' ? 2 : null
    await pool.query(`INSERT INTO people (id,organization_id,first_name,last_name,date_of_birth,nhs_number,room_number,gender,religion,funding_type,flags,allergies,dietary_requirements,gp_name,gp_surgery,gp_phone,status,support_level,location_id,min_staff_required) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [id, orgId, su.first, su.last, su.dob, su.nhs, su.room, su.gender, su.religion, su.funding, JSON.stringify(su.flags), JSON.stringify(su.allergies.split(', ').filter(Boolean)), su.diet, su.gp, su.gpSurg, su.gpPhone, 'active', su.support, locIds[su.locIdx], minStaff])
    sus.push({ id, name: `${su.first} ${su.last}`, room: su.room, locIdx: su.locIdx, allergies: su.allergies, diet: su.diet })
  }
  console.log('  ✓ 18 people created')

  // ── 8. Care Plans (36) ──
  const planCats = ['personal_care', 'medication', 'mobility', 'nutrition', 'mental_health', 'behaviour', 'skin_care', 'communication']
  for (const su of sus) {
    const cats = [...planCats].sort(() => Math.random() - 0.5).slice(0, 2)
    for (const cat of cats) {
      const cid = uuid()
      await pool.query(`INSERT INTO care_plans (id,person_id,title,category,description,risk_assessment,review_date,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [cid, su.id, `${cat.replace(/_/g, ' ')} support plan`, cat,
         `Individualised plan for ${su.name}. Focus on maintaining independence and wellbeing. Reviewed monthly with family involvement.`,
         'Low risk with regular monitoring. Family aware of plan.',
         new Date(Date.now() + Math.floor(60 + Math.random() * 120) * 86400000).toISOString().split('T')[0],
         Math.random() < 0.15 ? 'archived' : 'active'])
    }
  }
  console.log('  ✓ 36 care plans created')

  // ── 9. Daily Notes (90) ──
  const noteCats = ['wellbeing', 'nutrition', 'hydration', 'mobility', 'mood', 'medication', 'personal_care']
  const shifts = ['day', 'night']
  const supportLevels = ['independent', 'minimal', 'one_to_one', 'two_to_one', 'three_to_one', 'complex']
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
  for (let i = 0; i < 90; i++) {
    const su = sus[Math.floor(Math.random() * sus.length)]
    const daysAgo = Math.floor(Math.random() * 30)
    await pool.query(`INSERT INTO daily_notes (id,person_id,author_id,note_date,shift,category,content,support_level) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [uuid(), su.id, staff[Math.floor(Math.random() * staff.length)].userId,
       new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0],
       shifts[Math.floor(Math.random() * shifts.length)],
       noteCats[Math.floor(Math.random() * noteCats.length)],
       noteTemplates[Math.floor(Math.random() * noteTemplates.length)],
       supportLevels[Math.floor(Math.random() * supportLevels.length)]])
  }
  console.log('  ✓ 90 daily notes created')

  // ── 10. Risk Assessments (36) ──
  const riskTypes = ['falls', 'pressure_sore', 'nutrition', 'behaviour', 'mobility', 'medication', 'choking', 'skin_integrity']
  const riskLevels = ['low', 'medium', 'high', 'critical']
  for (const su of sus) {
    const n = 1 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) {
      const type = riskTypes[Math.floor(Math.random() * riskTypes.length)]
      const level = riskLevels[Math.floor(Math.random() * (type === 'falls' ? 3 : 2))]
      await pool.query(`INSERT INTO risk_assessments (id,person_id,type,risk_level,details,mitigation_actions,review_date) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [uuid(), su.id, type, level,
         `${type.replace(/_/g, ' ')} assessment completed. ${level === 'high' ? 'Requires immediate attention.' : 'Monitor on regular basis.'}`,
         level === 'high' ? 'Daily monitoring, family informed, equipment in place.' : 'Weekly review, staff awareness.',
         new Date(Date.now() + Math.floor(30 + Math.random() * 90) * 86400000).toISOString().split('T')[0]])
    }
  }
  console.log('  ✓ 36 risk assessments created')

  // ── 11. Family Contacts (36) ──
  const relationships = ['Daughter', 'Son', 'Spouse', 'Niece', 'Nephew', 'Grandchild', 'Sibling', 'Friend']
  for (const su of sus) {
    const n = 1 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) {
      const rel = relationships[Math.floor(Math.random() * relationships.length)]
      await pool.query(`INSERT INTO family_contacts (id,person_id,name,relationship,phone,email,is_emergency_contact) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [uuid(), su.id,
         `${['Anne', 'John', 'Mary', 'Peter', 'Susan', 'Robert', 'Catherine', 'Paul'][Math.floor(Math.random() * 8)]} ${su.name.split(' ')[1]}`,
         rel, `07${Math.floor(100000000 + Math.random() * 899999999)}`,
         `${rel.toLowerCase()}.${su.name.split(' ')[1].toLowerCase()}@email.com`,
         i === 0])
    }
  }
  console.log('  ✓ 36 family contacts created')

  // ── 12. Training Modules (12 CQC-aligned) ──
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
    await pool.query(`INSERT INTO training_modules (id,organization_id,name,category,frequency_days,is_mandatory,cqc_mandated,cqc_mandated_for_roles) VALUES ($1,$2,$3,$4,$5,true,true,$6)`,
      [id, orgId, m.name, m.cat, m.freq, JSON.stringify(m.roles)])
    modIds.push(id)
  }
  console.log('  ✓ 12 training modules created')

  // ── 13. Training Records (180+) ──
  let trCount = 0
  for (const s of staff) {
    for (const mid of modIds) {
      if (Math.random() < 0.22) continue
      const daysAgo = Math.floor(Math.random() * 365)
      const completedAt = new Date(Date.now() - daysAgo * 86400000)
      const expiresAt = new Date(completedAt.getTime() + 365 * 86400000)
      const expired = Math.random() < 0.12
      const status = expired ? 'expired' : Math.random() < 0.06 ? 'incomplete' : 'completed'
      await pool.query(`INSERT INTO training_records (module_id,staff_id,completed_at,expires_at,status) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [mid, s.profileId,
         status === 'completed' ? completedAt.toISOString() : null,
         expired ? new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString() : expiresAt.toISOString(),
         status])
      trCount++
    }
  }
  console.log(`  ✓ ${trCount} training records created`)

  // ── 14. Identity Documents (44) ──
  for (const s of staff) {
    const types = ['DBS', 'PASSPORT', 'RIGHT_TO_WORK']
    for (const type of types) {
      const expired = Math.random() < 0.15
      await pool.query(`INSERT INTO documents (staff_id,type,url,expiry_date,status) VALUES ($1,$2,'/files/private/orbis-doc.pdf',$3,$4)`,
        [s.profileId, type,
         new Date(Date.now() + (expired ? -Math.floor(Math.random() * 60) : Math.floor(Math.random() * 365)) * 86400000).toISOString().split('T')[0],
         expired ? 'expired' : 'approved'])
    }
  }
  console.log('  ✓ 66 identity documents created')

  // ── 15. Compliance Config & Requirements ──
  const reqNames = [
    'DBS Check', 'Safeguarding Training', 'Manual Handling', 'Medication Competency',
    'First Aid Certificate', 'Infection Control', 'Fire Safety', 'MCA & DoLS',
    'GDPR Training', 'Food Hygiene', 'Professional Registration', 'Health Assessment',
  ]
  const reqIds: string[] = []
  for (const rn of reqNames) {
    const id = uuid()
    await pool.query(`INSERT INTO compliance_config (id,organization_id,name,description,days_warning,days_overdue,is_mandatory) VALUES ($1,$2,$3,$4,30,0,true)`,
      [id, orgId, rn, `${rn} compliance requirement for all care staff`,])
    reqIds.push(id)
  }

  // Compliance requirements
  for (const rn of reqNames) {
    await pool.query(`INSERT INTO compliance_requirements (id,organization_id,name,description,is_mandatory) VALUES ($1,$2,$3,$4,true)`,
      [uuid(), orgId, rn, `${rn} - required for all staff`,])
  }
  console.log('  ✓ Compliance config & requirements created')

  // ── 16. Compliance Records (all staff ~82% complete) ──
  let crCount = 0
  for (const s of staff) {
    for (const rid of reqIds) {
      if (Math.random() < 0.18) continue
      await pool.query(`INSERT INTO compliance_records (staff_id,requirement_id,status) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [s.profileId, rid, Math.random() < 0.12 ? 'incomplete' : 'complete'])
      crCount++
    }
  }
  console.log(`  ✓ ${crCount} compliance records created`)

  // ── 17. Incidents (12) ──
  const incidents = [
    { title: 'Fall in bathroom — minor bruising', sev: 'medium', status: 'resolved', days: 45, su: 0 },
    { title: 'Medication error — wrong dose administered', sev: 'high', status: 'investigating', days: 3, su: 2 },
    { title: 'Altercation in communal area', sev: 'low', status: 'resolved', days: 20, su: 1 },
    { title: 'Pressure sore discovered on sacrum', sev: 'medium', status: 'reported', days: 7, su: 3 },
    { title: 'Slip in corridor — no injury', sev: 'low', status: 'resolved', days: 60, su: 5 },
    { title: 'Aggressive behaviour towards staff', sev: 'high', status: 'investigating', days: 5, su: 14 },
    { title: 'Medication refusal', sev: 'medium', status: 'resolved', days: 12, su: 8 },
    { title: 'Person reported missing — found in garden', sev: 'critical', status: 'closed', days: 30, su: 10 },
    { title: 'Choking incident at mealtime', sev: 'high', status: 'closed', days: 80, su: 17 },
    { title: 'Scald from hot drink', sev: 'medium', status: 'resolved', days: 15, su: 3 },
    { title: 'Unauthorised visitor on premises', sev: 'low', status: 'resolved', days: 90, su: 0 },
    { title: 'Concussion following fall', sev: 'high', status: 'reported', days: 2, su: 4 },
  ]
  for (const inc of incidents) {
    await pool.query(`INSERT INTO incidents (id,organization_id,title,severity,status,incident_date,location,reported_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [uuid(), orgId, inc.title, inc.sev, inc.status,
       new Date(Date.now() - inc.days * 86400000).toISOString().split('T')[0],
       ['Orbis House', 'Willow Court', 'Meadow View'][Math.floor(Math.random() * 3)],
       staff[Math.floor(Math.random() * staff.length)].userId])
  }
  console.log('  ✓ 12 incidents created')

  // ── 18. Competency Templates (6) ──
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
    await pool.query(`INSERT INTO competency_templates (id,organization_id,name,category,description,requires_reassessment_days) VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, orgId, ct.name, 'clinical', `${ct.name} competency assessment template`, 365])
    compTemplateIds.push(id)
  }
  console.log('  ✓ 6 competency templates created')

  // ── 19. Competency Assessments (60) ──
  for (const s of staff) {
    if (s.role === 'ORG_ADMIN') continue
    const n = 1 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) {
      const ctId = compTemplateIds[Math.floor(Math.random() * compTemplateIds.length)]
      const passed = Math.random() < 0.85
      await pool.query(`INSERT INTO competency_assessments (id,template_id,staff_id,assessor_id,assessed_at,passed,notes) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
        [uuid(), ctId, s.profileId, staff[0].userId,
         new Date(Date.now() - Math.floor(Math.random() * 90) * 86400000).toISOString().split('T')[0],
         passed,
         passed ? 'Demonstrated good knowledge and practice.' : 'Requires additional training and reassessment.'])
    }
  }
  console.log('  ✓ 60 competency assessments created')

  // ── 20. Policies (12 standard) ──
  const policyCats = ['Safeguarding', 'Health & Safety', 'HR', 'Clinical', 'Data Protection']
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
    await pool.query(`INSERT INTO policies (id,organization_id,title,category,content,version) VALUES ($1,$2,$3,$4,$5,'1.0')`,
      [uuid(), orgId, p.title, p.cat,
       `# ${p.title}\n\nThis policy outlines the approach of Orbis Group Ltd to ${p.title.toLowerCase()}.\n\n## Purpose\nTo ensure compliance with CQC regulations and promote best practice.\n\n## Scope\nThis policy applies to all staff, contractors, and volunteers.\n\n## Responsibilities\n- **ORG_ADMIN**: Overall accountability\n- **MANAGER**: Implementation and monitoring\n- **CARE_WORKER**: Compliance with policy requirements\n\n## Review\nThis policy will be reviewed annually or following any significant incident.`,
       ])
  }
  console.log('  ✓ 12 standard policies created')

  // ── 21. Appointments (16) ──
  const appointmentTypes = [
    'GP Appointment', 'Dentist Checkup', 'Physiotherapy', 'Optician Appointment',
    'Podiatry', 'Audiology', 'Chiropody', 'Counselling Session',
  ]
  for (let i = 0; i < 16; i++) {
    const su = sus[i % sus.length]
    const daysOffset = Math.floor((i - 8) * 3)
    await pool.query(`INSERT INTO appointments (id,organization_id,person_id,title,start_time,end_time,status,location_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [uuid(), orgId, su.id, appointmentTypes[i % appointmentTypes.length],
       new Date(Date.now() + daysOffset * 86400000 + 9 * 3600000 + Math.floor(Math.random() * 4) * 3600000).toISOString(),
       new Date(Date.now() + daysOffset * 86400000 + 10 * 3600000 + Math.floor(Math.random() * 4) * 3600000).toISOString(),
        daysOffset < 0 ? 'completed' : daysOffset === 0 ? 'scheduled' : 'scheduled',
       locIds[su.locIdx]])
  }
  console.log('  ✓ 16 appointments created')

  // ── 22. Goals (24) ──
  const goalTemplates = [
    'Increase mobility to 50m walking daily', 'Improve nutrition intake to 80% of meals',
    'Social engagement — attend 3 group activities weekly', 'Personal hygiene independence',
    'Medication adherence without prompting', 'Reduce falls risk through exercises',
    'Improve fluid intake to 1.5L daily', 'Build confidence in communal areas',
  ]
  for (let i = 0; i < 24; i++) {
    const su = sus[i % sus.length]
    const progress = Math.min(100, Math.floor(Math.random() * 120))
    const g = goalTemplates[i % goalTemplates.length]
    await pool.query(`INSERT INTO person_goals (id,organization_id,person_id,title,description,status,progress,target_date,cqc_domain) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [uuid(), orgId, su.id, g,
       `Working towards: ${g.toLowerCase()}. Reviewed fortnightly with key worker.`,
       progress >= 100 ? 'completed' : 'active', Math.min(progress, 100),
       new Date(Date.now() + (progress >= 100 ? -10 : 45) * 86400000).toISOString().split('T')[0],
       ['safe', 'effective', 'caring', 'responsive', 'well-led'][i % 5]])
  }
  console.log('  ✓ 24 goals created')

  // ── 23. Room Checks (24) ──
  const roomNumbers = ['101', '102', '103', '104', '105', '106', '107', '108', '201', '202', '203', '204', '205', '206', '301', '302', '303', '304']
  for (let i = 0; i < 24; i++) {
    const pass = Math.random() < 0.8
    await pool.query(`INSERT INTO room_checks (id,organization_id,location_id,room_number,checked_by,check_date,status,cleanliness_rating,safety_rating,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [uuid(), orgId, locIds[Math.floor(i / 8) % 3], roomNumbers[i % roomNumbers.length],
       staff[Math.floor(Math.random() * staff.length)].profileId,
       new Date(Date.now() - Math.floor(Math.random() * 14) * 86400000).toISOString().split('T')[0],
       pass ? 'pass' : Math.random() < 0.5 ? 'needs_attention' : 'fail',
       pass ? 4 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 2),
       pass ? 5 : 2 + Math.floor(Math.random() * 2),
       pass ? '' : 'Minor maintenance required — reported to facilities team'])
  }
  console.log('  ✓ 24 room checks created')

  // ── 24. Tasks (16) ──
  const taskData = [
    { title: 'Review all care plans for Q1', pri: 'high', days: -5, status: 'completed', su: true },
    { title: 'Order medication supplies', pri: 'high', days: 0, status: 'in_progress', su: false },
    { title: 'Fire safety check — all floors', pri: 'low', days: -2, status: 'completed', su: false },
    { title: 'Update risk assessments after incident', pri: 'high', days: 3, status: 'pending', su: true },
    { title: 'Staff supervision — David Patel', pri: 'medium', days: 7, status: 'pending', su: false },
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
  ]
  for (const td of taskData) {
    await pool.query(`INSERT INTO tasks (id,organization_id,title,assigned_to,person_id,priority,status,due_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [uuid(), orgId, td.title,
       staff[Math.floor(Math.random() * staff.length)].profileId,
       td.su ? sus[Math.floor(Math.random() * sus.length)].id : null,
       td.pri, td.status,
       new Date(Date.now() + td.days * 86400000).toISOString().split('T')[0]])
  }
  console.log('  ✓ 16 tasks created')

  // ── 25. Leave Requests (16) ──
  const leaveStatuses = ['approved', 'approved', 'pending', 'rejected', 'approved', 'approved', 'pending', 'approved', 'approved', 'pending', 'approved', 'approved', 'pending', 'approved', 'rejected', 'approved']
  for (let i = 0; i < 16; i++) {
    const s = staff[i % staff.length]
    const lt = leaveTypeIds[i % leaveTypeIds.length]
    const start = new Date(Date.now() + (i < 8 ? -30 : 7 + Math.floor(Math.random() * 30)) * 86400000)
    const end = new Date(start.getTime() + (1 + Math.floor(Math.random() * 3)) * 86400000)
    const reviewedBy = leaveStatuses[i] !== 'pending' ? staff[0].userId : null
    await pool.query(`INSERT INTO leave_requests (id,staff_id,leave_type_id,start_date,end_date,reason,status,reviewed_by,reviewed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [uuid(), s.profileId, lt, start.toISOString().split('T')[0], end.toISOString().split('T')[0],
       ['Family holiday', 'Medical appointment', 'Personal reasons', 'Study leave'][Math.floor(Math.random() * 4)],
       leaveStatuses[i], reviewedBy, reviewedBy ? new Date().toISOString() : null])
  }
  console.log('  ✓ 16 leave requests created')

  // ── 26. Shifts (4 weeks of shifts) ──
  const shiftTypes = ['day', 'day', 'wake_night']
  let shiftCount = 0
  for (let d = -7; d < 21; d++) {
    const date = new Date(Date.now() + d * 86400000)
    for (const locId of locIds) {
      const nShifts = locId === locIds[0] ? 3 : locId === locIds[1] ? 2 : 1
      for (let s = 0; s < nShifts; s++) {
        const shId = uuid()
        const st = shiftTypes[s % shiftTypes.length]
        const hour = st === 'day' ? 7 + (s * 6) : 19
        const endHour = st === 'day' ? hour + 12 : 7
        const startTime = new Date(date); startTime.setHours(hour, 0, 0, 0)
        const endTime = new Date(date); endTime.setHours(endHour, 0, 0, 0)
        if (endHour < hour) endTime.setDate(endTime.getDate() + 1)
        const assigned = d >= 0 ? Math.random() < 0.8 : true
        await pool.query(`INSERT INTO shifts (id,location_id,start_time,end_time,shift_type,status) VALUES ($1,$2,$3,$4,$5,$6)`,
          [shId, locId, startTime.toISOString(), endTime.toISOString(), st, assigned ? 'assigned' : 'open'])
        if (assigned) {
          const cands = staff.filter(s2 => s2.role === 'CARE_WORKER' || s2.role === 'MANAGER')
          await pool.query(`INSERT INTO shift_assignments (shift_id,staff_id,status) VALUES ($1,$2,'assigned')`,
            [shId, cands[Math.floor(Math.random() * cands.length)].profileId])
        }
        shiftCount++
      }
    }
  }
  console.log(`  ✓ ${shiftCount} shifts created`)

  // ── 27. Memory Book (30 entries) ──
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
    const su = sus[Math.floor(Math.random() * sus.length)]
    const imgUrl = memoryImgs[Math.floor(Math.random() * memoryImgs.length)]
    await pool.query(`INSERT INTO memory_book_entries (id,person_id,title,description,image_url,image_urls,recorded_date,created_by,support_level) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [uuid(), su.id, md.title, md.desc, imgUrl,
       imgUrl ? JSON.stringify([imgUrl]) : '[]',
       new Date(Date.now() - md.days * 86400000).toISOString().split('T')[0],
       staff[Math.floor(Math.random() * staff.length)].userId,
       ['independent', 'minimal', 'one_to_one', 'two_to_one'][Math.floor(Math.random() * 4)]])
  }
  console.log('  ✓ 30 memory book entries created')

  // ── 28. Satisfaction Surveys (12) ──
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
      await pool.query(`INSERT INTO satisfaction_surveys (id,organization_id,person_id,respondent_name,relationship,rating,comments) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [uuid(), orgId, sus[i % sus.length].id,
         `Family Member of ${sus[i % sus.length].name.split(' ')[0]}`,
         relationships2[i % relationships2.length],
         [2, 3, 4, 4, 5, 3, 5, 4, 5, 4, 5, 3][i],
         surveyComments[i]])
  }
  console.log('  ✓ 12 satisfaction surveys created')

  // ── 29. Care Assessments (18) ──
  const assessmentTypes = ['initial', 'annual', 'review', 'specialist']
  for (const su of sus) {
    const n = 1 + Math.floor(Math.random() * 2)
    for (let i = 0; i < n; i++) {
      await pool.query(`INSERT INTO care_assessments (id,organization_id,person_id,assessment_type,assessor_name,assessment_date,findings,recommendations,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [uuid(), orgId, su.id, assessmentTypes[Math.floor(Math.random() * assessmentTypes.length)],
         `${staff[Math.floor(Math.random() * staff.length)].name.join(' ')}`,
         new Date(Date.now() - Math.floor(Math.random() * 90) * 86400000).toISOString().split('T')[0],
         `Comprehensive assessment of ${su.name}. All care needs identified and documented.`,
         'Continue current care plan. Review mobility support requirements.',
         Math.random() < 0.2 ? 'draft' : 'completed'])
    }
  }
  console.log('  ✓ 24 care assessments created')

  // ── 30. Clinical Scores (36) ──
  const scoreTypes = ['waterlow', 'must', 'bmi']
  for (const su of sus) {
    const n = 1 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) {
      const st = scoreTypes[Math.floor(Math.random() * scoreTypes.length)]
      const score = Math.floor(Math.random() * 20) + 5
      await pool.query(`INSERT INTO clinical_scores (id,person_id,score_type,score,risk_level,recorded_date,notes) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [uuid(), su.id, st, score,
         score < 10 ? 'low' : score < 15 ? 'medium' : 'high',
         new Date(Date.now() - Math.floor(Math.random() * 60) * 86400000).toISOString().split('T')[0],
         `Routine ${st.toUpperCase()} assessment completed. ${score < 10 ? 'No action needed.' : 'Intervention plan in place.'}`])
    }
  }
  console.log('  ✓ 36 clinical scores created')

  // ── 31. Wellbeing / Mood Chart (60) ──
  const wellbeingDomains = ['mood', 'engagement', 'sleep', 'appetite', 'pain', 'mobility', 'social', 'overall']
  for (let i = 0; i < 60; i++) {
    const su = sus[Math.floor(Math.random() * sus.length)]
    await pool.query(`INSERT INTO person_wellbeing (id,person_id,domain,score,notes,recorded_date,recorded_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [uuid(), su.id, wellbeingDomains[Math.floor(Math.random() * wellbeingDomains.length)],
       Math.floor(Math.random() * 5) + 6,
       'Good day. Positive engagement with staff and peers.',
       new Date(Date.now() - Math.floor(Math.random() * 21) * 86400000).toISOString().split('T')[0],
       staff[Math.floor(Math.random() * staff.length)].userId])
  }
  console.log('  ✓ 60 wellbeing entries created')

  // ── 32. Communication Log (30) ──
  const commMethods = ['phone', 'email', 'visit', 'letter']
  const commDirections = ['inbound', 'outbound']
  for (let i = 0; i < 30; i++) {
    const su = sus[Math.floor(Math.random() * sus.length)]
    await pool.query(`INSERT INTO person_communication_log (id,person_id,contact_name,relationship,contact_method,direction,summary,recorded_date,recorded_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [uuid(), su.id,
       `Family of ${su.name}`, relationships2[Math.floor(Math.random() * relationships2.length)],
       commMethods[Math.floor(Math.random() * commMethods.length)],
       commDirections[Math.floor(Math.random() * commDirections.length)],
       'Discussed wellbeing and upcoming care plan review. Family satisfied with care.',
       new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString().split('T')[0],
       staff[Math.floor(Math.random() * staff.length)].userId])
  }
  console.log('  ✓ 30 communication log entries created')

  // ── 33. Capacity Assessments (12) ──
  const hasCapacity = [true, false, true, true, false, true, false, true, false, true, true, false]
  for (let i = 0; i < 12; i++) {
    const su = sus[i % sus.length]
    await pool.query(`INSERT INTO person_capacity_assessments (id,person_id,assessment_date,decision_to_be_made,capacity_found,capacity_status,best_interest_decision,review_date,recorded_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [uuid(), su.id,
       new Date(Date.now() - Math.floor(Math.random() * 180) * 86400000).toISOString().split('T')[0],
       'Capacity to make decisions about care and residence',
       hasCapacity[i], hasCapacity[i] ? 'has_capacity' : 'lacks_capacity',
       hasCapacity[i] ? null : 'Best interest decision made with family involvement. Remains in current placement.',
       new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
       staff[Math.floor(Math.random() * staff.length)].userId])
  }
  console.log('  ✓ 12 capacity assessments created')

  // ── 34. Care Pathways (10) ──
  const pathwayTypes = ['hospital_admission', 'hospital_discharge', 'short_break', 'transition', 'assessment_unit']
  for (let i = 0; i < 10; i++) {
    const su = sus[Math.floor(Math.random() * sus.length)]
    await pool.query(`INSERT INTO person_care_pathways (id,person_id,pathway_type,title,start_date,end_date,location_name,status,recorded_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [uuid(), su.id, pathwayTypes[Math.floor(Math.random() * pathwayTypes.length)],
       `${pathwayTypes[i % pathwayTypes.length].replace(/_/g, ' ')} pathway`,
       new Date(Date.now() - Math.floor(Math.random() * 60) * 86400000).toISOString().split('T')[0],
       i < 5 ? new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString().split('T')[0] : null,
       i < 7 ? ['St Thomas\' Hospital', 'Croydon University Hospital', 'Royal Brompton'][Math.floor(Math.random() * 3)] : null,
       i < 5 ? 'completed' : Math.random() < 0.5 ? 'active' : 'cancelled',
       staff[Math.floor(Math.random() * staff.length)].userId])
  }
  console.log('  ✓ 10 care pathways created')

  // ── 35. Time Away (12 checklist items across 4 titled records) ──
  const checklistCategories = ['documentation', 'medication', 'equipment', 'notification', 'property', 'other']
  const timeAwayRecords = [
    { title: 'Going to mum\'s house for the weekend', type: 'family_visit', destination: 'Mum\'s house, Croydon', offset: 14, days: 2 },
    { title: 'Weekend respite at Stonebridge', type: 'short_break', destination: 'Stonebridge Short Breaks Centre', offset: 5, days: 3 },
    { title: 'Hospital admission for assessment', type: 'hospital_admission', destination: 'St Thomas\' Hospital, London', offset: 28, days: 7 },
    { title: 'Moving to supported living at Rose Court', type: 'discharge', destination: 'Rose Court Supported Living', offset: 40, days: 0 },
  ]
  const timeAwayIds: string[] = []
  for (const rec of timeAwayRecords) {
    const su = sus[Math.floor(Math.random() * sus.length)]
    const start = new Date(); start.setDate(start.getDate() + rec.offset)
    const end = new Date(start); end.setDate(end.getDate() + rec.days)
    const id = uuid()
    timeAwayIds.push(id)
    await pool.query(`INSERT INTO person_time_away (id,person_id,title,time_away_type,destination,start_date,end_date,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, su.id, rec.title, rec.type, rec.destination, start.toISOString().split('T')[0], rec.days > 0 ? end.toISOString().split('T')[0] : null, staff[Math.floor(Math.random() * staff.length)].userId])
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
    const su = sus[Math.floor(Math.random() * sus.length)]
    const taw = timeAwayIds[Math.floor(Math.random() * timeAwayIds.length)]
    const tawRow = await pool.query('SELECT person_id FROM person_time_away WHERE id = $1', [taw])
    const items = checklistItems[i % checklistItems.length]
    await pool.query(`INSERT INTO person_discharge_checklist (id,person_id,time_away_id,item,category,quantity,unit,is_complete,completed_at,completed_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [uuid(), tawRow.rows[0].person_id, taw,
       items.item,
       checklistCategories[i % checklistCategories.length],
       items.qty, items.unit,
       i < 7, i < 7 ? new Date().toISOString() : null,
       i < 7 ? staff[Math.floor(Math.random() * staff.length)].userId : null])
  }
  console.log('  ✓ 4 time away records + 12 checklist items created')

  // ── 36. Notifications (20) ──
  const notifTypes = ['compliance', 'training', 'leave', 'scheduling', 'system', 'incident']
  const notifMessages = [
    'Training record expiring soon: Safeguarding Adults', 'New incident report requires review',
    'Leave request pending approval', 'Compliance rate below threshold for 2 staff members',
    'Shift unassigned for tomorrow — Orbis House night shift', 'DBS check expiring for Sarah Chen',
    'New care plan review due for Arthur Clarke', 'Room check flagged — Room 204 needs attention',
    'Medication audit due this week', 'Staff supervision overdue for 3 care workers',
  ]
  for (let i = 0; i < 20; i++) {
    const recipient = staff[Math.floor(Math.random() * staff.length)]
    await pool.query(`INSERT INTO notifications (id,user_id,title,message,type,read,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [uuid(), recipient.userId, notifTypes[i % notifTypes.length].toUpperCase(), notifMessages[i % notifMessages.length],
       notifTypes[i % notifTypes.length], i > 12, new Date(Date.now() - Math.floor(Math.random() * 14) * 86400000).toISOString()])
  }
  console.log('  ✓ 20 notifications created')

  // ── 37. Person Documents (24) ──
  const docTypes = ['care_plan', 'assessment', 'referral', 'consent_form', 'correspondence', 'other']
  for (let i = 0; i < 24; i++) {
    const su = sus[i % sus.length]
    await pool.query(`INSERT INTO person_documents (id,person_id,title,document_type,file_url,upload_date,uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [uuid(), su.id,
       `${docTypes[i % docTypes.length].replace(/_/g, ' ')} document - ${new Date(Date.now() - i * 30 * 86400000).toLocaleDateString('en-GB')}`,
       docTypes[i % docTypes.length],
       '/files/private/orbis-document.pdf',
       new Date(Date.now() - i * 15 * 86400000).toISOString().split('T')[0],
       staff[Math.floor(Math.random() * staff.length)].userId])
  }
  console.log('  ✓ 24 person documents created')

  // ── 38. Manager Delegations (5) ──
  const delePairs = [[1, 5], [2, 9], [3, 11], [1, 14], [2, 16]]
  for (const [primary, delegate] of delePairs) {
    await pool.query(`INSERT INTO manager_delegations (id,organization_id,primary_manager_id,delegate_manager_id,is_active) VALUES ($1,$2,$3,$4,true)`,
      [uuid(), orgId, staff[primary].userId, staff[delegate].userId])
  }
  console.log('  ✓ 5 manager delegations created')

  // ── 39. Audit Log (30 entries) ──
  const auditActions = ['create', 'update', 'view', 'delete']
  const auditEntities = ['person', 'care_plan', 'daily_note', 'incident', 'training_record', 'compliance_record']
  for (let i = 0; i < 30; i++) {
    const action = auditActions[Math.floor(Math.random() * 3)]
    const entity = auditEntities[Math.floor(Math.random() * auditEntities.length)]
    await pool.query(`INSERT INTO audit_logs (id,user_id,action,entity_type,entity_id,ip_address,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [uuid(), staff[Math.floor(Math.random() * staff.length)].userId,
       action, entity, uuid(),
       '192.168.1.' + Math.floor(Math.random() * 255),
       new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString()])
  }
  console.log('  ✓ 30 audit log entries created')

  // ── 40. Body Map Entries (15) ──
  const bodyConditions = ['bruise', 'wound', 'rash', 'swelling', 'burn', 'pressure_sore', 'scar', 'skin_tear']
  const bodyParts = ['left_arm', 'right_arm', 'left_leg', 'right_leg', 'chest', 'back', 'abdomen', 'head']
  for (let i = 0; i < 15; i++) {
    const su = sus[Math.floor(Math.random() * sus.length)]
    await pool.query(`INSERT INTO body_map_entries (id,person_id,body_view,body_zone,condition_type,description,severity,status,recorded_date,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [uuid(), su.id, Math.random() < 0.5 ? 'front' : 'back',
       bodyParts[Math.floor(Math.random() * bodyParts.length)],
       bodyConditions[Math.floor(Math.random() * bodyConditions.length)],
       `Minor noted during personal care.`,
       ['mild', 'moderate', 'severe'][Math.floor(Math.random() * 3)],
       Math.random() < 0.6 ? 'active' : 'resolved',
       new Date(Date.now() - Math.floor(Math.random() * 14) * 86400000).toISOString().split('T')[0],
       staff[Math.floor(Math.random() * staff.length)].userId])
  }
  console.log('  ✓ 15 body map entries created')

  // ── 41. Engagement Surveys (6) ──
  const engagementThemes = ['Workplace satisfaction', 'Workload balance', 'Team communication', 'Training needs', 'Career development', 'Wellbeing support']
  const eTemplateIds: string[] = []
  for (const theme of engagementThemes) {
    const id = uuid()
    await pool.query(`INSERT INTO engagement_templates (id,organization_id,name,questions,is_active) VALUES ($1,$2,$3,$4,true)`,
      [id, orgId, theme + ' Survey',
       JSON.stringify([
         { question: `How satisfied are you with ${theme.toLowerCase()}?`, type: 'slider', min: 1, max: 10 },
         { question: 'What could be improved?', type: 'text' },
       ])])
    eTemplateIds.push(id)
  }
  // Send one survey
  for (const s of staff.slice(0, 8)) {
    await pool.query(`INSERT INTO survey_invitations (id,organization_id,type,email,token,sent_at,expires_at) VALUES ($1,$2,'engagement',$3,$4,$5,$6)`,
      [uuid(), orgId, `${s.name.join('.')}@${domain}`, uuid(), new Date().toISOString(),
       new Date(Date.now() + 30 * 86400000).toISOString()])
  }
  console.log('  ✓ 6 engagement templates + 8 invitations created')

  // ── 42. eMAR Records (4) ──
  const marIds = [uuid(), uuid(), uuid(), uuid()]
  const marItemIds: string[] = []
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
  for (let mi = 0; mi < marIds.length; mi++) {
    const su = sus[mi * 4]
    const chartStart = new Date(Date.now() - 7 * 86400000)
    const chartEnd = new Date(Date.now() + 24 * 86400000)
    await pool.query(`INSERT INTO emedication_records (id,organization_id,person_id,title,start_date,end_date,status,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [marIds[mi], orgId, su.id, `MAR Chart - ${su.name}`, chartStart.toISOString().split('T')[0], chartEnd.toISOString().split('T')[0], 'active', staff[0].userId])
    for (let medIdx = mi * 3; medIdx < mi * 3 + 3; medIdx++) {
      const med = medNames[medIdx % medNames.length]
      const itemId = uuid()
      marItemIds.push(itemId)
      await pool.query(`INSERT INTO emedication_items (id,emedication_record_id,name,dosage,unit,route,frequency,times,is_prn) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [itemId, marIds[mi], med.name,
         med.name.includes('mg') ? med.name.match(/\d+/)?.[0] + ' mg' : med.name.includes('mcg') ? med.name.match(/\d+/)?.[0] + ' mcg' : '1 dose',
         med.name.includes('mcg') ? 'mcg' : 'mg',
         med.route, med.freq, JSON.stringify(['08:00', '13:00', '18:00', '22:00']), med.prn])
      // Create some administrations for past days
      for (let d = -6; d <= 0; d++) {
        if (med.prn && Math.random() > 0.3) continue
        const sched = new Date(Date.now() + d * 86400000); sched.setHours(8, 0, 0, 0)
        const given = Math.random() < 0.9
        await pool.query(`INSERT INTO emedication_administrations (id,emedication_item_id,staff_id,scheduled_time,administered_time,status) VALUES ($1,$2,$3,$4,$5,$6)`,
          [uuid(), itemId, staff[Math.floor(Math.random() * staff.length)].profileId,
           sched.toISOString(),
           given ? new Date(sched.getTime() + Math.floor(Math.random() * 30) * 60000).toISOString() : null,
           given ? 'given' : 'missed'])
      }
    }
  }
  console.log('  ✓ 4 eMAR records with medications + administrations created')

  // Daily medication counts (per-session) for the first MAR person
  const countPerson = sus[0]
  const countStaff = `${staff[0].name.join(' ')}`
  const countDates = [new Date().toISOString().split('T')[0], new Date().toISOString().split('T')[0], new Date(Date.now() - 86400000).toISOString().split('T')[0]]
  const countSessions = ['end_of_day', 'am', 'pm']
  for (let c = 0; c < countDates.length; c++) {
    const countId = uuid()
    const hasMismatch = c === 1
    await pool.query(`INSERT INTO emedication_daily_counts (id,organization_id,person_id,count_date,count_session,staff_name,matches_physical,notes,counted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [countId, orgId, countPerson.id, countDates[c], countSessions[c], countStaff, !hasMismatch, hasMismatch ? 'One medication below expected — escalated for review' : 'All stock verified', new Date(Date.now() - (countDates.length - 1 - c) * 6 * 3600000).toISOString()])
    for (let i = 0; i < Math.min(3, marItemIds.length); i++) {
      const med = medNames[i % medNames.length]
      const expected = 4
      const actual = hasMismatch && i === 0 ? expected - 1 : expected
      await pool.query(`INSERT INTO emedication_daily_count_items (id,daily_count_id,medication_item_id,medication_name,expected_quantity,actual_quantity,reason_for_mismatch,escalate) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [uuid(), countId, marItemIds[i], med.name, expected, actual, hasMismatch && i === 0 ? 'Count discrepancy' : null, hasMismatch && i === 0])
    }
  }
  console.log('  ✓ 3 daily medication counts (incl. escalated mismatch) created')

  // ── 43. Evidence Mappings (15) ──
  const sourceTypes = ['training', 'documents', 'competency', 'care_plans', 'incidents', 'satisfaction']
  const domains = ['safe', 'effective', 'caring', 'responsive', 'well-led']
  let emCount = 0
  for (const domain of domains) {
    for (let i = 0; i < 3; i++) {
      await pool.query(`INSERT INTO evidence_mappings (id,organization_id,source_type,source_category,target_domain) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [uuid(), orgId, sourceTypes[Math.floor(Math.random() * sourceTypes.length)],
         ['mandatory', 'clinical', 'general'][Math.floor(Math.random() * 3)],
         domain])
      emCount++
    }
  }
  console.log(`  ✓ ${emCount} evidence mappings created`)

  console.log('\n' + '='.repeat(50))
  console.log(`✓ "${orgName}" DEMO SEEDED SUCCESSFULLY`)
  console.log('='.repeat(50))
  console.log(`\n  Organisation ID: ${orgId}`)
  console.log(`  Org admin login: james.mercer@${domain}  (password: DemoPass123!)`)
  console.log(`  Platform admin: caredesk@reydesk.com  (password: DemoPass123!)`)
  console.log(`\n  Staff can login with: firstname.lastname@${domain}`)
  console.log(`  All passwords: DemoPass123!`)
  console.log(`\n  Locations:`)
  for (const l of locations) console.log(`    - ${l.name}`)
  console.log(`\n  ${staff.length} staff, ${sus.length} people`)
  console.log(`  ${trCount} training records, ${crCount} compliance records`)
  console.log(`  ${shiftCount} shifts across ${locations.length} locations\n`)

  await pool.end()
  process.exit(0)
}

seed().catch(e => { console.error('Seed failed:', e); process.exit(1) })
