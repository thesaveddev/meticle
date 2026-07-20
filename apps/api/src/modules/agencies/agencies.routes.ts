import { Router } from 'express';
import { AgenciesController } from './agencies.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { UserRole } from '@caredesk/shared';

const router = Router();
router.use(authenticate);

const adminManager = [UserRole.ORG_ADMIN, UserRole.MANAGER] as UserRole[];

// Agencies CRUD
router.get('/', requireRole(...adminManager), asyncHandler(AgenciesController.getAll));
router.get('/all-workers', requireRole(...adminManager), asyncHandler(AgenciesController.getAllWorkers));
router.get('/savings', requireRole(...adminManager), asyncHandler(AgenciesController.getSavings));
router.get('/savings-by-month', requireRole(...adminManager), asyncHandler(AgenciesController.getSavingsByMonth));
router.get('/savings-by-agency', requireRole(...adminManager), asyncHandler(AgenciesController.getSavingsByAgency));
router.get('/shift-history', requireRole(...adminManager), asyncHandler(AgenciesController.getShiftHistory));
router.get('/rates', requireRole(...adminManager), asyncHandler(AgenciesController.getAllRates));
router.get('/:id', requireRole(...adminManager), asyncHandler(AgenciesController.getById));
router.post('/', requireRole(...adminManager), asyncHandler(AgenciesController.create));
router.patch('/:id', requireRole(...adminManager), asyncHandler(AgenciesController.update));
router.delete('/:id', requireRole(...adminManager), asyncHandler(AgenciesController.delete));

// Workers
router.get('/:agencyId/workers', requireRole(...adminManager), asyncHandler(AgenciesController.getWorkers));
router.get('/workers/:id', requireRole(...adminManager), asyncHandler(AgenciesController.getWorkerById));
router.post('/workers', requireRole(...adminManager), asyncHandler(AgenciesController.createWorker));
router.patch('/workers/:id', requireRole(...adminManager), asyncHandler(AgenciesController.updateWorker));
router.delete('/workers/:id', requireRole(...adminManager), asyncHandler(AgenciesController.deleteWorker));

// Rates
router.get('/:agencyId/rates', requireRole(...adminManager), asyncHandler(AgenciesController.getRates));
router.post('/rates', requireRole(...adminManager), asyncHandler(AgenciesController.upsertRate));
router.delete('/rates/:id', requireRole(...adminManager), asyncHandler(AgenciesController.deleteRate));

export default router;
