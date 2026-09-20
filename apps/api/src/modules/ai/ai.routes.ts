import { Router } from 'express';
import { AIController } from './ai.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { updateAIConfigSchema, aiAnalysisRequestSchema, aiRotaAnalysisSchema, aiRotaGenerateSchema, aiDailyNoteGenerateSchema, aiDailyNoteApproveSchema, aiMealPlanGenerationSchema, aiManagerBriefingSchema, aiIntelligenceSchema } from '../../shared/validation/schemas';
import { UserRole } from '@meticle/shared';
import { requireSupportedLivingOnly } from '../../shared/middleware/requireServiceType';

const router = Router();

router.use(authenticate);

router.get('/config', requireRole(UserRole.ORG_ADMIN), asyncHandler(AIController.getConfig));
router.put('/config', requireRole(UserRole.ORG_ADMIN), validate(updateAIConfigSchema), asyncHandler(AIController.updateConfig));
router.post('/analyze/compliance', requireRole(UserRole.ORG_ADMIN), validate(aiAnalysisRequestSchema), asyncHandler(AIController.analyzeComplianceGap));
router.post('/manager-briefing', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(aiManagerBriefingSchema), asyncHandler(AIController.managerBriefing));
router.post('/care-summary', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(aiIntelligenceSchema), asyncHandler(AIController.intelligence));
router.post('/change-detection', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(aiIntelligenceSchema), asyncHandler(AIController.intelligence));
router.post('/risk-signals', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(aiIntelligenceSchema), asyncHandler(AIController.intelligence));
router.post('/compliance-copilot', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER), validate(aiIntelligenceSchema), asyncHandler(AIController.intelligence));
router.post('/assistant', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(aiIntelligenceSchema), asyncHandler(AIController.intelligence));
router.post('/end-of-day', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(aiIntelligenceSchema), asyncHandler(AIController.intelligence));
router.post('/operations-copilot', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(aiIntelligenceSchema), asyncHandler(AIController.intelligence));
router.post('/anomaly-detection', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(aiIntelligenceSchema), asyncHandler(AIController.intelligence));
router.post('/rota-alternatives', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(aiIntelligenceSchema), asyncHandler(AIController.intelligence));
router.post('/competency-coaching', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(aiIntelligenceSchema), asyncHandler(AIController.intelligence));
router.post('/family-communication-draft', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(aiIntelligenceSchema), asyncHandler(AIController.intelligence));
router.post('/triage/incident', requireRole(UserRole.ORG_ADMIN), asyncHandler(AIController.triageIncident));
router.post('/analyze/rota', requireSupportedLivingOnly, requireRole(UserRole.ORG_ADMIN), validate(aiRotaAnalysisSchema), asyncHandler(AIController.analyzeRota));
router.post('/generate/rota', requireSupportedLivingOnly, requireRole(UserRole.ORG_ADMIN), validate(aiRotaGenerateSchema), asyncHandler(AIController.generateRota));
router.post('/daily-notes/generate', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(aiDailyNoteGenerateSchema), asyncHandler(AIController.generateDailyNote));
router.post('/daily-notes/approve', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(aiDailyNoteApproveSchema), asyncHandler(AIController.approveDailyNote));
router.post('/daily-notes/:noteId/analyze', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(AIController.analyzeExistingNote));
router.get('/audit-logs', requireRole(UserRole.ORG_ADMIN), asyncHandler(AIController.auditLogs));
router.get('/usage-stats', requireRole(UserRole.ORG_ADMIN), asyncHandler(AIController.usageStats));
router.post('/generate/meal-plan', requireSupportedLivingOnly, requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(aiMealPlanGenerationSchema), asyncHandler(AIController.generateMealPlan));
router.post('/generate/weekly-meal-plan', requireSupportedLivingOnly, requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(AIController.generateWeeklyMealPlan));
router.post('/generate/shopping-list', requireSupportedLivingOnly, requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(AIController.generateShoppingList));
router.post('/daily-notes/:noteId/care-plan-gap', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(AIController.analyzeCarePlanGap));
router.post('/competency/generate-questions', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(AIController.generateCompetencyQuestions));

export default router;
