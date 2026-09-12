import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { validate } from '../../shared/middleware/validate.middleware';
import { UserRole } from '@meticle/shared';
import { HomecareController } from './homecare.controller';

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const iso = z.string().datetime({ offset: true });
const managerRoles = [UserRole.ORG_ADMIN, UserRole.MANAGER];
const fieldRoles = [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER];

const packageSchema = z.object({
  person_id: uuid.nullish(),
  name: z.string().trim().min(1).max(255),
  status: z.enum(['draft','active','paused','ended']).optional(),
  funding_type: z.enum(['private','local_authority','nhs','other']).optional(),
  start_date: date.nullish(),
  end_date: date.nullish(),
  weekly_hours: z.number().min(0).max(1000).nullish(),
  hourly_rate_pence: z.number().int().min(0).nullish(),
  client_rate_pence: z.number().int().min(0).nullish(),
  travel_time_paid: z.boolean().optional(),
  mileage_rate_pence: z.number().int().min(0).nullish(),
  notes: z.string().max(5000).nullish(),
});
const packagePatchSchema = packageSchema.partial().omit({ person_id: true });
const planSchema = z.object({
  visit_type: z.enum(['morning','breakfast','lunch','tea','evening','night','routine','medication','custom']),
  label: z.string().trim().min(1).max(255),
  days_of_week: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  duration_minutes: z.number().int().min(1).max(720),
  travel_buffer_minutes: z.number().int().min(0).max(240).optional(),
  required_skills: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  default_staff_id: uuid.nullish(),
});
const generationSchema = z.object({ from: date, to: date });
const availabilitySchema = z.object({ staff_id: uuid, day_of_week: z.number().int().min(0).max(6), start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/), end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/), is_available: z.boolean().optional() });
const disruptionSchema = z.object({ disruption_type: z.enum(['traffic','public_transport','weather','vehicle','client_unavailable','unsafe','other']), severity: z.enum(['low','medium','high']).optional(), delay_minutes: z.number().int().min(0).max(1440).optional(), description: z.string().trim().min(1).max(5000), expected_arrival: iso.nullish() });
const mileagePolicySchema = z.object({ tax_year: z.string().trim().min(4).max(9), vehicle_type: z.enum(['car','motorcycle','bicycle','public_transport','other']), fuel_category: z.enum(['petrol','diesel','hybrid','electric','lpg','not_applicable','other']), rate_pence: z.number().int().min(0), effective_from: date.nullish(), effective_to: date.nullish(), source_label: z.string().max(255).nullish(), is_active: z.boolean().optional() });
const followupSchema = z.object({ followup_type: z.enum(['communication','incident']), channel: z.string().max(30).nullish(), recipient: z.string().max(255).nullish(), outcome: z.enum(['recorded','attempted','completed','no_answer','escalated']).optional(), notes: z.string().trim().min(1).max(5000), incident_id: uuid.nullish() });
const reconciliationSchema = z.object({ status: z.enum(['matched','exception','ignored']), external_reference: z.string().max(255).nullish(), reconciled_gross_pay_pence: z.number().int().min(0).nullish(), note: z.string().max(2000).nullish() });
const exceptionSchema = z.object({
  exception_type: z.enum(['late','missed','cancelled','no_show','other']),
  resolution_note: z.string().max(2000).nullish(),
});
const exportSchema = z.object({ from: date, to: date, provider: z.enum(['sage','xero','quickbooks','brightpay','staffology','generic_csv']).optional() });
const billingPeriodSchema = z.object({ from: date, to: date });
const runIdSchema = z.object({ runId: uuid });
const visitSchema = z.object({
  package_id: uuid,
  visit_plan_id: uuid.nullish(),
  person_id: uuid,
  assigned_staff_id: uuid.nullish(),
  visit_type: z.enum(['morning','breakfast','lunch','tea','evening','night','routine','medication','custom']),
  label: z.string().trim().min(1).max(255),
  scheduled_start: iso,
  scheduled_end: iso,
});
const visitPatchSchema = z.object({
  assigned_staff_id: uuid.nullish(),
  status: z.enum(['scheduled','en_route','checked_in','completed','missed','cancelled']).optional(),
  actual_travel_minutes: z.number().int().min(0).nullish(),
  actual_mileage_miles: z.number().min(0).nullish(),
  mileage_status: z.enum(['not_submitted','submitted','approved','rejected']).optional(),
  late_reason: z.string().max(1000).nullish(),
  visit_notes: z.string().max(5000).nullish(),
});
const executionSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy_meters: z.number().min(0).max(10000).optional(),
  actual_travel_minutes: z.number().int().min(0).optional(),
  actual_mileage_miles: z.number().min(0).optional(),
  note: z.string().max(5000).optional(),
  action_key: z.string().trim().min(8).max(120).optional(),
});
const timesheetSchema = z.object({
  work_minutes: z.number().int().min(0).optional(),
  travel_minutes: z.number().int().min(0).optional(),
  paid_travel_minutes: z.number().int().min(0).optional(),
  mileage_miles: z.number().min(0).optional(),
  mileage_rate_pence: z.number().int().min(0).nullish(),
  hourly_rate_pence: z.number().int().min(0).nullish(),
  gross_pay_pence: z.number().int().min(0).nullish(),
  status: z.enum(['draft','submitted','approved','rejected']).optional(),
  rejection_reason: z.string().max(1000).nullish(),
});

