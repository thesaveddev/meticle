import { Router } from 'express';
import { ComplianceController } from './compliance.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { uploadDocumentSchema, updateDocumentStatusSchema } from '../../shared/validation/schemas';
import { upload } from '../../shared/middleware/upload.middleware';
import { UserRole } from '@meticle/shared';

const router = Router();

router.use(authenticate);

router.get('/documents', asyncHandler(ComplianceController.getAllDocuments));
router.get('/expiring', asyncHandler(ComplianceController.getExpiringDocuments));
router.get('/evidence-pack', asyncHandler(ComplianceController.getEvidencePack));
router.get('/evidence-pack/pdf', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ComplianceController.generateEvidencePackPdf));
router.get('/identity-dashboard', asyncHandler(ComplianceController.getIdentityDashboard));
router.post('/upload', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), upload.single('document'), validate(uploadDocumentSchema), asyncHandler(ComplianceController.uploadDocument));
router.patch('/documents/:id/status', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateDocumentStatusSchema), asyncHandler(ComplianceController.updateDocumentStatus));
router.patch('/records/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ComplianceController.updateRecord));
router.post('/documents/:id/renewal-reminder', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ComplianceController.sendRenewalReminder));
router.post('/documents/:id/request-renewal', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ComplianceController.requestRenewal));
router.post('/documents/:id/submit-renewal', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), upload.single('document'), asyncHandler(ComplianceController.submitRenewal));
router.post('/run-notifications', requireRole(UserRole.ORG_ADMIN), asyncHandler(ComplianceController.runNotifications));
router.get('/trends', asyncHandler(ComplianceController.getTrends));
router.get('/evidence-mappings', asyncHandler(ComplianceController.getEvidenceMappings));
router.post('/evidence-mappings', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ComplianceController.upsertEvidenceMapping));
router.delete('/evidence-mappings/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ComplianceController.deleteEvidenceMapping));
router.get('/records', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ComplianceController.getAllRecords));
router.post('/seed-records', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ComplianceController.seedRecords));
router.get('/:staffId', asyncHandler(ComplianceController.getStaffCompliance));

export default router;
