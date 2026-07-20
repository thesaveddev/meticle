import { Router } from 'express';
import { SchedulingController } from './scheduling.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { requirePermission } from '../../shared/middleware/requirePermission';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { validate } from '../../shared/middleware/validate.middleware';
import { createShiftSchema, updateShiftSchema, assignStaffSchema, createTemplateSchema } from '../../shared/validation/schemas';
import { UserRole } from '@caredesk/shared';

const router = Router();
router.use(authenticate);

router.get('/staff', asyncHandler(SchedulingController.getStaffList));
router.get('/min-staff', asyncHandler(SchedulingController.getMinStaffCounts));
router.get('/templates', asyncHandler(SchedulingController.getTemplates));
router.post('/templates', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), requirePermission('scheduling', 'edit'), validate(createTemplateSchema), asyncHandler(SchedulingController.createTemplate));
router.get('/my-shifts', asyncHandler(SchedulingController.getMyShifts));
router.get('/my-claims', asyncHandler(SchedulingController.getMyClaims));
router.get('/pending-claims', asyncHandler(SchedulingController.getPendingClaims));
router.get('/approved-claims', asyncHandler(SchedulingController.getApprovedClaims));
router.get('/unclaimed', asyncHandler(SchedulingController.getUnclaimedOpenShifts));
router.get('/', asyncHandler(SchedulingController.getShifts));
router.get('/open', asyncHandler(SchedulingController.getOpenShifts));
router.get('/last-date', asyncHandler(SchedulingController.getLastShiftDate));
router.post('/', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), requirePermission('scheduling', 'edit'), validate(createShiftSchema), asyncHandler(SchedulingController.createShift));
router.get('/:id', asyncHandler(SchedulingController.getShift));
router.patch('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), requirePermission('scheduling', 'edit'), validate(updateShiftSchema), asyncHandler(SchedulingController.updateShift));
router.delete('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), requirePermission('scheduling', 'edit'), asyncHandler(SchedulingController.deleteShift));
router.post('/:id/assign', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), requirePermission('scheduling', 'edit'), validate(assignStaffSchema), asyncHandler(SchedulingController.assignStaff));
router.post('/:id/claim', asyncHandler(SchedulingController.claimOpenShift));
router.patch('/:id/send-to-agency', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), requirePermission('scheduling', 'edit'), asyncHandler(SchedulingController.sendToAgency));
router.patch('/:id/agency-coverage', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), requirePermission('scheduling', 'edit'), asyncHandler(SchedulingController.updateAgencyCoverage));
router.patch('/:shiftId/approve-claim/:staffId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), requirePermission('scheduling', 'edit'), asyncHandler(SchedulingController.approveOvertimeClaim));
router.patch('/:shiftId/reject-claim/:staffId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), requirePermission('scheduling', 'edit'), asyncHandler(SchedulingController.rejectOvertimeClaim));
router.delete('/:shiftId/assign/:staffId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), requirePermission('scheduling', 'edit'), asyncHandler(SchedulingController.unassignStaff));
router.delete('/:shiftId/revoke-claim/:staffId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), requirePermission('scheduling', 'edit'), asyncHandler(SchedulingController.revokeOvertimeClaim));
router.post('/:shiftId/swap-claim/:staffId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), requirePermission('scheduling', 'edit'), asyncHandler(SchedulingController.swapOvertimeClaim));
router.get('/staff/:staffId/shifts', asyncHandler(SchedulingController.getStaffShifts));

// Shift swaps
router.post('/:shiftId/swap-request', asyncHandler(SchedulingController.requestSwap));
router.patch('/swap-response/:swapId', asyncHandler(SchedulingController.respondToSwap));
router.get('/swap-requests/my', asyncHandler(SchedulingController.getMySwapRequests));
router.get('/:shiftId/eligible-swap-staff', asyncHandler(SchedulingController.getEligibleSwapStaff));

export default router;
