// Minimal production seed — 4 named users only
// Run in container: node apps/api/dist/scripts/seed-team.js
// All users login with: DemoPass123!
//
// Every seeded user gets the same published password, so this is only
// appropriate for a real deployment where those four accounts are known to the
// people who own them and their credentials are changed before the deployment
// carries real care data. Set SEED_TEAM_PASSWORD to override it, and see
// scripts/seed-dreakcare.js for the workflow-driven alternative, which is the
// one to use for demo data.

import pool from '../shared/database'
import { v4 as uuid } from 'uuid'
import bcrypt from 'bcryptjs'

// Cost 12, not 10 — see seed-orbis.ts.
const PWH = bcrypt.hashSync(process.env.SEED_TEAM_PASSWORD || 'DemoPass123!', 12)

async function seed() {
  console.log('\n=== Seeding Meticle Team (4 users) ===\n')

  const orgId = uuid()
  const locId = uuid()

  // ── Organization ──
  await pool.query(
    `INSERT INTO organizations (id,name,status,plan,subscription_status,trial_ends_at)
     VALUES ($1,'Meticle Care','active','professional','trial',$2)`,
    [orgId, new Date(Date.now() + 90 * 86400000).toISOString()]
  )
  console.log('  ✓ Organization "Meticle Care" created')

  // ── Location ──
  await pool.query(
    `INSERT INTO locations (id,organization_id,name,address,minimum_staff_per_day)
     VALUES ($1,$2,'Head Office','',1)`,
    [locId, orgId]
  )
  console.log('  ✓ 1 location created')

  // ── Users ──
  const users = [
    { email: 'itsopeyemi@gmail.com', first: 'Opeyemi', last: 'Olorunfemi', role: 'ORG_ADMIN' },
    { email: 'linkhopey@gmail.com', first: 'Hope', last: 'Link', role: 'MANAGER' },
    { email: 'gistline2@gmail.com', first: 'Gist', last: 'Line', role: 'MANAGER' },
    { email: 'opeyemiolorunfemy@gmail.com', first: 'Opeyemi', last: 'Olorunfemy', role: 'CARE_WORKER' },
  ]

  for (const u of users) {
    const uid = uuid()
    // Remove existing user with this email (re-runnable)
    await pool.query(`DELETE FROM users WHERE email = $1`, [u.email])
    await pool.query(
      `INSERT INTO users (id,organization_id,email,role,status,password_hash,email_verified)
       VALUES ($1,$2,$3,$4,'active',$5,true)`,
      [uid, orgId, u.email, u.role, PWH]
    )
    await pool.query(
      `INSERT INTO staff_profiles (id,user_id,first_name,last_name,location_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [uuid(), uid, u.first, u.last, locId]
    )
    console.log(`  ✓ ${u.role.padEnd(12)} ${u.email}`)
  }

  console.log('\n=== Seed complete. Password for all: DemoPass123! ===\n')
  await pool.end()
}

seed().catch(async (err) => {
  console.error('Seed failed:', err)
  await pool.end()
  process.exit(1)
})
