import { Router } from 'express';
import { ComplianceController } from './compliance.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { uploadDocumentSchema, updateDocumentStatusSchema } from '../../shared/validation/schemas';
import { uploadWithScan } from '../../shared/middleware/upload.middleware';
import { UserRole } from '@meticle/shared';
import { z } from 'zod';

const router = Router();

// Validated against the registry in the controller, not by enumerating scheme
// ids here, so adding a nation does not mean editing a validation schema.
const vettingSchemeSchema = z.object({ vetting_scheme: z.string().min(1).max(64) });
// The number is not pattern-validated. CIW registration numbers can contain a
// forward slash and have had several published formats, and a regex that rejects
// a real registration number is worse than one that accepts a typo — the typo is
// visible to a human, a rejected real number is not.
const registrationSchema = z.object({
  regulator_id: z.string().min(1).max(32),
  registration_number: z.string().min(1).max(120),
  verified: z.boolean().optional(),
});

router.use(authenticate);

router.get('/documents', asyncHandler(ComplianceController.getAllDocuments));
router.get('/expiring', asyncHandler(ComplianceController.getExpiringDocuments));
router.get('/alerts-summary', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ComplianceController.getAlertsSummary));
router.get('/evidence-pack', asyncHandler(ComplianceController.getEvidencePack));
router.get('/evidence-pack/pdf', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ComplianceController.generateEvidencePackPdf));
router.get('/identity-dashboard', asyncHandler(ComplianceController.getIdentityDashboard));
// Declared before '/:staffId' below, which would otherwise swallow these.
router.get('/vetting-schemes', asyncHandler(ComplianceController.listVettingSchemes));
router.get('/vetting-scheme', asyncHandler(ComplianceController.getVettingScheme));
// ORG_ADMIN: this changes which background check every member of staff is
// measured against, so it is a compliance decision about the organisation
// rather than a rostering preference.
router.put('/vetting-scheme', requireRole(UserRole.ORG_ADMIN), validate(vettingSchemeSchema), asyncHandler(ComplianceController.updateVettingScheme));
// Which body regulates this service, and our number with them. ORG_ADMIN, like
// the rest of the organisation's regulatory settings.
router.get('/regulators', asyncHandler(ComplianceController.listRegulators));
router.get('/regulator-registrations', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER), asyncHandler(ComplianceController.getRegulatorRegistrations));
router.put('/regulator-registrations', requireRole(UserRole.ORG_ADMIN), validate(registrationSchema), asyncHandler(ComplianceController.upsertRegulatorRegistration));
router.delete('/regulator-registrations', requireRole(UserRole.ORG_ADMIN), validate(z.object({ regulator_id: z.string().min(1).max(32) })), asyncHandler(ComplianceController.deleteRegulatorRegistration));
router.post('/upload', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), ...uploadWithScan('document'), validate(uploadDocumentSchema), asyncHandler(ComplianceController.uploadDocument));
router.patch('/documents/:id/status', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateDocumentStatusSchema), asyncHandler(ComplianceController.updateDocumentStatus));
router.patch('/records/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ComplianceController.updateRecord));
router.post('/documents/:id/renewal-reminder', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ComplianceController.sendRenewalReminder));
router.post('/documents/:id/request-renewal', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ComplianceController.requestRenewal));
router.post('/documents/:id/submit-renewal', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), ...uploadWithScan('document'), asyncHandler(ComplianceController.submitRenewal));
router.post('/run-notifications', requireRole(UserRole.ORG_ADMIN), asyncHandler(ComplianceController.runNotifications));
router.get('/trends', asyncHandler(ComplianceController.getTrends));
router.get('/evidence-mappings', asyncHandler(ComplianceController.getEvidenceMappings));
router.post('/evidence-mappings', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ComplianceController.upsertEvidenceMapping));
router.delete('/evidence-mappings/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ComplianceController.deleteEvidenceMapping));
router.get('/records', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ComplianceController.getAllRecords));
router.post('/seed-records', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ComplianceController.seedRecords));
router.get('/:staffId', asyncHandler(ComplianceController.getStaffCompliance));

export default router;
