import { Router } from 'express';
import { HealthController } from './health.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { validate } from '../../shared/middleware/validate.middleware';
import { UserRole } from '@meticle/shared';
import { createObservationSchema, createBowelMovementSchema, createDentalRecordSchema, createFluidIntakeSchema, updateObservationSchema, updateBowelMovementSchema, updateDentalRecordSchema, updateFluidIntakeSchema } from '../../shared/validation/schemas';

const router = Router();
router.use(authenticate);

// Health Observations
router.get('/:serviceUserId/observations', asyncHandler(HealthController.getObservations));
router.post('/:serviceUserId/observations', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(createObservationSchema), asyncHandler(HealthController.createObservation));
router.patch('/:serviceUserId/observations/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateObservationSchema), asyncHandler(HealthController.updateObservation));
router.delete('/:serviceUserId/observations/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(HealthController.deleteObservation));

// Bowel Movements
router.get('/:serviceUserId/bowel', asyncHandler(HealthController.getBowelMovements));
router.post('/:serviceUserId/bowel', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(createBowelMovementSchema), asyncHandler(HealthController.createBowelMovement));
router.patch('/:serviceUserId/bowel/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateBowelMovementSchema), asyncHandler(HealthController.updateBowelMovement));
router.delete('/:serviceUserId/bowel/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(HealthController.deleteBowelMovement));

// Dental Records
router.get('/:serviceUserId/dental', asyncHandler(HealthController.getDentalRecords));
router.post('/:serviceUserId/dental', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(createDentalRecordSchema), asyncHandler(HealthController.createDentalRecord));
router.patch('/:serviceUserId/dental/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateDentalRecordSchema), asyncHandler(HealthController.updateDentalRecord));
router.delete('/:serviceUserId/dental/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(HealthController.deleteDentalRecord));

// Fluid Intake
router.get('/:serviceUserId/fluid', asyncHandler(HealthController.getFluidIntake));
router.get('/:serviceUserId/fluid/total', asyncHandler(HealthController.getDailyFluidTotal));
router.post('/:serviceUserId/fluid', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(createFluidIntakeSchema), asyncHandler(HealthController.createFluidIntake));
router.patch('/:serviceUserId/fluid/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateFluidIntakeSchema), asyncHandler(HealthController.updateFluidIntake));
router.delete('/:serviceUserId/fluid/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(HealthController.deleteFluidIntake));

export default router;
