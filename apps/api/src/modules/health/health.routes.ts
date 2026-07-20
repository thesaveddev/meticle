import { Router } from 'express';
import { HealthController } from './health.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { validate } from '../../shared/middleware/validate.middleware';
import { createObservationSchema, createBowelMovementSchema, createDentalRecordSchema, createFluidIntakeSchema, updateObservationSchema, updateBowelMovementSchema, updateDentalRecordSchema, updateFluidIntakeSchema } from '../../shared/validation/schemas';

const router = Router();
router.use(authenticate);

// Health Observations
router.get('/:serviceUserId/observations', asyncHandler(HealthController.getObservations));
router.post('/:serviceUserId/observations', validate(createObservationSchema), asyncHandler(HealthController.createObservation));
router.patch('/:serviceUserId/observations/:id', validate(updateObservationSchema), asyncHandler(HealthController.updateObservation));
router.delete('/:serviceUserId/observations/:id', asyncHandler(HealthController.deleteObservation));

// Bowel Movements
router.get('/:serviceUserId/bowel', asyncHandler(HealthController.getBowelMovements));
router.post('/:serviceUserId/bowel', validate(createBowelMovementSchema), asyncHandler(HealthController.createBowelMovement));
router.patch('/:serviceUserId/bowel/:id', validate(updateBowelMovementSchema), asyncHandler(HealthController.updateBowelMovement));
router.delete('/:serviceUserId/bowel/:id', asyncHandler(HealthController.deleteBowelMovement));

// Dental Records
router.get('/:serviceUserId/dental', asyncHandler(HealthController.getDentalRecords));
router.post('/:serviceUserId/dental', validate(createDentalRecordSchema), asyncHandler(HealthController.createDentalRecord));
router.patch('/:serviceUserId/dental/:id', validate(updateDentalRecordSchema), asyncHandler(HealthController.updateDentalRecord));
router.delete('/:serviceUserId/dental/:id', asyncHandler(HealthController.deleteDentalRecord));

// Fluid Intake
router.get('/:serviceUserId/fluid', asyncHandler(HealthController.getFluidIntake));
router.get('/:serviceUserId/fluid/total', asyncHandler(HealthController.getDailyFluidTotal));
router.post('/:serviceUserId/fluid', validate(createFluidIntakeSchema), asyncHandler(HealthController.createFluidIntake));
router.patch('/:serviceUserId/fluid/:id', validate(updateFluidIntakeSchema), asyncHandler(HealthController.updateFluidIntake));
router.delete('/:serviceUserId/fluid/:id', asyncHandler(HealthController.deleteFluidIntake));

export default router;
