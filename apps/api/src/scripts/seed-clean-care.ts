// Clean Care LTD — complete seed
// Purges ALL data and creates a fresh org with realistic homecare data.
// Password for the seeded users: Password123$, except the deployment smoke
// account, which takes DEPLOY_SMOKE_PASSWORD instead — see below.

import { Client } from 'pg'
const uuid = () => crypto.randomUUID()
import bcrypt from 'bcryptjs'

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) throw new Error('DATABASE_URL required')
const client = new Client({ connectionString: DB_URL, ssl: false })
const q = (t: string, p?: any[]) => client.query(t, p)

const DAY = 86400000
const ago = (n: number) => new Date(Date.now() - n * DAY).toISOString()
const dateAgo = (n: number) => ago(n).split('T')[0]
const dateIn = (n: number) => new Date(Date.now() + n * DAY).toISOString().split('T')[0]
const DEFAULT_PASSWORD = 'Password123$'

// ── Deployment smoke credential ──────────────────────────────────────────────
// The deploy pipeline signs in as one seeded account (AUTH_SMOKE_EMAIL /
// AUTH_SMOKE_PASSWORD in .github/workflows/deploy.yml, fed from the
// DEPLOY_SMOKE_EMAIL / DEPLOY_SMOKE_PASSWORD environment) and fails the release
// when it cannot. A freshly provisioned environment therefore has to seed that
// account with the password the pipeline holds, so it is read from the
// environment rather than hard-coded:
//
//   DEPLOY_SMOKE_EMAIL=contact.techville@gmail.com \
//   DEPLOY_SMOKE_PASSWORD=<the pipeline's value> \
//   npx ts-node src/scripts/seed-clean-care.ts
//
// Both are optional. Unset means the smoke account keeps the documented default,
// which only satisfies the smoke test while the pipeline uses that same default.
const SMOKE_EMAIL =
  (process.env.DEPLOY_SMOKE_EMAIL ?? '').trim().toLowerCase() || 'contact.techville@gmail.com'
const SMOKE_PASSWORD = (process.env.DEPLOY_SMOKE_PASSWORD ?? '').trim()

const USERS = [
  { email: 'itsopeyemi@gmail.com', first: 'Opeyemi', last: 'Olorunfemi', role: 'ORG_ADMIN', phone: '07586215433' },
  { email: 'opeyemi@gmail.com', first: 'Opeyemi', last: 'Adebayo', role: 'MANAGER', phone: '07700900101' },
  { email: 'toye.adenuga@gmail.com', first: 'Toye', last: 'Adenuga', role: 'MANAGER', phone: '07700900102' },
  { email: 'opeyemiolorunfemy@gmail.com', first: 'Opeyemi', last: 'Femi', role: 'CARE_WORKER', phone: '07700900103' },
  { email: 'nirocarts@gmail.com', first: 'Niro', last: 'Carter', role: 'CARE_WORKER', phone: '07700900104' },
  { email: 'gistline2@gmail.com', first: 'Grace', last: 'Roberts', role: 'CARE_WORKER', phone: '07700900105' },
  { email: 'smart.iwallet@gmail.com', first: 'Samuel', last: 'Ibrahim', role: 'CARE_WORKER', phone: '07700900106' },
  { email: 'contact.techville@gmail.com', first: 'Tunde', last: 'Oladele', role: 'CARE_WORKER', phone: '07700900107' },
  { email: 'faithhopey@gmail.com', first: 'Faith', last: 'Okafor', role: 'CARE_WORKER', phone: '07700900108' },
]

// Checked before anything is purged: the pipeline can only sign in as an account
// this seed creates, so a mismatch is a hard error rather than a release that
// deploys and then rolls back on a smoke failure.
if (!USERS.some(u => u.email.toLowerCase() === SMOKE_EMAIL)) {
  throw new Error(
    `DEPLOY_SMOKE_EMAIL=${SMOKE_EMAIL} is not one of the seeded accounts, so the deployment smoke test ` +
      `could not sign in. Point DEPLOY_SMOKE_EMAIL at a seeded address (${USERS.map(u => u.email).join(', ')}) ` +
      `or add that address to the USERS list above.`,
  )
}

