import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { BillingController } from './billing.controller';
import { UserRole } from '@caredesk/shared';
import { updatePlanSchema, addPaymentMethodSchema, createSetupIntentSchema } from '../../shared/validation/schemas';

const router = Router();

router.use(authenticate);

// Read routes (any authenticated user)
router.get('/subscription', asyncHandler(BillingController.getSubscription));
router.get('/invoices', asyncHandler(BillingController.getInvoices));
router.get('/payment-methods', asyncHandler(BillingController.getPaymentMethods));
router.post('/create-setup-intent', requireRole(UserRole.ORG_ADMIN), validate(createSetupIntentSchema), asyncHandler(BillingController.createSetupIntent));

// Mutation routes (ORG_ADMIN only)
router.patch('/subscription', requireRole(UserRole.ORG_ADMIN), validate(updatePlanSchema), asyncHandler(BillingController.updatePlan));
router.post('/payment-methods', requireRole(UserRole.ORG_ADMIN), validate(addPaymentMethodSchema), asyncHandler(BillingController.addPaymentMethod));
router.patch('/payment-methods/:id/default', requireRole(UserRole.ORG_ADMIN), asyncHandler(BillingController.setDefaultPaymentMethod));
router.delete('/payment-methods/:id', requireRole(UserRole.ORG_ADMIN), asyncHandler(BillingController.deletePaymentMethod));
router.post('/seed-invoices', requireRole(UserRole.ORG_ADMIN), asyncHandler(BillingController.seedInvoices));

// Add-ons
router.get('/addons', asyncHandler(BillingController.getAddons));
router.patch('/addons', requireRole(UserRole.ORG_ADMIN), asyncHandler(BillingController.updateAddons));

export default router;
