import { Router } from 'express';
import { ServiceUserController } from './service-users.controller';
import { uploadWithScan, uploadMultipleWithScan } from '../../shared/middleware/upload.middleware';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { UserRole } from '@caredesk/shared';
import { createServiceUserSchema, updateServiceUserSchema, createCarePlanSchema, updateCarePlanSchema, createDailyNoteSchema, updateDailyNoteSchema, createRiskAssessmentSchema, updateRiskAssessmentSchema, createFamilyContactSchema, updateFamilyContactSchema, createAssessmentSchema, updateAssessmentSchema, createBodyMapEntrySchema, updateBodyMapEntrySchema, createMemoryBookEntrySchema, updateMemoryBookEntrySchema, createClinicalScoreSchema, updateClinicalScoreSchema, createDocumentSchema, createWellbeingSchema, createCommunicationLogSchema, createCapacityAssessmentSchema, updateCapacityAssessmentSchema, createCarePathwaySchema, updateCarePathwaySchema, createDischargeChecklistSchema, updateDischargeChecklistSchema } from '../../shared/validation/schemas';

const router = Router();

router.use(authenticate);

// Read routes (any authenticated user)
router.get('/', asyncHandler(ServiceUserController.list));
router.get('/:id', asyncHandler(ServiceUserController.getById));
router.get('/assessments/:id', asyncHandler(ServiceUserController.getAssessment));
router.get('/:serviceUserId/daily-notes', asyncHandler(ServiceUserController.getDailyNotes));
router.get('/:serviceUserId/assessments', asyncHandler(ServiceUserController.listAssessments));
router.get('/:serviceUserId/timeline', asyncHandler(ServiceUserController.getTimeline));

