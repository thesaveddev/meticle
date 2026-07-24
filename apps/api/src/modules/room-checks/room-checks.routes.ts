import { Router } from 'express';
import { RoomCheckController } from './room-checks.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { uploadWithScan } from '../../shared/middleware/upload.middleware';
import { UserRole } from '@meticle/shared';
import { createRoomCheckSchema, updateRoomCheckSchema } from '../../shared/validation/schemas';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(RoomCheckController.list));
router.post('/', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), uploadWithScan('photo'), validate(createRoomCheckSchema), asyncHandler(RoomCheckController.create));
router.patch('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateRoomCheckSchema), asyncHandler(RoomCheckController.update));
router.delete('/:id', requireRole(UserRole.ORG_ADMIN), asyncHandler(RoomCheckController.delete));

export default router;
