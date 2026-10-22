import { Router } from 'express';
import { IncidentSeverityController } from './incident-severity.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { UserRole } from '@meticle/shared';
import { assessSeveritySchema, overrideSeveritySchema } from '../../shared/validation/schemas';

const router = Router();
router.use(authenticate);

// Any authenticated user can assess (a reporter needs it to file); only
// managers can override, and only with a recorded reason.
router.post('/assess', validate(assessSeveritySchema), asyncHandler(IncidentSeverityController.assess));
router.post('/override', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(overrideSeveritySchema), asyncHandler(IncidentSeverityController.override));
router.get('/:incidentId/history', asyncHandler(IncidentSeverityController.history));

export default router;
