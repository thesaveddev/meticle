import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { PlatformAdminController } from './platform-admin.controller';
import { UserRole } from '@meticle/shared';

const router = Router();

router.use(authenticate);
router.use(requireRole(UserRole.SUPER_ADMIN));

router.get('/stats', asyncHandler(PlatformAdminController.getStats));
router.get('/finance', asyncHandler(PlatformAdminController.getFinanceOverview));
router.get('/audit-log', asyncHandler(PlatformAdminController.getAuditLog));
router.get('/system-health', asyncHandler(PlatformAdminController.getSystemHealth));
router.get('/organizations', asyncHandler(PlatformAdminController.listOrganizations));
router.get('/organizations/:id', asyncHandler(PlatformAdminController.getOrganization));
router.patch('/organizations/:id/status', asyncHandler(PlatformAdminController.updateOrganizationStatus));
router.patch('/organizations/:id/billing', asyncHandler(PlatformAdminController.updateOrgBilling));
router.get('/users', asyncHandler(PlatformAdminController.listUsers));
router.get('/trial-followups', asyncHandler(PlatformAdminController.listTrialFollowups));
router.post('/trial-followups/:organizationId/email', asyncHandler(PlatformAdminController.sendTrialFollowupEmail));
router.patch('/users/:id/status', asyncHandler(PlatformAdminController.updateUserStatus));

export default router;
