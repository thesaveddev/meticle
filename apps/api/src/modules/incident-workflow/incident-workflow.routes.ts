import { Router } from 'express';
import { IncidentWorkflowController } from './incident-workflow.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { UserRole } from '@meticle/shared';
import { startWorkflowSchema } from '../../shared/validation/schemas';

const router = Router();
router.use(authenticate);

// Starting is manager work; ack/complete is the roster doing it, so any
// authenticated member can transition a task they own.
router.post('/start', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(startWorkflowSchema), asyncHandler(IncidentWorkflowController.start));
router.post('/tasks/:id/:action', asyncHandler(IncidentWorkflowController.taskAction));
router.get('/:incidentId', asyncHandler(IncidentWorkflowController.getByIncident));
router.post('/sweep', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(IncidentWorkflowController.sweep));

export default router;
