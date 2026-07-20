import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { NotificationsController } from './notifications.controller';
import { markAllNotificationsReadSchema } from '../../shared/validation/schemas';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(NotificationsController.getMyNotifications));
router.get('/unread-count', asyncHandler(NotificationsController.getUnreadCount));
router.patch('/:id/read', asyncHandler(NotificationsController.markAsRead));
router.patch('/read-all', validate(markAllNotificationsReadSchema), asyncHandler(NotificationsController.markAllAsRead));
router.get('/preferences', asyncHandler(NotificationsController.getPreferences));
router.patch('/preferences', asyncHandler(NotificationsController.updatePreference));

export default router;
