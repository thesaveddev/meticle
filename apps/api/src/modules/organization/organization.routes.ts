import { Router } from 'express';
import { InvitationController } from './invitation.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { validate } from '../../shared/middleware/validate.middleware';
import { inviteStaffSchema, acceptInvitationSchema } from '../../shared/validation/schemas';
import { UserRole } from '@caredesk/shared';

const router = Router();

// Validate invitation (no auth required - called before registration)
router.get('/invitation/validate', asyncHandler(InvitationController.validate));

// Authenticated routes
router.use(authenticate);

router.post('/invitation/invite', requireRole(UserRole.ORG_ADMIN), validate(inviteStaffSchema), asyncHandler(InvitationController.invite));
router.get('/invitation/invitations', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(InvitationController.getInvitations));
router.post('/invitation/resend/:id', requireRole(UserRole.ORG_ADMIN), asyncHandler(InvitationController.resend));
router.delete('/invitation/:id', requireRole(UserRole.ORG_ADMIN), asyncHandler(InvitationController.cancel));
router.post('/invitation/accept', validate(acceptInvitationSchema), asyncHandler(InvitationController.accept));

export default router;
