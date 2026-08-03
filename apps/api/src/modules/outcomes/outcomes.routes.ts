import { Router } from 'express';
import { OutcomesController } from './outcomes.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { validate } from '../../shared/middleware/validate.middleware';
import { createScaleSchema, updateScaleSchema, recordAssessmentSchema } from '../../shared/validation/schemas';
import { UserRole } from '@meticle/shared';

const router = Router();

router.use(authenticate);

router.get('/scales', asyncHandler(OutcomesController.listScales));
router.get('/scales/:id', asyncHandler(OutcomesController.getScale));
router.post('/scales', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createScaleSchema), asyncHandler(OutcomesController.createScale));
router.patch('/scales/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateScaleSchema), asyncHandler(OutcomesController.updateScale));
router.delete('/scales/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(OutcomesController.deleteScale));

router.post('/scales/:scaleId/assess', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(recordAssessmentSchema), asyncHandler(OutcomesController.recordAssessment));
router.get('/scales/:scaleId/results', asyncHandler(OutcomesController.listResults));
router.get('/results', asyncHandler(OutcomesController.listAllResults));
router.post('/results', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(OutcomesController.recordAssessmentFromBody));
router.get('/results/:resultId', asyncHandler(OutcomesController.getResult));
router.delete('/results/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(OutcomesController.deleteResult));

router.get('/person/:personId/summary', asyncHandler(OutcomesController.getPersonSummary));
router.get('/person/:personId/trend', asyncHandler(OutcomesController.getPersonTrend));
router.get('/org/summary', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(OutcomesController.getOrgSummary));

export default router;
