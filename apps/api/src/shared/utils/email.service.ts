import nodemailer from 'nodemailer';
import { buildEmailHtml, buildCodeEmailHtml, buildStatusEmailHtml } from './email.template';
import logger from './logger';

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

async function sendMail(to: string, subject: string, html: string) {
  const t = getTransporter();
  if (!t) { logger.warn('No email transporter available'); return; }
  try {
    const from = process.env.SMTP_FROM || 'hello@meticlecare.com';
    await t.sendMail({ from, to, subject, html });
    logger.info({ to, subject }, 'Email sent');
  } catch (err) { logger.error(err, 'Email send failed'); }
}

const baseUrl = () => process.env.FRONTEND_URL || 'http://localhost:3000';

export class EmailService {
  static async sendVerificationEmail(email: string, token: string) {
    const url = `${baseUrl()}/verify-email?token=${token}`;
    await sendMail(email, 'Verify your Meticle account',
      buildEmailHtml('Verify Email', 'Verify your email address',
        `<p>Click the button below to verify your email address and activate your account.</p>`,
        { label: 'Verify Email', url }));
  }

  static async sendVerificationCode(email: string, code: string) {
    await sendMail(email, 'Your Meticle Verification Code', buildCodeEmailHtml(code));
  }

  static async sendPasswordResetEmail(email: string, token: string) {
    const url = `${baseUrl()}/reset-password?token=${token}`;
    await sendMail(email, 'Reset your Meticle password',
      buildEmailHtml('Reset Password', 'Reset your password',
        `<p>Click the button below to reset your password. This link expires in 1 hour.</p>`,
        { label: 'Reset Password', url }));
  }

  static async sendInviteEmail(email: string, orgName: string, token: string) {
    const url = `${baseUrl()}/register?token=${token}`;
    await sendMail(email, `You've been invited to join ${orgName} on Meticle`,
      buildEmailHtml('Invitation', `You've been invited to ${orgName}`,
        `<p>Click below to create your account and join ${orgName} on Meticle.</p>`,
        { label: 'Accept Invitation', url }));
  }

