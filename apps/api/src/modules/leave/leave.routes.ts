import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { LeaveController } from './leave.controller';
import { UserRole } from '@meticle/shared';
import { createLeaveRequestSchema, reviewLeaveRequestSchema, createLeaveTypeSchema, updateLeaveTypeSchema, updateStaffEntitlementSchema } from '../../shared/validation/schemas';

const router = Router();

router.use(authenticate);

// Self-service routes (any authenticated user)
router.get('/my-requests', asyncHandler(LeaveController.getMyLeaveRequests));
router.post('/my-requests', validate(createLeaveRequestSchema), asyncHandler(LeaveController.createLeaveRequest));
router.patch('/requests/:id/cancel', asyncHandler(LeaveController.cancelLeaveRequest));
router.get('/balances', asyncHandler(LeaveController.getLeaveBalances));
router.get('/calendar-stats', asyncHandler(LeaveController.getCalendarStats));
router.get('/locations', asyncHandler(LeaveController.getLocations));

// Manager/Admin routes
router.get('/types', asyncHandler(LeaveController.getLeaveTypes));
router.post('/types', requireRole(UserRole.ORG_ADMIN), validate(createLeaveTypeSchema), asyncHandler(LeaveController.createLeaveType));
router.put('/types/:id', requireRole(UserRole.ORG_ADMIN), validate(updateLeaveTypeSchema), asyncHandler(LeaveController.updateLeaveType));
router.delete('/types/:id', requireRole(UserRole.ORG_ADMIN), asyncHandler(LeaveController.deleteLeaveType));
router.get('/requests', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(LeaveController.getAllLeaveRequests));
router.patch('/requests/:id/review', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(reviewLeaveRequestSchema), asyncHandler(LeaveController.reviewLeaveRequest));
router.get('/balances/:staffId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(LeaveController.getStaffLeaveBalances));
router.get('/staff-requests/:staffId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(LeaveController.getStaffLeaveRequests));
router.put('/entitlement/:staffId', requireRole(UserRole.ORG_ADMIN), validate(updateStaffEntitlementSchema), asyncHandler(LeaveController.updateStaffEntitlement));

export default router;
