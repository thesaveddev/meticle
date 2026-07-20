import { Router, Request, Response } from 'express'
import { getDb } from '../db/database'
import { scrapeCqcProviders, searchCqcByName } from '../scraper/cqc'
import { enrichLead, bulkEnrich } from '../contact/enrich'
import { sendEmail, sendCampaign, trackOpen, trackClick, getEmailStats } from '../email/sender'
import { seedTemplates } from '../email/templates'
import { v4 as uuid } from 'uuid'

const router = Router()

// ── Leads ──
router.get('/leads', (req: Request, res: Response) => {
  const db = getDb()
  const status = req.query.status as string
  const search = req.query.search as string
  let sql = 'SELECT * FROM leads WHERE 1=1'
  const params: any[] = []
  if (status && status !== 'all') { sql += ' AND status = ?'; params.push(status) }
  if (search) { sql += ' AND (provider_name LIKE ? OR contact_name LIKE ? OR postcode LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`) }
  sql += ' ORDER BY updated_at DESC LIMIT 200'
  const leads = db.prepare(sql).all(...params)
  res.json(leads)
})

router.patch('/leads/:id', (req: Request, res: Response) => {
  const db = getDb()
  const { id } = req.params
  const { status, notes, contact_name, contact_email, contact_phone } = req.body
  const sets: string[] = []; const params: any[] = []
  if (status) { sets.push('status = ?'); params.push(status) }
  if (notes !== undefined) { sets.push('notes = ?'); params.push(notes) }
  if (contact_name) { sets.push('contact_name = ?'); params.push(contact_name) }
  if (contact_email) { sets.push('contact_email = ?'); params.push(contact_email) }
  if (contact_phone) { sets.push('contact_phone = ?'); params.push(contact_phone) }
  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' })
  sets.push("updated_at = datetime('now')")
  params.push(id)
  db.prepare(`UPDATE leads SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  const updated = db.prepare('SELECT * FROM leads WHERE id = ?').get(id)
  res.json(updated)
})

router.delete('/leads/:id', (req: Request, res: Response) => {
  getDb().prepare('DELETE FROM leads WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Scraping ──
router.post('/scrape', async (req: Request, res: Response) => {
  const { region, limit } = req.body
  const result = await scrapeCqcProviders(region, limit || 50)
  res.json(result)
})

router.get('/search-cqc', async (req: Request, res: Response) => {
  const providers = await searchCqcByName(req.query.q as string || '')
  res.json(providers)
})

// ── Enrichment ──
router.post('/enrich/:id', async (req: Request, res: Response) => {
  const result = await enrichLead(parseInt(req.params.id))
  if (!result) return res.status(404).json({ error: 'No contact found' })
  res.json(result)
})

router.post('/enrich-bulk', async (req: Request, res: Response) => {
  const { status, limit } = req.body
  const result = await bulkEnrich(status || 'new', limit || 20)
  res.json(result)
})

// ── Email ──
router.post('/send-email', async (req: Request, res: Response) => {
  const { leadId, template } = req.body
  const ok = await sendEmail(leadId, template || 'intro')
  if (!ok) return res.status(400).json({ error: 'Failed to send' })
  res.json({ ok: true })
})

router.post('/send-campaign', async (req: Request, res: Response) => {
  const { stage, template, limit } = req.body
  const result = await sendCampaign(stage || 'new', template || 'intro', limit || 10)
  res.json(result)
})

router.get('/email-stats', (_req: Request, res: Response) => {
  res.json(getEmailStats())
})

router.post('/seed-templates', (_req: Request, res: Response) => {
  seedTemplates()
  res.json({ ok: true })
})

// ── Tracking (public, no auth) ──
router.get('/t/:leadId', (req: Request, res: Response) => {
  const leadId = parseInt(req.params.leadId)
  trackClick(leadId)
  const action = req.query.action || 'book'
  if (action === 'book') res.redirect('https://calendly.com/your-link/15min')
  else res.redirect('/')
})

router.get('/pixel/:leadId', (req: Request, res: Response) => {
  trackOpen(parseInt(req.params.leadId))
  res.set('Content-Type', 'image/gif')
  res.set('Cache-Control', 'no-cache')
  res.send(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'))
})

// ── Stats ──
router.get('/stats', (_req: Request, res: Response) => {
  const db = getDb()
  const total = db.prepare('SELECT COUNT(*) as count FROM leads').get() as any
  const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM leads GROUP BY status').all()
  const emailStats = getEmailStats()
  const lastScrape = db.prepare('SELECT * FROM scrape_logs ORDER BY created_at DESC LIMIT 1').get() as any
  res.json({ total: total.count, byStatus, emailStats, lastScrape })
})

export default router
