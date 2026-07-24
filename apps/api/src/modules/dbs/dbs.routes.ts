import { Router } from 'express';
import { z } from 'zod';
import { DbsController } from './dbs.controller';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { UserRole } from '@meticle/shared';
import { DbsLevel, DbsWorkforce } from './dbs.types';

const createDbsSchema = z.object({
  staffId: z.string().uuid(),
  level: z.nativeEnum(DbsLevel),
  workforce: z.nativeEnum(DbsWorkforce),
  costPence: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['clear', 'disclosure', 'cancelled', 'error']),
  certificateNumber: z.string().optional(),
});

const router = Router();

router.use(authenticate);

router.get('/checks', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(DbsController.list));
router.get('/checks/stats', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(DbsController.stats));
router.get('/checks/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(DbsController.get));
router.post('/checks', requireRole(UserRole.ORG_ADMIN), validate(createDbsSchema), asyncHandler(DbsController.create));
router.post('/checks/:id/submit', requireRole(UserRole.ORG_ADMIN), asyncHandler(DbsController.submit));
router.patch('/checks/:id/status', requireRole(UserRole.ORG_ADMIN), validate(updateStatusSchema), asyncHandler(DbsController.updateStatus));
router.post('/checks/:id/poll', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(DbsController.poll));

export default router;
