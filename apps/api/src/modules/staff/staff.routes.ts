import { Router } from 'express';
import { StaffController } from './staff.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { UserRole } from '@caredesk/shared';
import { createStaffProfileSchema, addQualificationSchema, savePreferencesSchema, updateStaffRoleSchema, updateStaffStatusSchema, updateStaffProfileSchema, updateStaffDepartmentSchema, addSkillSchema, addEmergencyContactSchema, forcePasswordResetSchema } from '../../shared/validation/schemas';

const router = Router();

router.use(authenticate);

router.post('/', requireRole(UserRole.ORG_ADMIN), validate(createStaffProfileSchema), asyncHandler(StaffController.createProfile));
router.get('/org-members', asyncHandler(StaffController.getOrgMembers));
router.patch('/:userId/role', requireRole(UserRole.ORG_ADMIN), validate(updateStaffRoleSchema), asyncHandler(StaffController.updateUserRole));
router.patch('/:userId/status', requireRole(UserRole.ORG_ADMIN), validate(updateStaffStatusSchema), asyncHandler(StaffController.updateUserStatus));
router.delete('/:userId', requireRole(UserRole.ORG_ADMIN), asyncHandler(StaffController.deleteUser));
router.patch('/:userId/profile', validate(updateStaffProfileSchema), asyncHandler(StaffController.updateStaffProfile));
router.post('/self-deactivate', asyncHandler(StaffController.selfDeactivate));
router.get('/:userId', asyncHandler(StaffController.getProfile));
router.post('/preferences', validate(savePreferencesSchema), asyncHandler(StaffController.savePreferences));
router.post('/:userId/force-password-reset', requireRole(UserRole.ORG_ADMIN), validate(forcePasswordResetSchema), asyncHandler(StaffController.forcePasswordReset));
router.patch('/:staffId/department', requireRole(UserRole.ORG_ADMIN), validate(updateStaffDepartmentSchema), asyncHandler(StaffController.updateDepartment));
router.get('/by-department/:departmentId', asyncHandler(StaffController.getStaffByDepartment));
router.get('/:userId/compliance', asyncHandler(StaffController.getStaffCompliance));
router.post('/:staffId/qualifications', requireRole(UserRole.ORG_ADMIN), validate(addQualificationSchema), asyncHandler(StaffController.addQualification));
router.get('/:staffId/skills', asyncHandler(StaffController.getSkills));
router.post('/:staffId/skills', requireRole(UserRole.ORG_ADMIN), validate(addSkillSchema), asyncHandler(StaffController.addSkill));
router.delete('/:staffId/skills/:skillId', requireRole(UserRole.ORG_ADMIN), asyncHandler(StaffController.deleteSkill));
router.get('/:staffId/emergency-contacts', asyncHandler(StaffController.getEmergencyContacts));
router.post('/:staffId/emergency-contacts', requireRole(UserRole.ORG_ADMIN), validate(addEmergencyContactSchema), asyncHandler(StaffController.addEmergencyContact));
router.delete('/:staffId/emergency-contacts/:contactId', requireRole(UserRole.ORG_ADMIN), asyncHandler(StaffController.deleteEmergencyContact));

export default router;
