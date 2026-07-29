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
  try {
    const { EmailQueue } = await import('./email.queue');
    await EmailQueue.enqueue(to, subject, html);
    logger.info({ to, subject }, 'Email queued');
  } catch (err: any) {
    logger.error({ err: err.message, to, subject }, 'Email enqueue failed');
  }
}

const baseUrl = () => 'https://meticlecare.com';

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
          `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;font-size:15px;color:#0F4C81;font-weight:700;width:24px">\u2713</td><td style="padding:6px 0;font-size:14px;color:#4B5563"><strong>eMAR &amp; Clinical Records</strong> — 31-day medication administration charts, PRN tracking, stock management, and full clinical history for every service user.</td></tr>` +
          `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;font-size:15px;color:#0F4C81;font-weight:700;width:24px">\u2713</td><td style="padding:6px 0;font-size:14px;color:#4B5563"><strong>Service User Hub</strong> — Care plans, daily notes, risk assessments, family portal, body maps, wellbeing logs, and discharge planning — all in one place.</td></tr>` +
          `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;font-size:15px;color:#0F4C81;font-weight:700;width:24px">\u2713</td><td style="padding:6px 0;font-size:14px;color:#4B5563"><strong>Incidents &amp; Reporting</strong> — Log, categorise, and action incidents with full audit trails. 35+ reports with filters and CSV export.</td></tr>` +
          `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;font-size:15px;color:#0F4C81;font-weight:700;width:24px">\u2713</td><td style="padding:6px 0;font-size:14px;color:#4B5563"><strong>Leave, Training &amp; Competency</strong> — End-to-end leave management, training matrix with expiry alerts, and competency assessments with evidence.</td></tr>` +
          `</table>` +
          `<p style="margin:0 0 16px 0">You're on a <strong>14-day free trial</strong> with full access to every feature. Here's how to get started:</p>` +
          `<p style="margin:0 0 4px 0;font-size:14px;color:#1F2937"><strong>1.</strong> Complete your organisation profile and invite your team</p>` +
          `<p style="margin:0 0 4px 0;font-size:14px;color:#1F2937"><strong>2.</strong> Set up your locations, departments, and teams</p>` +
          `<p style="margin:0 0 4px 0;font-size:14px;color:#1F2937"><strong>3.</strong> Add service users and configure care plans</p>` +
          `<p style="margin:0 0 4px 0;font-size:14px;color:#1F2937"><strong>4.</strong> Build your rota and invite staff to claim shifts</p>` +
          `<p style="margin:0 0 16px 0;font-size:14px;color:#1F2937"><strong>5.</strong> Run your first CQC readiness assessment</p>` +
          `<p style="margin:0;font-size:14px;color:#4B5563">If you need anything, just reply to this email — we're here to help.</p>` +
          `<p style="margin:16px 0 0 0;font-size:13px;color:#9CA3AF">The Meticle Team</p>`,
          { label: 'Go to Dashboard', url }));
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
          { label: 'Go to Dashboard', url }));
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
    await sendMail(to, subject, html);
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
        service_user_name: string;
        required: number;
        given: number;
        missed: number;
        refused: number;
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
        ? `<span style="color:#6B7280">Service user: ${s.su_name}</span>`
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
        <td style="padding:6px 12px;border-bottom:1px solid #F3F4F6;font-size:13px">${e.service_user_name}</td>
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
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase">Service User</td>
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;text-align:center">Required</td>
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;text-align:center">Given</td>
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;text-align:center">Missed/Refused</td>
</tr>
${emarRows}
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
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase">Service User</td>
  <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase">Status</td>
</tr>
${shiftRows}
</table>
</td></tr></table>
${emarSection}`,
        { label: 'View Rota', url: `${baseUrl()}/scheduling` }
      )
    );
  }
}
