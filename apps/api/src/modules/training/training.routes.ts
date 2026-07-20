import { Router } from 'express';
import { TrainingController } from './training.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { UserRole } from '@caredesk/shared';
import { createTrainingModuleSchema, updateTrainingModuleSchema, upsertTrainingRecordSchema, bulkAssignTrainingSchema } from '../../shared/validation/schemas';

const router = Router();

router.use(authenticate);

router.get('/modules', asyncHandler(TrainingController.getModules));
router.post('/modules', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createTrainingModuleSchema), asyncHandler(TrainingController.createModule));
router.put('/modules/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateTrainingModuleSchema), asyncHandler(TrainingController.updateModule));
router.delete('/modules/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(TrainingController.deleteModule));

router.get('/records', asyncHandler(TrainingController.getRecords));
router.post('/records', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(upsertTrainingRecordSchema), asyncHandler(TrainingController.upsertRecord));
router.delete('/records/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(TrainingController.deleteRecord));

router.get('/matrix', asyncHandler(TrainingController.getMatrix));
router.get('/expiring', asyncHandler(TrainingController.getExpiring));
router.get('/dashboard', asyncHandler(TrainingController.getDashboard));
router.post('/bulk-assign', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(bulkAssignTrainingSchema), asyncHandler(TrainingController.bulkAssign));
router.post('/auto-assign', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(TrainingController.autoAssign));

export default router;
