import { Router } from 'express';
import { IncidentsController } from './incidents.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { uploadWithScan } from '../../shared/middleware/upload.middleware';
import { UserRole } from '@meticle/shared';
import { createIncidentSchema, updateIncidentSchema, createIncidentCategorySchema, updateIncidentCategorySchema, addInvolvedResidentSchema, createIncidentActionSchema } from '../../shared/validation/schemas';

const router = Router();
router.use(authenticate);

// The reporter of an incident must be able to see it, and only it. This wraps
// the controller's visibility rule as middleware so the sub-resource reads
// below cannot be reached by skipping the check on the incident itself.
const visibleIncident = (req: any, _res: any, next: any) =>
  IncidentsController.requireVisibleIncident(req).then(() => next(), next);

// Reference data. Any authenticated user can read the category list because a
// support worker needs it in order to file a report at all.
router.get('/categories', asyncHandler(IncidentsController.getCategories));

// Manager-only aggregate.
router.get('/stats', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(IncidentsController.getStats));

// Read routes. A support worker reaches these too, but the controller scopes
// them to incidents they reported, so filing a concern never exposes the
// organisation's whole incident history to them.
router.get('/', asyncHandler(IncidentsController.list));
router.get('/:id', visibleIncident, asyncHandler(IncidentsController.getById));
router.get('/:id/actions', visibleIncident, asyncHandler(IncidentsController.getActions));
router.get('/:id/attachments', visibleIncident, asyncHandler(IncidentsController.getAttachments));
router.get('/:id/timeline', visibleIncident, asyncHandler(IncidentsController.getTimeline));

// Reporting. Any authenticated user may raise a concern; a support worker's
// submission is reduced to the reporting fields, and triage fields are set by
// a manager afterwards.
router.post('/', validate(createIncidentSchema), asyncHandler(IncidentsController.create));

// Investigation routes (MANAGER or ORG_ADMIN)
router.patch('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateIncidentSchema), asyncHandler(IncidentsController.update));
router.delete('/:id', requireRole(UserRole.ORG_ADMIN), asyncHandler(IncidentsController.deleteIncident));

// Categories (ORG_ADMIN)
// Incident categories are operational reference data managers maintain
// alongside the incident triage they already perform.
router.post('/categories', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createIncidentCategorySchema), asyncHandler(IncidentsController.createCategory));
router.put('/categories/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateIncidentCategorySchema), asyncHandler(IncidentsController.updateCategory));
router.delete('/categories/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(IncidentsController.deleteCategory));

// Involved residents
router.post('/:id/involved', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(addInvolvedResidentSchema), asyncHandler(IncidentsController.addInvolvedResident));
router.delete('/:id/involved/:involvedId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(IncidentsController.removeInvolvedResident));

// Actions
router.post('/:id/actions', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createIncidentActionSchema), asyncHandler(IncidentsController.createAction));
router.patch('/:id/actions/:actionId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(IncidentsController.updateAction));
router.patch('/:id/actions/:actionId/complete', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(IncidentsController.completeAction));
router.delete('/:id/actions/:actionId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(IncidentsController.deleteAction));

// Evidence attachments
router.post('/:id/attachments', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), uploadWithScan('file'), asyncHandler(IncidentsController.uploadAttachment));
router.delete('/:id/attachments/:attachmentId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(IncidentsController.deleteAttachment));

export default router;
