import { Pool } from 'pg'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://meticle:meticle_secret@localhost:5432/meticle'

const pool = new Pool({ connectionString: DATABASE_URL })

const ORG_NAME = 'DreakCare'
const ORG_SLUG = 'dreakcare'
const PASSWORD = 'Password123$'

const STAFF = [
  { email: 'opeyemiolorunfemy@gmail.com', first_name: 'Opeyemi', last_name: 'Olorunfemi', role: 'ORG_ADMIN' },
  { email: 'opeyemi@meticlecare.com', first_name: 'Opeyemi', last_name: 'Admin', role: 'MANAGER' },
  { email: 'linkhopey@gmail.com', first_name: 'Hope', last_name: 'Link', role: 'MANAGER' },
  { email: 'sarah.johnson@dreakcare.co.uk', first_name: 'Sarah', last_name: 'Johnson', role: 'CARE_WORKER' },
  { email: 'james.williams@dreakcare.co.uk', first_name: 'James', last_name: 'Williams', role: 'CARE_WORKER' },
  { email: 'emma.brown@dreakcare.co.uk', first_name: 'Emma', last_name: 'Brown', role: 'CARE_WORKER' },
  { email: 'david.smith@dreakcare.co.uk', first_name: 'David', last_name: 'Smith', role: 'CARE_WORKER' },
  { email: 'lisa.taylor@dreakcare.co.uk', first_name: 'Lisa', last_name: 'Taylor', role: 'CARE_WORKER' },
  { email: 'michael.davis@dreakcare.co.uk', first_name: 'Michael', last_name: 'Davis', role: 'CARE_WORKER' },
  { email: 'rachel.wilson@dreakcare.co.uk', first_name: 'Rachel', last_name: 'Wilson', role: 'COMPLIANCE_OFFICER' },
]

const CLIENTS = [
  { first_name: 'Margaret', last_name: 'Thompson', dob: '1942-03-15', address: '12 Oak Lane, Birmingham B15 2TT', allergies: ['Penicillin', 'Latex'], support_level: 'minimal' },
  { first_name: 'Arthur', last_name: 'Bennett', dob: '1938-11-22', address: '45 Maple Road, Birmingham B16 0AA', allergies: ['Shellfish'], support_level: 'one_to_one' },
  { first_name: 'Dorothy', last_name: 'Hughes', dob: '1945-07-08', address: '78 Elm Street, Solihull B91 3BZ', allergies: [], support_level: 'minimal' },
  { first_name: 'Walter', last_name: 'Green', dob: '1940-01-30', address: '23 Cedar Avenue, Sutton Coldfield B73 6AP', allergies: ['Aspirin', 'Codeine'], support_level: 'one_to_one' },
  { first_name: 'Betty', last_name: 'Adams', dob: '1943-09-12', address: '56 Birch Close, Wolverhampton WV1 2QR', allergies: [], support_level: 'minimal' },
  { first_name: 'George', last_name: 'Clark', dob: '1936-05-19', address: '91 Pine Drive, Walsall WS1 1AB', allergies: ['Peanuts', 'Dust mites'], support_level: 'two_to_one' },
  { first_name: 'Edna', last_name: 'Robinson', dob: '1944-12-03', address: '14 Willow Way, West Bromwich B70 8DE', allergies: [], support_level: 'minimal' },
  { first_name: 'Frank', last_name: 'Hall', dob: '1939-08-25', address: '67 Ash Grove, Dudley DY1 3FG', allergies: ['Ibuprofen'], support_level: 'one_to_one' },
]

const LOCATIONS = [
  { name: 'DreakCare Office', address: '100 Corporation Street, Birmingham B4 6AY', type: 'office' },
  { name: 'South Birmingham Hub', address: '25 Bristol Road, Birmingham B5 7AA', type: 'hub' },
]

const VISIT_TYPES = ['morning', 'lunch', 'tea', 'evening', 'night', 'medication']
const FUNDING_TYPES = ['private', 'local_authority', 'nhs']

function uuid() { return crypto.randomUUID() }
function daysFromNow(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d }
function timeSlot(hour: number, minutes = 0) { const d = new Date(); d.setHours(hour, minutes, 0, 0); return d }

