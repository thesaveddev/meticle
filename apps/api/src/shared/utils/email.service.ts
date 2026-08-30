import nodemailer from 'nodemailer';
import { buildEmailHtml, buildCodeEmailHtml, buildStatusEmailHtml } from './email.template';
import { buildInvoiceHtml, generatePdf } from '../../modules/billing/billing.pdf';
import pool from '../database';
import logger from './logger';

// ── Sender addresses ──
// Each category uses a distinct 'From' address for brand trust and deliverability.
const SENDERS = {
  notifications: process.env.SMTP_FROM_NOTIFICATIONS || 'notifications@meticlecare.com',
  billing:      process.env.SMTP_FROM_BILLING      || 'billing@meticlecare.com',
  security:     process.env.SMTP_FROM_SECURITY      || 'security@meticlecare.com',
  support:      process.env.SMTP_FROM_SUPPORT       || 'support@meticlecare.com',
  team:         process.env.SMTP_FROM_TEAM          || 'hello@meticlecare.com',
} as const;

export type SenderCategory = keyof typeof SENDERS;

let transporter: nodemailer.Transporter | null = null;

export function getTransporter() {
  if (!transporter) {
    const useSmtp = process.env.SMTP_HOST && process.env.SMTP_USER;
    if (useSmtp) {
      logger.info('Email: Using SMTP');
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: parseInt(process.env.SMTP_PORT || '587') === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
    } else {
      logger.info('Email: Using test account');
      nodemailer.createTestAccount().then(acc => {
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email', port: 587, secure: false,
          auth: { user: acc.user, pass: acc.pass },
        });
      });
    }
  }
  return transporter!;
}

async function sendMail(to: string, subject: string, html: string, category: SenderCategory = 'notifications', attachments?: { filename: string; content: Buffer; contentType?: string }[]) {
  try {
    const { EmailQueue } = await import('./email.queue');
    await EmailQueue.enqueue(to, subject, html, SENDERS[category], attachments);
    logger.info({ to, subject, category, from: SENDERS[category] }, 'Email queued');
  } catch (err: any) {
    logger.error({ err: err.message, to, subject, category }, 'Email enqueue failed');
  }
}

const baseUrl = () =>
  process.env.FRONTEND_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://meticlecare.com' : 'http://localhost:3000');

const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';

const fmtDate = (date?: string | null) =>
  date
    ? new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    : 'your shift';

export class EmailService {
  static async sendVerificationEmail(email: string, token: string) {
    const url = `${baseUrl()}/verify-email?token=${token}`;
    await sendMail(email, 'Verify your Meticle account',
      buildEmailHtml('Verify Email', 'Verify your email address',
        `<p>Click the button below to verify your email address and activate your account.</p>`,
        { label: 'Verify Email', url }), 'security');
  }

  static async sendVerificationCode(email: string, code: string) {
    await sendMail(email, 'Your Meticle Verification Code', buildCodeEmailHtml(code), 'security');
  }

  static async sendPasswordResetEmail(email: string, token: string) {
    const url = `${baseUrl()}/reset-password?token=${token}`;
    await sendMail(email, 'Reset your Meticle password',
      buildEmailHtml('Reset Password', 'Reset your password',
        `<p>Click the button below to reset your password. This link expires in 1 hour.</p>`,
        { label: 'Reset Password', url }), 'security');
  }

  static async sendInviteEmail(email: string, orgName: string, token: string) {
    const url = `${baseUrl()}/register?token=${token}`;
    await sendMail(email, `You've been invited to join ${orgName} on Meticle`,
      buildEmailHtml('Invitation', `You've been invited to ${orgName}`,
        `<p>Click below to create your account and join ${orgName} on Meticle.</p>`,
        { label: 'Accept Invitation', url }), 'team');
  }

