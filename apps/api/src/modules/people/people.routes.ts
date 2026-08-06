import { Router } from 'express';
import { PersonController } from './people.controller';
import { uploadWithScan, uploadMultipleWithScan } from '../../shared/middleware/upload.middleware';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { UserRole } from '@meticle/shared';
import { createPersonSchema, updatePersonSchema, createCarePlanSchema, updateCarePlanSchema, createDailyNoteSchema, updateDailyNoteSchema, createRiskAssessmentSchema, updateRiskAssessmentSchema, createFamilyContactSchema, updateFamilyContactSchema, createAssessmentSchema, updateAssessmentSchema, createBodyMapEntrySchema, updateBodyMapEntrySchema, createMemoryBookEntrySchema, updateMemoryBookEntrySchema, createClinicalScoreSchema, updateClinicalScoreSchema, createDocumentSchema, createWellbeingSchema, createCommunicationLogSchema, updateCommunicationLogSchema, createCapacityAssessmentSchema, updateCapacityAssessmentSchema, createCarePathwaySchema, updateCarePathwaySchema, createDischargeChecklistSchema, updateDischargeChecklistSchema } from '../../shared/validation/schemas';

const router = Router();

router.use(authenticate);

// Read routes (any authenticated user)
router.get('/', asyncHandler(PersonController.list));
router.get('/:id', asyncHandler(PersonController.getById));
router.get('/assessments/:id', asyncHandler(PersonController.getAssessment));
router.get('/:personId/daily-notes', asyncHandler(PersonController.getDailyNotes));
router.get('/:personId/assessments', asyncHandler(PersonController.listAssessments));
router.get('/:personId/timeline', asyncHandler(PersonController.getTimeline));

// Mutation routes (MANAGER or ORG_ADMIN)
router.post('/bulk/status', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(PersonController.bulkStatus));
router.post('/bulk/discharge', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(PersonController.bulkDischarge));
router.post('/', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createPersonSchema), asyncHandler(PersonController.create));
router.patch('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updatePersonSchema), asyncHandler(PersonController.update));
router.post('/:id/photo', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), uploadWithScan('photo'), asyncHandler(PersonController.uploadPhoto));
router.delete('/:id', requireRole(UserRole.ORG_ADMIN), asyncHandler(PersonController.delete));
router.post('/:personId/care-plans', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createCarePlanSchema), asyncHandler(PersonController.createCarePlan));
router.patch('/care-plans/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateCarePlanSchema), asyncHandler(PersonController.updateCarePlan));
router.delete('/care-plans/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(PersonController.deleteCarePlan));

// Body Map routes
router.get('/:personId/body-map', asyncHandler(PersonController.listBodyMapEntries));
router.post('/:personId/body-map', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createBodyMapEntrySchema), asyncHandler(PersonController.createBodyMapEntry));
router.patch('/body-map/:entryId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateBodyMapEntrySchema), asyncHandler(PersonController.updateBodyMapEntry));
router.delete('/body-map/:entryId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(PersonController.deleteBodyMapEntry));

// Memory Book routes
router.get('/:personId/memory-book', asyncHandler(PersonController.listMemoryBook));
router.post('/:personId/memory-book', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), ...uploadMultipleWithScan('images', 10), validate(createMemoryBookEntrySchema), asyncHandler(PersonController.createMemoryBookEntry));
router.patch('/memory-book/:entryId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateMemoryBookEntrySchema), asyncHandler(PersonController.updateMemoryBookEntry));
router.delete('/memory-book/:entryId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(PersonController.deleteMemoryBookEntry));

router.post('/:personId/daily-notes', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(createDailyNoteSchema), asyncHandler(PersonController.createDailyNote));
router.patch('/daily-notes/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateDailyNoteSchema), asyncHandler(PersonController.updateDailyNote));
router.post('/:personId/risk-assessments', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createRiskAssessmentSchema), asyncHandler(PersonController.createRiskAssessment));
router.patch('/risk-assessments/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateRiskAssessmentSchema), asyncHandler(PersonController.updateRiskAssessment));
router.delete('/risk-assessments/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(PersonController.deleteRiskAssessment));
router.post('/:personId/family-contacts', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createFamilyContactSchema), asyncHandler(PersonController.createFamilyContact));
router.patch('/family-contacts/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateFamilyContactSchema), asyncHandler(PersonController.updateFamilyContact));
router.delete('/family-contacts/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(PersonController.deleteFamilyContact));
router.post('/:personId/assessments', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createAssessmentSchema), asyncHandler(PersonController.createAssessment));
router.patch('/assessments/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateAssessmentSchema), asyncHandler(PersonController.updateAssessment));
router.delete('/assessments/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(PersonController.deleteAssessment));

// Clinical Scores
router.get('/:personId/clinical-scores', asyncHandler(PersonController.getClinicalScores));
router.post('/:personId/clinical-scores', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createClinicalScoreSchema), asyncHandler(PersonController.createClinicalScore));
router.delete('/clinical-scores/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(PersonController.deleteClinicalScore));

// Person Documents
router.get('/:personId/documents', asyncHandler(PersonController.getDocuments));
router.post('/:personId/documents', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createDocumentSchema), asyncHandler(PersonController.createDocument));
router.delete('/documents/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(PersonController.deleteDocument));

router.patch('/clinical-scores/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateClinicalScoreSchema), asyncHandler(PersonController.updateClinicalScore));

router.get('/:personId/wellbeing', asyncHandler(PersonController.listWellbeing));
router.post('/:personId/wellbeing', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createWellbeingSchema), asyncHandler(PersonController.createWellbeing));
router.delete('/wellbeing/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(PersonController.deleteWellbeing));

router.get('/:personId/communication-log', asyncHandler(PersonController.listCommunicationLog));
router.post('/:personId/communication-log', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createCommunicationLogSchema), asyncHandler(PersonController.createCommunicationLog));
router.patch('/communication-log/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateCommunicationLogSchema), asyncHandler(PersonController.updateCommunicationLog));
router.delete('/communication-log/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(PersonController.deleteCommunicationLog));

router.get('/:personId/capacity', asyncHandler(PersonController.listCapacityAssessments));
router.post('/:personId/capacity', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createCapacityAssessmentSchema), asyncHandler(PersonController.createCapacityAssessment));
router.patch('/capacity/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateCapacityAssessmentSchema), asyncHandler(PersonController.updateCapacityAssessment));
router.delete('/capacity/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(PersonController.deleteCapacityAssessment));

router.get('/:personId/care-pathways', asyncHandler(PersonController.listCarePathways));
router.post('/:personId/care-pathways', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createCarePathwaySchema), asyncHandler(PersonController.createCarePathway));
router.patch('/care-pathways/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateCarePathwaySchema), asyncHandler(PersonController.updateCarePathway));
router.delete('/care-pathways/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(PersonController.deleteCarePathway));

  router.get('/:personId/discharge-checklist', asyncHandler(PersonController.listDischargeChecklist));

router.post('/:personId/discharge-checklist', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createDischargeChecklistSchema), asyncHandler(PersonController.createDischargeChecklist));
router.patch('/discharge-checklist/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateDischargeChecklistSchema), asyncHandler(PersonController.updateDischargeChecklist));
router.delete('/discharge-checklist/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(PersonController.deleteDischargeChecklist));

export default router;