const PW = bcrypt.hashSync(DEFAULT_PASSWORD, 10)
const SMOKE_PW = SMOKE_PASSWORD ? bcrypt.hashSync(SMOKE_PASSWORD, 10) : PW
let rows = 0
const ins = async (t: string, p?: any[]) => { await q(t, p); rows++ }

async function seed() {
  console.log('\n=== CLEAN CARE LTD — Full Seed ===\n')
  await client.connect()

  // ═══ PURGE ═══
  console.log('Purging database...')
  const tables = (await q(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '\\_migration%'`)).rows
  await q('TRUNCATE ' + tables.map((t: any) => t.tablename).join(', ') + ' CASCADE')
  console.log(`  ✓ Purged ${tables.length} tables`)

  // ═══ ORG ═══
  const orgId = uuid()
  await ins(`INSERT INTO organizations (id,name,status,plan,subscription_status,regulator,primary_color,secondary_color,accent_color,
    minimum_compliance_percent,compliance_alert_threshold,onboarding_completed,onboarding_step,
    location_threshold_meters,require_photo_on_checkout,default_hourly_rate,primary_service_type,service_types,
    created_at) VALUES ($1,'Clean Care LTD','active','professional','active','cqc','#0F4C81','#6B7280','#F8FAFC',
    70,70,true,6,500,false,13.50,'domiciliary','{"domiciliary","supported_living"}'::text[],$2)`,
    [orgId, ago(430)])
  console.log('✓ Organisation created')

  // ═══ USERS ═══
  const userIds: string[] = []
  const staffIds: string[] = []
  for (let i = 0; i < USERS.length; i++) {
    const u = USERS[i]
    const uid = uuid()
    userIds.push(uid)
    const passwordHash = u.email.toLowerCase() === SMOKE_EMAIL ? SMOKE_PW : PW
    await ins(`INSERT INTO users (id,organization_id,email,role,status,password_hash,email_verified,created_at) VALUES ($1,$2,$3,$4,'active',$5,true,$6)`,
      [uid, orgId, u.email, u.role, passwordHash, ago(420 - i * 5)])

    const spId = uuid()
    staffIds.push(spId)
    await ins(`INSERT INTO staff_profiles (id,user_id,first_name,last_name,phone,employment_status,employment_type,contracted_hours_weekly,created_at) VALUES ($1,$2,$3,$4,$5,'active','full_time',37.5,$6)`,
      [spId, uid, u.first, u.last, u.phone, ago(420 - i * 5)])

    const skills = u.role === 'CARE_WORKER'
      ? ['Personal Care', 'Medication Administration', 'Moving & Handling', 'Dementia Care', 'First Aid']
      : ['Safeguarding Lead', 'Service Management', 'CQC Compliance', 'Team Leadership']
    for (const sk of skills.slice(0, 2 + Math.floor(Math.random() * 3)))
      await ins(`INSERT INTO skills (id,staff_id,name,created_at) VALUES ($1,$2,$3,$4)`, [uuid(), spId, sk, ago(400)])

    const quals = u.role === 'CARE_WORKER'
      ? [{ n: 'NVQ Level 2 Health & Social Care', d: 380 }, { n: 'Care Certificate', d: 350 }]
      : [{ n: 'NVQ Level 5 Leadership & Management', d: 400 }]
    for (const qq of quals)
      await ins(`INSERT INTO qualifications (id,staff_id,name,issue_date,created_at) VALUES ($1,$2,$3,$4,$5)`, [uuid(), spId, qq.n, dateAgo(qq.d), ago(qq.d)])

    await ins(`INSERT INTO emergency_contacts (id,staff_id,name,relationship,phone,created_at) VALUES ($1,$2,$3,'Family','07900000111',$4)`, [uuid(), spId, `Emergency ${u.first}`, ago(400)])

    if (u.role === 'CARE_WORKER')
      for (let d = 0; d < 7; d++)
        await ins(`INSERT INTO staff_availability (id,staff_id,day_of_week,start_time,end_time,is_available,created_at) VALUES ($1,$2,$3,$4,$5,true,$6)`, [uuid(), spId, d, '07:00:00', '21:00:00', ago(30)])

    for (const nt of ['compliance', 'training', 'documents', 'leave', 'shift', 'general'])
      await ins(`INSERT INTO notification_preferences (user_id,notification_type,enabled) VALUES ($1,$2,true)`, [uid, nt])
  }

  const teamId = uuid()
  await ins(`INSERT INTO teams (id,organization_id,name,description,created_at) VALUES ($1,$2,'Care Team','Primary care team',$3)`, [teamId, orgId, ago(420)])
  for (const uid of userIds)
    await ins(`INSERT INTO team_members (team_id,user_id,role,created_at) VALUES ($1,$2,'MEMBER',$3)`, [teamId, uid, ago(410)])

  console.log(`✓ ${USERS.length} users created`)

  // ═══ LOCATIONS ═══
  const locs = [
    { name: 'Clean Care Office', addr: '45 High Street, London SE1 1AA' },
    { name: 'South London Hub', addr: '120 Clapham High Street, London SW4 7SL' },
    { name: 'Croydon Centre', addr: '78 North End, Croydon CR0 1TY' },
  ]
  const locIds = locs.map(() => uuid())
  for (let i = 0; i < locs.length; i++)
    await ins(`INSERT INTO locations (id,organization_id,name,address,minimum_staff_per_day,min_day_staff,min_night_staff,manager_id,latitude,longitude,created_at) VALUES ($1,$2,$3,$4,3,2,1,$5,$6,$7,$8)`,
      [locIds[i], orgId, locs[i].name, locs[i].addr, userIds[i % 3], (51.45 + i * 0.05).toFixed(6), (-0.12 + i * 0.03).toFixed(6), ago(420)])

  const deptIds = [uuid(), uuid()]
  await ins(`INSERT INTO departments (id,location_id,name,created_at) VALUES ($1,$2,'Care Services',$3)`, [deptIds[0], locIds[0], ago(420)])
  await ins(`INSERT INTO departments (id,location_id,name,created_at) VALUES ($1,$2,'Management',$3)`, [deptIds[1], locIds[0], ago(420)])
  console.log('✓ 3 locations + 2 departments')

  // ═══ PEOPLE ═══
  const PDATA = [
    { first: 'Margaret', last: 'Johnson', dob: '1938-07-22', gender: 'Female', locIdx: 0, support: 'one_to_one', allergies: ['Penicillin'], diet: 'Diabetic', flags: ['falls_risk'] },
    { first: 'George', last: 'Brown', dob: '1945-11-08', gender: 'Male', locIdx: 0, support: 'minimal', allergies: [], diet: 'Regular', flags: [] },
    { first: 'Florence', last: 'Williams', dob: '1940-05-12', gender: 'Female', locIdx: 0, support: 'two_to_one', allergies: ['Aspirin', 'Latex'], diet: 'Soft diet', flags: ['falls_risk', 'choking'] },
    { first: 'Arthur', last: 'Taylor', dob: '1935-03-15', gender: 'Male', locIdx: 2, support: 'one_to_one', allergies: [], diet: 'Low sodium', flags: ['dnr'] },
    { first: 'Dorothy', last: 'Evans', dob: '1942-09-14', gender: 'Female', locIdx: 2, support: 'minimal', allergies: ['Sulfa'], diet: 'Regular', flags: ['diabetic'] },
    { first: 'Harold', last: 'Thomas', dob: '1932-11-30', gender: 'Male', locIdx: 1, support: 'one_to_one', allergies: [], diet: 'Modified texture', flags: ['behaviour'] },
    { first: 'Edith', last: 'Davies', dob: '1948-02-04', gender: 'Female', locIdx: 1, support: 'minimal', allergies: ['Peanuts'], diet: 'Gluten free', flags: [] },
    { first: 'Albert', last: 'Roberts', dob: '1939-06-23', gender: 'Male', locIdx: 1, support: 'two_to_one', allergies: ['Codeine'], diet: 'Diabetic', flags: ['epilepsy', 'diabetic'] },
    { first: 'Beatrice', last: 'Hall', dob: '1943-01-04', gender: 'Female', locIdx: 0, support: 'independent', allergies: [], diet: 'Regular', flags: [] },
    { first: 'Walter', last: 'Young', dob: '1936-04-23', gender: 'Male', locIdx: 2, support: 'one_to_one', allergies: ['Penicillin'], diet: 'Fortified', flags: ['falls_risk', 'mca_dols'] },
    { first: 'Mabel', last: 'Wright', dob: '1941-05-15', gender: 'Female', locIdx: 1, support: 'minimal', allergies: [], diet: 'Regular', flags: [] },
    { first: 'Cecil', last: 'King', dob: '1934-10-11', gender: 'Male', locIdx: 0, support: 'complex', allergies: ['Aspirin'], diet: 'Liquidised', flags: ['choking', 'dnr'] },
  ]

  const peopleIds: string[] = []
  for (const p of PDATA) {
    const pid = uuid()
    peopleIds.push(pid)
    await ins(`INSERT INTO people (id,organization_id,first_name,last_name,date_of_birth,gender,status,location_id,gp_name,gp_surgery,gp_phone,dietary_requirements,allergies,support_level,flags,tags,communication_method,funding_type,funding_details,dnacpr_status,admission_date,min_staff_required,created_at) VALUES ($1,$2,$3,$4,$5,$6,'active',$7,'Dr Patel','Health Centre','020 7946 0101',$8,$9,$10,$11,'[]'::jsonb,'verbal','local_authority','LA funded',$12,$13,$14,$15)`,
      [pid, orgId, p.first, p.last, p.dob, p.gender, locIds[p.locIdx], p.diet, JSON.stringify(p.allergies), p.support, JSON.stringify(p.flags), p.flags.includes('dnr') ? 'dnacpr' : 'no_dnacpr', dateAgo(350 + Math.floor(Math.random() * 50)), p.support === 'two_to_one' ? 2 : 1, ago(400)])
  }
  console.log(`✓ ${peopleIds.length} clients created`)

  // ═══ MILEAGE POLICIES ═══
  await ins(`INSERT INTO homecare_mileage_policies (id,organization_id,tax_year,vehicle_type,fuel_category,rate_pence,effective_from,effective_to,is_active,source_label,created_at) VALUES ($1,$2,'2025-26','car','petrol',45,'2025-04-06','2026-04-05',true,'hmrc',$3)`, [uuid(), orgId, ago(30)])
  await ins(`INSERT INTO homecare_mileage_policies (id,organization_id,tax_year,vehicle_type,fuel_category,rate_pence,effective_from,effective_to,is_active,source_label,created_at) VALUES ($1,$2,'2025-26','car','diesel',45,'2025-04-06','2026-04-05',true,'hmrc',$3)`, [uuid(), orgId, ago(30)])
  console.log('✓ 2 mileage policies')

  // ═══ CARE PACKAGES, VISITS, TASKS, TIMESHEETS ═══
  const carerIds = staffIds.filter((_, i) => USERS[i].role === 'CARE_WORKER')
  const carerUserIds = userIds.filter((_, i) => USERS[i].role === 'CARE_WORKER')
  const visitTypes = ['morning', 'lunch', 'evening', 'night']
  const visitLabels = ['Morning Call', 'Lunch Call', 'Evening Call', 'Night Call']
  let visitCount = 0, taskCount = 0, tsCount = 0

  for (let dayOff = -7; dayOff <= 3; dayOff++) {
    const vDate = new Date(Date.now() + dayOff * DAY)
    const isPast = dayOff < 0
    const isToday = dayOff === 0

    for (const [pi, pid] of peopleIds.entries()) {
      const numVisits = 1 + Math.floor(Math.random() * 2)
      for (let v = 0; v < numVisits; v++) {
        const vid = uuid()
        const hour = 8 + v * 4
        const start = new Date(vDate); start.setHours(hour, 0, 0, 0)
        const end = new Date(vDate); end.setHours(hour + 1, 0, 0, 0)
        const carerId = carerIds[(pi + v) % carerIds.length]
        const status = isPast ? (Math.random() < 0.85 ? 'completed' : 'missed') : isToday ? (Math.random() < 0.4 ? 'completed' : 'scheduled') : 'scheduled'

        // Package
        const pkgId = uuid()
        await ins(`INSERT INTO homecare_packages (id,organization_id,person_id,name,status,funding_type,hourly_rate_pence,mileage_rate_pence,created_at) VALUES ($1,$2,$3,$4,'active','local_authority',1350,45,$5)`,
          [pkgId, orgId, pid, `${PDATA[pi].first}'s Package`, ago(400)])

        const workMin = 45 + Math.floor(Math.random() * 30)
        const travelMin = 15 + Math.floor(Math.random() * 20)
        const miles = +(2 + Math.random() * 8).toFixed(1)
        const grossPay = Math.round(workMin * 1350 / 60)

        await ins(`INSERT INTO homecare_visits (id,organization_id,package_id,person_id,assigned_staff_id,status,label,visit_type,scheduled_start,scheduled_end,check_in_at,check_out_at,check_in_latitude,check_in_longitude,actual_travel_minutes,actual_mileage_miles,visit_notes,progress_notes,hourly_rate_pence,mileage_rate_pence,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,1350,45,$19)`,
          [vid, orgId, pkgId, pid, carerId, status, `${visitLabels[v % 4]} — ${PDATA[pi].first}`, visitTypes[v % 4], start.toISOString(), end.toISOString(),
            status === 'completed' ? start.toISOString() : null, status === 'completed' ? end.toISOString() : null,
            status === 'completed' ? (51.45 + pi * 0.01).toFixed(6) : null, status === 'completed' ? (-0.12 + pi * 0.01).toFixed(6) : null,
            status === 'completed' ? travelMin : null, status === 'completed' ? miles : null,
            status === 'completed' ? `Visit completed. ${PDATA[pi].first} was well.` : null,
            status === 'completed' ? 'Progress noted.' : null, ago(Math.abs(dayOff) + 1)])

        // Tasks
        const taskLabels = ['Check medication', 'Personal care', 'Prepare meal', 'Update care notes']
        const numTasks = 2 + Math.floor(Math.random() * 2)
        for (let t = 0; t < numTasks; t++) {
          const done = status === 'completed' && Math.random() < 0.9
          await ins(`INSERT INTO homecare_visit_tasks (id,visit_id,label,sort_order,done,completed_by,completed_at,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [uuid(), vid, taskLabels[t], t, done, done ? carerUserIds[(pi + v) % carerUserIds.length] : null, done ? end.toISOString() : null, ago(Math.abs(dayOff) + 1)])
          if (done) taskCount++
        }

        // Timesheet
        if (status === 'completed') {
          const tsStatus = Math.random() < 0.7 ? 'approved' : Math.random() < 0.5 ? 'submitted' : 'draft'
          await ins(`INSERT INTO homecare_timesheets (id,organization_id,visit_id,staff_id,work_minutes,travel_minutes,paid_travel_minutes,mileage_miles,mileage_rate_pence,hourly_rate_pence,gross_pay_pence,status,submitted_at,approved_by,approved_at,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1350,$10,$11,$12,$13,$14,$15)`,
            [uuid(), orgId, vid, carerId, workMin, travelMin, travelMin, miles, 45, grossPay, tsStatus, tsStatus !== 'draft' ? ago(Math.abs(dayOff)) : null, tsStatus === 'approved' ? userIds[0] : null, tsStatus === 'approved' ? ago(Math.abs(dayOff) - 1) : null, ago(Math.abs(dayOff) + 1)])
          tsCount++
        }

        visitCount++
      }
    }
  }
  console.log(`✓ ${visitCount} visits, ${taskCount} tasks, ${tsCount} timesheets`)

  // ═══ CARE PLANS ═══
  let planCount = 0
  for (const pid of peopleIds) {
    for (const cat of ['personal_care', 'medication'])
      await ins(`INSERT INTO care_plans (id,person_id,title,category,description,review_date,status,version,created_at) VALUES ($1,$2,$3,$4,$5,$6,'active',1,$7)`,
        [uuid(), pid, `${cat.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} Plan`, cat, `Individualised care plan.`, dateIn(90), ago(200)])
    planCount += 2
  }
  console.log(`✓ ${planCount} care plans`)

  // ═══ DAILY NOTES ═══
  const notes = ['Had a good day. Ate well.', 'Mood stable. Social.', 'Required assistance with personal care.', 'Ate 75% of meals. Hydration encouraged.', 'Slept well. No incidents.', 'Family visited. Happy.', 'Mood low but improved.', 'Assisted with medication. No issues.', 'Engaged with activities.', 'Appetite poor but improved.']
  for (let i = 0; i < 100; i++) {
    const pid = peopleIds[Math.floor(Math.random() * peopleIds.length)]
    const dAgo = Math.floor(Math.random() * 365)
    await ins(`INSERT INTO daily_notes (id,person_id,author_id,note_date,shift,category,content,support_level,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [uuid(), pid, carerUserIds[Math.floor(Math.random() * carerUserIds.length)], dateAgo(dAgo), Math.random() < 0.7 ? 'day' : 'night', ['wellbeing', 'nutrition', 'mood'][Math.floor(Math.random() * 3)], notes[Math.floor(Math.random() * notes.length)], ['independent', 'minimal'][Math.floor(Math.random() * 2)], ago(dAgo)])
  }
  console.log('✓ 100 daily notes')

  // ═══ RISK ASSESSMENTS ═══
  for (const pid of peopleIds) {
    const lvl = ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
    await ins(`INSERT INTO risk_assessments (id,person_id,type,risk_level,details,mitigation_actions,review_date,created_at) VALUES ($1,$2,'falls',$3,$4,$5,$6,$7)`,
      [uuid(), pid, lvl, 'Falls risk assessment.', 'Regular monitoring.', dateIn(60), ago(100)])
  }
  console.log('✓ 12 risk assessments')

  // ═══ INCIDENTS ═══
  await ins(`INSERT INTO incident_categories (id,organization_id,name,severity,is_cqc_reportable,is_active,created_at) VALUES ($1,$2,'Fall','medium',false,true,$3)`, [uuid(), orgId, ago(400)])
  await ins(`INSERT INTO incident_categories (id,organization_id,name,severity,is_cqc_reportable,is_active,created_at) VALUES ($1,$2,'Medication','high',true,true,$3)`, [uuid(), orgId, ago(400)])
  for (let i = 0; i < 5; i++)
    await ins(`INSERT INTO incidents (id,organization_id,title,description,severity,status,incident_date,is_cqc_reportable,reported_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [uuid(), orgId, `Incident ${i + 1}`, `Reported incident #${i + 1}.`, ['low', 'medium', 'high'][i % 3], i < 3 ? 'resolved' : 'reported', dateAgo(30 + i * 10), false, userIds[0], ago(30 + i * 10)])
  console.log('✓ 2 incident categories + 5 incidents')

  // ═══ POLICIES ═══
  for (const p of ['Safeguarding', 'Risk Assessment', 'GDPR', 'Fire Safety', 'Medication', 'Infection Control', 'Health & Safety', 'Complaints'])
    await ins(`INSERT INTO policies (id,organization_id,title,category,content,version,status,created_at) VALUES ($1,$2,$3,'General',$4,'1.0','active',$5)`, [uuid(), orgId, p, `# ${p}\nClean Care LTD policy on ${p.toLowerCase()}.`, ago(400)])
  console.log('✓ 8 policies')

  // ═══ TRAINING ═══
  for (const t of ['Safeguarding Level 2', 'Moving & Handling', 'First Aid', 'Medication Admin', 'Fire Safety', 'GDPR'])
    await ins(`INSERT INTO training_modules (id,organization_id,name,category,frequency_days,is_mandatory,created_at) VALUES ($1,$2,$3,'Mandatory',365,true,$4)`, [uuid(), orgId, t, ago(400)])
  console.log('✓ 6 training modules')

  // ═══ LEAVE TYPES ═══
  for (const lt of [{ n: 'Annual Leave', c: '#0F4C81', d: 28 }, { n: 'Sick Leave', c: '#DC2626', d: 6 }, { n: 'Training', c: '#16A34A', d: 3 }])
    await ins(`INSERT INTO leave_types (id,organization_id,name,color,days_allowed,duration_type,created_at) VALUES ($1,$2,$3,$4,$5,'days',$6)`, [uuid(), orgId, lt.n, lt.c, lt.d, ago(400)])
  console.log('✓ 3 leave types')

  // ═══ CHAT ═══
  const chId = uuid()
  await ins(`INSERT INTO chat_channels (id,organization_id,name,type,created_by,created_at) VALUES ($1,$2,'General','general',$3,$4)`, [chId, orgId, userIds[0], ago(400)])
  for (const uid of userIds) await ins(`INSERT INTO chat_members (channel_id,user_id,joined_at) VALUES ($1,$2,$3)`, [chId, uid, ago(400)])
  for (const [i, msg] of ['Welcome to Clean Care LTD!', 'Good morning team!', 'Meeting at 2pm today.', 'Any updates on care plans?', 'Shift swaps available tomorrow.'].entries())
    await ins(`INSERT INTO chat_messages (channel_id,sender_id,content,created_at) VALUES ($1,$2,$3,$4)`, [chId, userIds[i % userIds.length], msg, ago(10 - i)])
  console.log('✓ Chat channel + messages')

  // ═══ COMPLIANCE ═══
  for (const cr of ['DBS Check', 'Safeguarding Training', 'Manual Handling', 'First Aid', 'Medication Competency', 'Fire Safety'])
    await ins(`INSERT INTO compliance_config (id,organization_id,name,description,days_warning,days_overdue,is_mandatory,created_at) VALUES ($1,$2,$3,$4,30,0,true,$5)`, [uuid(), orgId, cr, `${cr} requirement`, ago(400)])
  console.log('✓ 6 compliance requirements')

  console.log(`\n=== DONE: ${rows} rows inserted ===\n`)
  console.log('Login credentials:')
  for (const u of USERS) console.log(`  ${u.email} — ${u.role}`)
  console.log(
    '\nPasswords:\n' +
      `  ${SMOKE_EMAIL} (deployment smoke account): ${
        SMOKE_PASSWORD
          ? 'the DEPLOY_SMOKE_PASSWORD value'
          : `${DEFAULT_PASSWORD} — DEPLOY_SMOKE_PASSWORD was not set`
      }\n` +
      `  all other accounts: ${DEFAULT_PASSWORD}`,
  )
}

// Exported so the seed can be driven programmatically and awaited.
export const seedDone = seed()
  .then(() => client.end())
  .catch(e => {
    console.error('SEED FAILED:', e)
    process.exit(1)
  })