  static async sendWelcomeEmail(email: string, name: string, orgName?: string, isAdmin?: boolean) {
    const url = `${baseUrl()}/dashboard`;
    const subject = 'Welcome To Meticle';
    const org = orgName || 'your organisation';

    if (isAdmin) {
      await sendMail(email, subject,
        buildEmailHtml('Welcome',
          'Welcome To Meticle',
          `<p style="margin:0 0 20px 0">Hi ${name},</p>` +
          `<p style="margin:0 0 16px 0">You've just taken the first step toward running a smarter, safer care organisation. <strong>Meticle</strong> is the all-in-one platform that unifies your entire care operation — from scheduling and compliance to clinical records and family communication.</p>` +
          `<p style="margin:0 0 12px 0;font-weight:700;font-size:15px;color:#1F2937">What you can do with Meticle:</p>` +
          `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0">` +
          `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;font-size:15px;color:#0F4C81;font-weight:700;width:24px">\u2713</td><td style="padding:6px 0;font-size:14px;color:#4B5563"><strong>Smart Scheduling &amp; Rota Planning</strong> — Drag-and-drop rota, shift swaps, overtime claims, and minimum-staff alerts. Reduce agency spend by up to 40%.</td></tr>` +
          `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;font-size:15px;color:#0F4C81;font-weight:700;width:24px">\u2713</td><td style="padding:6px 0;font-size:14px;color:#4B5563"><strong>Compliance &amp; CQC Readiness</strong> — Real-time compliance dashboards, automated training reminders, DBS tracking, and one-click CQC evidence packs. Know your score before the inspector arrives.</td></tr>` +
          `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;font-size:15px;color:#0F4C81;font-weight:700;width:24px">\u2713</td><td style="padding:6px 0;font-size:14px;color:#4B5563"><strong>eMAR &amp; Clinical Records</strong> — 31-day medication administration charts, PRN tracking, stock management, and full clinical history for every person.</td></tr>` +
          `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;font-size:15px;color:#0F4C81;font-weight:700;width:24px">\u2713</td><td style="padding:6px 0;font-size:14px;color:#4B5563"><strong>Person Hub</strong> — Care plans, daily notes, risk assessments, family portal, body maps, wellbeing logs, and discharge planning — all in one place.</td></tr>` +
          `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;font-size:15px;color:#0F4C81;font-weight:700;width:24px">\u2713</td><td style="padding:6px 0;font-size:14px;color:#4B5563"><strong>Incidents &amp; Reporting</strong> — Log, categorise, and action incidents with full audit trails. 35+ reports with filters and CSV export.</td></tr>` +
          `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;font-size:15px;color:#0F4C81;font-weight:700;width:24px">\u2713</td><td style="padding:6px 0;font-size:14px;color:#4B5563"><strong>Leave, Training &amp; Competency</strong> — End-to-end leave management, training matrix with expiry alerts, and competency assessments with evidence.</td></tr>` +
          `</table>` +
          `<p style="margin:0 0 16px 0">You're on a <strong>14-day free trial</strong> with full access to every feature. Here's how to get started:</p>` +
          `<p style="margin:0 0 4px 0;font-size:14px;color:#1F2937"><strong>1.</strong> Complete your organisation profile and invite your team</p>` +
          `<p style="margin:0 0 4px 0;font-size:14px;color:#1F2937"><strong>2.</strong> Set up your locations, departments, and teams</p>` +
          `<p style="margin:0 0 4px 0;font-size:14px;color:#1F2937"><strong>3.</strong> Add people and configure care plans</p>` +
          `<p style="margin:0 0 4px 0;font-size:14px;color:#1F2937"><strong>4.</strong> Build your rota and invite staff to claim shifts</p>` +
          `<p style="margin:0 0 16px 0;font-size:14px;color:#1F2937"><strong>5.</strong> Run your first CQC readiness assessment</p>` +
          `<p style="margin:0;font-size:14px;color:#4B5563">If you need anything, just reply to this email — we're here to help.</p>` +
          `<p style="margin:16px 0 0 0;font-size:13px;color:#9CA3AF">The Meticle Team</p>`,
          { label: 'Go to Dashboard', url }), 'team');
    } else {
      await sendMail(email, subject,
        buildEmailHtml('Welcome',
          'Welcome To Meticle',
          `<p style="margin:0 0 20px 0">Hi ${name},</p>` +
          `<p style="margin:0 0 16px 0">Welcome to <strong>${org}</strong> on Meticle. You now have access to everything your organisation uses to run care operations — scheduling, compliance, clinical records, and more.</p>` +
          `<p style="margin:0 0 12px 0;font-weight:700;font-size:15px;color:#1F2937">Here's what you can do right away:</p>` +
          `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0">` +
          `<tr><td style="padding:4px 10px 4px 0;vertical-align:top;font-size:14px;color:#0F4C81;font-weight:700;width:22px">\u2022</td><td style="padding:4px 0;font-size:14px;color:#4B5563">View your shifts and rota</td></tr>` +
          `<tr><td style="padding:4px 10px 4px 0;vertical-align:top;font-size:14px;color:#0F4C81;font-weight:700;width:22px">\u2022</td><td style="padding:4px 0;font-size:14px;color:#4B5563">Complete your compliance and training requirements</td></tr>` +
          `<tr><td style="padding:4px 10px 4px 0;vertical-align:top;font-size:14px;color:#0F4C81;font-weight:700;width:22px">\u2022</td><td style="padding:4px 0;font-size:14px;color:#4B5563">Log care notes, observations, and eMAR administrations</td></tr>` +
          `<tr><td style="padding:4px 10px 4px 0;vertical-align:top;font-size:14px;color:#0F4C81;font-weight:700;width:22px">\u2022</td><td style="padding:4px 0;font-size:14px;color:#4B5563">Request leave and swap shifts with your team</td></tr>` +
          `<tr><td style="padding:4px 10px 4px 0;vertical-align:top;font-size:14px;color:#0F4C81;font-weight:700;width:22px">\u2022</td><td style="padding:4px 0;font-size:14px;color:#4B5563">Chat with colleagues in real-time</td></tr>` +
          `</table>` +
          `<p style="margin:0 0 16px 0;font-size:14px;color:#4B5563">Your manager will assign your shifts and set up any training you need. If you have questions, reach out to your team lead or reply to this email.</p>` +
          `<p style="margin:0;font-size:13px;color:#9CA3AF">The Meticle Team</p>`,
          { label: 'Go to Dashboard', url }), 'team');
    }
  }

  // ── Leave ──
  static async sendLeaveRequestedEmail(email: string, reviewerName: string, staffName: string, leaveType: string, startDate: string, endDate: string) {
    await sendMail(email, `Leave Request — ${staffName}`,
      buildStatusEmailHtml('Leave Request', `Hi ${reviewerName},`, 'pending', 'Pending Approval',
        [`${staffName} has requested ${leaveType} leave from ${startDate} to ${endDate}.`],
        { label: 'Review Request', url: `${baseUrl()}/leave` }));
  }

  static async sendLeaveApprovedEmail(email: string, name: string, leaveType: string, startDate: string, endDate: string) {
    await sendMail(email, `Leave Approved — ${leaveType}`,
      buildStatusEmailHtml('Leave Approved', `Hi ${name},`, 'approved', 'Approved',
        [`Your ${leaveType} leave from ${startDate} to ${endDate} has been approved.`],
        { label: 'View My Leave', url: `${baseUrl()}/leave` }));
  }

  static async sendLeaveBookedEmail(email: string, staffName: string, bookedByName: string, leaveType: string, startDate: string, endDate: string) {
    await sendMail(email, `Leave Booked — ${leaveType}`,
      buildStatusEmailHtml('Leave Booked', `Hi ${staffName},`, 'approved', 'Approved',
        [`${bookedByName} has booked ${leaveType} leave for you from ${startDate} to ${endDate}. It has been approved.`],
        { label: 'View My Leave', url: `${baseUrl()}/leave` }));
  }

  static async sendLeaveRejectedEmail(email: string, name: string, leaveType: string, startDate: string, endDate: string) {
    await sendMail(email, `Leave Rejected — ${leaveType}`,
      buildStatusEmailHtml('Leave Rejected', `Hi ${name},`, 'rejected', 'Rejected',
        [`Your ${leaveType} leave from ${startDate} to ${endDate} was not approved.`],
        { label: 'View Details', url: `${baseUrl()}/leave` }));
  }

  // ── Documents ──
  static async sendDocumentExpiringEmail(email: string, staffName: string, docType: string, expiryDate: string) {
    await sendMail(email, `${docType} Expiring Soon`,
      buildStatusEmailHtml('Document Expiring', `Hi ${staffName},`, 'pending', 'Action Required',
        [`Your ${docType} expires on ${expiryDate}. Please upload a renewed copy.`],
        { label: 'Upload Now', url: `${baseUrl()}/compliance/identity` }));
  }

  static async sendDocumentExpiredEmail(email: string, staffName: string, docType: string) {
    await sendMail(email, `${docType} Has Expired`,
      buildStatusEmailHtml('Document Expired', `Hi ${staffName},`, 'rejected', 'Expired',
        [`Your ${docType} has expired. Please upload a renewed copy immediately.`],
        { label: 'Upload Now', url: `${baseUrl()}/compliance/identity` }));
  }

