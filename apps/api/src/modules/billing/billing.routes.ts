import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { BillingController } from './billing.controller';
import { UserRole } from '@meticle/shared';
import { updatePlanSchema, addPaymentMethodSchema, createSetupIntentSchema, updateBillingConfigSchema } from '../../shared/validation/schemas';

const router = Router();

router.use(authenticate);

// Read routes (any authenticated user)
router.get('/subscription', asyncHandler(BillingController.getSubscription));
router.get('/invoices', asyncHandler(BillingController.getInvoices));
router.get('/invoices/:id/download', asyncHandler(BillingController.downloadInvoice));
router.get('/payment-methods', asyncHandler(BillingController.getPaymentMethods));
router.post('/create-setup-intent', requireRole(UserRole.ORG_ADMIN), validate(createSetupIntentSchema), asyncHandler(BillingController.createSetupIntent));

// Mutation routes (ORG_ADMIN only)
router.patch('/subscription', requireRole(UserRole.ORG_ADMIN), validate(updatePlanSchema), asyncHandler(BillingController.updatePlan));
router.post('/payment-methods', requireRole(UserRole.ORG_ADMIN), validate(addPaymentMethodSchema), asyncHandler(BillingController.addPaymentMethod));
router.patch('/payment-methods/:id/default', requireRole(UserRole.ORG_ADMIN), asyncHandler(BillingController.setDefaultPaymentMethod));
router.delete('/payment-methods/:id', requireRole(UserRole.ORG_ADMIN), asyncHandler(BillingController.deletePaymentMethod));
router.post('/retry-payment', requireRole(UserRole.ORG_ADMIN), asyncHandler(BillingController.retryPayment));

// Add-ons
router.get('/addons', asyncHandler(BillingController.getAddons));
router.patch('/addons', requireRole(UserRole.ORG_ADMIN), asyncHandler(BillingController.updateAddons));

// Billing configuration (pricing, mileage, payroll)
router.get('/pricing-config', requireRole(UserRole.ORG_ADMIN), asyncHandler(BillingController.getPricingConfig));
router.patch('/pricing-config', requireRole(UserRole.ORG_ADMIN), validate(updateBillingConfigSchema), asyncHandler(BillingController.updatePricingConfig));
router.get('/mileage-rates', requireRole(UserRole.ORG_ADMIN), asyncHandler(BillingController.getMileageRates));
router.patch('/mileage-rates', requireRole(UserRole.ORG_ADMIN), asyncHandler(BillingController.updateMileageRates));

// Stripe price diagnostics (ORG_ADMIN only — reveals configured price IDs and amounts)
router.get('/stripe-price-config', requireRole(UserRole.ORG_ADMIN), asyncHandler(BillingController.getStripePriceConfig));

export default router;
