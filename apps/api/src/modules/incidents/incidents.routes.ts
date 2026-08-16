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

// Read routes (MANAGER or ORG_ADMIN)
router.get('/stats', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(IncidentsController.getStats));
router.get('/categories', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(IncidentsController.getCategories));
router.get('/', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(IncidentsController.list));
router.get('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(IncidentsController.getById));
router.get('/:id/actions', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(IncidentsController.getActions));
router.get('/:id/attachments', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(IncidentsController.getAttachments));
router.get('/:id/timeline', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(IncidentsController.getTimeline));

// Mutation routes (MANAGER or ORG_ADMIN)
router.post('/', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createIncidentSchema), asyncHandler(IncidentsController.create));
router.patch('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateIncidentSchema), asyncHandler(IncidentsController.update));
router.delete('/:id', requireRole(UserRole.ORG_ADMIN), asyncHandler(IncidentsController.deleteIncident));

// Categories (ORG_ADMIN)
router.post('/categories', requireRole(UserRole.ORG_ADMIN), validate(createIncidentCategorySchema), asyncHandler(IncidentsController.createCategory));
router.put('/categories/:id', requireRole(UserRole.ORG_ADMIN), validate(updateIncidentCategorySchema), asyncHandler(IncidentsController.updateCategory));
router.delete('/categories/:id', requireRole(UserRole.ORG_ADMIN), asyncHandler(IncidentsController.deleteCategory));

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
