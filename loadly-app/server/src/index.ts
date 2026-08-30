import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { v4 as uuid } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import db from './db.js';
import { createSession, processMessage, getSession } from './ai/engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── Email transporter ───
let transporter: nodemailer.Transporter | null = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendEmailNotification(subject: string, body: string) {
  if (!transporter) {
    console.log(`[EMAIL LOG] ${subject}\n${body}\n`);
    return;
  }
  try {
    await transporter.sendMail({
      from: `"Loadly" <${process.env.SMTP_USER}>`,
      to: process.env.EMAIL_TO || 'bookings@loadlygroup.co.uk',
      subject,
      text: body,
    });
  } catch (err) {
    console.error('Email failed:', err);
  }
}

// ─── Health ───
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'loadly-api', timestamp: new Date().toISOString() });
});

// ─── Services ───
app.get('/api/services', (_req, res) => {
  const services = db.prepare('SELECT * FROM services ORDER BY coming_soon ASC, name').all();
  res.json(services);
});

app.get('/api/services/:slug', (req, res) => {
  const service = db.prepare('SELECT * FROM services WHERE slug = ?').get(req.params.slug);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  res.json(service);
});

// ─── Quote Engine ───
app.post('/api/quote/start', (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  const sessionId = createSession();
  processMessage(sessionId, message).then(result => {
    // Save quote to DB
    const quoteId = uuid();
    db.prepare(`
      INSERT INTO quotes (id, session_id, service_type, property_type, property_size, rooms, bathrooms, context, estimated_price, price_breakdown, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      quoteId, sessionId, result.context.serviceType, result.context.propertyType,
      result.context.propertySize, result.context.rooms, result.context.bathrooms,
      JSON.stringify(result.context), result.estimatedPrice,
      JSON.stringify(result.breakdown), result.confidence
    );

    res.json({ ...result, quoteId });
  }).catch(err => {
    console.error('Quote error:', err);
    res.status(500).json({ error: 'Failed to process quote' });
  });
});

app.post('/api/quote/continue', (req, res) => {
  const { sessionId, message } = req.body;
  if (!sessionId || !message) return res.status(400).json({ error: 'sessionId and message are required' });

  processMessage(sessionId, message).then(result => {
    // Update quote in DB
    db.prepare(`
      UPDATE quotes SET context = ?, estimated_price = ?, price_breakdown = ?, confidence = ?, updated_at = datetime('now')
      WHERE session_id = ?
    `).run(
      JSON.stringify(result.context), result.estimatedPrice,
      JSON.stringify(result.breakdown), result.confidence, sessionId
    );

    res.json(result);
  }).catch(err => {
    console.error('Quote continue error:', err);
    res.status(500).json({ error: 'Failed to process message' });
  });
});

app.post('/api/quote/convert', (req, res) => {
  const { sessionId, name, email, phone, postcode } = req.body;
  if (!sessionId || !name || !phone) return res.status(400).json({ error: 'sessionId, name, and phone are required' });

  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const quote = db.prepare('SELECT * FROM quotes WHERE session_id = ?').get(sessionId) as any;
  const price = quote?.estimated_price || 0;
  const breakdown = quote?.price_breakdown || '[]';

  const enquiryId = uuid();
  db.prepare(`
    INSERT INTO enquiries (id, name, email, phone, service, postcode, description, quoted_price, quote_breakdown, quote_context, ai_session_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
  `).run(
    enquiryId, name, email, phone,
    session.context.serviceType || 'general',
    postcode || session.context.postcode,
    `AI Quote — ${session.context.serviceType} for ${session.context.rooms}bed ${session.context.propertyType}`,
    price, breakdown, JSON.stringify(session.context), sessionId
  );

  // Update quote
  db.prepare('UPDATE quotes SET enquiry_id = ?, status = ? WHERE session_id = ?')
    .run(enquiryId, 'converted', sessionId);

  // Email notification
  const area = session.context.postcode ? ` (${session.context.postcode})` : '';
  sendEmailNotification(
    `New AI Quote Enquiry — ${name}`,
    `Name: ${name}\nPhone: ${phone}\nEmail: ${email || 'N/A'}\nService: ${session.context.serviceType}${area}\nProperty: ${session.context.rooms}bed ${session.context.propertyType}\nEstimated: £${price}\nQuote ID: ${enquiryId}`
  );

  res.json({ enquiryId, estimatedPrice: price, status: 'created' });
});

// ─── Enquiries ───
app.get('/api/enquiries', (req, res) => {
  const { status, search, limit = '50' } = req.query;
  let sql = 'SELECT * FROM enquiries WHERE 1=1';
  const params: any[] = [];

  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (search) {
    sql += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR service LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit as string));

  const enquiries = db.prepare(sql).all(...params);
  res.json(enquiries);
});

app.get('/api/enquiries/:id', (req, res) => {
  const enquiry = db.prepare('SELECT * FROM enquiries WHERE id = ?').get(req.params.id);
  if (!enquiry) return res.status(404).json({ error: 'Enquiry not found' });
  res.json(enquiry);
});

app.post('/api/enquiries', (req, res) => {
  const { name, email, phone, service, postcode, description, preferred_date, preferred_time } = req.body;
  if (!name || !phone || !service) {
    return res.status(400).json({ error: 'name, phone, and service are required' });
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO enquiries (id, name, email, phone, service, postcode, description, preferred_date, preferred_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, email || null, phone, service, postcode || null, description || null, preferred_date || null, preferred_time || null);

  // Email notification
  sendEmailNotification(
    `New Enquiry — ${name} (${service})`,
    `Name: ${name}\nPhone: ${phone}\nEmail: ${email || 'N/A'}\nService: ${service}\nPostcode: ${postcode || 'N/A'}\nDescription: ${description || 'N/A'}\nPreferred date: ${preferred_date || 'Flexible'}`
  );

  res.json({ id, status: 'created' });
});

app.patch('/api/enquiries/:id', (req, res) => {
  const { status, notes, quoted_price } = req.body;
  const enquiry = db.prepare('SELECT * FROM enquiries WHERE id = ?').get(req.params.id);
  if (!enquiry) return res.status(404).json({ error: 'Enquiry not found' });

  if (status) db.prepare('UPDATE enquiries SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, req.params.id);
  if (notes !== undefined) db.prepare('UPDATE enquiries SET notes = ?, updated_at = datetime(\'now\') WHERE id = ?').run(notes, req.params.id);
  if (quoted_price !== undefined) db.prepare('UPDATE enquiries SET quoted_price = ?, updated_at = datetime(\'now\') WHERE id = ?').run(quoted_price, req.params.id);

  res.json({ updated: true });
});

app.delete('/api/enquiries/:id', (req, res) => {
  db.prepare('DELETE FROM enquiries WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

// ─── Staff ───
app.get('/api/staff', (req, res) => {
  const { role, status = 'active' } = req.query;
  let sql = 'SELECT * FROM staff WHERE 1=1';
  const params: any[] = [];

  if (status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (role) {
    sql += ' AND role = ?';
    params.push(role);
  }
  sql += ' ORDER BY name';

  res.json(db.prepare(sql).all(...params));
});

app.post('/api/staff', (req, res) => {
  const { name, role, email, phone, hourly_rate, skills, notes } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'name and role are required' });

  const id = uuid();
  db.prepare(`
    INSERT INTO staff (id, name, role, email, phone, hourly_rate, skills, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, role, email || null, phone || null, hourly_rate || null, JSON.stringify(skills || []), notes || null);

  res.json({ id, status: 'created' });
});

app.patch('/api/staff/:id', (req, res) => {
  const { name, role, email, phone, hourly_rate, status: staffStatus, skills, notes } = req.body;
  const fields: string[] = [];
  const params: any[] = [];

  if (name !== undefined) { fields.push('name = ?'); params.push(name); }
  if (role !== undefined) { fields.push('role = ?'); params.push(role); }
  if (email !== undefined) { fields.push('email = ?'); params.push(email); }
  if (phone !== undefined) { fields.push('phone = ?'); params.push(phone); }
  if (hourly_rate !== undefined) { fields.push('hourly_rate = ?'); params.push(hourly_rate); }
  if (staffStatus !== undefined) { fields.push('status = ?'); params.push(staffStatus); }
  if (skills !== undefined) { fields.push('skills = ?'); params.push(JSON.stringify(skills)); }
  if (notes !== undefined) { fields.push('notes = ?'); params.push(notes); }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);

  db.prepare(`UPDATE staff SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  res.json({ updated: true });
});

app.delete('/api/staff/:id', (req, res) => {
  db.prepare('DELETE FROM staff WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

// ─── Jobs / Schedule ───
app.get('/api/jobs', (req, res) => {
  const { week } = req.query;
  let sql = `
    SELECT j.*, e.name as client_name, e.phone as client_phone, s.name as staff_name
    FROM jobs j
    LEFT JOIN enquiries e ON j.enquiry_id = e.id
    LEFT JOIN staff s ON j.staff_id = s.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (week) {
    // week format: "2024-W03" or ISO date of Monday
    sql += ' AND j.scheduled_date >= ? AND j.scheduled_date <= date(?, "+7 days")';
    params.push(week, week);
  }

  sql += ' ORDER BY j.scheduled_date, j.scheduled_time';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/jobs', (req, res) => {
  const { enquiry_id, staff_id, service, postcode, scheduled_date, scheduled_time, duration_hours, price, notes } = req.body;
  if (!service || !scheduled_date) return res.status(400).json({ error: 'service and scheduled_date are required' });

  const id = uuid();
  db.prepare(`
    INSERT INTO jobs (id, enquiry_id, staff_id, service, postcode, scheduled_date, scheduled_time, duration_hours, price, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, enquiry_id || null, staff_id || null, service, postcode || null, scheduled_date, scheduled_time || null, duration_hours || null, price || null, notes || null);

  res.json({ id, status: 'created' });
});

app.patch('/api/jobs/:id', (req, res) => {
  const { staff_id, status: jobStatus, scheduled_date, scheduled_time, notes } = req.body;
  const fields: string[] = [];
  const params: any[] = [];

  if (staff_id !== undefined) { fields.push('staff_id = ?'); params.push(staff_id); }
  if (jobStatus !== undefined) { fields.push('status = ?'); params.push(jobStatus); }
  if (scheduled_date !== undefined) { fields.push('scheduled_date = ?'); params.push(scheduled_date); }
  if (scheduled_time !== undefined) { fields.push('scheduled_time = ?'); params.push(scheduled_time); }
  if (notes !== undefined) { fields.push('notes = ?'); params.push(notes); }
  fields.push("updated_at = datetime('now')");

  if (fields.length === 1) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);

  db.prepare(`UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  res.json({ updated: true });
});

app.delete('/api/jobs/:id', (req, res) => {
  db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

// ─── Dashboard Stats ───
app.get('/api/dashboard/stats', (_req, res) => {
  const totalEnquiries = (db.prepare('SELECT COUNT(*) as count FROM enquiries').get() as any).count;
  const newEnquiries = (db.prepare("SELECT COUNT(*) as count FROM enquiries WHERE status = 'new'").get() as any).count;
  const quoted = (db.prepare("SELECT COUNT(*) as count FROM enquiries WHERE status = 'quoted'").get() as any).count;
  const booked = (db.prepare("SELECT COUNT(*) as count FROM enquiries WHERE status = 'booked'").get() as any).count;
  const completed = (db.prepare("SELECT COUNT(*) as count FROM enquiries WHERE status = 'completed'").get() as any).count;
  const activeCleaners = (db.prepare("SELECT COUNT(*) as count FROM staff WHERE role = 'cleaner' AND status = 'active'").get() as any).count;
  const activeDrivers = (db.prepare("SELECT COUNT(*) as count FROM staff WHERE role = 'driver' AND status = 'active'").get() as any).count;
  const totalStaff = (db.prepare("SELECT COUNT(*) as count FROM staff WHERE status = 'active'").get() as any).count;
  const thisWeek = (db.prepare("SELECT COUNT(*) as count FROM enquiries WHERE created_at >= date('now', '-7 days')").get() as any).count;
  const revenue = (db.prepare("SELECT COALESCE(SUM(quoted_price), 0) as total FROM enquiries WHERE status IN ('booked', 'completed')").get() as any).total;
  const upcomingJobs = (db.prepare("SELECT COUNT(*) as count FROM jobs WHERE scheduled_date >= date('now')").get() as any).count;

  res.json({
    totalEnquiries,
    newEnquiries,
    quoted,
    booked,
    completed,
    activeCleaners,
    activeDrivers,
    totalStaff,
    thisWeek,
    revenue,
    upcomingJobs,
  });
});

// ─── Serve React build in production ───
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  Loadly API running on http://localhost:${PORT}`);
  console.log(`  Quote engine: ${process.env.OPENAI_API_KEY ? 'OpenAI' : 'Rule-based'} mode`);
  console.log(`  Email: ${transporter ? 'Configured' : 'Console logging (no SMTP)'}\n`);
});
