import { Router } from 'express';
import { ChatController } from './chat.controller';
import { authMiddleware } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/channels', ChatController.listChannels);
router.get('/channels/:channel/messages', ChatController.listMessages);
router.post('/channels/:channel/messages', ChatController.sendMessage);
router.patch('/messages/:id', ChatController.editMessage);
router.delete('/messages/:id', ChatController.deleteMessage);
router.post('/read-receipts', ChatController.markRead);
router.get('/unread', ChatController.getUnreadCounts);

export default router;