  // ── Training ──
  static async sendTrainingExpiringEmail(email: string, staffName: string, moduleName: string, expiryDate: string) {
    await sendMail(email, `Training Expiring — ${moduleName}`,
      buildStatusEmailHtml('Training Expiring', `Hi ${staffName},`, 'pending', 'Action Required',
        [`Your "${moduleName}" training expires on ${expiryDate}.`],
        { label: 'View Training', url: `${baseUrl()}/compliance/training` }));
  }

  static async sendTrainingExpiredEmail(email: string, staffName: string, moduleName: string) {
    await sendMail(email, `Training Expired — ${moduleName}`,
      buildStatusEmailHtml('Training Expired', `Hi ${staffName},`, 'rejected', 'Expired',
        [`Your "${moduleName}" training has expired.`],
        { label: 'View Training', url: `${baseUrl()}/compliance/training` }));
  }

  // ── Competency ──
  static async sendCompetencyDueEmail(email: string, staffName: string, templateName: string, dueDate: string, isOverdue: boolean) {
    await sendMail(email, isOverdue ? `Competency Overdue — ${templateName}` : `Competency Due — ${templateName}`,
      buildStatusEmailHtml('Competency', `Hi ${staffName},`, isOverdue ? 'rejected' : 'pending', isOverdue ? 'Overdue' : 'Due Soon',
        [isOverdue ? `Your "${templateName}" assessment is overdue.` : `Your "${templateName}" assessment is due on ${dueDate}.`],
        { label: 'View', url: `${baseUrl()}/compliance/competency` }));
  }

  // ── Overtime ──
  static async sendOvertimeClaimedEmail(email: string, staffName: string, locationName: string, date: string, time: string) {
    await sendMail(email, `Overtime Claim — ${staffName}`,
      buildStatusEmailHtml('Overtime', `Overtime claim submitted`, 'pending', 'Pending',
        [`${staffName} claimed overtime at ${locationName} on ${date} (${time}).`],
        { label: 'Review', url: `${baseUrl()}/scheduling/overtime-claims` }));
  }

  static async sendOvertimeApprovedEmail(email: string, staffName: string, locationName: string, date: string, time: string) {
    await sendMail(email, 'Overtime Approved',
      buildStatusEmailHtml('Overtime', `Hi ${staffName},`, 'approved', 'Approved',
        [`Your overtime at ${locationName} on ${date} (${time}) has been approved.`],
        { label: 'View Rota', url: `${baseUrl()}/scheduling` }));
  }

  static async sendOvertimeRejectedEmail(email: string, staffName: string, locationName: string, date: string, time: string) {
    await sendMail(email, 'Overtime Rejected',
      buildStatusEmailHtml('Overtime', `Hi ${staffName},`, 'rejected', 'Rejected',
        [`Your overtime at ${locationName} on ${date} (${time}) was not approved.`],
        { label: 'Browse Shifts', url: `${baseUrl()}/shift-marketplace` }));
  }

  // ── Delegation ──
  static async sendDelegationAssignedEmail(email: string, delegateName: string, primaryName: string, endsAt?: string | null) {
    await sendMail(email, 'Manager Delegation Assigned',
      buildEmailHtml('Delegation', `Hi ${delegateName},`,
        `<p>You have been assigned as a delegate for ${primaryName}.${endsAt ? ` This delegation ends on ${new Date(endsAt).toLocaleDateString()}.` : ''}</p>`,
        { label: 'Open Meticle', url: `${baseUrl()}/leave` }));
  }