const router = Router();
router.use(authenticate);
router.get('/packages', requireRole(...fieldRoles), asyncHandler(HomecareController.listPackages));
router.post('/packages', requireRole(...managerRoles), validate(packageSchema), asyncHandler(HomecareController.createPackage));
router.patch('/packages/:id', requireRole(...managerRoles), validate(packagePatchSchema), asyncHandler(HomecareController.updatePackage));
router.get('/staff', requireRole(...managerRoles), asyncHandler(HomecareController.listStaff));
router.get('/staff-visits/:staffId', requireRole(...fieldRoles), asyncHandler(HomecareController.getStaffVisits));
router.get('/my-availability', requireRole(...fieldRoles), asyncHandler(HomecareController.getMyAvailability));
router.get('/availability', requireRole(...managerRoles), asyncHandler(HomecareController.listAvailability));
router.post('/availability', requireRole(...fieldRoles), validate(availabilitySchema), asyncHandler(HomecareController.createAvailability));
router.delete('/availability/:id', requireRole(...managerRoles), asyncHandler(HomecareController.deleteAvailability));
router.get('/disruptions', requireRole(...managerRoles), asyncHandler(HomecareController.listDisruptions));
router.get('/mileage-policies', requireRole(...managerRoles), asyncHandler(HomecareController.listMileagePolicies));
router.post('/mileage-policies', requireRole(...managerRoles), validate(mileagePolicySchema), asyncHandler(HomecareController.createMileagePolicy));
router.patch('/mileage-policies/:id', requireRole(...managerRoles), validate(mileagePolicySchema.partial()), asyncHandler(HomecareController.updateMileagePolicy));
router.delete('/mileage-policies/:id', requireRole(...managerRoles), asyncHandler(HomecareController.deleteMileagePolicy));
router.get('/followups', requireRole(...managerRoles), asyncHandler(HomecareController.listFollowups));
router.get('/payroll/reconciliations', requireRole(...managerRoles), asyncHandler(HomecareController.listPayrollReconciliations));

