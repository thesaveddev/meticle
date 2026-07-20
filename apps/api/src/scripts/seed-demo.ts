// Demo data seed for CareDesk. Creates a realistic demo org with 72% compliance.
// Run: npx tsx src/scripts/seed-demo.ts

import pool from '../shared/database'
import { v4 as uuid } from 'uuid'

async function seed() {
  console.log('Seeding demo data...')
  const orgId = uuid()
  const locationId = uuid()

  // 1. Organization
  await pool.query(`INSERT INTO organizations (id, name, status, plan, regulator, primary_color, secondary_color, accent_color, minimum_compliance_percent, auto_approve_documents) VALUES ($1,'Sunrise Supported Living','active','professional','cqc','#0F4C81','#16A34A','#F59E0B',70,true)`, [orgId])
  console.log('  Org created')

  // 2. Location
  await pool.query(`INSERT INTO locations (id, organization_id, name, address, minimum_staff_per_day, min_day_staff, min_night_staff) VALUES ($1,$2,'Harbour House','12 Marine Parade, Brighton BN2 1TL',3,2,1)`, [locationId, orgId])
  console.log('  Location created')

  // 3. Staff (15)
  const roles = ['CARE_WORKER','CARE_WORKER','CARE_WORKER','CARE_WORKER','CARE_WORKER','CARE_WORKER','CARE_WORKER','CARE_WORKER','CARE_WORKER','CARE_WORKER','MANAGER','MANAGER','COMPLIANCE_OFFICER','COMPLIANCE_OFFICER','ORG_ADMIN']
  const staffNames = [
    ['Sarah','Johnson'], ['Michael','Brown'], ['Emma','Williams'], ['James','Jones'],
    ['Lisa','Davis'], ['David','Miller'], ['Rachel','Wilson'], ['Thomas','Moore'],
    ['Jennifer','Taylor'], ['Robert','Anderson'], ['Amanda','Thomas'], ['Daniel','Jackson'],
    ['Patricia','White'], ['Richard','Harris'], ['Admin','User']
  ]
  const users: any[] = []
  const staffProfiles: any[] = []

  for (let i = 0; i < 15; i++) {
    const userId = uuid()
    const spId = uuid()
    const email = `${staffNames[i][0].toLowerCase()}.${staffNames[i][1].toLowerCase()}@sunrise.care`
    await pool.query(`INSERT INTO users (id, organization_id, email, first_name, last_name, role, status, password_hash) VALUES ($1,$2,$3,$4,$5,$6,'active','$2b$10$placeholderhash')`, [userId, orgId, email, staffNames[i][0], staffNames[i][1], roles[i]])
    await pool.query(`INSERT INTO staff_profiles (id, user_id, organization_id, first_name, last_name, location_id) VALUES ($1,$2,$3,$4,$5,$6)`, [spId, userId, orgId, staffNames[i][0], staffNames[i][1], i < 10 ? locationId : null])
    users.push({ id: userId, role: roles[i] })
    staffProfiles.push({ id: spId, userId, role: roles[i], name: staffNames[i] })
  }
  console.log('  15 staff created')

  // 4. Service Users (12)
  const suNames = [
    ['Arthur','Clarke','101','A12345678','Penicillin'],
    ['Margaret','Thatcher','102','A23456789',''],
    ['George','Orwell','103','A34567890','Latex'],
    ['Florence','Nightingale','104','A45678901','Aspirin, Penicillin'],
    ['Winston','Churchill','105','A56789012',''],
    ['Agatha','Christie','201','A67890123','Peanuts'],
    ['Alan','Turing','202','A78901234',''],
    ['Isaac','Newton','203','A89012345','Sulfa'],
    ['Charles','Darwin','204','A90123456',''],
    ['Jane','Austen','301','A01234567','Penicillin, Peanuts'],
    ['William','Shakespeare','302','A12345679',''],
    ['Mary','Seacole','303','A23456780','Latex, Aspirin'],
  ]
  const serviceUsers: any[] = []
  for (const su of suNames) {
    const id = uuid()
    await pool.query(`INSERT INTO service_users (id, organization_id, first_name, last_name, room_number, nhs_number, allergies, gp_name, gp_surgery, gp_phone, dietary_requirements, status) VALUES ($1,$2,$3,$4,$5,$6,$7,'Dr Miller','Harbour Medical Centre','01273 555010','Diabetic diet',$8)`,
      [id, orgId, su[0], su[1], su[2], su[3], JSON.stringify(su[4].split(', ').filter(Boolean)), su[4] ? 'active' : 'active'])
    serviceUsers.push({ id, name: su[0] + ' ' + su[1], room: su[2] })
  }
  console.log('  12 service users created')

  // 5. Training Modules (8 CQC-mandated)
  const modules = [
    { name:'Safeguarding Adults Level 2',category:'Safeguarding',cqcRoles:['CARE_WORKER','MANAGER','COMPLIANCE_OFFICER'] },
    { name:'Infection Prevention & Control',category:'Infection Control',cqcRoles:['CARE_WORKER','MANAGER'] },
    { name:'Fire Safety Awareness',category:'Fire Safety',cqcRoles:['CARE_WORKER','MANAGER'] },
    { name:'Moving & Handling People',category:'Manual Handling',cqcRoles:['CARE_WORKER'] },
    { name:'Medication Management',category:'Medication',cqcRoles:['CARE_WORKER','MANAGER'] },
    { name:'Emergency First Aid at Work',category:'First Aid',cqcRoles:['CARE_WORKER','MANAGER'] },
    { name:'GDPR & Data Protection',category:'Mandatory',cqcRoles:['CARE_WORKER','MANAGER','COMPLIANCE_OFFICER','ORG_ADMIN'] },
    { name:'Mental Capacity Act & DoLS',category:'Mandatory',cqcRoles:['CARE_WORKER','MANAGER','COMPLIANCE_OFFICER'] },
  ]
  const moduleIds: string[] = []
  for (const m of modules) {
    const id = uuid()
    await pool.query(`INSERT INTO training_modules (id, organization_id, name, category, frequency_days, is_mandatory, cqc_mandated, cqc_mandated_for_roles) VALUES ($1,$2,$3,$4,365,true,true,$5)`, [id, orgId, m.name, m.category, JSON.stringify(m.cqcRoles)])
    moduleIds.push(id)
  }
  console.log('  8 training modules created')

  // 6. Training Records (60+ mixed statuses)
  let created = 0
  for (const sp of staffProfiles) {
    for (let mi = 0; mi < moduleIds.length; mi++) {
      // Skip some to create gaps (~72% completion)
      if (Math.random() < 0.3) continue
      const status = Math.random() < 0.15 ? 'expired' : Math.random() < 0.1 ? 'incomplete' : 'completed'
      const daysAgo = Math.floor(Math.random() * 365)
      const completedAt = status === 'completed' ? new Date(Date.now() - daysAgo * 86400000).toISOString() : null
      const expiresAt = status === 'completed' ? new Date(Date.now() - daysAgo * 86400000 + 365 * 86400000).toISOString() : null
      // Make some expired
      const actualExpires = expiresAt && Math.random() < 0.2 ? new Date(Date.now() - Math.random() * 30 * 86400000).toISOString() : expiresAt
      const actualStatus = actualExpires && new Date(actualExpires) < new Date() ? 'expired' : status
      await pool.query(`INSERT INTO training_records (module_id, staff_id, completed_at, expires_at, status) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [moduleIds[mi], sp.id, completedAt, actualExpires, actualStatus])
      created++
    }
  }
  console.log(`  ${created} training records created`)

  // 7. Identity Documents (20)
  for (const sp of staffProfiles) {
    const types = ['DBS','PASSPORT']
    for (const type of types) {
      const status = Math.random() < 0.15 ? 'expired' : 'approved'
      const daysFromNow = status === 'expired' ? -Math.floor(Math.random() * 60) : Math.floor(Math.random() * 365)
      await pool.query(`INSERT INTO documents (staff_id, type, url, expiry_date, status) VALUES ($1,$2,'/files/private/demo-doc.pdf',$3,$4)`,
        [sp.id, type, new Date(Date.now() + daysFromNow * 86400000).toISOString().split('T')[0], status])
    }
  }
  console.log('  20 identity documents created')

  // 8. Compliance Records (staff below threshold pattern)
  for (const sp of staffProfiles.slice(0, 10)) {
    await pool.query(`INSERT INTO compliance_records (staff_id, requirement_id, status) VALUES ($1,(SELECT id FROM compliance_config WHERE organization_id=$2 LIMIT 1),$3) ON CONFLICT DO NOTHING`,
      [sp.id, orgId, Math.random() < 0.3 ? 'incomplete' : 'complete'])
  }
  console.log('  Compliance records created')

  // 9. Incidents (6)
  const incidents = [
    { title:'Fall in bathroom', severity:'medium', status:'resolved', daysAgo:45 },
    { title:'Medication error — wrong dose', severity:'high', status:'investigating', daysAgo:3 },
    { title:'Resident altercation', severity:'low', status:'resolved', daysAgo:20 },
    { title:'Pressure sore discovered', severity:'medium', status:'reported', daysAgo:7 },
    { title:'Slip in corridor', severity:'low', status:'resolved', daysAgo:60 },
    { title:'Aggressive behaviour incident', severity:'high', status:'investigating', daysAgo:5 },
  ]
  for (const inc of incidents) {
    await pool.query(`INSERT INTO incidents (id, organization_id, title, severity, status, occurred_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [uuid(), orgId, inc.title, inc.severity, inc.status, new Date(Date.now() - inc.daysAgo * 86400000).toISOString()])
  }
  console.log('  6 incidents created')

  // 10. Care Plans (18)
  const planCategories = ['personal_care','medication','mobility','nutrition','mental_health','behaviour']
  for (const su of serviceUsers) {
    for (let i = 0; i < 2; i++) {
      const cat = planCategories[Math.floor(Math.random() * planCategories.length)]
      await pool.query(`INSERT INTO care_plans (service_user_id, title, category, description, status, review_date) VALUES ($1,$2,$3,'Individualised care plan for '||$2,$4,$5)`,
        [su.id, `${cat.replace(/_/g,' ')} support plan`, cat, Math.random() < 0.2 ? 'archived' : 'active', new Date(Date.now() + 90*86400000).toISOString().split('T')[0]])
    }
  }
  console.log('  18 care plans created')

  // 11. Satisfaction Surveys (8)
  for (let i = 0; i < 8; i++) {
    const ratings = [2,3,4,4,5,5,3,4]
    await pool.query(`INSERT INTO satisfaction_surveys (organization_id, service_user_id, respondent_name, relationship, rating, comments) VALUES ($1,$2,$3,$4,$5,$6)`,
      [orgId, serviceUsers[i % serviceUsers.length].id, `Family Member ${i+1}`, 'Family Member', ratings[i], ratings[i] >= 4 ? 'Very happy with the care provided' : 'Some concerns about communication'])
  }
  console.log('  8 satisfaction surveys created')

  // 12. Shifts (current week)
  const shiftTypes = ['day','day','day','wake_night','sleep']
  for (let d = 0; d < 7; d++) {
    const date = new Date(Date.now() + d * 86400000)
    for (let s = 0; s < 3; s++) {
      const shId = uuid()
      const hour = shiftTypes[s] === 'day' ? 8 : shiftTypes[s] === 'wake_night' ? 20 : 22
      const endHour = shiftTypes[s] === 'day' ? 20 : shiftTypes[s] === 'wake_night' ? 8 : 7
      const startTime = new Date(date); startTime.setHours(hour, 0, 0, 0)
      const endTime = new Date(date); endTime.setHours(endHour, 0, 0, 0)
      if (endHour < hour) endTime.setDate(endTime.getDate()+1)
      await pool.query(`INSERT INTO shifts (id, location_id, start_time, end_time, shift_type, status) VALUES ($1,$2,$3,$4,$5,$6)`,
        [shId, locationId, startTime.toISOString(), endTime.toISOString(), shiftTypes[s], s < 2 ? 'assigned' : 'open'])
      if (s < 2) {
        await pool.query(`INSERT INTO shift_assignments (shift_id, staff_id, status) VALUES ($1,$2,'assigned')`,
          [shId, staffProfiles[s + d % 10].id])
      }
    }
  }
  console.log('  21 shifts created')

  // 13. Appointments (5)
  for (let i = 0; i < 5; i++) {
    await pool.query(`INSERT INTO appointments (id, organization_id, service_user_id, title, start_time, end_time, status, location_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [uuid(), orgId, serviceUsers[i].id, ['GP Appointment','Dentist Checkup','Physiotherapy','Hairdresser Visit','Optician'][i],
        new Date(Date.now() + i * 86400000 + 9*3600000).toISOString(),
        new Date(Date.now() + i * 86400000 + 10*3600000).toISOString(), 'scheduled', locationId])
  }
  console.log('  5 appointments created')

  // 14. Goals (10)
  for (let i = 0; i < 10; i++) {
    const progress = Math.floor(Math.random() * 100)
    await pool.query(`INSERT INTO service_user_goals (organization_id, service_user_id, title, description, status, progress, target_date, cqc_domain) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [orgId, serviceUsers[i % serviceUsers.length].id,
        ['Increase mobility','Improve nutrition','Social engagement','Personal hygiene routine','Medication adherence'][i % 5],
        `Working towards this goal with daily support`, progress >= 100 ? 'completed' : 'active', progress,
        new Date(Date.now() + 30*86400000).toISOString().split('T')[0], ['safe','effective','caring','responsive','well-led'][i % 5]])
  }
  console.log('  10 goals created')

  // 15. Room Checks (8)
  for (let i = 0; i < 8; i++) {
    await pool.query(`INSERT INTO room_checks (organization_id, location_id, room_number, checked_by, check_date, status, cleanliness_rating, safety_rating, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [orgId, locationId, ['101','102','103','104','105','201','202','301'][i],
        staffProfiles[10 + Math.floor(Math.random()*2)].id,
        new Date(Date.now() - i * 7 * 86400000).toISOString().split('T')[0],
        i < 6 ? 'pass' : i === 6 ? 'needs_attention' : 'fail',
        i < 6 ? 4 + Math.floor(Math.random()*2) : 2, i < 6 ? 5 : 3, i < 6 ? '' : 'Cracked window seal needs repair'])
  }
  console.log('  8 room checks created')

  // 16. Tasks (8)
  for (let i = 0; i < 8; i++) {
    await pool.query(`INSERT INTO tasks (organization_id, title, description, assigned_to, service_user_id, priority, status, due_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [orgId, ['Review care plans','Order medication supplies','Fire safety check','Update risk assessments','Staff supervisions','Window repair Room 204','Garden maintenance check','New resident assessment'][i],
        '', staffProfiles[10 + i % 3].id, serviceUsers[i % serviceUsers.length].id,
        ['medium','high','low','medium','high','urgent','low','medium'][i],
        i < 3 ? 'completed' : i < 6 ? 'pending' : 'in_progress',
        new Date(Date.now() + (i < 3 ? -7 : 7) * 86400000).toISOString().split('T')[0]])
  }
  console.log('  8 tasks created')

  console.log('\n✓ Demo data seeded successfully!')
  console.log(`  Org ID: ${orgId}`)
  console.log(`  Login email: admin.user@sunrise.care`)
  console.log(`  Login password: Admin123! (or whatever you set)`)
  await pool.end()
}

seed().catch(e => { console.error('Seed failed:', e); process.exit(1) })