  // ── Shifts ──
  static async sendShiftStartEmail(staffEmail: string, staffName: string, date: string, shifts: any[], people?: any[], incidents?: any[], appointments?: any[]) {
    const shiftRows = shifts.map((s: any) => {
      const type = s.shift_type ? s.shift_type.charAt(0).toUpperCase() + s.shift_type.slice(1).replace('_', ' ') : 'Day';
      const person = s.person_first_name
        ? `${s.person_first_name} ${s.person_last_name}${s.person_room ? ` <span style="font-weight:400;color:#9CA3AF">(Room ${s.person_room})</span>` : ''}`
        : '<span style="color:#9CA3AF">—</span>';
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #F0EDE6;white-space:nowrap">${fmtTime(s.start_time)} — ${fmtTime(s.end_time)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #F0EDE6">${s.location_name || '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #F0EDE6">${type}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #F0EDE6">${person}</td>
      </tr>`;
    }).join('');

    const peopleRows = (people || []).filter((p: any) => p).map((p: any) => {
      const bits: string[] = [];
      if (p.support_level) bits.push(`Support: <strong>${p.support_level}</strong>`);
      if (p.dnacpr_status) bits.push(`DNACPR: <strong>${p.dnacpr_status}</strong>`);
      if (p.allergies?.length) bits.push(`Allergies: ${p.allergies.join(', ')}`);
      if (p.flags?.length) bits.push(`Flags: ${p.flags.join(', ')}`);
      return `<tr>
        <td style="padding:6px 12px;vertical-align:top;font-weight:600;white-space:nowrap">${p.first_name} ${p.last_name}${p.room_number ? ` <span style="font-weight:400;color:#9CA3AF">(Room ${p.room_number})</span>` : ''}</td>
        <td style="padding:6px 12px">${bits.join(' · ') || '<span style="color:#9CA3AF">—</span>'}</td>
      </tr>`;
    }).join('');

    const appList = appointments?.length
      ? `<p style="margin-top:20px;font-weight:600">Today's appointments</p><ul style="margin:8px 0 0;padding-left:20px;color:#374151">${appointments.map((a: any) => `<li><strong>${fmtTime(a.start_time)}</strong> — ${a.title}${a.first_name ? ` (${a.first_name} ${a.last_name})` : ''}</li>`).join('')}</ul>`
      : '';
    const incList = incidents?.length
      ? `<p style="margin-top:20px;font-weight:600">Recent incidents</p><ul style="margin:8px 0 0;padding-left:20px;color:#374151">${incidents.map((i: any) => `<li><strong>${i.title}</strong> — ${i.severity}</li>`).join('')}</ul>`
      : '';

    await sendMail(staffEmail, `Your shift preview for ${fmtDate(date)}`,
      buildEmailHtml('Shift Preview', `Hi ${staffName},`,
        `<p>Here are the details for your shift on <strong>${fmtDate(date)}</strong>.</p>
         <table border="0" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #F0EDE6;border-radius:8px;margin-top:12px">
           <tr style="background:#F7F4EE">
             <th style="padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#6B7280">Time</th>
             <th style="padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#6B7280">Location</th>
             <th style="padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#6B7280">Type</th>
             <th style="padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#6B7280">Person</th>
           </tr>${shiftRows}
         </table>
         ${peopleRows ? `<p style="margin-top:20px;font-weight:600">People requiring attention</p><table border="0" cellpadding="0" cellspacing="0" style="width:100%">${peopleRows}</table>` : ''}
         ${appList}${incList}
         <p style="margin-top:24px">Open the rota for the latest information.</p>`,
        { label: 'View Rota', url: `${baseUrl()}/scheduling` }));
  }

  // ── MFA ──
  static async sendMfaSetupCompleteEmail(email: string, name: string) {
    await sendMail(email, 'MFA Enabled',
      buildEmailHtml('Security', `Hi ${name},`,
        `<p>Multi-factor authentication has been enabled on your account.</p>`,
        { label: 'Settings', url: `${baseUrl()}/settings` }), 'security');
  }

  static async sendMfaBackupCodesEmail(email: string, backupCodes: string[], name: string) {
    await sendMail(email, 'Your MFA Backup Codes',
      buildEmailHtml('Backup Codes', `Hi ${name},`,
        `<p>Save these backup codes in a safe place. Each code can only be used once:</p><pre>${backupCodes.join('\n')}</pre>`,
        { label: 'Settings', url: `${baseUrl()}/settings` }), 'security');
  }

  static async sendMfaResetAdminEmail(email: string, name: string) {
    await sendMail(email, 'MFA Reset by Admin',
      buildEmailHtml('MFA Reset', `Hi ${name},`,
        `<p>An administrator has reset your multi-factor authentication. Next time you log in you will be asked to set up MFA again.</p>`,
        { label: 'Login', url: `${baseUrl()}/login` }), 'security');
  }

  // ── Shift Swaps ──
  static async sendSwapRequestedEmail(email: string, staffName: string, requesterName: string, shiftDate: string, shiftTime: string) {
    await sendMail(email, `Shift Swap Request — ${requesterName}`,
      buildStatusEmailHtml('Swap Request', `Hi ${staffName},`, 'pending', 'Swap Requested',
        [`${requesterName} wants to swap their shift on ${shiftDate} at ${shiftTime}.`],
        { label: 'View Swap Request', url: `${baseUrl()}/scheduling` }));
  }

  static async sendSwapAcceptedEmail(email: string, staffName: string, accepterName: string, shiftDate: string, shiftTime: string, locationName: string, toShiftDate?: string, toShiftTime?: string, toShiftLocation?: string) {
    await sendMail(email, `Swap Accepted — ${accepterName}`,
      buildStatusEmailHtml('Swap Accepted', `Hi ${staffName},`, 'approved', 'Accepted',
        [`${accepterName} accepted your swap for ${shiftDate} at ${shiftTime} (${locationName}).${toShiftDate ? ` You are now covering ${toShiftDate} at ${toShiftTime}` : ''}`],
        { label: 'View Rota', url: `${baseUrl()}/scheduling` }));
  }

  static async sendSwapDeclinedEmail(email: string, staffName: string, declinerName: string, shiftDate: string, shiftTime: string) {
    await sendMail(email, `Swap Declined — ${declinerName}`,
      buildStatusEmailHtml('Swap Declined', `Hi ${staffName},`, 'rejected', 'Declined',
        [`${declinerName} declined your swap for ${shiftDate} at ${shiftTime}.`],
        { label: 'View Rota', url: `${baseUrl()}/scheduling` }));
  }

  static async sendSwapAcceptedToManagerEmail(email: string, managerName: string, accepterName: string, requesterName: string, locationName: string, shiftDate: string, shiftTime: string, toShiftDate?: string, toShiftTime?: string, toShiftLocation?: string) {
    await sendMail(email, `Swap Approved — ${accepterName} ↔ ${requesterName}`,
      buildStatusEmailHtml('Swap', `Hi ${managerName},`, 'approved', 'Swap Completed',
        [`${accepterName} and ${requesterName} swapped shifts at ${locationName} on ${shiftDate}.`],
        { label: 'View Rota', url: `${baseUrl()}/scheduling` }));
  }

  static async sendUnclaimedShiftReminderEmail(email: string, managerName: string, locationName: string, shiftDate: string, shiftTime: string, shiftType: string) {
    await sendMail(email, `Unclaimed Shift — ${locationName}`,
      buildEmailHtml('Unclaimed Shift', `Hi ${managerName},`,
        `<p>A ${shiftType} shift at ${locationName} on ${shiftDate} at ${shiftTime} is still unclaimed.</p>`,
        { label: 'View Unclaimed Shifts', url: `${baseUrl()}/scheduling/overtime-claims` }));
  }

  /** Generic send used by chat notifications and other modules */
  static async sendEmail(to: string, subject: string, htmlBody: string) {
    const html = buildEmailHtml(subject, subject, htmlBody);
    await sendMail(to, subject, html, 'notifications');
  }

  // ── Family Portal ──
  static async sendFamilyPortalInviteEmail(email: string, memberName: string, personName: string, token: string, orgName: string) {
    const url = `${baseUrl()}/family-portal/${token}`;
    await sendMail(email, `${orgName} — Access to ${personName}'s care information`,
      buildEmailHtml('Family Portal', `You've been invited to stay connected`,
        `<p>Hi ${memberName},</p>` +
        `<p><strong>${orgName}</strong> has invited you to view care information for <strong>${personName}</strong> through the Meticle Family Portal.</p>` +
        `<p>Through this secure portal you can see:</p>` +
        `<ul><li>Daily care notes</li><li>Care plans</li><li>Goals and progress</li><li>Health observations</li></ul>` +
        `<p style="margin-top:16px">This link expires in <strong>14 days</strong> and is unique to you. Do not share it.</p>`,
        { label: 'View Care Information', url }), 'team');
  }

  // ── Misc ──
  static async sendComplianceDigestEmail(email: string, managerName: string, locationName: string, staffItems: { staffName: string; incomplete: { requirement: string; category: string }[] }[]) {
    const items = staffItems.map(s => {
      const reqs = s.incomplete.map(r => `<li>${r.requirement} (${r.category})</li>`).join('');
      return `<tr><td style="padding:6px 12px;font-weight:600">${s.staffName}</td><td style="padding:6px 12px"><ul style="margin:0;padding-left:16px">${reqs}</ul></td></tr>`;
    }).join('');
    await sendMail(email, `Compliance Digest — ${locationName}`,
      buildEmailHtml('Compliance Digest', `Compliance Status for ${locationName}`,
        `<p>Hi ${managerName},</p><p>Here's your daily compliance update:</p><table border="0" cellpadding="0" cellspacing="0">${items}</table>`,
        { label: 'View Compliance', url: `${baseUrl()}/compliance` }));
  }

  static async sendQueued(to: string, subject: string, htmlBody: string, category: SenderCategory = 'notifications') {
    const html = buildEmailHtml(subject, subject, htmlBody);
    await sendMail(to, subject, html, category);
  }

  static buildTrialFollowupEmailHtml(name: string, orgName: string, message: string) {
    const url = `${baseUrl()}/billing`;
    return buildEmailHtml(
      'A note from Meticle',
      'Checking in about your Meticle trial',
      `<p>Hi ${name},</p><p>${message.replace(/\n/g, '<br>')}</p><p>Your organisation, <strong>${orgName}</strong>, can review its plan and reactivate access from Billing.</p>`,
      { label: 'Review billing', url }
    );
  }

  // ── Trial Reminders ──
  static async sendTrialExpiringEmail(email: string, name: string, orgName: string, daysLeft: number, hasCard: boolean) {
    const org = orgName || 'your organisation';
    const url = `${baseUrl()}/billing`;
    const timing = daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`;
    const subject = hasCard
      ? `Your Meticle trial ends ${timing}`
      : `Your Meticle trial ends ${timing} — payment method needed`;
    const body = hasCard
      ? `<p>Hi ${name},</p><p>Your trial for <strong>${org}</strong> ends ${timing}. We will charge the payment method on file when the trial ends.</p><p>You can review your plan or update your payment method from Billing.</p>`
      : `<p>Hi ${name},</p><p>Your trial for <strong>${org}</strong> ends ${timing}. Add a payment method before then if you want uninterrupted access after the trial.</p><p>Your account and data will remain available for reactivation if you decide not to continue.</p>`;
    await sendMail(email, subject,
      buildEmailHtml('Trial ending', daysLeft === 1 ? 'Your trial ends tomorrow' : `Your trial ends in ${daysLeft} days`, body,
        { label: hasCard ? 'Review billing' : 'Add payment method', url }), 'billing');
  }

  static async sendTrialExpiredEmail(email: string, name: string, orgName: string, hasCard: boolean) {
    const org = orgName || 'your organisation';
    const url = `${baseUrl()}/billing`;
    const subject = hasCard ? 'Your Meticle trial has ended' : 'Your Meticle trial has ended — choose whether to continue';
    const body = hasCard
      ? `<p>Hi ${name},</p><p>Your trial for <strong>${org}</strong> has ended and your subscription is now active. The payment method on file was charged.</p><p>You can review your plan, invoices and payment method in Billing.</p>`
      : `<p>Hi ${name},</p><p>Your trial for <strong>${org}</strong> has ended. No payment was taken because no payment method was on file.</p><p>Your data has been retained. Add a payment method if you want to reactivate the service.</p>`;
    await sendMail(email, subject,
      buildEmailHtml('Trial ended', `Your trial for ${org} has ended`, body,
        { label: hasCard ? 'Open billing' : 'Reactivate service', url }), 'billing');
  }

  // ── Subscription Renewal ──
  static async sendSubscriptionExpiringEmail(email: string, name: string, orgName: string, daysLeft: number, hasCard: boolean) {
    const org = orgName || 'your organisation';
    const url = `${baseUrl()}/billing`;
    const plural = daysLeft !== 1;
    const headline = plural ? `Your subscription ends in ${daysLeft} days` : 'Your subscription ends tomorrow';
    await sendMail(email,
      plural ? `Your Meticle subscription ends in ${daysLeft} days` : 'Your Meticle subscription ends tomorrow',
      buildEmailHtml('Subscription Renewal', headline,
        `<p>Hi ${name},</p>` +
        `<p>Your Meticle subscription for <strong>${org}</strong> ${plural ? `ends in <strong>${daysLeft} days</strong>` : '<strong>ends tomorrow</strong>'}.</p>` +
        `<p>After this date, access to operational changes will be restricted. Your data will be retained.</p>` +
        `<p>${hasCard ? 'Review your payment method if anything has changed.' : 'Add a payment method before the end date if you want service to continue.'}</p>`,
        { label: hasCard ? 'View Billing' : 'Add Payment Card', url }), 'billing');
  }

  static async sendSubscriptionExpiredEmail(email: string, name: string, orgName: string) {
    const org = orgName || 'your organisation';
    const url = `${baseUrl()}/billing`;
    await sendMail(email, 'Your Meticle subscription has ended — reactivate to restore access',
      buildEmailHtml('Subscription Ended', `Your subscription for ${org} has ended`,
        `<p>Hi ${name},</p>` +
        `<p>Your Meticle subscription for <strong>${org}</strong> has ended, so your team's access has been paused.</p>` +
        `<p>Your data has been retained. Renewing restores access for your organisation.</p>` +
        `<p>Open Billing to choose a plan or update your payment method.</p>`,
        { label: 'Reactivate Now', url }), 'billing');
  }

