import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.resolve(__dirname, '../../data/marketing.db')
let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    const fs = require('fs')
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    migrate(db)
  }
  return db
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_name TEXT NOT NULL,
      cqc_id TEXT,
      address TEXT,
      postcode TEXT,
      phone TEXT,
      service_type TEXT,
      cqc_rating TEXT,
      last_inspection TEXT,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      contact_source TEXT,
      status TEXT DEFAULT 'new' CHECK(status IN ('new','enriched','contacted','replied','demo_booked','won','lost','skipped')),
      notes TEXT,
      campaign_stage INTEGER DEFAULT 0,
      last_contacted TEXT,
      next_followup TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
      template_name TEXT,
      subject TEXT,
      sent_at TEXT DEFAULT (datetime('now')),
      opened_at TEXT,
      clicked_at TEXT,
      status TEXT DEFAULT 'sent'
    );

    CREATE TABLE IF NOT EXISTS email_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scrape_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      providers_found INTEGER DEFAULT 0,
      new_leads INTEGER DEFAULT 0,
      status TEXT DEFAULT 'success',
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_postcode ON leads(postcode);
    CREATE INDEX IF NOT EXISTS idx_leads_rating ON leads(cqc_rating);
    CREATE INDEX IF NOT EXISTS idx_email_logs_lead ON email_logs(lead_id);
  `)
}
