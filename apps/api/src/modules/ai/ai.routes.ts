import { Router } from 'express';
import { AIController } from './ai.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { updateAIConfigSchema, aiAnalysisRequestSchema, aiRotaAnalysisSchema, aiRotaGenerateSchema, aiDailyNoteGenerateSchema, aiDailyNoteApproveSchema } from '../../shared/validation/schemas';
import { UserRole } from '@meticle/shared';

const router = Router();

router.use(authenticate);

router.get('/config', requireRole(UserRole.ORG_ADMIN), asyncHandler(AIController.getConfig));
router.put('/config', requireRole(UserRole.ORG_ADMIN), validate(updateAIConfigSchema), asyncHandler(AIController.updateConfig));
router.post('/analyze/compliance', requireRole(UserRole.ORG_ADMIN), validate(aiAnalysisRequestSchema), asyncHandler(AIController.analyzeComplianceGap));
router.post('/triage/incident', requireRole(UserRole.ORG_ADMIN), asyncHandler(AIController.triageIncident));
router.post('/analyze/rota', requireRole(UserRole.ORG_ADMIN), validate(aiRotaAnalysisSchema), asyncHandler(AIController.analyzeRota));
router.post('/generate/rota', requireRole(UserRole.ORG_ADMIN), validate(aiRotaGenerateSchema), asyncHandler(AIController.generateRota));
router.post('/daily-notes/generate', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(aiDailyNoteGenerateSchema), asyncHandler(AIController.generateDailyNote));
router.post('/daily-notes/approve', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(aiDailyNoteApproveSchema), asyncHandler(AIController.approveDailyNote));
router.post('/daily-notes/:noteId/analyze', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(AIController.analyzeExistingNote));
router.get('/audit-logs', requireRole(UserRole.ORG_ADMIN), asyncHandler(AIController.auditLogs));
router.get('/usage-stats', requireRole(UserRole.ORG_ADMIN), asyncHandler(AIController.usageStats));

export default router;
