import { Router } from 'express';
import { NutritionController } from './nutrition.controller';
import { MealPlanController } from './meal-plan.controller';
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
router.get('/trend', asyncHandler(NutritionController.get7DayTrend));
router.get('/people', asyncHandler(NutritionController.getPeopleWithDietaryInfo));

// Test data seeding
router.post('/seed-test-data', requireRole(UserRole.ORG_ADMIN), asyncHandler(NutritionController.seedTestNutritionData));

// Meal Plan Templates
router.get('/meal-plans', asyncHandler(MealPlanController.listTemplates));
router.get('/meal-plans/:id', asyncHandler(MealPlanController.getTemplate));
router.post('/meal-plans', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(MealPlanController.createTemplate));
router.put('/meal-plans/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(MealPlanController.updateTemplate));
router.delete('/meal-plans/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(MealPlanController.deleteTemplate));
router.post('/meal-plans/:id/clone', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(MealPlanController.cloneTemplate));

// Meal Plan Items
router.post('/meal-plans/:templateId/items', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(MealPlanController.addItem));
router.put('/meal-plans/items/:itemId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(MealPlanController.updateItem));
router.delete('/meal-plans/items/:itemId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(MealPlanController.deleteItem));

// PDF Export
router.post('/export/meal-plan-pdf', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(NutritionController.exportMealPlanPdf));

export default router;
