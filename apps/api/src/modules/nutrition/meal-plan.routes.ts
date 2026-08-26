import { Router } from 'express';
import { MealPlanController } from './meal-plan.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { UserRole } from '@meticle/shared';

const router = Router();
router.use(authenticate);

// Templates
router.get('/', asyncHandler(MealPlanController.listTemplates));
router.get('/:id', asyncHandler(MealPlanController.getTemplate));
router.post('/', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(MealPlanController.createTemplate));
router.put('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(MealPlanController.updateTemplate));
router.delete('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(MealPlanController.deleteTemplate));
router.post('/:id/clone', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(MealPlanController.cloneTemplate));

// Template items
router.post('/:templateId/items', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(MealPlanController.addItem));
router.put('/items/:itemId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(MealPlanController.updateItem));
router.delete('/items/:itemId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(MealPlanController.deleteItem));

export default router;