  static async sendWelcomeEmail(email: string, name: string, orgName?: string) {
    const org = orgName || 'your organisation';
    const url = `${baseUrl()}/dashboard`;
    await sendMail(email, `Welcome to Meticle, ${org}!`,
      buildEmailHtml('Welcome',
        `Welcome to Meticle, ${org}`,
        `<p style="margin:0 0 12px 0">Hi ${name},</p>` +
        `<p style="margin:0 0 12px 0">Thank you for choosing Meticle. I built this platform because I believe every care provider deserves to walk into a CQC inspection knowing exactly what their score will be.</p>` +
        `<p style="margin:0 0 16px 0">Here's what I suggest you do first:</p>` +
        `<p style="margin:0 0 4px 0"><strong>1. Add your staff</strong> — invite your team from the Staff Directory</p>` +
        `<p style="margin:0 0 4px 0"><strong>2. Set up compliance profiles</strong> — staff are auto-assigned by role</p>` +
        `<p style="margin:0 0 4px 0"><strong>3. Run your first CQC readiness assessment</strong> — see where you stand</p>` +
        `<p style="margin:0 0 12px 0"><strong>4. Generate an evidence pack</strong> — one click, inspector-ready</p>` +
        `<p style="margin:0 0 12px 0">You're on a <strong>14-day free trial</strong>. Take it for a proper spin.</p>` +
        `<p style="margin:0;font-size:13px;color:#9CA3AF">If you have any questions, just reply to this email.</p>` +
        `<p style="margin:0;font-size:13px;color:#9CA3AF">Opeyemi Olorunfemi<br>CEO, Meticle</p>`,
        { label: 'Go to Meticle', url }));
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
  static async sendShiftStartEmail(staffEmail: string, staffName: string, date: string, shifts: any[], incidents?: any[], appointments?: any[]) {
    const shiftList = shifts.map((s: any) => `<tr><td style="padding:4px 12px">${s.time || s.start_time}</td><td style="padding:4px 12px">${s.location}</td><td style="padding:4px 12px">${s.type || ''}</td></tr>`).join('');
    const incList = incidents?.length ? `<p style="margin-top:12px"><strong>Recent Incidents:</strong></p><ul>${incidents.map((i: any) => `<li>${i.title} (${i.severity})</li>`).join('')}</ul>` : '';
    const appList = appointments?.length ? `<p style="margin-top:12px"><strong>Today's Appointments:</strong></p><ul>${appointments.map((a: any) => `<li>${a.title} — ${a.service_user_name || ''}</li>`).join('')}</ul>` : '';
    await sendMail(staffEmail, `Your Rota for ${date}`,
      buildEmailHtml('Today\'s Plan', `Hi ${staffName},`,
        `<p>Here's your plan for ${date}:</p><table>${shiftList}</table>${incList}${appList}`,
        { label: 'View Rota', url: `${baseUrl()}/scheduling` }));
  }

  // ── MFA ──
  static async sendMfaSetupCompleteEmail(email: string, name: string) {
    await sendMail(email, 'MFA Enabled',
      buildEmailHtml('Security', `Hi ${name},`,
        `<p>Multi-factor authentication has been enabled on your account.</p>`,
        { label: 'Settings', url: `${baseUrl()}/settings` }));
  }

  static async sendMfaBackupCodesEmail(email: string, backupCodes: string[], name: string) {
    await sendMail(email, 'Your MFA Backup Codes',
      buildEmailHtml('Backup Codes', `Hi ${name},`,
        `<p>Save these backup codes in a safe place. Each code can only be used once:</p><pre>${backupCodes.join('\n')}</pre>`,
        { label: 'Settings', url: `${baseUrl()}/settings` }));
  }

  static async sendMfaResetAdminEmail(email: string, name: string) {
    await sendMail(email, 'MFA Reset by Admin',
      buildEmailHtml('MFA Reset', `Hi ${name},`,
        `<p>An administrator has reset your multi-factor authentication. Next time you log in you will be asked to set up MFA again.</p>`,
        { label: 'Login', url: `${baseUrl()}/login` }));
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
    await sendMail(to, subject, html);
  }

  // ── Family Portal ──
  static async sendFamilyPortalInviteEmail(email: string, memberName: string, serviceUserName: string, token: string, orgName: string) {
    const url = `${baseUrl()}/family-portal/${token}`;
    await sendMail(email, `${orgName} — Access to ${serviceUserName}'s care information`,
      buildEmailHtml('Family Portal', `You've been invited to stay connected`,
        `<p>Hi ${memberName},</p>` +
        `<p><strong>${orgName}</strong> has invited you to view care information for <strong>${serviceUserName}</strong> through the Meticle Family Portal.</p>` +
        `<p>Through this secure portal you can see:</p>` +
        `<ul><li>Daily care notes</li><li>Care plans</li><li>Goals and progress</li><li>Health observations</li></ul>` +
        `<p style="margin-top:16px">This link expires in <strong>90 days</strong> and is unique to you. Do not share it.</p>`,
        { label: 'View Care Information', url }));
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

  static async sendQueued(to: string, subject: string, htmlBody: string) {
    const html = buildEmailHtml(subject, subject, htmlBody);
    const { EmailQueue } = await import('./email.queue');
    await EmailQueue.enqueue(to, subject, html);
  }

  // ── Trial Reminders ──
  static async sendTrialExpiringEmail(email: string, name: string, orgName: string, daysLeft: number, hasCard: boolean) {
    const org = orgName || 'your organisation';
    const url = `${baseUrl()}/billing`;
    if (hasCard) {
      await sendMail(email,
        daysLeft > 1 ? `Your trial ends in ${daysLeft} days — your card will be charged on the expiry date` : `Your trial ends tomorrow — your card will be charged`,
        buildEmailHtml('Trial Reminder',
          daysLeft > 1 ? `Your trial ends in ${daysLeft} days` : 'Your trial ends tomorrow',
          `<p>Hi ${name},</p>` +
          `<p>Your 14-day trial for <strong>${org}</strong> ${daysLeft > 1 ? `ends in <strong>${daysLeft} days</strong>` : '<strong>ends tomorrow</strong>'}. We'll charge the card on file on the expiry date.</p>` +
          `<p>You can view or update your payment method at any time.</p>` +
          `<p style="font-size:13px;color:#9CA3AF">Opeyemi Olorunfemi<br>CEO, Meticle</p>`,
          { label: 'View Billing', url }));
    } else {
      await sendMail(email,
        daysLeft > 1 ? `Your trial ends in ${daysLeft} days — add a card to continue` : `Your trial ends tomorrow — add a card today`,
        buildEmailHtml('Trial Reminder',
          daysLeft > 1 ? `Your trial ends in ${daysLeft} days` : 'Your trial ends tomorrow',
          `<p>Hi ${name},</p>` +
          `<p>Your 14-day trial for <strong>${org}</strong> ${daysLeft > 1 ? `ends in <strong>${daysLeft} days</strong>` : '<strong>ends tomorrow</strong>'}. You'll lose access to CQC scoring, evidence packs, rota planning, eMAR, and all compliance records.</p>` +
          `<p>Adding a payment card takes 30 seconds. <strong>You won't be charged until your trial ends.</strong></p>` +
          `<p style="font-size:13px;color:#9CA3AF">Opeyemi Olorunfemi<br>CEO, Meticle</p>`,
          { label: 'Add Payment Card', url }));
    }
  }

  static async sendTrialExpiredEmail(email: string, name: string, orgName: string, hasCard: boolean) {
    const org = orgName || 'your organisation';
    const url = `${baseUrl()}/billing`;
    if (hasCard) {
      await sendMail(email, 'Your Meticle trial has ended — your card has been charged',
        buildEmailHtml('Trial Ended', `Your trial for ${org} has ended`,
          `<p>Hi ${name},</p>` +
          `<p>Your 14-day trial has ended. Your card on file has been charged and your subscription is now active.</p>` +
          `<p>You can manage your plan and billing from the Billing page.</p>` +
          `<p style="font-size:13px;color:#9CA3AF">Opeyemi Olorunfemi<br>CEO, Meticle</p>`,
          { label: 'Manage Billing', url }));
    } else {
      await sendMail(email, 'Your Meticle trial has ended — add a card to restore access',
        buildEmailHtml('Trial Expired', `Your trial for ${org} has ended`,
          `<p>Hi ${name},</p>` +
          `<p>Your 14-day free trial has ended. Your data is safe — nothing has been deleted. Add a card to continue using Meticle.</p>` +
          `<p><strong>No card = no charges.</strong> You control when to resume.</p>` +
          `<p style="font-size:13px;color:#9CA3AF">Opeyemi Olorunfemi<br>CEO, Meticle</p>`,
          { label: 'Reactivate Now', url }));
    }
  }
}
