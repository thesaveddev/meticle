import { Router } from 'express';
import { z } from 'zod';
import { ExpensesController } from './expenses.controller';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { UserRole } from '@meticle/shared';
import { ExpenseCategory } from './expenses.types';

const expenseFields = z.object({
  personId: z.string().uuid().nullish(),
  locationId: z.string().uuid().nullish(),
  moneySource: z.enum(['house', 'person']).default('person'),
  paymentMethod: z.string().max(30).optional(),
  category: z.nativeEnum(ExpenseCategory),
  amountPence: z.number().int().positive(),
  description: z.string().max(500).optional(),
  receiptUrl: z.string().url().optional(),
  incurredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const createExpenseSchema = expenseFields.refine(data => data.moneySource === 'house' ? Boolean(data.locationId) : Boolean(data.personId), { message: 'Select a location for house funds or a person for person funds', path: ['locationId'] });
const updateExpenseSchema = z.object({
  category: z.nativeEnum(ExpenseCategory).optional(),
  description: z.string().max(500).optional(),
});

const voidExpenseSchema = z.object({
  reason: z.string().min(3, 'Reason is required to void an entry').max(500),
});

const topUpSchema = z.object({
  moneySource: z.enum(['house', 'person']),
  locationId: z.string().uuid().nullish(),
  personId: z.string().uuid().nullish(),
  amountPence: z.number().int().positive(),
  notes: z.string().max(500).optional(),
}).refine(data => data.moneySource === 'house' ? !!data.locationId : !!data.personId, { message: 'Select a location for house funds or a person for person funds' });

const cashCheckSchema = z.object({
  moneySource: z.enum(['house', 'person']),
  locationId: z.string().uuid().nullish(),
  personId: z.string().uuid().nullish(),
  expectedBalancePence: z.number().min(0),
  physicalBalancePence: z.number().min(0),
  checkDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional(),
  escalate: z.boolean().optional(),
  escalationReason: z.string().max(500).optional(),
  handedOverTo: z.string().uuid(),
}).refine(data => data.moneySource === 'house' ? !!data.locationId : !!data.personId, { message: 'Select a location for house funds or person for person funds' });

const reconcileSchema = z.object({
  moneySource: z.enum(['house', 'person']),
  locationId: z.string().uuid().nullish(),
  personId: z.string().uuid().nullish(),
  actualBalancePence: z.number().int().min(0),
  handedOverTo: z.string().uuid(),
  notes: z.string().max(500).optional(),
}).refine(data => data.moneySource === 'house' ? !!data.locationId : !!data.personId, { message: 'Select a location for house funds or a person for person funds' });

const reconciliationReviewSchema = z.object({
  decision: z.enum(['accepted', 'rejected']),
  rejectionReason: z.string().max(500).optional(),
}).refine(data => data.decision !== 'rejected' || Boolean(data.rejectionReason?.trim()), { message: 'A reason is required when rejecting a reconciliation', path: ['rejectionReason'] });

const router = Router();
router.use(authenticate);

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.MANAGER];
const VIEW_ROLES = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER];

router.get('/', requireRole(...VIEW_ROLES), asyncHandler(ExpensesController.list));
router.get('/stats', requireRole(...ADMIN_ROLES), asyncHandler(ExpensesController.stats));
router.get('/petty-cash/balances', requireRole(...ADMIN_ROLES), asyncHandler(ExpensesController.getBalances));
router.post('/petty-cash/top-up', requireRole(...ADMIN_ROLES), validate(topUpSchema), asyncHandler(ExpensesController.topUp));
router.post('/petty-cash/reconcile', requireRole(...ADMIN_ROLES), validate(reconcileSchema), asyncHandler(ExpensesController.reconcile));
router.get('/petty-cash/reconciliations', requireRole(...VIEW_ROLES), asyncHandler(ExpensesController.getReconciliations));
router.post('/petty-cash/reconciliations/:id/review', requireRole(...VIEW_ROLES), validate(reconciliationReviewSchema), asyncHandler(ExpensesController.reviewReconciliation));
router.post('/petty-cash/daily-check', requireRole(...ADMIN_ROLES), validate(cashCheckSchema), asyncHandler(ExpensesController.dailyCashCheck));
router.get('/petty-cash/daily-checks', requireRole(...VIEW_ROLES), asyncHandler(ExpensesController.getDailyCashChecks));
router.post('/petty-cash/daily-checks/:id/accept', requireRole(...VIEW_ROLES), asyncHandler(ExpensesController.acceptDailyCashCheck));
router.get('/report', requireRole(...ADMIN_ROLES), asyncHandler(ExpensesController.report));
router.get('/petty-cash/transactions', requireRole(...ADMIN_ROLES), asyncHandler(ExpensesController.getTransactions));
router.post('/', requireRole(...ADMIN_ROLES), validate(createExpenseSchema), asyncHandler(ExpensesController.create));
router.get('/:id', requireRole(...VIEW_ROLES), asyncHandler(ExpensesController.get));
router.patch('/:id', requireRole(...ADMIN_ROLES), validate(updateExpenseSchema), asyncHandler(ExpensesController.update));
router.put('/:id/void', requireRole(...ADMIN_ROLES), validate(voidExpenseSchema), asyncHandler(ExpensesController.void));

export default router;
