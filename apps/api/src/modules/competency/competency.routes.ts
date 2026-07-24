import { Router } from 'express';
import { CompetencyController } from './competency.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { UserRole } from '@meticle/shared';
import { createCompetencyTemplateSchema, updateCompetencyTemplateSchema, createCompetencyAssessmentSchema } from '../../shared/validation/schemas';

const router = Router();

router.use(authenticate);

router.get('/templates', asyncHandler(CompetencyController.getTemplates));
router.post('/templates', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createCompetencyTemplateSchema), asyncHandler(CompetencyController.createTemplate));
router.put('/templates/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateCompetencyTemplateSchema), asyncHandler(CompetencyController.updateTemplate));
router.delete('/templates/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(CompetencyController.deleteTemplate));

router.get('/assessments', asyncHandler(CompetencyController.getAssessments));
router.post('/assessments', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createCompetencyAssessmentSchema), asyncHandler(CompetencyController.createAssessment));
router.delete('/assessments/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(CompetencyController.deleteAssessment));

router.get('/pending', asyncHandler(CompetencyController.getPending));

export default router;
