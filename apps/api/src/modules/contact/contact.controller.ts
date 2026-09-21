import { Request, Response } from 'express';
import pool from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import { AuditRepository } from '../audit/audit.repository';
import { EmailService } from '../../shared/utils/email.service';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export class ContactController {
  static async submit(req: Request, res: Response) {
    const {
      name, email, company, role, careType, message, website,
      source, utmSource, utmMedium, utmCampaign, referrer,
      privacyConsent, marketingConsent, privacyPolicyVersion,
    } = req.body;

    // Quietly accept bot submissions so the form does not reveal the honeypot.
    if (website) return res.json({ success: true, message: 'Message received.' });

    const result = await pool.query(
      `INSERT INTO contact_submissions
        (name, email, company, role, care_type, message, source, utm_source, utm_medium, utm_campaign, referrer, ip_address, user_agent, privacy_consent, marketing_consent, privacy_policy_version, consented_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
       RETURNING id`,
      [
        name, email, company || null, role || null, careType || null, message,
        source || 'website', utmSource || null, utmMedium || null, utmCampaign || null,
        referrer || null, req.ip, req.get('user-agent') || null,
        privacyConsent === true, marketingConsent === true, privacyPolicyVersion || '2026-09-20',
      ],
    );

    const recipient = process.env.CONTACT_EMAIL || 'hello@meticlecare.com';
    const replyTo = escapeHtml(email);
    const body = `
      <p>New contact form submission from the Meticle Care website.</p>
      <table role="presentation" cellpadding="8" cellspacing="0" style="border:1px solid #E5E7EB;border-collapse:collapse;width:100%">
        ${[
          ['Name', name], ['Email', replyTo], ['Organisation', company || '—'], ['Role', role || '—'],
          ['Care type', careType || '—'], ['Message', message], ['Lead ID', result.rows[0]?.id || '—'],
        ].map(([label, value]) => `<tr><td style="border:1px solid #E5E7EB;background:#F9FAFB;font-weight:700;width:120px">${escapeHtml(String(label))}</td><td style="border:1px solid #E5E7EB">${escapeHtml(String(value))}</td></tr>`).join('')}
      </table>
      <p style="font-size:13px;color:#6B7280">Reply to ${replyTo} to follow up with this lead.</p>`;

    await pool.query(
      `INSERT INTO marketing_events (event_name, source, consent_basis, metadata)
       VALUES ('demo_request_submitted', $1, 'contact_form_consent', $2::jsonb)`,
      [source || 'website', JSON.stringify({ leadId: result.rows[0]?.id, careType: careType || null })],
    );

    // The lead is stored before email delivery. A mail outage must not lose the enquiry.
    EmailService.sendEmail(recipient, `New demo enquiry — ${name}`, body).catch(() => {});
    EmailService.sendEmail(
      email,
      'Thanks for contacting MeticleCare',
      `<p>Thanks for getting in touch. We have received your enquiry and a member of the MeticleCare team will reply within one business day.</p><p>If your request is urgent, reply to this email and include your organisation name.</p>`,
    ).catch(() => {});

    res.status(201).json({ success: true, leadId: result.rows[0]?.id, message: 'Message received. We will get back to you within one business day.' });
  }

  static async list(req: Request, res: Response) {
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '25'), 10) || 25));
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const params: any[] = [];
    const conditions: string[] = [];
    let index = 1;
    if (status) { conditions.push(`status = $${index++}`); params.push(status); }
    if (search) { conditions.push(`(name ILIKE $${index} OR email ILIKE $${index} OR company ILIKE $${index})`); params.push(`%${search}%`); index++; }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await pool.query(`SELECT id, name, email, company, role, care_type, message, status, source, utm_source, utm_medium, utm_campaign, marketing_consent, privacy_policy_version, consented_at, created_at, updated_at FROM contact_submissions ${where} ORDER BY created_at DESC LIMIT $${index} OFFSET $${index + 1}`, [...params, limit, (page - 1) * limit]);
    const [total, byStatus] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM contact_submissions ${where}`, params),
      pool.query(`SELECT status, COUNT(*)::int AS count FROM contact_submissions ${where} GROUP BY status ORDER BY status`, params),
    ]);
    res.json({ submissions: rows.rows, total: total.rows[0].total, counts: byStatus.rows, page, limit });
  }

  static async update(req: Request, res: Response) {
    const { id } = req.params;
    const { status, notes } = req.body;
    const updated = await pool.query(
      `UPDATE contact_submissions SET status = $1, notes = COALESCE($2, notes), updated_at = NOW() WHERE id = $3 RETURNING id, status, notes, updated_at`,
      [status, notes ?? null, id],
    );
    if (!updated.rows.length) throw new AppError(404, 'Lead not found');
    await AuditRepository.log({
      user_id: req.user!.userId,
      action: 'UPDATE_CONTACT_SUBMISSION',
      entity_type: 'contact_submission',
      entity_id: id,
      new_data: { status, notes: notes ?? null },
      ip_address: req.ip,
    });
    res.json(updated.rows[0]);
  }
}
