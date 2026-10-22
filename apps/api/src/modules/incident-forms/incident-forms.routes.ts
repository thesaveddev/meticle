import { Router } from 'express';
import { IncidentFormsController } from './incident-forms.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { UserRole } from '@meticle/shared';
import { createIncidentFormSchema, evaluateIncidentFormSchema } from '../../shared/validation/schemas';

const router = Router();
router.use(authenticate);

// Any authenticated user reads the published form and evaluates answers —
// a support worker cannot file a concern without both.
router.get('/:key', asyncHandler(IncidentFormsController.getByKey));
router.post('/evaluate', validate(evaluateIncidentFormSchema), asyncHandler(IncidentFormsController.evaluate));

// Managers design; workers file.
router.post('/', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createIncidentFormSchema), asyncHandler(IncidentFormsController.createDraft));
router.post('/:id/publish', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(IncidentFormsController.publish));

export default router;
