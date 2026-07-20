import { Router } from 'express';
import { AIController } from './ai.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { updateAIConfigSchema, aiAnalysisRequestSchema, aiRotaAnalysisSchema, aiRotaGenerateSchema } from '../../shared/validation/schemas';
import { UserRole } from '@caredesk/shared';

const router = Router();

router.use(authenticate);
router.use(requireRole(UserRole.ORG_ADMIN));

router.get('/config', asyncHandler(AIController.getConfig));
router.put('/config', validate(updateAIConfigSchema), asyncHandler(AIController.updateConfig));
router.post('/analyze/compliance', validate(aiAnalysisRequestSchema), asyncHandler(AIController.analyzeComplianceGap));
router.post('/triage/incident', asyncHandler(AIController.triageIncident));
router.post('/analyze/rota', validate(aiRotaAnalysisSchema), asyncHandler(AIController.analyzeRota));
router.post('/generate/rota', validate(aiRotaGenerateSchema), asyncHandler(AIController.generateRota));
router.get('/audit-logs', asyncHandler(AIController.auditLogs));
router.get('/usage-stats', asyncHandler(AIController.usageStats));

export default router;