// Swap / Transfer
const swapSchema = z.object({ visit_id: uuid, target_staff_id: uuid.nullish(), target_visit_id: uuid.nullish(), request_type: z.enum(['swap', 'transfer']), message: z.string().max(500).nullish() });
const swapResponseSchema = z.object({ status: z.enum(['accepted', 'rejected']), response_message: z.string().max(500).nullish() });
router.post('/swap-requests', requireRole(...fieldRoles), validate(swapSchema), asyncHandler(HomecareController.createSwapRequest));
router.get('/swap-requests', requireRole(...fieldRoles), asyncHandler(HomecareController.listSwapRequests));
router.patch('/swap-requests/:id/respond', requireRole(...fieldRoles), validate(swapResponseSchema), asyncHandler(HomecareController.respondSwapRequest));
router.get('/notifications', requireRole(...fieldRoles), asyncHandler(HomecareController.getCarerNotifications));
router.post('/notifications/read', requireRole(...fieldRoles), asyncHandler(HomecareController.markNotificationsRead));
router.get('/week-visits', requireRole(...fieldRoles), asyncHandler(HomecareController.getWeekVisits));
router.patch('/payroll/reconciliations/:id', requireRole(...managerRoles), validate(reconciliationSchema), asyncHandler(HomecareController.reconcilePayroll));
router.get('/packages/:packageId/visit-plans', requireRole(...fieldRoles), asyncHandler(HomecareController.listVisitPlans));
router.post('/packages/:packageId/visit-plans', requireRole(...managerRoles), validate(planSchema), asyncHandler(HomecareController.createVisitPlan));
router.post('/visit-plans/:planId/generate', requireRole(...managerRoles), validate(generationSchema), asyncHandler(HomecareController.generateVisits));
router.get('/visits', requireRole(...managerRoles), asyncHandler(HomecareController.listVisits));
router.get('/my-visits', requireRole(...fieldRoles), asyncHandler(HomecareController.myVisits));
router.post('/visits', requireRole(...managerRoles), validate(visitSchema), asyncHandler(HomecareController.createVisit));
router.patch('/visits/:id', requireRole(...managerRoles), validate(visitPatchSchema), asyncHandler(HomecareController.updateVisit));
router.get('/exceptions', requireRole(...managerRoles), asyncHandler(HomecareController.listExceptions));
router.post('/visits/:id/resolve-exception', requireRole(...managerRoles), validate(exceptionSchema), asyncHandler(HomecareController.resolveException));
router.post('/visits/:id/check-in', requireRole(...fieldRoles), validate(executionSchema), asyncHandler(HomecareController.checkIn));
router.post('/visits/:id/check-out', requireRole(...fieldRoles), validate(executionSchema), asyncHandler(HomecareController.checkOut));
router.post('/visits/:id/disruptions', requireRole(...fieldRoles), validate(disruptionSchema), asyncHandler(HomecareController.createDisruption));
router.post('/visits/:id/followups', requireRole(...managerRoles), validate(followupSchema), asyncHandler(HomecareController.createFollowup));
router.post('/visits/:id/offline/:action(check-in|check-out)', requireRole(...fieldRoles), validate(executionSchema), asyncHandler(HomecareController.offlineAction));
router.patch('/disruptions/:id/resolve', requireRole(...managerRoles), asyncHandler(HomecareController.resolveDisruption));
router.get('/timesheets', requireRole(...managerRoles), asyncHandler(HomecareController.listTimesheets));
router.get('/care-plans', requireRole(...managerRoles), asyncHandler(HomecareController.listCarePlans));
router.get('/timesheets/monthly-totals', requireRole(...managerRoles), validate(billingPeriodSchema, 'query'), asyncHandler(HomecareController.getMonthlyCarerTotals));
router.patch('/timesheets/:id', requireRole(...managerRoles), validate(timesheetSchema), asyncHandler(HomecareController.updateTimesheet));
router.get('/payroll/export.csv', requireRole(...managerRoles), validate(exportSchema, 'query'), asyncHandler(HomecareController.exportPayroll));
router.get('/client-billing/runs', requireRole(...managerRoles), asyncHandler(HomecareController.listClientBillingRuns));
router.get('/client-billing/utilisation', requireRole(...managerRoles), validate(billingPeriodSchema, 'query'), asyncHandler(HomecareController.getClientBillingUtilisation));
router.post('/client-billing/runs', requireRole(...managerRoles), validate(billingPeriodSchema), asyncHandler(HomecareController.createClientBillingRun));
router.get('/client-billing/runs/:runId', requireRole(...managerRoles), validate(runIdSchema, 'params'), asyncHandler(HomecareController.getClientBillingRun));
router.get('/client-billing/runs/:runId/lines', requireRole(...managerRoles), validate(runIdSchema, 'params'), asyncHandler(HomecareController.listClientBillingLines));
router.post('/client-billing/runs/:runId/approve', requireRole(...managerRoles), validate(runIdSchema, 'params'), asyncHandler(HomecareController.approveClientBillingRun));
router.post('/client-billing/runs/:runId/void', requireRole(...managerRoles), validate(runIdSchema, 'params'), asyncHandler(HomecareController.voidClientBillingRun));
router.get('/client-billing/runs/:runId/invoice.pdf', requireRole(...managerRoles), validate(runIdSchema, 'params'), asyncHandler(HomecareController.downloadClientInvoicePdf));
router.get('/client-billing/runs/:runId/mtd-export', requireRole(...managerRoles), validate(runIdSchema, 'params'), asyncHandler(HomecareController.getMtdExport));

// Organization location threshold
const thresholdSchema = z.object({ location_threshold_meters: z.number().min(50).max(5000) });
router.patch('/settings/location-threshold', requireRole(...managerRoles), validate(thresholdSchema), asyncHandler(HomecareController.updateLocationThreshold));
router.get('/settings/location-threshold', requireRole(...fieldRoles), asyncHandler(HomecareController.getLocationThreshold));

export default router;
