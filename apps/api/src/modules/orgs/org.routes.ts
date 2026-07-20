import { Router } from 'express';
import { OrgController } from './org.controller';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { rateLimit } from '../../shared/middleware/rateLimit.middleware';
import { createOrganizationSchema, updateOrganizationSchema, createLocationSchema, createDepartmentSchema, updateDepartmentSchema, createTeamSchema, updateTeamSchema, addTeamMemberSchema, updateBrandingSchema } from '../../shared/validation/schemas';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { UserRole } from '@caredesk/shared';

const router = Router();

router.post('/', rateLimit(15, 60000), validate(createOrganizationSchema), asyncHandler(OrgController.createOrganization));
router.get('/:id', authenticate, asyncHandler(OrgController.getOrganization));
router.patch('/:id', authenticate, requireRole(UserRole.ORG_ADMIN), validate(updateOrganizationSchema), asyncHandler(OrgController.updateOrganization));
router.post('/:orgId/locations', authenticate, requireRole(UserRole.ORG_ADMIN), validate(createLocationSchema), asyncHandler(OrgController.createLocation));
router.get('/:orgId/locations', authenticate, asyncHandler(OrgController.getLocationsByOrg));
router.post('/:locationId/departments', authenticate, requireRole(UserRole.ORG_ADMIN), validate(createDepartmentSchema), asyncHandler(OrgController.createDepartment));
router.get('/:locationId/departments', authenticate, asyncHandler(OrgController.getDepartmentsByLocation));
router.patch('/departments/:id', authenticate, requireRole(UserRole.ORG_ADMIN), validate(updateDepartmentSchema), asyncHandler(OrgController.updateDepartment));
router.delete('/departments/:id', authenticate, requireRole(UserRole.ORG_ADMIN), asyncHandler(OrgController.deleteDepartment));
router.get('/departments/single/:id', authenticate, asyncHandler(OrgController.getDepartmentById));
router.get('/:orgId/teams', authenticate, asyncHandler(OrgController.getTeams));
router.post('/:orgId/teams', authenticate, requireRole(UserRole.ORG_ADMIN), validate(createTeamSchema), asyncHandler(OrgController.createTeam));
router.patch('/teams/:id', authenticate, requireRole(UserRole.ORG_ADMIN), validate(updateTeamSchema), asyncHandler(OrgController.updateTeam));
router.delete('/teams/:id', authenticate, requireRole(UserRole.ORG_ADMIN), asyncHandler(OrgController.deleteTeam));
router.get('/teams/:teamId/members', authenticate, asyncHandler(OrgController.getTeamMembers));
router.post('/teams/:teamId/members', authenticate, requireRole(UserRole.ORG_ADMIN), validate(addTeamMemberSchema), asyncHandler(OrgController.addTeamMember));
router.delete('/teams/:teamId/members/:userId', authenticate, requireRole(UserRole.ORG_ADMIN), asyncHandler(OrgController.removeTeamMember));
router.patch('/:id/branding', authenticate, requireRole(UserRole.ORG_ADMIN), validate(updateBrandingSchema), asyncHandler(OrgController.updateBranding));
router.get('/:id/subscription', authenticate, asyncHandler(OrgController.getSubscription));

export default router;
