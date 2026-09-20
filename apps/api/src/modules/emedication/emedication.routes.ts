import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { validate } from '../../shared/middleware/validate.middleware';
import { EMedicationController } from './emedication.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { requireSupportedLivingOnly } from '../../shared/middleware/requireServiceType';
import { UserRole } from '@meticle/shared';
import pool from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import {
  createMedicationRecordSchema,
  updateMedicationRecordSchema,
  addMedicationItemSchema,
  updateMedicationItemSchema,
  logAdministrationSchema,
  updateAdministrationSchema,
  createStockItemSchema,
  updateStockItemSchema,
  createDeliverySchema,
  createDailyCountSchema,
  upsertDailyCountItemSchema,
  upsertDailyCountSchema,
  toggleMedicationCompetenceSchema,
  ensureMonthlyMarSchema,
} from '../../shared/validation/schemas';

const router = Router();

router.use(authenticate);
router.use(requireSupportedLivingOnly);

// Medication support is available by default to supported-living/residential
// organisations. Domiciliary providers must explicitly enable it because it
// changes the care workflow, permissions, training, and audit expectations.
router.use(asyncHandler(async (req, _res, next) => {
  const result = await pool.query('SELECT service_types, care_capabilities FROM organizations WHERE id = $1', [req.user!.organizationId]);
  const types: string[] = result.rows[0]?.service_types || [];
  const isDomiciliary = types.some(type => ['domiciliary', 'live_in'].includes(type));
  const enabled = result.rows[0]?.care_capabilities?.medication_support === true;
  if (isDomiciliary && !enabled) throw new AppError(403, 'Medication support is not enabled for this domiciliary organisation');
  next();
}));

// ── Read routes — any authenticated user (CARE_WORKER can view) ──
router.get('/records', asyncHandler(EMedicationController.listRecords));
router.get('/records/:id', asyncHandler(EMedicationController.getRecord));
router.get('/records/:recordId/chart', asyncHandler(EMedicationController.getMarChart));
router.get('/items/:itemId/administrations', asyncHandler(EMedicationController.getAdministrations));
router.get('/overdue', asyncHandler(EMedicationController.getOverdue));
router.get('/overdue/count', asyncHandler(EMedicationController.getOverdueCount));

// ── Administration — CARE_WORKER can log ──
router.post('/administrations', validate(logAdministrationSchema), asyncHandler(EMedicationController.logAdministration));
router.patch('/administrations/:adminId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateAdministrationSchema), asyncHandler(EMedicationController.updateAdministration));

// ── Management — ORG_ADMIN / MANAGER only ──
router.post('/records', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createMedicationRecordSchema), asyncHandler(EMedicationController.createRecord));
router.patch('/records/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateMedicationRecordSchema), asyncHandler(EMedicationController.updateRecord));
router.delete('/records/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(EMedicationController.deleteRecord));

router.post('/records/:recordId/items', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(addMedicationItemSchema), asyncHandler(EMedicationController.addItem));
router.patch('/items/:itemId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateMedicationItemSchema), asyncHandler(EMedicationController.updateItem));
router.delete('/items/:itemId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(EMedicationController.deleteItem));

router.post('/ensure-monthly-mar', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(ensureMonthlyMarSchema), asyncHandler(EMedicationController.ensureMonthlyMar));
router.post('/archive-previous', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(EMedicationController.archivePreviousMars));

router.post('/records/:recordId/import-from-previous', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(EMedicationController.importFromPreviousMonth));

// ── Audit Trail — managers & admins only ──
router.get('/audit-logs', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(EMedicationController.getAuditLogs));

// ── Stock / Inventory — CARE_WORKER can view, add and amend ──
router.get('/stock', asyncHandler(EMedicationController.listStock));
router.post('/stock', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(createStockItemSchema), asyncHandler(EMedicationController.createStock));
router.patch('/stock/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(updateStockItemSchema), asyncHandler(EMedicationController.updateStock));
router.patch('/stock/:id/archive', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(z.object({})), asyncHandler(EMedicationController.archiveStock));
router.delete('/stock/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(EMedicationController.deleteStock));

// ── Deliveries — CARE_WORKER can view and log ──
router.get('/deliveries', asyncHandler(EMedicationController.listDeliveries));
router.get('/deliveries/:id', asyncHandler(EMedicationController.getDelivery));
router.post('/deliveries', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(createDeliverySchema), asyncHandler(EMedicationController.createDelivery));
router.patch('/deliveries/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(createDeliverySchema), asyncHandler(EMedicationController.updateDelivery));
router.delete('/deliveries/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(EMedicationController.deleteDelivery));

// ── Staff medication competence toggle ──
router.patch('/staff/:staffProfileId/medication-competence', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(toggleMedicationCompetenceSchema), asyncHandler(EMedicationController.toggleMedicationCompetence));

// ── Daily Counts — CARE_WORKER can view and log ──
router.get('/daily-counts/medications', asyncHandler(EMedicationController.getMedicationsForDailyCount));
router.get('/daily-counts', asyncHandler(EMedicationController.listDailyCounts));
router.post('/daily-counts', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(createDailyCountSchema), asyncHandler(EMedicationController.createDailyCount));
router.post('/daily-counts/upsert', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(upsertDailyCountSchema), asyncHandler(EMedicationController.upsertDailyCount));

// ── Daily Count Items (per-medication) ──
router.get('/records/:recordId/medication-quantities', asyncHandler(EMedicationController.getMedicationQuantitiesForCount));
router.get('/daily-counts/:dailyCountId/items', asyncHandler(EMedicationController.listDailyCountItems));
router.post('/daily-counts/items', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), validate(upsertDailyCountItemSchema), asyncHandler(EMedicationController.upsertDailyCountItem));

// ── Stock Adjustments — CARE_WORKER can log, history is viewable by all ──
router.get('/stock/:stockItemId/adjustments', asyncHandler(EMedicationController.listStockAdjustments));
router.post('/stock/:stockItemId/adjustments', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(EMedicationController.createStockAdjustment));

export default router;
