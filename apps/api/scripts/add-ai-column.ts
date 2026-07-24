import pool from '../src/shared/database'

async function run() {
  await pool.query(`ALTER TABLE daily_notes ADD COLUMN IF NOT EXISTS generated_by_ai BOOLEAN NOT NULL DEFAULT FALSE`)
  console.log('Column generated_by_ai added to daily_notes')
  process.exit(0)
}

run().catch(e => { console.error(e); process.exit(1) })
