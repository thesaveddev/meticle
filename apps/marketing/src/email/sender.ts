import nodemailer from 'nodemailer'
import { getDb } from '../db/database'
import { getTemplate, renderTemplate } from './templates'

let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (transporter) return transporter
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE === 'true' || parseInt(process.env.SMTP_PORT || '465') === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
  return transporter
}

export async function sendEmail(leadId: number, templateName: string, extraVars: Record<string, string> = {}): Promise<boolean> {
  const db = getDb()
  const lead: any = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId)
  if (!lead || !lead.contact_email) return false

  const trackingBase = process.env.TRACKING_BASE_URL || 'http://localhost:3005'
  const vars: Record<string, string> = {
    ...extraVars,
    provider_name: lead.provider_name,
    contact_name: lead.contact_name || 'Manager',
    cqc_rating: lead.cqc_rating || 'Not rated',
    last_inspection: lead.last_inspection || '',
    tracking_link: `${trackingBase}/t/${leadId}`,
    tracking_link_display: trackingBase,
    tracking_pixel: `${trackingBase}/pixel/${leadId}`,
  }

  const { subject, html } = renderTemplate(templateName, vars)

  try {
    const transport = getTransporter()
    await transport.sendMail({
      from: process.env.SMTP_FROM || 'hello@caredesk.app',
      to: lead.contact_email,
      subject,
      html,
    })

    // Log the email send
    db.prepare('INSERT INTO email_logs (lead_id, template_name, subject) VALUES (?, ?, ?)').run(leadId, templateName, subject)

    // Update lead status
    const status = lead.status === 'new' ? 'contacted' : lead.status
    db.prepare('UPDATE leads SET status = ?, last_contacted = datetime(\'now\'), campaign_stage = campaign_stage + 1, updated_at = datetime(\'now\') WHERE id = ?').run(status, leadId)

    return true
  } catch (e) {
    console.error('Email send failed:', (e as Error).message)
    return false
  }
}

export async function sendCampaign(stage: string = 'new', templateName: string = 'intro', limit: number = 10): Promise<{ sent: number; failed: number }> {
  const db = getDb()
  const leads = db.prepare(`
    SELECT id FROM leads
    WHERE status = ? AND contact_email IS NOT NULL AND contact_email != ''
    LIMIT ?
  `).all(stage, limit) as { id: number }[]

  let sent = 0; let failed = 0
  for (const l of leads) {
    const ok = await sendEmail(l.id, templateName)
    if (ok) sent++; else failed++
  }
  return { sent, failed }
}

export function trackOpen(leadId: number) {
  const db = getDb()
  db.prepare('UPDATE email_logs SET opened_at = datetime(\'now\'), status = \'opened\' WHERE lead_id = ? AND opened_at IS NULL ORDER BY sent_at DESC LIMIT 1').run(leadId)
}

export function trackClick(leadId: number) {
  const db = getDb()
  db.prepare('UPDATE email_logs SET clicked_at = datetime(\'now\'), status = \'clicked\' WHERE lead_id = ? AND clicked_at IS NULL ORDER BY sent_at DESC LIMIT 1').run(leadId)
}

export function getEmailStats() {
  const db = getDb()
  const sent = db.prepare('SELECT COUNT(*) as count FROM email_logs').get() as any
  const opened = db.prepare('SELECT COUNT(*) as count FROM email_logs WHERE opened_at IS NOT NULL').get() as any
  const clicked = db.prepare('SELECT COUNT(*) as count FROM email_logs WHERE clicked_at IS NOT NULL').get() as any
  return { sent: sent.count, opened: opened.count, clicked: clicked.count, openRate: sent.count > 0 ? Math.round((opened.count / sent.count) * 100) : 0 }
}
