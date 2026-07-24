import pool from '../src/shared/database'

async function run() {
  const cols = [
    `ALTER TABLE daily_notes ADD COLUMN IF NOT EXISTS ai_mood_analysis JSONB`,
    `ALTER TABLE daily_notes ADD COLUMN IF NOT EXISTS ai_safeguarding_flags JSONB`,
    `ALTER TABLE daily_notes ADD COLUMN IF NOT EXISTS ai_care_plan_updates JSONB`,
    `ALTER TABLE daily_notes ADD COLUMN IF NOT EXISTS ai_interventions JSONB`,
    `ALTER TABLE daily_notes ADD COLUMN IF NOT EXISTS ai_risk_level VARCHAR(20)`,
    `ALTER TABLE daily_notes ADD COLUMN IF NOT EXISTS ai_follow_up_required BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE daily_notes ADD COLUMN IF NOT EXISTS ai_follow_up_details TEXT`,
  ]
  for (const sql of cols) {
    await pool.query(sql)
    console.log('OK:', sql.substring(0, 60))
  }
  console.log('All columns added')
  await pool.end()
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
