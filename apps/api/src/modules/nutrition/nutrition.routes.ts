import { Router } from 'express';
import { NutritionController } from './nutrition.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { UserRole } from '@meticle/shared';

const router = Router();
router.use(authenticate);

// Dietary Profile
router.get('/:personId/dietary-profile', asyncHandler(NutritionController.getDietaryProfile));
router.post('/:personId/dietary-profile', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(NutritionController.upsertDietaryProfile));

// Meal Records
router.get('/:personId/meals', asyncHandler(NutritionController.getMeals));
router.get('/:personId/meals/summary', asyncHandler(NutritionController.getDailySummary));
router.get('/:personId/meals/weekly', asyncHandler(NutritionController.getWeeklySummary));
router.get('/meal/:id', asyncHandler(NutritionController.getMeal));
router.post('/:personId/meals', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(NutritionController.createMeal));
router.patch('/meal/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(NutritionController.updateMeal));
router.delete('/meal/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(NutritionController.deleteMeal));

// Meal Items
router.post('/meal/:mealId/items', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(NutritionController.addMealItem));
router.patch('/meal/items/:itemId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(NutritionController.updateMealItem));
router.delete('/meal/items/:itemId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(NutritionController.deleteMealItem));

// Overview (org-wide)
router.get('/overview', asyncHandler(NutritionController.getNutritionOverview));
router.get('/people', asyncHandler(NutritionController.getPeopleWithDietaryInfo));

export default router;
