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
  personId: z.string().uuid().optional().nullable(),
  locationId: z.string().uuid().optional(),
  moneySource: z.enum(['house', 'person']).default('person'),
  paymentMethod: z.string().max(30).optional(),
  category: z.nativeEnum(ExpenseCategory),
  amountPence: z.number().int().positive(),
  description: z.string().max(500).optional(),
  receiptUrl: z.string().url().optional(),
  incurredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const createExpenseSchema = expenseFields.refine(data => data.moneySource === 'house' || !!data.personId, { message: 'A person is required for person money', path: ['personId'] });
const updateExpenseSchema = expenseFields.partial();

const topUpSchema = z.object({
  locationId: z.string().uuid(),
  amountPence: z.number().int().positive(),
  notes: z.string().max(500).optional(),
});

const reconcileSchema = z.object({
  locationId: z.string().uuid(),
  actualBalancePence: z.number().int().min(0),
  notes: z.string().max(500).optional(),
});

const router = Router();
router.use(authenticate);

router.get('/', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(ExpensesController.list));
router.get('/stats', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ExpensesController.stats));
router.get('/petty-cash/balances', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ExpensesController.getBalances));
router.post('/petty-cash/top-up', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(topUpSchema), asyncHandler(ExpensesController.topUp));
router.post('/petty-cash/reconcile', requireRole(UserRole.ORG_ADMIN), validate(reconcileSchema), asyncHandler(ExpensesController.reconcile));
router.get('/petty-cash/transactions', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ExpensesController.getTransactions));
router.post('/', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createExpenseSchema), asyncHandler(ExpensesController.create));
router.get('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(ExpensesController.get));
router.patch('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateExpenseSchema), asyncHandler(ExpensesController.update));
router.delete('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ExpensesController.remove));

export default router;
