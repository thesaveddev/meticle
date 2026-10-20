import { Router } from 'express';
import { z } from 'zod';
import { DbsController } from './dbs.controller';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { UserRole } from '@meticle/shared';
import { DbsLevel, DbsRecruitmentDecision, DbsWorkforce } from './dbs.types';

const createDbsSchema = z.object({
  staffId: z.string().uuid(),
  level: z.nativeEnum(DbsLevel),
  workforce: z.nativeEnum(DbsWorkforce),
  costPence: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['clear', 'disclosure', 'cancelled', 'error']),
  certificateNumber: z.string().optional(),
});

// ── DBS Update Service re-checks (docs/DBS_INTEGRATION_PLAN.md phase 3) ──────
//
// `YYYY-MM-DD` and not `z.coerce.date()`: these are calendar days a manager
// types, not instants, and a `Date` would be re-serialised on the way to
// Postgres in whatever timezone the server happens to have — which is how a due
// date moves by a day.
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date in YYYY-MM-DD form');

/**
 * Subscribe — the consent record, and nothing else.
 *
 * `paperCertificateSeenOn` and `identityVerifiedOn` are required because DBS
 * makes them preconditions of a status check, so a subscription without them
 * would be a subscription that can never lawfully be used.
 */
const subscribeUpdateServiceSchema = z.object({
  staffId: z.string().uuid(),
  level: z.nativeEnum(DbsLevel),
  workforce: z.nativeEnum(DbsWorkforce),
  updateServiceId: z.string().min(1).max(100),
  certificateReference: z.string().max(100).optional(),
  certificateIssuedOn: calendarDate.optional(),
  consentGivenOn: calendarDate.optional(),
  consentMethod: z.enum(['written', 'email', 'verbal', 'online_form']),
  paperCertificateSeenOn: calendarDate,
  identityVerifiedOn: calendarDate,
  identityMethod: z.enum(['manual_document_check', 'digital_identity_service']),
  checkIntervalMonths: z.number().int().min(1).max(36).optional(),
  nextCheckDueOn: calendarDate.optional(),
});

/**
 * A recorded status check.
 *
 * The level and workforce are sent on every check rather than read from the
 * subscription, because the employer has to be entitled to the same level and
 * workforce each time it uses the Update Service — an assertion the API cannot
 * make on the manager's behalf.
 */
const recordUpdateServiceCheckSchema = z.object({
  checkedOn: calendarDate.optional(),
  outcome: z.enum(['no_change', 'changed', 'unable_to_check']),
  level: z.nativeEnum(DbsLevel),
  workforce: z.nativeEnum(DbsWorkforce),
  notes: z.string().max(1000).optional(),
  nextCheckDueOn: calendarDate.optional(),
});

const renewalMarkerSchema = z.object({
  // Explicitly nullable so a marker set in error can be cleared.
  renewalDueOn: calendarDate.nullable(),
  note: z.string().max(500).optional(),
});

const completeRenewalSchema = z.object({
  certificateReference: z.string().min(1).max(100),
  certificateIssuedOn: calendarDate,
  nextCheckDueOn: calendarDate.optional(),
});

const withdrawConsentSchema = z.object({
  reason: z.string().min(3).max(500),
});

// ── Certificate metadata (docs/DBS_INTEGRATION_PLAN.md phase 0 items 4–5) ────
//
// `nullable().optional()` rather than `optional()` alone: `undefined` means "leave
// this field alone" and `null` means "clear it", and a mistyped certificate
// reference has to be correctable. Both survive the parse, so the service can
// tell them apart.
const certificateMetadataSchema = z.object({
  certificateNumber: z.string().max(100).nullable().optional(),
  certificateIssuedOn: calendarDate.nullable().optional(),
  recruitmentDecision: z.nativeEnum(DbsRecruitmentDecision).nullable().optional(),
  recruitmentDecisionOn: calendarDate.nullable().optional(),
  renewalDueOn: calendarDate.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const router = Router();

router.use(authenticate);

router.get('/checks', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(DbsController.list));
router.get('/checks/stats', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(DbsController.stats));
router.get('/checks/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(DbsController.get));
router.post('/checks', requireRole(UserRole.ORG_ADMIN), validate(createDbsSchema), asyncHandler(DbsController.create));
router.post('/checks/:id/submit', requireRole(UserRole.ORG_ADMIN), asyncHandler(DbsController.submit));
router.patch('/checks/:id/status', requireRole(UserRole.ORG_ADMIN), validate(updateStatusSchema), asyncHandler(DbsController.updateStatus));
router.post('/checks/:id/poll', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(DbsController.poll));

// The certificate metadata a manager read off the paper certificate. A manager's
// routine work, not an administrative act: the person who saw the certificate is
// the one who has to be able to record what was on it.
router.patch('/checks/:id/certificate', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(certificateMetadataSchema), asyncHandler(DbsController.recordCertificate));

// The retention purge, on demand. ORG_ADMIN only, because it deletes and cannot
// be undone — and because the nightly sweep already does it for everyone.
router.post('/certificates/purge', requireRole(UserRole.ORG_ADMIN), asyncHandler(DbsController.purgeCertificates));

// The Update Service family. `/update-service/stats` is declared before
// `/update-service/:id` so Express does not read "stats" as an id.
router.get('/update-service', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(DbsController.listUpdateService));
router.get('/update-service/stats', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(DbsController.updateServiceStats));
router.get('/update-service/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(DbsController.getUpdateService));

// Recording a check is a manager's routine work, not an administrative act: the
// person who performs the check is the one who has to be able to log it.
router.post('/update-service', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(subscribeUpdateServiceSchema), asyncHandler(DbsController.subscribeUpdateService));
router.post('/update-service/:id/checks', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(recordUpdateServiceCheckSchema), asyncHandler(DbsController.recordUpdateServiceCheck));
router.patch('/update-service/:id/renewal', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(renewalMarkerSchema), asyncHandler(DbsController.setUpdateServiceRenewal));
router.post('/update-service/:id/renewal/complete', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(completeRenewalSchema), asyncHandler(DbsController.completeUpdateServiceRenewal));
router.post('/update-service/:id/withdraw', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(withdrawConsentSchema), asyncHandler(DbsController.withdrawUpdateServiceConsent));

export default router;
