import { Request, Response } from 'express';
import { SurveysRepository } from './surveys.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { EmailService } from '../../shared/utils/email.service';
import { NotificationsController } from '../notifications/notifications.controller';
import { query } from '../../shared/database';
import logger, { logWarn } from '../../shared/utils/logger';

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class SurveysController {
  // ── Satisfaction ──
  static async submitSatisfaction(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID required');
    const { service_user_id, respondent_name, relationship, rating, comments } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      throw new AppError(400, 'Rating must be between 1 and 5');
    }
    const survey = await SurveysRepository.createSatisfaction(orgId, {
      service_user_id, respondent_name, relationship, rating, comments,
    });
    res.status(201).json(survey);
  }

  static async getSatisfactionSurveys(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID required');
    const surveys = await SurveysRepository.getSatisfactionSurveys(orgId, {
      serviceUserId: req.query.serviceUserId as string,
      search: req.query.search as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    });
    res.json(surveys);
  }

  static async updateSatisfactionNotes(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const { id } = req.params;
    const { manager_notes } = req.body;
    const updated = await SurveysRepository.updateSatisfactionNotes(id, orgId, manager_notes);
    if (!updated) throw new AppError(404, 'Feedback not found');
    res.json(updated);
  }

  static async getSatisfactionAggregate(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID required');
    const agg = await SurveysRepository.getSatisfactionAggregate(orgId);
    res.json(agg);
  }

  // ── Satisfaction Invitations ──
  static async sendSatisfactionInvitation(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID required');
    const { email, service_user_id, service_user_name } = req.body;
    if (!email) throw new AppError(400, 'Recipient email is required');
    const inv = await SurveysRepository.createInvitation(orgId, 'satisfaction', email, service_user_id, service_user_name);
    const link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/survey/satisfaction/${inv.token}`;
    const orgResult = await query(`SELECT name FROM organizations WHERE id = $1`, [orgId]);
    const orgName = escapeHtml(orgResult.rows[0]?.name || 'the organisation');
    const serviceUserText = service_user_name ? ` for ${escapeHtml(service_user_name)}` : '';
    await EmailService.sendQueued(
      email,
      `We value your feedback about ${orgName}`,
      `<p style="margin:0 0 12px 0">You have been invited to share your feedback about the quality of care provided by <strong>${orgName}</strong>${serviceUserText}.</p>
       <p style="margin:0 0 12px 0">Your honest feedback helps us understand what we're doing well and where we can improve.</p>
       <p style="margin:0 0 12px 0;font-size:13px;color:#9CA3AF">This link expires in 7 days.</p>
       <a href="${link}" style="display:inline-block;padding:12px 24px;background:#0F4C81;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Share Your Feedback</a>`
    );
    // Notify sender
    await NotificationsController.createNotification(
      req.user!.userId, 'Survey Invitation Sent',
      `Satisfaction survey invitation sent to ${email}`,
      'compliance'
    ).catch(logWarn('satisfaction invitation notification'));
    res.status(201).json(inv);
  }

  static async getInvitations(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID required');
    const type = req.query.type as 'satisfaction' | 'engagement' | undefined;
    const invitations = await SurveysRepository.getInvitations(orgId, type);
    res.json(invitations);
  }

  // ── Public submission (no auth required) ──
  static async publicSubmitSatisfaction(req: Request, res: Response) {
    const { token } = req.params;
    const { respondent_name, relationship, rating, comments, service_user_name } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      throw new AppError(400, 'Rating must be between 1 and 5');
    }
    const survey = await SurveysRepository.completeInvitation(token, {
      respondent_name: respondent_name || '', relationship: relationship || '', rating, comments,
    });
    // If service_user_name provided, update the invitation record
    if (service_user_name && survey) {
      await query(`UPDATE survey_invitations SET service_user_name = $1 WHERE token = $2`, [service_user_name, token]).catch(logWarn('update survey service_user_name'));
    }
    if (!survey) throw new AppError(400, 'Invalid or expired survey link');
    res.status(201).json({ message: 'Thank you for your feedback!' });
  }

  static async publicGetForm(req: Request, res: Response) {
    const { token } = req.params;
    const inv = await SurveysRepository.getInvitationByToken(token);
    if (!inv) throw new AppError(404, 'Survey not found or expired');
    // Get engagement template questions if applicable
    let questions = null;
    if (inv.type === 'engagement' && inv.template_id) {
      const tmplResult = await query(`SELECT questions FROM engagement_templates WHERE id = $1`, [inv.template_id]);
      questions = tmplResult.rows[0]?.questions || null;
    }
    res.json({
      type: inv.type,
      service_user_name: inv.service_user_name,
      service_user_id: inv.service_user_id,
      org_name: inv.org_name,
      expires_at: inv.expires_at,
      questions,
    });
  }

  static async publicSubmitEngagement(req: Request, res: Response) {
    const { token } = req.params;
    const { ratings, comments, is_anonymous } = req.body;
    if (!ratings || typeof ratings !== 'object' || Object.keys(ratings).length === 0) {
      throw new AppError(400, 'Ratings are required');
    }
    const survey = await SurveysRepository.completeEngagementInvitation(token, {
      ratings, comments, is_anonymous: is_anonymous ?? true,
    });
    if (!survey) throw new AppError(400, 'Invalid or expired survey link');
    res.status(201).json({ message: 'Thank you for your feedback!' });
  }

  // ── Engagement ──
  static async submitEngagement(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID required');
    const { ratings, comments, is_anonymous } = req.body;
    if (!ratings || typeof ratings !== 'object' || Object.keys(ratings).length === 0) {
      throw new AppError(400, 'Ratings object is required');
    }
    const survey = await SurveysRepository.createEngagement(orgId, {
      respondent_id: req.user!.userId,
      ratings, comments, is_anonymous,
    });
    res.status(201).json(survey);
  }

  static async getEngagementSurveys(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const templateId = req.query.template_id as string | undefined;
    const surveys = await SurveysRepository.getEngagementSurveys(orgId, templateId);
    res.json(surveys);
  }

  static async getEngagementAggregate(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID required');
    const agg = await SurveysRepository.getEngagementAggregate(orgId);
    res.json(agg);
  }

  // ── Engagement Templates ──
  static async createEngagementTemplate(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID required');
    const { name, questions } = req.body;
    if (!name) throw new AppError(400, 'Template name is required');
    if (!questions || !Array.isArray(questions)) throw new AppError(400, 'Questions array is required');
    const template = await SurveysRepository.createEngagementTemplate(orgId, { name, questions });
    res.status(201).json(template);
  }

  static async getEngagementTemplates(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID required');
    const search = req.query.search as string | undefined;
    const templates = await SurveysRepository.getEngagementTemplates(orgId, search);
    res.json(templates);
  }

  static async updateEngagementTemplate(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID required');
    const { id } = req.params;
    const { name, questions, is_active } = req.body;
    const template = await SurveysRepository.updateEngagementTemplate(id, orgId, { name, questions, is_active });
    if (!template) throw new AppError(404, 'Template not found');
    res.json(template);
  }

  static async deleteEngagementTemplate(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID required');
    const { id } = req.params;
    await SurveysRepository.deleteEngagementTemplate(id, orgId);
    res.json({ message: 'Template deleted' });
  }

  // ── Send Engagement Survey ──
  static async triggerEngagementSurvey(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(400, 'Organization ID required');
    const { template_id, roles } = req.body;
    if (!template_id) throw new AppError(400, 'Template ID is required');
    const result = await SurveysRepository.sendEngagementSurveyToStaff(template_id, orgId, roles);
    if (!result) throw new AppError(404, 'Template not found');
    const { template, invitations } = result;
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const orgResult = await query(`SELECT name FROM organizations WHERE id = $1`, [orgId]);
    const orgName = escapeHtml(orgResult.rows[0]?.name || 'the organisation');
    const safeTemplateName = escapeHtml(template.name);
    let sentCount = 0;
    for (const inv of invitations) {
      const link = `${baseUrl}/survey/engagement/${inv.token}`;
      await EmailService.sendQueued(
        inv.email,
        `Survey: ${safeTemplateName} — ${orgName}`,
        `<p style="margin:0 0 12px 0">Hi ${escapeHtml(inv.name || '')},</p>
         <p style="margin:0 0 12px 0">You have been invited to complete the "<strong>${safeTemplateName}</strong>" engagement survey for <strong>${orgName}</strong>.</p>
         <p style="margin:0 0 12px 0">Your honest feedback helps us make ${orgName} a better place to work.</p>
         <p style="margin:0 0 12px 0;font-size:13px;color:#9CA3AF">This survey link expires in 7 days.</p>
         <a href="${link}" style="display:inline-block;padding:12px 24px;background:#0F4C81;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Complete Survey</a>`
      ).catch(e => logger.error({ err: e }, 'Failed to queue survey email'));
      // Send push notification
      await NotificationsController.createNotification(
        inv.userId, `Survey: ${template.name}`,
        `Please complete the "${template.name}" engagement survey for ${orgName}`,
        'compliance'
      ).catch(logWarn('engagement survey notification'));
      sentCount++;
    }
    res.status(201).json({ message: `Survey sent to ${sentCount} staff members`, sent_count: sentCount });
  }
}
