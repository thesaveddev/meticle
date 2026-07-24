import { Router } from 'express';
import { FamilyPortalController as Ctrl } from './familyPortal.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { createFamilyMemberSchema, updateFamilyMemberSchema } from '../../shared/validation/schemas';
import { UserRole } from '@meticle/shared';
import { asyncHandler } from '../../shared/middleware/asyncHandler';

const router = Router();
const publicRouter = Router();

// ── Authenticated routes (managers + org_admins) ──
router.use(authenticate);

router.get('/members', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(Ctrl.listMembers));
router.post('/members', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createFamilyMemberSchema), asyncHandler(Ctrl.createMember));
router.patch('/members/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateFamilyMemberSchema), asyncHandler(Ctrl.updateMember));
router.post('/members/:id/revoke', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(Ctrl.revokeMember));
router.post('/members/:id/resend', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(Ctrl.resendInvite));
router.post('/members/:id/refresh-token', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(Ctrl.refreshToken));
router.delete('/members/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(Ctrl.deleteMember));

// ── Public routes (token-based, no auth) ──
publicRouter.get('/:token', asyncHandler(Ctrl.portalGetInfo));
publicRouter.get('/:token/care-notes', asyncHandler(Ctrl.portalGetCareNotes));
publicRouter.get('/:token/care-plans', asyncHandler(Ctrl.portalGetCarePlans));
publicRouter.get('/:token/goals', asyncHandler(Ctrl.portalGetGoals));
publicRouter.get('/:token/observations', asyncHandler(Ctrl.portalGetObservations));

export default router;
export { publicRouter };
