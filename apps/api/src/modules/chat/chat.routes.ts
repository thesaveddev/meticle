import { Router } from 'express';
import { ChatController } from './chat.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { uploadWithScan } from '../../shared/middleware/upload.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';

const router = Router();

router.use(authenticate);

// Channels
// Every async handler rides in asyncHandler: a bare handler turns any throw
// (DB error, malformed input) into an unhandled rejection, and the
// process-level handler exits the whole API over one bad request.
router.post('/upload', ...uploadWithScan('file'), asyncHandler(ChatController.uploadFile));
router.get('/channels', asyncHandler(ChatController.listChannels));
router.get('/channels/:channel/messages', asyncHandler(ChatController.listMessages));
router.post('/channels/:channel/messages', asyncHandler(ChatController.sendMessage));
router.patch('/messages/:id', asyncHandler(ChatController.editMessage));
router.delete('/messages/:id', asyncHandler(ChatController.deleteMessage));
// Keep channel-scoped aliases used by the web client.
router.patch('/channels/:channel/messages/:id', asyncHandler(ChatController.editMessage));
router.delete('/channels/:channel/messages/:id', asyncHandler(ChatController.deleteMessage));

// Channel management
router.get('/link-preview', asyncHandler(ChatController.getLinkPreview));
router.get('/channels/:channelId/files', asyncHandler(ChatController.listChannelFiles));
router.post('/channels/:channelId/files', ...uploadWithScan('file'), asyncHandler(ChatController.uploadChannelFile));
router.delete('/channels/:channelId/files/:fileId', asyncHandler(ChatController.deleteChannelFile));
router.post('/ensure-general', asyncHandler(ChatController.ensureGeneral));
router.get('/org-members', asyncHandler(ChatController.listOrgMembers));
router.get('/channels/:channelId/members', asyncHandler(ChatController.listChannelMembers));
router.delete('/channels/:channelId/members/:userId', asyncHandler(ChatController.removeChannelMember));
router.delete('/channels/:channelId/leave', asyncHandler(ChatController.leaveChannel));

// DMs & groups
router.post('/channels/dm/:targetUserId', asyncHandler(ChatController.createDM));
router.post('/groups', asyncHandler(ChatController.createGroup));

// Read receipts
router.post('/read-receipts', asyncHandler(ChatController.markRead));
router.get('/channels/:channelId/read-receipts', asyncHandler(ChatController.getReadReceipts));
router.post('/channels/:channelId/read', asyncHandler(ChatController.markChannelRead));
router.post('/channels/:channelId/delivered', asyncHandler(ChatController.markDelivered));
router.get('/unread', asyncHandler(ChatController.getUnreadCounts));

// Search
router.get('/search', asyncHandler(ChatController.searchMessages));

// Reactions
router.post('/channels/:channel/messages/:messageId/reactions', asyncHandler(ChatController.addReaction));

export default router;
