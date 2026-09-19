import { Request, Response } from 'express';
import { AppError } from '../../shared/middleware/error.middleware';
import { FamilyFeedbackRepository as Repo } from './familyFeedback.repository';
import { NotificationsController } from '../notifications/notifications.controller';
import { EmailService } from '../../shared/utils/email.service';
import { query } from '../../shared/database';
import logger, { logWarn } from '../../shared/utils/logger';

export class FamilyFeedbackController {
  /**
   * GET /api/family-feedback/:token — public, token-based
   * Returns visit details and a blank feedback form.
   */
  static async getFeedbackForm(req: Request, res: Response) {
    const { token } = req.params;
    if (!token) throw new AppError(400, 'Token is required');

    const record = await Repo.validateToken(token);
    if (!record) throw new AppError(404, 'This feedback link has expired or already been submitted.');

    res.json({
      visit: {
        label: record.visit_label,
        scheduled_start: record.scheduled_start,
        scheduled_end: record.scheduled_end,
        carer_name: record.carer_name,
      },
      person: {
        first_name: record.person_first_name,
        last_name: record.person_last_name,
      },
      organization: { name: record.org_name },
      family_member_name: record.family_member_name,
      relationship: record.relationship,
    });
  }

  /**
   * POST /api/family-feedback/:token — public, token-based
   * Submit feedback for a completed visit.
   */
  static async submitFeedback(req: Request, res: Response) {
    const { token } = req.params;
    if (!token) throw new AppError(400, 'Token is required');

    const { overall_rating, care_quality_rating, communication_rating, punctuality_rating, feedback_text, would_recommend } = req.body;

    if (!overall_rating || overall_rating < 1 || overall_rating > 5) {
      throw new AppError(400, 'Overall rating must be between 1 and 5');
    }

    const record = await Repo.submitFeedback(token, {
      overall_rating,
      care_quality_rating,
      communication_rating,
      punctuality_rating,
      feedback_text,
      would_recommend,
    });

    if (!record) throw new AppError(404, 'This feedback link has expired or already been submitted.');

    // Notify managers about the feedback
    FamilyFeedbackController.notifyManager(record).catch(logWarn('feedbackNotifyManager'));

    res.json({ message: 'Thank you for your feedback.', submitted: true });
  }

  /**
   * GET /api/compliance/family-feedback — authenticated, manager view
   * List all submitted feedback for the organisation.
   */
  static async listFeedback(req: Request, res: Response) {
    const user = req.user!;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const personId = req.query.personId as string | undefined;

    const result = await Repo.getOrgFeedback(user.organizationId!, { limit, offset, personId });
    res.json(result);
  }

  private static async notifyManager(record: any) {
    try {
      const managers = await query(
        `SELECT u.id, u.email, COALESCE(NULLIF(sp.first_name || ' ' || sp.last_name, ''), u.email) as name
         FROM users u
         LEFT JOIN staff_profiles sp ON sp.user_id = u.id
         WHERE u.organization_id = $1 AND u.role IN ('ORG_ADMIN', 'MANAGER') AND u.status = 'active'`,
        [record.organization_id]
      );

      const stars = '★'.repeat(record.overall_rating) + '☆'.repeat(5 - record.overall_rating);
      const personName = `${record.person_first_name || ''} ${record.person_last_name || ''}`.trim();

      for (const mgr of managers.rows) {
        await NotificationsController.createNotification(
          mgr.id,
          `Family feedback received — ${personName}`,
          `${record.family_member_name} (${record.relationship || 'Family'}) rated the visit ${record.overall_rating}/5. ${record.feedback_text ? `"${record.feedback_text.substring(0, 100)}${record.feedback_text.length > 100 ? '...' : ''}"` : ''}`,
          'compliance'
        ).catch(logWarn('feedbackNotification'));

        if (mgr.email) {
          EmailService.sendEmail(
            mgr.email,
            `Family feedback: ${personName} — ${stars}`,
            `<p>Hi ${mgr.name},</p>
            <p><strong>${record.family_member_name}</strong> (${record.relationship || 'Family member'}) has submitted feedback for a visit to <strong>${personName}</strong>.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr>
                <td style="padding:12px;background:#F0FDF4;border:1px solid #DCFCE7;border-radius:8px;text-align:center">
                  <strong style="color:#166534;font-size:24px">${record.overall_rating}/5</strong><br/>
                  <span style="color:#6B7280;font-size:13px">Overall rating</span>
                </td>
                ${record.care_quality_rating ? `<td style="padding:12px;background:#F0FDF4;border:1px solid #DCFCE7;border-radius:8px;text-align:center"><strong style="font-size:18px">${record.care_quality_rating}/5</strong><br/><span style="color:#6B7280;font-size:13px">Care quality</span></td>` : ''}
                ${record.communication_rating ? `<td style="padding:12px;background:#F0FDF4;border:1px solid #DCFCE7;border-radius:8px;text-align:center"><strong style="font-size:18px">${record.communication_rating}/5</strong><br/><span style="color:#6B7280;font-size:13px">Communication</span></td>` : ''}
                ${record.punctuality_rating ? `<td style="padding:12px;background:#F0FDF4;border:1px solid #DCFCE7;border-radius:8px;text-align:center"><strong style="font-size:18px">${record.punctuality_rating}/5</strong><br/><span style="color:#6B7280;font-size:13px">Punctuality</span></td>` : ''}
              </tr>
            </table>
            ${record.feedback_text ? `<p style="color:#374151;line-height:1.6;margin:16px 0;padding:12px;background:#F9FAFB;border-radius:8px;border-left:3px solid #00C9A7">"${record.feedback_text}"</p>` : ''}
            ${record.would_recommend !== null ? `<p style="margin:8px 0"><strong>Would recommend:</strong> ${record.would_recommend ? 'Yes ✓' : 'No'}</p>` : ''}
            <p><a href="${process.env.FRONTEND_URL || ''}/people/${record.person_id}" style="display:inline-block;padding:10px 24px;background:#0F4C81;color:#fff;text-decoration:none;border-radius:6px">View Person Profile →</a></p>`
          ).catch(logWarn('feedbackEmail'));
        }
      }
    } catch (err) {
      logWarn('feedbackNotifyManager')(err);
    }
  }
}
