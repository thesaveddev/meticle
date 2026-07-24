import { Router } from 'express';
import { AppointmentController } from './appointments.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { validate } from '../../shared/middleware/validate.middleware';
import { createAppointmentSchema, updateAppointmentSchema } from '../../shared/validation/schemas';
import { UserRole } from '@meticle/shared';

const router = Router();

router.use(authenticate);

router.get('/today-stats', asyncHandler(AppointmentController.getTodayStats));
router.get('/', asyncHandler(AppointmentController.list));
router.get('/:id', asyncHandler(AppointmentController.getById));
router.post('/', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createAppointmentSchema), asyncHandler(AppointmentController.create));
router.patch('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateAppointmentSchema), asyncHandler(AppointmentController.update));
router.delete('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(AppointmentController.delete));

export default router;
