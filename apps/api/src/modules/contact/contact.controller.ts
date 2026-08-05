import { Request, Response } from 'express';
import { EmailService } from '../../shared/utils/email.service';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export class ContactController {
  static async submit(req: Request, res: Response) {
    const { name, email, company, message } = req.body;
    const recipient = process.env.CONTACT_EMAIL || 'hello@meticlecare.com';
    const replyTo = escapeHtml(email);
    const body = `
      <p>New contact form submission from the MeticleCare website.</p>
      <table role="presentation" cellpadding="8" cellspacing="0" style="border:1px solid #E5E7EB;border-collapse:collapse;width:100%">
        <tr>
          <td style="border:1px solid #E5E7EB;background:#F9FAFB;font-weight:700;width:120px">Name</td>
          <td style="border:1px solid #E5E7EB">${escapeHtml(name)}</td>
        </tr>
        <tr>
          <td style="border:1px solid #E5E7EB;background:#F9FAFB;font-weight:700">Email</td>
          <td style="border:1px solid #E5E7EB">${replyTo}</td>
        </tr>
        <tr>
          <td style="border:1px solid #E5E7EB;background:#F9FAFB;font-weight:700">Company</td>
          <td style="border:1px solid #E5E7EB">${escapeHtml(company || '—')}</td>
        </tr>
        <tr>
          <td style="border:1px solid #E5E7EB;background:#F9FAFB;font-weight:700">Message</td>
          <td style="border:1px solid #E5E7EB">${escapeHtml(message)}</td>
        </tr>
      </table>
      <p style="font-size:13px;color:#6B7280">Reply to ${replyTo} to follow up with this lead.</p>`;
    await EmailService.sendEmail(recipient, `New Contact Form — ${name}`, body);
    res.json({ success: true, message: 'Message received. We will get back to you within 4 hours.' });
  }
}
