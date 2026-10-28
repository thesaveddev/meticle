import { Router } from 'express';
import { ReportingController } from './reporting.controller';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { UserRole } from '@meticle/shared';

const router = Router();

router.use(authenticate);

router.get('/reports', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ReportingController.listReports));
router.get('/overview', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ReportingController.getOverview));
router.get('/filter-options', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ReportingController.getFilterOptions));
router.get('/data/:reportId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ReportingController.getReportData));
router.get('/export/:reportId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ReportingController.exportReport));

// Custom report builder. Static paths first: '/custom/:id' would otherwise
// swallow 'datasets', 'run' and 'export' as an unknown saved-report id.
const customRole = requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER);
router.get('/custom/datasets', customRole, asyncHandler(ReportingController.getCustomDatasets));
router.get('/custom/recipients', customRole, asyncHandler(ReportingController.listScheduleRecipients));
router.get('/custom', customRole, asyncHandler(ReportingController.listCustomReports));
router.post('/custom/run', customRole, asyncHandler(ReportingController.runCustomReport));
router.post('/custom/export', customRole, asyncHandler(ReportingController.exportCustomReport));
router.post('/custom', customRole, asyncHandler(ReportingController.createCustomReport));
router.get('/custom/:id', customRole, asyncHandler(ReportingController.getCustomReport));
router.put('/custom/:id', customRole, asyncHandler(ReportingController.updateCustomReport));
router.delete('/custom/:id', customRole, asyncHandler(ReportingController.deleteCustomReport));
router.get('/custom/:id/schedules', customRole, asyncHandler(ReportingController.listReportSchedules));
router.post('/custom/:id/schedules', customRole, asyncHandler(ReportingController.createReportSchedule));
router.put('/custom/:id/schedules/:scheduleId', customRole, asyncHandler(ReportingController.updateReportSchedule));
router.get('/custom/:id/schedules/:scheduleId/deliveries', customRole, asyncHandler(ReportingController.listScheduleDeliveries));
router.delete('/custom/:id/schedules/:scheduleId', customRole, asyncHandler(ReportingController.deleteReportSchedule));
router.post('/custom/:id/send-now', customRole, asyncHandler(ReportingController.sendReportScheduleNow));

export default router;
