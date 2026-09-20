import { Request, Response } from 'express';
import pool from '../../shared/database';
import { EmailService } from '../../shared/utils/email.service';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export class ContactController {
  static async submit(req: Request, res: Response) {
    const {
      name, email, company, role, careType, message, website,
      source, utmSource, utmMedium, utmCampaign, referrer,
    } = req.body;

    // Quietly accept bot submissions so the form does not reveal the honeypot.
    if (website) return res.json({ success: true, message: 'Message received.' });

    const result = await pool.query(
      `INSERT INTO contact_submissions
        (name, email, company, role, care_type, message, source, utm_source, utm_medium, utm_campaign, referrer, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        name, email, company || null, role || null, careType || null, message,
        source || 'website', utmSource || null, utmMedium || null, utmCampaign || null,
        referrer || null, req.ip, req.get('user-agent') || null,
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

    // The lead is stored before email delivery. A mail outage must not lose the enquiry.
    EmailService.sendEmail(recipient, `New demo enquiry — ${name}`, body).catch(() => {});
    EmailService.sendEmail(
      email,
      'Thanks for contacting MeticleCare',
      `<p>Thanks for getting in touch. We have received your enquiry and a member of the MeticleCare team will reply within one business day.</p><p>If your request is urgent, reply to this email and include your organisation name.</p>`,
    ).catch(() => {});

    res.status(201).json({ success: true, leadId: result.rows[0]?.id, message: 'Message received. We will get back to you within one business day.' });
  }
}