  // ── Payment receipts & recovery (industry-standard dunning) ──
  static async sendPaymentReceiptEmail(email: string, name: string, orgName: string, opts: {
    amount: number
    currency: string
    invoiceNumber: string
    planName: string
    nextBillingDate?: string | null
    isRetry?: boolean
    organizationId?: string
  }) {
    const url = `${baseUrl()}/billing`;
    const org = orgName || 'your organisation';
    const next = opts.nextBillingDate
      ? new Date(opts.nextBillingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'your next billing date';

    // Generate invoice PDF attachment
    let attachments: { filename: string; content: Buffer; contentType?: string }[] | undefined;
    try {
      if (opts.organizationId) {
        const orgResult = await pool.query('SELECT name, primary_color FROM organizations WHERE id = $1', [opts.organizationId]);
        const orgData = orgResult.rows[0] || {};
        const invoiceData = {
          amount: opts.amount,
          currency: opts.currency,
          invoice_number: opts.invoiceNumber,
          description: opts.planName,
          status: 'paid',
          issued_at: new Date().toISOString(),
          paid_at: new Date().toISOString(),
        };
        const invoiceHtml = buildInvoiceHtml(invoiceData, { name: orgData.name || org, primary_color: orgData.primary_color });
        const pdfBuffer = await generatePdf(invoiceHtml);
        attachments = [{ filename: `invoice-${opts.invoiceNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }];
      }
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Failed to generate invoice PDF for receipt email');
    }

    await sendMail(email,
      `Receipt for ${opts.currency} ${opts.amount.toFixed(2)} — Meticle`,
      buildEmailHtml('Payment Receipt', `${opts.isRetry ? 'Payment received' : 'Thank you for your payment'}`,
        `<p>Hi ${name},</p>` +
        `<p>Your payment for <strong>${org}</strong> went through successfully.</p>` +
        `<table border="0" cellpadding="0" cellspacing="0" style="margin:12px 0;background:#F9FAFB;border-radius:12px;padding:16px;width:100%">` +
        `<tr><td style="padding:6px 12px;font-size:14px;color:#6B7280">Plan</td><td style="padding:6px 12px;font-size:14px;font-weight:600;color:#111827;text-align:right">${opts.planName}</td></tr>` +
        `<tr><td style="padding:6px 12px;font-size:14px;color:#6B7280">Invoice</td><td style="padding:6px 12px;font-size:14px;font-weight:600;color:#111827;text-align:right">${opts.invoiceNumber}</td></tr>` +
        `<tr><td style="padding:6px 12px;font-size:14px;color:#6B7280">Amount</td><td style="padding:6px 12px;font-size:16px;font-weight:800;color:#0F4C81;text-align:right">${opts.currency} ${opts.amount.toFixed(2)}</td></tr>` +
        `<tr><td style="padding:6px 12px;font-size:14px;color:#6B7280">Next billing date</td><td style="padding:6px 12px;font-size:14px;font-weight:600;color:#111827;text-align:right">${next}</td></tr>` +
        `</table>` +
        `<p style="font-size:13px;color:#9CA3AF">Your invoice is attached to this email. Questions about this charge? Reply and we'll help.</p>`,
        { label: 'View Billing', url }), 'billing', attachments);
  }

  static async sendPaymentFailedEmail(email: string, name: string, orgName: string, opts: {
    amount: number
    currency: string
    cardInfo: string
    attemptCount: number
    nextAttempt?: string | null
    daysSinceFirstFailure: number
    manualRetry?: boolean
    organizationId?: string
  }) {
    const url = `${baseUrl()}/billing`;
    const org = orgName || 'your organisation';
    const currency = opts.currency;
    const amount = opts.amount.toFixed(2);
    const retryStr = opts.nextAttempt ? `We'll retry automatically on <strong>${opts.nextAttempt}</strong>.` : (opts.manualRetry ? 'You can retry at any time from the Billing page.' : "We'll retry automatically.");
    // Escalating urgency per dunning best practice (day 0 → friendly, day 14 → final)
    let heading = "We couldn't process your payment";
    let body: string;
    let subject: string;
    if (opts.daysSinceFirstFailure >= 14) {
      heading = 'Final notice: your subscription will pause';
      subject = `Final notice: your Meticle subscription will pause`;
      body = `<p>Hi ${name},</p>` +
        `<p>It's been two weeks since our first failed attempt to charge <strong>${currency} ${amount}</strong> for <strong>${org}</strong>. Your access will be paused soon unless the payment goes through.</p>` +
        `<p>Your data will be retained, and you can reactivate the service from Billing.</p>`;
    } else if (opts.daysSinceFirstFailure >= 7) {
      heading = 'Action needed — your payment is still failing';
      subject = `Action needed: payment for ${org} is still failing`;
      body = `<p>Hi ${name},</p>` +
        `<p>We've tried several times to charge <strong>${currency} ${amount}</strong> for <strong>${org}</strong> and the payment is still failing (${opts.cardInfo}).</p>` +
        `<p>Your account is now in a restricted grace period. Read-only access remains available until the grace period ends. Changes are restricted until payment is resolved. ${retryStr}</p><p>The grace period starts when the billing period ends and lasts seven days unless payment is resolved sooner.</p>`;
    } else if (opts.daysSinceFirstFailure >= 3) {
      heading = 'We tried your card again — action still needed';
      subject = `We tried your card again for ${org}`;
      body = `<p>Hi ${name},</p>` +
        `<p>We tried charging <strong>${currency} ${amount}</strong> for <strong>${org}</strong> again and it didn't go through (${opts.cardInfo}).</p>` +
        `<p>The bank may have declined the charge because the card is expired, restricted, or temporarily unavailable. ${retryStr}</p>` +
        `<p>Your subscription remains active for now. Review the payment method before the next attempt.</p><p>If the billing period ends while payment remains unresolved, the seven-day restricted grace period will begin.</p>`;
    } else {
      subject = `Quick update: your Meticle payment didn't go through`;
      body = `<p>Hi ${name},</p>` +
        `<p>Our charge of <strong>${currency} ${amount}</strong> for <strong>${org}</strong> didn't go through (${opts.cardInfo}).</p>` +
        `<p>The bank may have declined the charge because the card is expired, restricted, or temporarily unavailable. ${retryStr}</p>` +
        `<p>Your access continues while we sort this out. Review the payment method in Billing. If the billing period ends while payment remains unresolved, a seven-day restricted grace period will begin.</p>`;
    }

    // Generate draft invoice PDF attachment
    let attachments: { filename: string; content: Buffer; contentType?: string }[] | undefined;
    try {
      if (opts.organizationId) {
        const orgResult = await pool.query('SELECT name, primary_color FROM organizations WHERE id = $1', [opts.organizationId]);
        const orgData = orgResult.rows[0] || {};
        const invoiceData = {
          amount: opts.amount,
          currency: opts.currency,
          invoice_number: `DRAFT-${Date.now().toString(36).toUpperCase()}`,
          description: `${org} subscription — payment pending`,
          status: 'open',
          issued_at: new Date().toISOString(),
        };
        const invoiceHtml = buildInvoiceHtml(invoiceData, { name: orgData.name || org, primary_color: orgData.primary_color });
        const pdfBuffer = await generatePdf(invoiceHtml);
        attachments = [{ filename: `invoice-draft-${org.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }];
      }
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Failed to generate draft invoice PDF for failure email');
    }

    await sendMail(email, subject,
      buildEmailHtml('Payment Update', heading, body,
        { label: opts.manualRetry ? 'Retry Payment' : 'Update Payment Method', url }), 'billing', attachments);
  }

  static async sendPaymentActionRequiredEmail(email: string, name: string, orgName: string, opts: {
    amount: number
    currency: string
  }) {
    const url = `${baseUrl()}/billing`;
    const org = orgName || 'your organisation';
    await sendMail(email,
      `Action required: confirm your ${opts.currency} ${opts.amount.toFixed(2)} Meticle payment`,
      buildEmailHtml('Payment Action Required', 'Your bank needs you to confirm a payment',
        `<p>Hi ${name},</p>` +
        `<p>To keep your <strong>${org}</strong> subscription running, your bank needs you to confirm a recent payment of <strong>${opts.currency} ${opts.amount.toFixed(2)}</strong> (3D Secure authentication).</p>` +
        `<p>Complete the confirmation to keep your subscription active.</p>`,        { label: 'Complete Payment', url }), 'billing');
  }

  // Build invoice notification email HTML (used by webhook handler and reminder job)
  static buildInvoiceEmailHtml(name: string, amount: number, currency: string, description: string, dueDateStr: string) {
    const url = `${baseUrl()}/billing`;
    const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency + ' ';
    return buildEmailHtml('Invoice', 'Your invoice is ready',
      `<p>Hi ${name},</p>` +
      `<p>A new invoice has been generated for your Meticle subscription:</p>` +
      `<table border="0" cellpadding="0" cellspacing="0" style="margin:12px 0;background:#F9FAFB;border-radius:12px;padding:16px;width:100%">` +
      `<tr><td style="padding:6px 12px;font-size:14px;color:#6B7280">Description</td><td style="padding:6px 12px;font-size:14px;font-weight:600;color:#111827;text-align:right">${description}</td></tr>` +
      `<tr><td style="padding:6px 12px;font-size:14px;color:#6B7280">Amount</td><td style="padding:6px 12px;font-size:16px;font-weight:800;color:#0F4C81;text-align:right">${symbol}${amount.toFixed(2)}</td></tr>` +
      `<tr><td style="padding:6px 12px;font-size:14px;color:#6B7280">Due date</td><td style="padding:6px 12px;font-size:14px;font-weight:600;color:#DC2626;text-align:right">${dueDateStr}</td></tr>` +
      `</table>` +
      `<p>If a payment method is on file, it will be charged automatically on the due date. Review the invoice and payment method in Billing.</p>`,
      { label: 'View Invoice', url });
  }

  // Pre-due invoice reminder emails
  static async sendInvoiceReminderEmail(email: string, name: string, orgName: string, opts: {
    amount: number
    currency: string
    dueDate: string
    daysUntilDue: number
  }) {
    const url = `${baseUrl()}/billing`;
    const org = orgName || 'your organisation';
    const symbol = opts.currency === 'GBP' ? '£' : opts.currency === 'USD' ? '$' : opts.currency + ' ';
    const dueDateStr = new Date(opts.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    let heading: string;
    let body: string;
    let subject: string;
    if (opts.daysUntilDue <= 1) {
      heading = 'Payment due tomorrow';
      subject = `Payment due tomorrow for ${org}`;
      body = `<p>Hi ${name},</p>` +
        `<p>Your Meticle invoice of <strong>${symbol}${opts.amount.toFixed(2)}</strong> for <strong>${org}</strong> is due <strong>tomorrow</strong> (${dueDateStr}).</p>` +
        `<p>If a payment method is on file, it will be charged automatically. Review it in Billing before the due date if anything has changed.</p>`;
    } else if (opts.daysUntilDue <= 3) {
      heading = `Payment due in ${opts.daysUntilDue} days`;
      subject = `Payment due in ${opts.daysUntilDue} days for ${org}`;
      body = `<p>Hi ${name},</p>` +
        `<p>Your Meticle invoice of <strong>${symbol}${opts.amount.toFixed(2)}</strong> for <strong>${org}</strong> is due on <strong>${dueDateStr}</strong>.</p>` +
        `<p>If a payment method is on file, it will be charged automatically. You can review it in Billing.</p>`;
    } else {
      heading = `Payment due in ${opts.daysUntilDue} days`;
      subject = `Upcoming payment for ${org} — ${dueDateStr}`;
      body = `<p>Hi ${name},</p>` +
        `<p>This is a friendly reminder that your Meticle invoice of <strong>${symbol}${opts.amount.toFixed(2)}</strong> for <strong>${org}</strong> is due on <strong>${dueDateStr}</strong>.</p>` +
        `<p>No action is needed if your payment method is up to date.</p>`;
    }
    await sendMail(email, subject,
      buildEmailHtml('Payment Reminder', heading, body,
        { label: 'View Billing', url }), 'billing');
  }

  // -- Daily Shift Audit --
  static async sendShiftAuditEmail(
    email: string,
    managerName: string,
    date: string,
    loc: {
      location_name: string;
      total_shifts: number;
      staff_deployed: number;
      minimum_staff: number;
      staffing_ok: boolean;
      shifts: {
        shift_type: string;
        start_time: string;
        end_time: string;
        status: string;
        su_name: string | null;
        staff: { first_name: string; last_name: string; is_overtime: boolean }[];
      }[];
      emar: {
        person_name: string;
        required: number;
        given: number;
        missed: number;
        refused: number;
      }[];
      low_stock: {
        medication_name: string;
        dosage: string;
        unit: string;
        quantity: number;
        reorder_level: number;
        quantity_unit: string;
        person_name: string;
      }[];
    }
  ) {
    const staffingBadge = loc.staffing_ok
      ? '<span style="color:#065F46;background:#D1FAE5;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700">STAFFED</span>'
      : '<span style="color:#991B1B;background:#FEE2E2;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700">UNDERSTAFFED</span>';

    const shiftRows = loc.shifts.map(s => {
      const staffNames = s.staff.map(st =>
        `<span style="margin-right:8px">${st.first_name} ${st.last_name}${st.is_overtime ? ' <em>(OT)</em>' : ''}</span>`
      ).join('') || '<em>Unassigned</em>';

      const suLabel = s.su_name
        ? `<span style="color:#6B7280">Person: ${s.su_name}</span>`
        : '';

      const start = new Date(s.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const end = new Date(s.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6">
          <strong style="text-transform:capitalize">${s.shift_type}</strong><br>
          <span style="color:#6B7280;font-size:13px">${start} – ${end}</span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:13px">${staffNames}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:13px">${suLabel}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:12px;text-transform:capitalize;color:${s.status === 'completed' ? '#065F46' : '#92400E'}">${s.status}</td>
      </tr>`;
    }).join('');

    const emarRows = loc.emar.map(e => {
      const missedTotal = e.missed + e.refused;
      const color = missedTotal > 0 ? '#991B1B' : '#065F46';
      const bg = missedTotal > 0 ? '#FEE2E2' : '#D1FAE5';
      return `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #F3F4F6;font-size:13px">${e.person_name}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;text-align:center">${e.required}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;text-align:center">${e.given}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;text-align:center">
          <span style="color:${color};background:${bg};padding:2px 8px;border-radius:10px;font-weight:600">${missedTotal}</span>
        </td>
      </tr>`;
    }).join('');

    const emarSection = loc.emar.length > 0
      ? `<tr><td style="padding:20px 0 0 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:16px;font-weight:700;color:#1F2937;padding:0 0 12px 0">eMAR Medication Status</td></tr>
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden">
<tr style="background:#F9FAFB">
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase">Person</td>
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;text-align:center">Required</td>
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;text-align:center">Given</td>
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;text-align:center">Missed/Refused</td>
</tr>
${emarRows}
</table>
</td></tr></table>
</td></tr>`
      : '';

    const lowStockRows = loc.low_stock.map(s =>
      `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #F3F4F6;font-size:13px">${s.medication_name} ${s.dosage}${s.unit}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #F3F4F6;font-size:13px">${s.person_name || 'Shared stock'}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;text-align:center">
          <span style="color:#991B1B;background:#FEE2E2;padding:2px 8px;border-radius:10px;font-weight:600">${s.quantity} ${s.quantity_unit || s.unit || ''}</span>
        </td>
        <td style="padding:6px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;text-align:center">${s.reorder_level}</td>
      </tr>`).join('');

    const lowStockSection = loc.low_stock.length > 0
      ? `<tr><td style="padding:20px 0 0 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:16px;font-weight:700;color:#1F2937;padding:0 0 4px 0">Stock Reorder Alerts</td></tr>
<tr><td style="font-size:13px;color:#6B7280;padding:0 0 12px 0">${loc.low_stock.length} item(s) at or below reorder level — please arrange delivery.</td></tr>
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden">
<tr style="background:#F9FAFB">
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase">Medication</td>
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase">Person</td>
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;text-align:center">Remaining</td>
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;text-align:center">Reorder At</td>
</tr>
${lowStockRows}
</table>
</td></tr></table>
</td></tr>`
      : '';

    const dateFormatted = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    await sendMail(email,
      `Daily Shift Audit — ${loc.location_name} — ${dateFormatted}`,
      buildEmailHtml(
        'Daily Shift Audit',
        `Shift Report — ${loc.location_name}`,
        `<p>Hi ${managerName},</p>
<p>Here's your shift summary for <strong>${dateFormatted}</strong>.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">
<tr>
  <td style="padding:12px 16px;background:#F9FAFB;border-radius:8px;text-align:center">
    <div style="font-size:24px;font-weight:800;color:#0F4C81">${loc.total_shifts}</div>
    <div style="font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:0.3px">Shifts</div>
  </td>
  <td style="padding:12px 16px;background:#F9FAFB;border-radius:8px;text-align:center">
    <div style="font-size:24px;font-weight:800;color:#0F4C81">${loc.staff_deployed}</div>
    <div style="font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:0.3px">Staff Deployed</div>
  </td>
  <td style="padding:12px 16px;background:#F9FAFB;border-radius:8px;text-align:center">
    <div style="font-size:24px;font-weight:800;color:${loc.staffing_ok ? '#065F46' : '#991B1B'}">${loc.minimum_staff}</div>
    <div style="font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:0.3px">Min Required</div>
  </td>
  <td style="padding:12px 16px;background:#F9FAFB;border-radius:8px;text-align:center">
    ${staffingBadge}
  </td>
</tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:16px;font-weight:700;color:#1F2937;padding:0 0 12px 0">Shifts Today</td></tr>
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden">
<tr style="background:#F9FAFB">
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase">Shift</td>
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase">Staff</td>
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase">Person</td>
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase">Status</td>
</tr>
${shiftRows}
</table>
</td></tr></table>
${emarSection}
${lowStockSection}`,
        { label: 'View Rota', url: `${baseUrl()}/scheduling` }
      )
    );
  }

  // -- Stock reorder alert --
  static async sendStockReorderEmail(
    email: string,
    managerName: string,
    item: {
      medication_name: string;
      dosage: string;
      unit: string;
      quantity: number;
      reorder_level: number;
      quantity_unit: string;
      location_name: string;
      person_name: string;
    }
  ) {
    const remainingLabel = `${item.quantity} ${item.quantity_unit || item.unit || ''}`;
    await sendMail(email,
      `Stock Reorder Alert — ${item.medication_name} — ${item.location_name}`,
      buildEmailHtml(
        'Stock Reorder Alert',
        `Reorder required: ${item.medication_name}`,
        `<p>Hi ${managerName},</p>
<p><strong>${item.medication_name} ${item.dosage}${item.unit}</strong>${item.person_name ? ` for <strong>${item.person_name}</strong>` : ''} has reached its reorder level.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden">
<tr style="background:#F9FAFB">
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase">Remaining Stock</td>
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase">Reorder Level</td>
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase">Location</td>
</tr>
<tr>
  <td style="padding:8px 12px;font-size:14px;font-weight:700;color:#991B1B">${remainingLabel}</td>
  <td style="padding:8px 12px;font-size:14px;text-align:center">${item.reorder_level}</td>
  <td style="padding:8px 12px;font-size:13px">${item.location_name || '—'}</td>
</tr>
</table>

<p style="font-size:13px;color:#6B7280">Once stock is below the reorder level, administrations cannot be recorded as given until a delivery is logged. Please arrange a delivery as soon as possible.</p>`,
        { label: 'View Stock', url: `${baseUrl()}/emedication` }
      )
    );
  }

  // -- Late medication alert --
  static async sendLateMedAlertEmail(
    email: string,
    recipientName: string,
    locationName: string,
    items: {
      person_name: string;
      medication_name: string;
      dosage: string;
      unit: string;
      scheduled_time: string;
    }[],
    delayMinutes: number
  ) {
    const rows = items.map(i => {
      const time = new Date(i.scheduled_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      return `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #F3F4F6;font-size:13px">${i.person_name}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #F3F4F6;font-size:13px"><strong>${i.medication_name}</strong> ${i.dosage}${i.unit}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;text-align:center">
          <span style="color:#991B1B;background:#FEE2E2;padding:2px 8px;border-radius:10px;font-weight:600">${time}</span>
        </td>
      </tr>`;
    }).join('');

    await sendMail(email,
      `Medication Overdue — ${locationName} — ${items.length} due`,
      buildEmailHtml(
        'Late Medication Alert',
        `Medications overdue at ${locationName}`,
        `<p>Hi ${recipientName},</p>
<p>${items.length} medication administration${items.length !== 1 ? 's are' : ' is'} overdue by more than <strong>${delayMinutes} minutes</strong>. Please check on the person(s) and administer where appropriate.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden">
<tr style="background:#F9FAFB">
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase">Person</td>
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase">Medication</td>
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;text-align:center">Scheduled</td>
</tr>
${rows}
</table>

<p style="font-size:13px;color:#6B7280">Any omitted or refused administration must be recorded on the MAR chart and reported to the prescriber if required.</p>`,
        { label: 'Open eMAR', url: `${baseUrl()}/emedication` }
      )
    );
  }
}
