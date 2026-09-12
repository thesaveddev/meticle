import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { validate } from '../../shared/middleware/validate.middleware';
import { UserRole } from '@meticle/shared';
import { BodyMapController } from './bodyMap.controller';

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  person_id: z.string().uuid(),
  body_view: z.enum(['front', 'back']),
  body_zone: z.string().min(1).max(50),
  zone_x: z.number().min(0).max(1).optional(),
  zone_y: z.number().min(0).max(1).optional(),
  condition_type: z.enum(['bruise', 'wound', 'rash', 'injection', 'burn', 'pressure_sore', 'scar', 'swelling', 'skin_tear', 'other']),
  description: z.string().max(5000).optional(),
  severity: z.enum(['mild', 'moderate', 'severe']).optional(),
  image_url: z.string().url().max(2000).optional(),
});

const updateSchema = z.object({
  description: z.string().max(5000).optional(),
  severity: z.enum(['mild', 'moderate', 'severe']).optional(),
  status: z.enum(['active', 'healing', 'resolved']).optional(),
  resolved_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  image_url: z.string().url().max(2000).optional(),
});

const allRoles = [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER];

router.get('/person/:personId', asyncHandler(BodyMapController.getEntries));
router.get('/person/:personId/active', asyncHandler(BodyMapController.getActiveEntries));
router.get('/person/:personId/history', asyncHandler(BodyMapController.getHistory));
router.get('/person/:personId/stats', asyncHandler(BodyMapController.getStats));
router.get('/:id', asyncHandler(BodyMapController.getEntry));
router.post('/', requireRole(...allRoles), validate(createSchema), asyncHandler(BodyMapController.createEntry));
router.patch('/:id', requireRole(...allRoles), validate(updateSchema), asyncHandler(BodyMapController.updateEntry));
router.delete('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(BodyMapController.deleteEntry));

export default router;
