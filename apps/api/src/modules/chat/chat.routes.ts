import { Router } from 'express';
import { ChatController } from './chat.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Channels
router.get('/channels', ChatController.listChannels);
router.get('/channels/:channel/messages', ChatController.listMessages);
router.post('/channels/:channel/messages', ChatController.sendMessage);
router.patch('/messages/:id', ChatController.editMessage);
router.delete('/messages/:id', ChatController.deleteMessage);

// Channel management
router.post('/ensure-general', ChatController.ensureGeneral);
router.get('/org-members', ChatController.listOrgMembers);
router.get('/channels/:channelId/members', ChatController.listChannelMembers);
router.delete('/channels/:channelId/members/:userId', ChatController.removeChannelMember);
router.delete('/channels/:channelId/leave', ChatController.leaveChannel);

// DMs & groups
router.post('/channels/dm/:targetUserId', ChatController.createDM);
router.post('/groups', ChatController.createGroup);

// Read receipts
router.post('/read-receipts', ChatController.markRead);
router.post('/channels/:channelId/read', ChatController.markChannelRead);
router.get('/unread', ChatController.getUnreadCounts);

// Search
router.get('/search', ChatController.searchMessages);

export default router;
