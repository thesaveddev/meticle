import { Router } from 'express';
import { SurveysController } from './surveys.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { UserRole } from '@meticle/shared';

const router = Router();
const publicRouter = Router();

// ── Authenticated routes ──
router.use(authenticate);

// Satisfaction surveys
router.post('/satisfaction', asyncHandler(SurveysController.submitSatisfaction));
router.get('/satisfaction', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(SurveysController.getSatisfactionSurveys));
router.get('/satisfaction/aggregate', asyncHandler(SurveysController.getSatisfactionAggregate));
router.patch('/satisfaction/:id/notes', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(SurveysController.updateSatisfactionNotes));

// Satisfaction invitations
router.post('/satisfaction/invite', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(SurveysController.sendSatisfactionInvitation));
router.get('/invitations', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(SurveysController.getInvitations));

// Engagement templates
router.post('/engagement/templates', requireRole(UserRole.ORG_ADMIN), asyncHandler(SurveysController.createEngagementTemplate));
router.get('/engagement/templates', asyncHandler(SurveysController.getEngagementTemplates));
router.put('/engagement/templates/:id', requireRole(UserRole.ORG_ADMIN), asyncHandler(SurveysController.updateEngagementTemplate));
router.delete('/engagement/templates/:id', requireRole(UserRole.ORG_ADMIN), asyncHandler(SurveysController.deleteEngagementTemplate));

// Trigger engagement survey
router.post('/engagement/send', requireRole(UserRole.ORG_ADMIN), asyncHandler(SurveysController.triggerEngagementSurvey));

// Staff engagement surveys (logged in)
router.post('/engagement', asyncHandler(SurveysController.submitEngagement));
router.get('/engagement', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(SurveysController.getEngagementSurveys));
router.get('/engagement/aggregate', asyncHandler(SurveysController.getEngagementAggregate));

// ── Public routes (no auth) ──
publicRouter.get('/form/satisfaction/:token', asyncHandler(SurveysController.publicGetForm));
publicRouter.post('/submit/satisfaction/:token', asyncHandler(SurveysController.publicSubmitSatisfaction));
publicRouter.get('/form/engagement/:token', asyncHandler(SurveysController.publicGetForm));
publicRouter.post('/submit/engagement/:token', asyncHandler(SurveysController.publicSubmitEngagement));

export default router;
export { publicRouter };