// Mutation routes (MANAGER or ORG_ADMIN)
router.post('/bulk/status', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ServiceUserController.bulkStatus));
router.post('/bulk/discharge', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ServiceUserController.bulkDischarge));
router.post('/', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createServiceUserSchema), asyncHandler(ServiceUserController.create));
router.patch('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateServiceUserSchema), asyncHandler(ServiceUserController.update));
router.post('/:id/photo', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), uploadWithScan('photo'), asyncHandler(ServiceUserController.uploadPhoto));
router.delete('/:id', requireRole(UserRole.ORG_ADMIN), asyncHandler(ServiceUserController.delete));
router.post('/:serviceUserId/care-plans', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createCarePlanSchema), asyncHandler(ServiceUserController.createCarePlan));
router.patch('/care-plans/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateCarePlanSchema), asyncHandler(ServiceUserController.updateCarePlan));
router.delete('/care-plans/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ServiceUserController.deleteCarePlan));

// Body Map routes
router.get('/:serviceUserId/body-map', asyncHandler(ServiceUserController.listBodyMapEntries));
router.post('/:serviceUserId/body-map', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createBodyMapEntrySchema), asyncHandler(ServiceUserController.createBodyMapEntry));
router.patch('/body-map/:entryId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateBodyMapEntrySchema), asyncHandler(ServiceUserController.updateBodyMapEntry));
router.delete('/body-map/:entryId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ServiceUserController.deleteBodyMapEntry));

// Memory Book routes
router.get('/:serviceUserId/memory-book', asyncHandler(ServiceUserController.listMemoryBook));
router.post('/:serviceUserId/memory-book', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), ...uploadMultipleWithScan('images', 10), validate(createMemoryBookEntrySchema), asyncHandler(ServiceUserController.createMemoryBookEntry));
router.patch('/memory-book/:entryId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateMemoryBookEntrySchema), asyncHandler(ServiceUserController.updateMemoryBookEntry));
router.delete('/memory-book/:entryId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ServiceUserController.deleteMemoryBookEntry));

router.post('/:serviceUserId/daily-notes', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(createDailyNoteSchema), asyncHandler(ServiceUserController.createDailyNote));
router.patch('/daily-notes/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateDailyNoteSchema), asyncHandler(ServiceUserController.updateDailyNote));
router.post('/:serviceUserId/risk-assessments', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createRiskAssessmentSchema), asyncHandler(ServiceUserController.createRiskAssessment));
router.patch('/risk-assessments/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateRiskAssessmentSchema), asyncHandler(ServiceUserController.updateRiskAssessment));
router.delete('/risk-assessments/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ServiceUserController.deleteRiskAssessment));
router.post('/:serviceUserId/family-contacts', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createFamilyContactSchema), asyncHandler(ServiceUserController.createFamilyContact));
router.patch('/family-contacts/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateFamilyContactSchema), asyncHandler(ServiceUserController.updateFamilyContact));
router.delete('/family-contacts/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ServiceUserController.deleteFamilyContact));
router.post('/:serviceUserId/assessments', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createAssessmentSchema), asyncHandler(ServiceUserController.createAssessment));
router.patch('/assessments/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateAssessmentSchema), asyncHandler(ServiceUserController.updateAssessment));
router.delete('/assessments/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ServiceUserController.deleteAssessment));

// Clinical Scores
router.get('/:serviceUserId/clinical-scores', asyncHandler(ServiceUserController.getClinicalScores));
router.post('/:serviceUserId/clinical-scores', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createClinicalScoreSchema), asyncHandler(ServiceUserController.createClinicalScore));
router.delete('/clinical-scores/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ServiceUserController.deleteClinicalScore));

// Service User Documents
router.get('/:serviceUserId/documents', asyncHandler(ServiceUserController.getDocuments));
router.post('/:serviceUserId/documents', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createDocumentSchema), asyncHandler(ServiceUserController.createDocument));
router.delete('/documents/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ServiceUserController.deleteDocument));

router.patch('/clinical-scores/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateClinicalScoreSchema), asyncHandler(ServiceUserController.updateClinicalScore));

router.get('/:serviceUserId/wellbeing', asyncHandler(ServiceUserController.listWellbeing));
router.post('/:serviceUserId/wellbeing', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createWellbeingSchema), asyncHandler(ServiceUserController.createWellbeing));
router.delete('/wellbeing/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ServiceUserController.deleteWellbeing));

router.get('/:serviceUserId/communication-log', asyncHandler(ServiceUserController.listCommunicationLog));
router.post('/:serviceUserId/communication-log', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createCommunicationLogSchema), asyncHandler(ServiceUserController.createCommunicationLog));
router.delete('/communication-log/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ServiceUserController.deleteCommunicationLog));

router.get('/:serviceUserId/capacity', asyncHandler(ServiceUserController.listCapacityAssessments));
router.post('/:serviceUserId/capacity', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createCapacityAssessmentSchema), asyncHandler(ServiceUserController.createCapacityAssessment));
router.patch('/capacity/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateCapacityAssessmentSchema), asyncHandler(ServiceUserController.updateCapacityAssessment));
router.delete('/capacity/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ServiceUserController.deleteCapacityAssessment));

router.get('/:serviceUserId/care-pathways', asyncHandler(ServiceUserController.listCarePathways));
router.post('/:serviceUserId/care-pathways', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createCarePathwaySchema), asyncHandler(ServiceUserController.createCarePathway));
router.patch('/care-pathways/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateCarePathwaySchema), asyncHandler(ServiceUserController.updateCarePathway));
router.delete('/care-pathways/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ServiceUserController.deleteCarePathway));

router.get('/:serviceUserId/discharge-checklist', asyncHandler(ServiceUserController.listDischargeChecklist));
router.post('/:serviceUserId/discharge-checklist', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createDischargeChecklistSchema), asyncHandler(ServiceUserController.createDischargeChecklist));
router.patch('/discharge-checklist/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateDischargeChecklistSchema), asyncHandler(ServiceUserController.updateDischargeChecklist));
router.delete('/discharge-checklist/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ServiceUserController.deleteDischargeChecklist));

export default router;
