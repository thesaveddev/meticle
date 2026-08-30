import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'loadly.db');

// Ensure data directory exists
import fs from 'fs';
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ───
db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT 'cleaning',
    description TEXT,
    short_description TEXT,
    base_price REAL,
    price_unit TEXT DEFAULT 'per job',
    features TEXT DEFAULT '[]',
    icon TEXT,
    active INTEGER DEFAULT 1,
    coming_soon INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS enquiries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    service TEXT NOT NULL,
    postcode TEXT,
    description TEXT,
    preferred_date TEXT,
    preferred_time TEXT,
    status TEXT DEFAULT 'new',
    quoted_price REAL,
    quote_breakdown TEXT,
    quote_context TEXT,
    ai_session_id TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    enquiry_id TEXT,
    service_type TEXT,
    property_type TEXT,
    property_size TEXT,
    rooms INTEGER,
    bathrooms INTEGER,
    context TEXT,
    questions_asked TEXT DEFAULT '[]',
    responses TEXT DEFAULT '{}',
    estimated_price REAL,
    price_breakdown TEXT,
    confidence REAL DEFAULT 0.5,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'cleaner',
    email TEXT,
    phone TEXT,
    hourly_rate REAL,
    status TEXT DEFAULT 'active',
    skills TEXT DEFAULT '[]',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    enquiry_id TEXT,
    staff_id TEXT,
    service TEXT NOT NULL,
    postcode TEXT,
    scheduled_date TEXT,
    scheduled_time TEXT,
    duration_hours REAL,
    status TEXT DEFAULT 'booked',
    price REAL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (enquiry_id) REFERENCES enquiries(id),
    FOREIGN KEY (staff_id) REFERENCES staff(id)
  );
`);

// ─── Seed services ───
const serviceCount = db.prepare('SELECT COUNT(*) as count FROM services').get() as any;
if (serviceCount.count === 0) {
  const insertService = db.prepare(`
    INSERT INTO services (id, name, slug, category, description, short_description, base_price, price_unit, features, icon, coming_soon)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const services = [
    ['svc-01', 'End of Tenancy Cleaning', 'end-of-tenancy', 'cleaning', 'Professional deep cleaning to get your full deposit back. We clean every corner, appliance, and surface to landlord standards.', 'Deep clean for deposit return', 120, 'per flat', JSON.stringify(['Full kitchen deep clean', 'Bathroom sanitisation', 'Carpet cleaning', 'Window cleaning', 'Oven & appliance clean', 'Deposit-back guarantee']), 'sparkles', 0],
    ['svc-02', 'Regular Home Cleaning', 'regular-cleaning', 'cleaning', 'Weekly, fortnightly, or monthly cleaning to keep your home spotless. Choose a routine that fits your life.', 'Recurring home cleaning', 45, 'per visit', JSON.stringify(['Dusting & vacuuming', 'Kitchen & bathroom wipe-down', 'Floor mopping', 'Bin emptying', 'Flexible scheduling']), 'house', 0],
    ['svc-03', 'Office Cleaning', 'office-cleaning', 'cleaning', 'After-hours or daytime office cleaning for a productive, professional workspace. Covering single offices to multi-floor commercial.', 'Commercial workspace cleaning', 60, 'per session', JSON.stringify(['Desk & workstation cleaning', 'Kitchen & breakroom', 'Toilet sanitisation', 'Floor care', 'Bin management', 'Flexible scheduling']), 'building', 0],
    ['svc-04', 'Deep Cleaning', 'deep-cleaning', 'cleaning', 'Intensive, top-to-bottom cleaning for homes that need extra attention. Ideal for seasonal cleans or pre-sale preparation.', 'Intensive top-to-bottom clean', 150, 'per job', JSON.stringify(['Inside all appliances', 'Grout & tile scrubbing', 'Skirting boards & radiators', 'Full window internal clean', 'Cupboard interiors']), 'star', 0],
    ['svc-05', 'Carpet Cleaning', 'carpet-cleaning', 'cleaning', 'Professional hot-water extraction carpet cleaning. Removes stains, allergens, and odours from all carpet types.', 'Steam & stain removal', 80, 'per room', JSON.stringify(['Hot water extraction', 'Stain treatment', 'Deodorising', 'Allergen removal', 'All carpet types']), 'layers', 0],
    ['svc-06', 'Post-Construction Clean', 'post-construction', 'cleaning', 'After builders leave, we handle the mess. Dust, debris, paint marks, adhesive residue — all cleared.', 'Builder\'s mess removal', 200, 'per job', JSON.stringify(['Construction dust removal', 'Paint & adhesive cleanup', 'Window & frame cleaning', 'Floor restoration', 'Full property clean']), 'hard-hat', 0],
    ['svc-07', 'Logistics & Moving', 'logistics', 'logistics', 'Professional moving and logistics services. From single items to full house moves across South Wales.', 'Moving & transport services', 150, 'per job', JSON.stringify(['Domestic moves', 'Office relocations', 'Single item delivery', 'Furniture transport', 'South Wales coverage']), 'truck', 1],
    ['svc-08', 'HVAC Services', 'hvac', 'facilities', 'Heating, ventilation, and air conditioning installation, maintenance, and repair.', 'Heating & cooling systems', 180, 'per job', JSON.stringify(['AC installation & repair', 'Boiler servicing', 'Ventilation maintenance', 'Energy efficiency audits']), 'thermometer', 1],
    ['svc-09', 'Facilities Management', 'facilities', 'facilities', 'Complete building maintenance — cleaning, repairs, HVAC, and everything in between.', 'Total building care', 0, 'custom quote', JSON.stringify(['Scheduled maintenance', 'Emergency response', 'Multi-service packages', 'Dedicated account manager']), 'castle', 1],
  ];

  const insertMany = db.transaction(() => {
    for (const s of services) insertService.run(...s);
  });
  insertMany();
}

// ─── Seed demo staff ───
const staffCount = db.prepare('SELECT COUNT(*) as count FROM staff').get() as any;
if (staffCount.count === 0) {
  const insertStaff = db.prepare(`
    INSERT INTO staff (id, name, role, phone, hourly_rate, status, skills)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertStaff.run('stf-01', 'Jane Smith', 'cleaner', '07123 456789', 15, 'active', JSON.stringify(['end-of-tenancy', 'deep-clean', 'carpet']));
  insertStaff.run('stf-02', 'Mark Jones', 'cleaner', '07987 654321', 14, 'active', JSON.stringify(['regular', 'office', 'carpet']));
  insertStaff.run('stf-03', 'Sarah Williams', 'driver', '07456 123789', 16, 'active', JSON.stringify(['logistics', 'moving']));
}

export default db;