async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. Create organisation
    const orgId = uuid()
    const hashedPassword = await bcrypt.hash(PASSWORD, 12)
    await client.query(`
      INSERT INTO organizations (id, name, slug, subscription_status, service_types, onboarding_completed, billing_settings)
      VALUES ($1, $2, $3, 'active', '["domiciliary"]', true, '{"vat_rate": 20, "default_funding_type": "private"}')
    `, [orgId, ORG_NAME, ORG_SLUG])
    console.log(`Created org: ${ORG_NAME} (${orgId})`)

    // 2. Create locations
    const locationIds: string[] = []
    for (const loc of LOCATIONS) {
      const locId = uuid()
      locationIds.push(locId)
      await client.query(`
        INSERT INTO locations (id, organization_id, name, address, status)
        VALUES ($1, $2, $3, $4, 'active')
      `, [locId, orgId, loc.name, loc.address])
    }
    console.log(`Created ${LOCATIONS.length} locations`)

    // 3. Create staff
    const staffIds: string[] = []
    for (const s of STAFF) {
      const userId = uuid()
      const staffId = uuid()
      staffIds.push(staffId)
      await client.query(`
        INSERT INTO users (id, organization_id, email, password_hash, first_name, last_name, role, email_verified)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      `, [userId, orgId, s.email, hashedPassword, s.first_name, s.last_name, s.role])
      await client.query(`
        INSERT INTO staff_profiles (id, user_id, organization_id, first_name, last_name, status)
        VALUES ($1, $2, $3, $4, $5, 'active')
      `, [staffId, userId, orgId, s.first_name, s.last_name])
      console.log(`Created staff: ${s.first_name} ${s.last_name} (${s.role})`)
    }

    // 4. Create clients
    const personIds: string[] = []
    for (const c of CLIENTS) {
      const personId = uuid()
      personIds.push(personId)
      await client.query(`
        INSERT INTO people (id, organization_id, first_name, last_name, date_of_birth, address, allergies, support_level, status, location_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9)
      `, [personId, orgId, c.first_name, c.last_name, c.dob, c.address, JSON.stringify(c.allergies), c.support_level, locationIds[0]])
    }
    console.log(`Created ${CLIENTS.length} clients`)

    // 5. Create mileage policies
    const mileagePolicies = [
      { tax_year: '2024/25', vehicle_type: 'car', fuel_category: 'petrol', rate_pence: 45 },
      { tax_year: '2024/25', vehicle_type: 'car', fuel_category: 'diesel', rate_pence: 45 },
      { tax_year: '2024/25', vehicle_type: 'car', fuel_category: 'hybrid', rate_pence: 45 },
      { tax_year: '2024/25', vehicle_type: 'car', fuel_category: 'electric', rate_pence: 9 },
      { tax_year: '2024/25', vehicle_type: 'motorcycle', fuel_category: 'petrol', rate_pence: 24 },
      { tax_year: '2024/25', vehicle_type: 'bicycle', fuel_category: 'not_applicable', rate_pence: 20 },
    ]
    for (const mp of mileagePolicies) {
      await client.query(`
        INSERT INTO homecare_mileage_policies (id, organization_id, tax_year, vehicle_type, fuel_category, rate_pence, is_active, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, true, $7)
      `, [uuid(), orgId, mp.tax_year, mp.vehicle_type, mp.fuel_category, mp.rate_pence, staffIds[0]])
    }
    console.log(`Created ${mileagePolicies.length} mileage policies`)

    // 6. Create care packages for each client
    const packageIds: string[] = []
    for (let i = 0; i < personIds.length; i++) {
      const pkgId = uuid()
      packageIds.push(pkgId)
      const funding = FUNDING_TYPES[i % FUNDING_TYPES.length]
      await client.query(`
        INSERT INTO homecare_packages (id, organization_id, person_id, name, status, funding_type, hourly_rate_pence, travel_time_paid, mileage_rate_pence, start_date)
        VALUES ($1, $2, $3, $4, 'active', $5, $6, true, 45, CURRENT_DATE)
      `, [pkgId, orgId, personIds[i], `${CLIENTS[i].first_name}'s care package`, funding, 1800 + (i * 100)])
    }
    console.log(`Created ${packageIds.length} care packages`)

    // 7. Create care plans
    const carePlanCategories = ['medication', 'nutrition', 'mobility', 'personal_care', 'social']
    for (let i = 0; i < personIds.length; i++) {
      for (let j = 0; j < 2; j++) {
        const cat = carePlanCategories[(i + j) % carePlanCategories.length]
        await client.query(`
          INSERT INTO care_plans (id, person_id, title, category, description, status, review_date)
          VALUES ($1, $2, $3, $4, $5, 'active', $6)
        `, [
          uuid(), personIds[i],
          `${cat.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} plan for ${CLIENTS[i].first_name}`,
          cat,
          `Detailed ${cat.replace(/_/g, ' ')} support plan for ${CLIENTS[i].first_name} ${CLIENTS[i].last_name}. This plan outlines the specific support needs, goals, and interventions required.`,
          daysFromNow(30 + j * 30),
        ])
      }
    }
    console.log('Created care plans for all clients')

    // 8. Create visit plans and generate visits for the next 7 days
    const careWorkers = staffIds.slice(3) // Only care workers
    let visitCount = 0
    for (let day = 0; day < 7; day++) {
      const date = daysFromNow(day)
      const dayOfWeek = date.getDay()

      for (let i = 0; i < personIds.length; i++) {
        // Each client gets 2-3 visits per day
        const visitsPerDay = i % 3 === 0 ? 3 : 2
        const visitTimes = [
          { hour: 8, minute: 0, duration: 30, type: 'morning' },
          { hour: 12, minute: 30, duration: 45, type: 'lunch' },
          { hour: 17, minute: 0, duration: 30, type: 'evening' },
        ].slice(0, visitsPerDay)

        for (const vt of visitTimes) {
          const visitId = uuid()
          const start = new Date(date)
          start.setHours(vt.hour, vt.minute, 0, 0)
          const end = new Date(start.getTime() + vt.duration * 60000)

          // Assign carer round-robin, but some visits stay unassigned
          const isUnassigned = day === 6 && i > 4 // Some unassigned on Sunday
          const carerId = isUnassigned ? null : careWorkers[(i + day) % careWorkers.length]

          const status = day < 0 ? 'completed' : day === 0 ? 'scheduled' : 'scheduled'

          await client.query(`
            INSERT INTO homecare_visits (id, organization_id, package_id, person_id, assigned_staff_id, visit_type, label, scheduled_start, scheduled_end, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [visitId, orgId, packageIds[i], personIds[i], carerId, vt.type, `${vt.type.charAt(0).toUpperCase() + vt.type.slice(1)} call`, start.toISOString(), end.toISOString(), status])
          visitCount++
        }
      }
    }
    console.log(`Created ${visitCount} visits over 7 days`)

    // 9. Create some completed visits with mileage for the past 3 days
    let completedCount = 0
    for (let day = -3; day < 0; day++) {
      const date = daysFromNow(day)
      for (let i = 0; i < Math.min(personIds.length, 5); i++) {
        const visitId = uuid()
        const start = new Date(date)
        start.setHours(9 + i, 0, 0, 0)
        const end = new Date(start.getTime() + 30 * 60000)
        const carerId = careWorkers[i % careWorkers.length]

        const checkIn = new Date(start.getTime() + 5 * 60000)
        const checkOut = new Date(end.getTime() - 2 * 60000)
        const mileage = 2 + Math.random() * 8
        const travelMinutes = 10 + Math.floor(Math.random() * 20)

        await client.query(`
          INSERT INTO homecare_visits (id, organization_id, package_id, person_id, assigned_staff_id, visit_type, label, scheduled_start, scheduled_end, status,
            check_in_at, check_out_at, check_in_latitude, check_in_longitude, actual_travel_minutes, actual_mileage_miles, mileage_status, visit_notes)
          VALUES ($1, $2, $3, $4, $5, 'routine', 'Completed call', $6, $7, 'completed',
            $8, $9, $10, $11, $12, $13, 'submitted', $14)
        `, [
          visitId, orgId, packageIds[i], personIds[i], carerId,
          start.toISOString(), end.toISOString(),
          checkIn.toISOString(), checkOut.toISOString(),
          52.4862 + (Math.random() * 0.02), -1.8904 + (Math.random() * 0.02), // Birmingham-ish coords
          travelMinutes, mileage.toFixed(2),
          `Routine ${VISIT_TYPES[i % VISIT_TYPES.length]} call completed. Client was well.`,
        ])
        completedCount++
      }
    }
    console.log(`Created ${completedCount} completed visits with mileage`)

    // 10. Create some timesheets for completed visits
    const completedVisits = await client.query(`
      SELECT id, assigned_staff_id, organization_id FROM homecare_visits
      WHERE organization_id = $1 AND status = 'completed' AND actual_mileage_miles IS NOT NULL
    `, [orgId])

    for (const v of completedVisits.rows) {
      const workMinutes = 25 + Math.floor(Math.random() * 10)
      const travelMinutes = 10 + Math.floor(Math.random() * 15)
      const paidTravel = Math.min(travelMinutes, 15)
      const mileage = Number((2 + Math.random() * 8).toFixed(2))
      const grossPay = Math.round((workMinutes + paidTravel) * 20) // £20/hr approx

      await client.query(`
        INSERT INTO homecare_timesheets (id, organization_id, visit_id, carer_id, work_minutes, travel_minutes, paid_travel_minutes, mileage_miles, mileage_rate_pence, gross_pay_pence, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 45, $9, 'submitted')
      `, [uuid(), orgId, v.id, v.assigned_staff_id, workMinutes, travelMinutes, paidTravel, mileage, grossPay])
    }
    console.log(`Created timesheets for ${completedVisits.rows.length} completed visits`)

    // 11. Create family contacts for some clients
    for (let i = 0; i < 4; i++) {
      await client.query(`
        INSERT INTO family_contacts (id, person_id, name, relationship, phone, email, is_emergency_contact)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        uuid(), personIds[i],
        `${CLIENTS[i].first_name}'s ${i % 2 === 0 ? 'daughter' : 'son'}`,
        i % 2 === 0 ? 'Daughter' : 'Son',
        `07${String(Math.floor(100000000 + Math.random() * 900000000))}`,
        `${CLIENTS[i].last_name.toLowerCase()}family@email.com`,
        i < 2,
      ])
    }
    console.log('Created family contacts')

    await client.query('COMMIT')
    console.log('\n=== Seed complete ===')
    console.log(`Organisation: ${ORG_NAME}`)
    console.log(`Login with any email above, password: ${PASSWORD}`)
    console.log('Staff roles:')
    STAFF.forEach(s => console.log(`  ${s.email} → ${s.role}`))
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Seed failed:', err)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

seed().catch(process.exit)
