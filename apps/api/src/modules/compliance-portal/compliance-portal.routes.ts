import { Router } from 'express';
import { CompliancePortalController } from './compliance-portal.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { authenticatePortal } from '../../shared/middleware/portalAuth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { UserRole } from '@meticle/shared';

const router = Router();

// ── Admin routes (require normal auth + ORG_ADMIN) ──
router.post('/access', authenticate, requireRole(UserRole.ORG_ADMIN), asyncHandler(CompliancePortalController.createPortalAccess));
router.get('/access', authenticate, requireRole(UserRole.ORG_ADMIN), asyncHandler(CompliancePortalController.listPortalAccess));
router.post('/access/:id/revoke', authenticate, requireRole(UserRole.ORG_ADMIN), asyncHandler(CompliancePortalController.revokePortalAccess));

// ── Portal routes (use portal token auth, not user auth) ──
router.get('/portal/verify', authenticatePortal, asyncHandler(CompliancePortalController.verifyToken));
router.get('/portal/dashboard', authenticatePortal, asyncHandler(CompliancePortalController.getDashboard));
router.get('/portal/person/:personId', authenticatePortal, asyncHandler(CompliancePortalController.getPersonDetail));
router.get('/portal/person/:personId/medication', authenticatePortal, asyncHandler(CompliancePortalController.getMedicationDetail));

export default router;
