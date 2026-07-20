import { Router } from 'express';
import { ChatController } from './chat.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { z } from 'zod';
import { validate } from '../../shared/middleware/validate.middleware';
import { upload } from '../../shared/middleware/upload.middleware';
import { UserRole } from '@caredesk/shared';

const createGroupSchema = z.object({
  name: z.string().min(1),
  memberIds: z.array(z.string().uuid()).optional(),
});

const sendMessageSchema = z.object({
  content: z.string().max(5000, 'Message content too long').optional(),
  file_url: z.string().max(2000).optional(),
  file_name: z.string().max(255).optional(),
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
});

const router = Router();

router.use(authenticate);

// Channels
router.get('/channels', asyncHandler(ChatController.getChannels));
router.get('/channels/:channelId', asyncHandler(ChatController.getChannel));
router.get('/channels/:channelId/members', asyncHandler(ChatController.getMembers));
router.get('/channels/:channelId/messages', asyncHandler(ChatController.getMessages));
router.post('/channels/:channelId/messages', validate(sendMessageSchema), asyncHandler(ChatController.sendMessage));
router.post('/channels/:channelId/read', asyncHandler(ChatController.markRead));

// Groups
router.post('/groups', validate(createGroupSchema), asyncHandler(ChatController.createGroup));
router.post('/channels/:channelId/members', validate(addMemberSchema), asyncHandler(ChatController.addMember));
router.delete('/channels/:channelId/members/:userId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ChatController.removeMember));

// DMs
router.post('/channels/dm/:targetUserId', asyncHandler(ChatController.getOrCreateDM));

// Shared files
router.get('/channels/:channelId/files', asyncHandler(ChatController.getFiles));
router.post('/channels/:channelId/files', upload.single('file'), asyncHandler(ChatController.uploadFile));
router.delete('/channels/:channelId/files/:fileId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ChatController.deleteFile));

// Utilities
router.get('/link-preview', asyncHandler(ChatController.getLinkPreview));
router.get('/org-members', asyncHandler(ChatController.getOrgMembers));
router.post('/ensure-general', asyncHandler(ChatController.ensureGeneralChannel));

export default router;
