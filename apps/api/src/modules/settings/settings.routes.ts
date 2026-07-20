import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { SettingsController } from './settings.controller';
import { UserRole } from '@caredesk/shared';
import { updateOrgSettingsSchema, createLocationSchema, updateLocationSchema, createComplianceConfigSchema, updateComplianceConfigSchema, createManagerDelegationSchema, updateManagerDelegationSchema, updateComplianceRecordSchema, createComplianceProfileSchema, updateComplianceProfileSchema, assignComplianceProfileSchema, createLocationCertificateSchema, updateLocationCertificateSchema } from '../../shared/validation/schemas';

const router = Router();

router.use(authenticate);

// Read routes (any authenticated user)
router.get('/org', asyncHandler(SettingsController.getOrgSettings));
router.get('/locations', asyncHandler(SettingsController.getLocations));
router.get('/staff', asyncHandler(SettingsController.getStaffList));
router.get('/compliance-config', asyncHandler(SettingsController.getComplianceConfig));
router.get('/delegations', asyncHandler(SettingsController.getManagerDelegations));
router.get('/compliance-records', asyncHandler(SettingsController.getComplianceRecords));
router.get('/compliance-profiles', asyncHandler(SettingsController.getComplianceProfiles));
router.get('/my-teams', asyncHandler(SettingsController.getMyTeams));

// Mutation routes (ORG_ADMIN only)
router.patch('/org', requireRole(UserRole.ORG_ADMIN), validate(updateOrgSettingsSchema), asyncHandler(SettingsController.updateOrgSettings));
router.post('/locations', requireRole(UserRole.ORG_ADMIN), validate(createLocationSchema), asyncHandler(SettingsController.createLocation));
router.put('/locations/:id', requireRole(UserRole.ORG_ADMIN), validate(updateLocationSchema), asyncHandler(SettingsController.updateLocation));
router.delete('/locations/:id', requireRole(UserRole.ORG_ADMIN), asyncHandler(SettingsController.deleteLocation));

// Location certificates
router.get('/locations/:locationId/certificates', asyncHandler(SettingsController.getLocationCertificates));
router.post('/locations/:locationId/certificates', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createLocationCertificateSchema), asyncHandler(SettingsController.createLocationCertificate));
router.put('/locations/:locationId/certificates/:certificateId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateLocationCertificateSchema), asyncHandler(SettingsController.updateLocationCertificate));
router.delete('/locations/:locationId/certificates/:certificateId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(SettingsController.deleteLocationCertificate));

router.post('/compliance-config', requireRole(UserRole.ORG_ADMIN), validate(createComplianceConfigSchema), asyncHandler(SettingsController.createComplianceConfig));
router.put('/compliance-config/:id', requireRole(UserRole.ORG_ADMIN), validate(updateComplianceConfigSchema), asyncHandler(SettingsController.updateComplianceConfig));
router.delete('/compliance-config/:id', requireRole(UserRole.ORG_ADMIN), asyncHandler(SettingsController.deleteComplianceConfig));
router.post('/delegations', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createManagerDelegationSchema), asyncHandler(SettingsController.createManagerDelegation));
router.patch('/delegations/:id', requireRole(UserRole.ORG_ADMIN), validate(updateManagerDelegationSchema), asyncHandler(SettingsController.updateManagerDelegation));
router.delete('/delegations/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(SettingsController.deleteManagerDelegation));
router.post('/calculate-entitlements', requireRole(UserRole.ORG_ADMIN), asyncHandler(SettingsController.calculateStaffEntitlement));
router.patch('/compliance-records/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateComplianceRecordSchema), asyncHandler(SettingsController.updateComplianceRecord));
router.post('/compliance-records/:id/upload', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), SettingsController.uploadMiddleware, asyncHandler(SettingsController.uploadComplianceRecordFile));
router.delete('/compliance-records/:id', requireRole(UserRole.ORG_ADMIN), asyncHandler(SettingsController.deleteComplianceRecord));
router.post('/compliance-records/seed', requireRole(UserRole.ORG_ADMIN), asyncHandler(SettingsController.seedComplianceRecords));
router.post('/compliance-profiles', requireRole(UserRole.ORG_ADMIN), validate(createComplianceProfileSchema), asyncHandler(SettingsController.createComplianceProfile));
router.put('/compliance-profiles/:id', requireRole(UserRole.ORG_ADMIN), validate(updateComplianceProfileSchema), asyncHandler(SettingsController.updateComplianceProfile));
router.delete('/compliance-profiles/:id', requireRole(UserRole.ORG_ADMIN), asyncHandler(SettingsController.deleteComplianceProfile));
router.post('/assign-compliance-profile', requireRole(UserRole.ORG_ADMIN), validate(assignComplianceProfileSchema), asyncHandler(SettingsController.assignComplianceProfile));
router.post('/auto-assign-profiles', requireRole(UserRole.ORG_ADMIN), asyncHandler(SettingsController.autoAssignProfiles));

// File upload
router.post('/upload', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), SettingsController.uploadMiddleware, asyncHandler(SettingsController.uploadFile));

export default router;
