import { Router } from 'express';
import { HealthController } from './health.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { validate } from '../../shared/middleware/validate.middleware';
import { UserRole } from '@meticle/shared';
import { createObservationSchema, createBowelMovementSchema, createDentalRecordSchema, createFluidIntakeSchema, createSleepRecordSchema, updateObservationSchema, updateBowelMovementSchema, updateDentalRecordSchema, updateFluidIntakeSchema, updateSleepRecordSchema } from '../../shared/validation/schemas';

const router = Router();
router.use(authenticate);

// Health Observations
router.get('/:personId/observations', asyncHandler(HealthController.getObservations));
router.post('/:personId/observations', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(createObservationSchema), asyncHandler(HealthController.createObservation));
router.patch('/:personId/observations/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateObservationSchema), asyncHandler(HealthController.updateObservation));
router.delete('/:personId/observations/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(HealthController.deleteObservation));

// Bowel Movements
router.get('/:personId/bowel', asyncHandler(HealthController.getBowelMovements));
router.post('/:personId/bowel', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(createBowelMovementSchema), asyncHandler(HealthController.createBowelMovement));
router.patch('/:personId/bowel/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateBowelMovementSchema), asyncHandler(HealthController.updateBowelMovement));
router.delete('/:personId/bowel/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(HealthController.deleteBowelMovement));

// Dental Records
router.get('/:personId/dental', asyncHandler(HealthController.getDentalRecords));
router.post('/:personId/dental', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(createDentalRecordSchema), asyncHandler(HealthController.createDentalRecord));
router.patch('/:personId/dental/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateDentalRecordSchema), asyncHandler(HealthController.updateDentalRecord));
router.delete('/:personId/dental/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(HealthController.deleteDentalRecord));

// Fluid Intake
router.get('/:personId/fluid', asyncHandler(HealthController.getFluidIntake));
router.get('/:personId/fluid/total', asyncHandler(HealthController.getDailyFluidTotal));
router.post('/:personId/fluid', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(createFluidIntakeSchema), asyncHandler(HealthController.createFluidIntake));
router.patch('/:personId/fluid/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateFluidIntakeSchema), asyncHandler(HealthController.updateFluidIntake));
router.delete('/:personId/fluid/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(HealthController.deleteFluidIntake));

// Sleep Records
router.get('/:personId/sleep', asyncHandler(HealthController.getSleepRecords));
router.post('/:personId/sleep', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(createSleepRecordSchema), asyncHandler(HealthController.createSleepRecord));
router.patch('/:personId/sleep/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateSleepRecordSchema), asyncHandler(HealthController.updateSleepRecord));
router.delete('/:personId/sleep/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(HealthController.deleteSleepRecord));

export default router;
