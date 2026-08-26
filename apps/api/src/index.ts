process.noDeprecation = true;
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import logger from './shared/utils/logger';
import dotenv from 'dotenv';
import { refreshDisposableEmailBlocklist } from './shared/utils/disposableEmail';
import { rateLimit } from './shared/middleware/rateLimit.middleware';
import { correlationId } from './shared/middleware/correlationId';
import { getHttpsOptions } from './shared/https';

import { setupDatabase } from './shared/database/setup';
import authRoutes from './modules/auth/auth.routes';
import orgRoutes from './modules/orgs/org.routes';
import staffRoutes from './modules/staff/staff.routes';
import complianceRoutes from './modules/compliance/compliance.routes';
import schedulingRoutes from './modules/scheduling/scheduling.routes';
import marketplaceRoutes from './modules/marketplace/marketplace.routes';
import reportingRoutes from './modules/reporting/reporting.routes';
import insightsRoutes from './modules/insights/insights.routes';
import personRoutes from './modules/people/people.routes';
import incidentRoutes from './modules/incidents/incidents.routes';
import invitationRoutes from './modules/organization/organization.routes';
import mfaRoutes from './modules/mfa/mfa.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import notificationRoutes from './modules/notifications/notifications.routes';
import permissionRoutes from './modules/permissions/permissions.routes';
import leaveRoutes from './modules/leave/leave.routes';
import chatRoutes from './modules/chat/chat.routes';
import settingsRoutes from './modules/settings/settings.routes';
import billingRoutes from './modules/billing/billing.routes';
import auditRoutes from './modules/audit/audit.routes';
import trainingRoutes from './modules/training/training.routes';
import competencyRoutes from './modules/competency/competency.routes';
import cqcRoutes from './modules/cqc/cqc.routes';
import surveysRoutes, { publicRouter as surveyPublicRoutes } from './modules/surveys/surveys.routes';
import appointmentRoutes from './modules/appointments/appointments.routes';
import policyRoutes from './modules/policies/policies.routes';
import taskRoutes from './modules/tasks/tasks.routes';
import roomCheckRoutes from './modules/room-checks/room-checks.routes';
import mobileRoutes from './modules/mobile/mobile.routes';
import goalRoutes from './modules/goals/goals.routes';
import healthRoutes from './modules/health/health.routes';
import nutritionRoutes from './modules/nutrition/nutrition.routes';
import familyPortalRoutes, { publicRouter as familyPortalPublicRoutes } from './modules/family-portal/familyPortal.routes';
import emedicationRoutes from './modules/emedication/emedication.routes';
import aiRoutes from './modules/ai/ai.routes';
import delegationRoutes from './modules/delegations/delegation.routes';
import agencyRoutes from './modules/agencies/agencies.routes';
import dbsRoutes from './modules/dbs/dbs.routes';
import expensesRoutes from './modules/expenses/expenses.routes';
import platformAdminRoutes from './modules/platform-admin/platform-admin.routes';
import dsptRoutes from './modules/dspt/dspt.routes';
import compliancePortalRoutes from './modules/compliance-portal/compliance-portal.routes';
import shiftAuditRoutes from './modules/shift-audit/shift-audit.routes';
import contactRoutes from './modules/contact/contact.routes';
import eventRoutes from './modules/events/events.routes';
import missionControlRoutes from './modules/mission-control/mission-control.routes';
import { BillingController } from './modules/billing/billing.controller';
import { ComplianceController } from './modules/compliance/compliance.controller';
import { ComplianceNotificationService } from './modules/compliance/compliance.notifications';
import { SettingsController } from './modules/settings/settings.controller';
import { errorHandler, notFoundHandler } from './shared/middleware/error.middleware';
import { authenticate } from './shared/middleware/auth.middleware';
import { asyncHandler } from './shared/middleware/asyncHandler';
import { uploadDir } from './shared/middleware/upload.middleware';
import { rlsMiddleware } from './shared/middleware/rls.middleware';
import { initSocketServer, closeSocketServer } from './shared/socket';
import { setupSwagger } from './shared/swagger';
import { healthCheck } from './shared/database';
import { metricsMiddleware, getMetrics } from './shared/metrics';

dotenv.config();

// Validate critical env vars at startup
const REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
for (const varName of REQUIRED_ENV_VARS) {
  if (!process.env[varName]) {
    logger.error({ varName }, `Missing required environment variable`);
    process.exit(1);
  }
}

// Process-level error handlers
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled Rejection — exiting');
  setTimeout(() => process.exit(1), 1000);
});
process.on('uncaughtException', (err) => {
  logger.fatal(err, 'Uncaught Exception — exiting');
  setTimeout(() => process.exit(1), 1000);
});

// Validate critical secrets before starting
(function validateSecrets() {
  const jwtSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!jwtSecret || jwtSecret.length < 32) {
    logger.fatal('JWT_SECRET must be set and at least 32 characters');
    process.exit(1);
  }
  if (!refreshSecret || refreshSecret.length < 32) {
    logger.fatal('JWT_REFRESH_SECRET must be set and at least 32 characters');
    process.exit(1);
  }

  if (!process.env.FIELD_ENCRYPTION_KEY) {
    logger.warn('FIELD_ENCRYPTION_KEY not set — PII fields (NHS numbers, addresses) stored in plaintext. Required for UK GDPR compliance.');
  }
})();

const app = express();
const httpsOptions = getHttpsOptions();
const httpServer = httpsOptions ? createHttpsServer(httpsOptions, app) : createServer(app);
const port = process.env.PORT || 3001;

// Initialize database
setupDatabase().catch((err) => {
  logger.error(err, 'Failed to setup database');
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      baseUri: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cookieParser());
app.use(correlationId);
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : undefined;

app.use(cors({
  origin: allowedOrigins
    ? (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    : process.env.NODE_ENV === 'production'
      ? false // reject all in production if not configured
      : true, // allow all in development
  credentials: true,
}));
app.use(pinoHttp({
  logger,
  autoLogging: process.env.NODE_ENV === 'production' ? { ignore: (req) => req.url === '/health' } : false,
  genReqId: (req) => (req as any).requestId || (req.headers['x-request-id'] as string) || crypto.randomUUID(),
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} ${res.statusCode} - ${err.message}`,
}));

// Global rate limit for API (auth endpoints have their own per-route limits)
app.use('/api', rateLimit(200, 60_000));
app.use(metricsMiddleware);

// RLS middleware: sets Postgres session variables for Row-Level Security
app.use(rlsMiddleware);

app.post('/billing/webhook', express.raw({ type: 'application/json' }), asyncHandler(BillingController.handleWebhook));
app.use(express.json({ limit: '15mb' }));
app.use('/uploads', express.static('uploads'));
app.get('/files/private/:filename', authenticate, asyncHandler(ComplianceController.servePrivateFile));
app.get('/files/:id', authenticate, asyncHandler(ComplianceController.serveFile));

// Routes
app.use('/auth', authRoutes);
app.use('/mfa', mfaRoutes);
app.use('/organizations', orgRoutes);
app.use('/organizations', invitationRoutes);
app.use('/staff', staffRoutes);
app.use('/compliance', complianceRoutes);
app.use('/shifts', schedulingRoutes);
app.use('/marketplace', marketplaceRoutes);
app.use('/reporting', reportingRoutes);
app.use('/insights', insightsRoutes);
app.use('/people', personRoutes);
app.use('/incidents', incidentRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/notifications', notificationRoutes);
app.use('/permissions', permissionRoutes);
app.use('/training', trainingRoutes);
app.use('/competency', competencyRoutes);
app.use('/cqc', cqcRoutes);
app.use('/surveys', surveysRoutes);
app.use('/api/surveys', surveyPublicRoutes);
app.use('/dspt', dsptRoutes); // no auth — public survey form submission
app.use('/compliance-portal', compliancePortalRoutes);
app.use('/leave', leaveRoutes);
app.use('/settings', settingsRoutes);
app.use('/chat', chatRoutes);
app.use('/billing', billingRoutes);
app.use('/audit', auditRoutes);
app.use('/appointments', appointmentRoutes);
app.use('/policies', policyRoutes);
app.use('/emedication', emedicationRoutes);
app.use('/goals', goalRoutes);
app.use('/ai', aiRoutes);
app.use('/family-portal', familyPortalRoutes);
app.use('/api/family-portal', familyPortalPublicRoutes);
app.use('/delegations', delegationRoutes);
app.use('/agencies', agencyRoutes);
app.use('/dbs', dbsRoutes);
app.use('/expenses', expensesRoutes);
app.use('/mission-control', missionControlRoutes);
app.use('/platform-admin', platformAdminRoutes);
// Health checks — must be BEFORE /health routes to avoid auth middleware clash
app.get('/health/live', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/health/ready', asyncHandler(async (req: Request, res: Response) => {
  const dbOk = await healthCheck();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    database: dbOk ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
}));

app.use('/health', healthRoutes);
app.use('/nutrition', nutritionRoutes);
app.use('/tasks', taskRoutes);
app.use('/room-checks', roomCheckRoutes);
app.use('/mobile', mobileRoutes);
app.use('/shift-audit', shiftAuditRoutes);
app.use('/events', eventRoutes);
app.use('/contact', contactRoutes); // public — website contact form

// Prometheus metrics — restricted to localhost/internal IPs in production
app.get('/metrics', asyncHandler(async (req: Request, res: Response) => {
  const metricsSecret = process.env.METRICS_SECRET;
  if (metricsSecret) {
    const token = req.query.token || req.headers['x-metrics-token'];
    if (token !== metricsSecret) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }
  res.set('Content-Type', 'text/plain');
  res.end(await getMetrics());
}));

// Swagger docs
setupSwagger(app);

// Socket.io
initSocketServer(httpServer).catch((err) => {
  logger.warn({ err }, 'Socket.io init (non-fatal)');
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Refresh the disposable email blocklist at startup and every 24h
refreshDisposableEmailBlocklist().catch(() => {});
setInterval(() => refreshDisposableEmailBlocklist().catch(() => {}), 24 * 60 * 60 * 1000);

httpServer.listen(port, () => {
  logger.info({ port, nodeEnv: process.env.NODE_ENV }, `Meticle API running on port ${port}`);
});

// Graceful shutdown
function shutdown(signal: string) {
  logger.warn({ signal }, 'Shutting down gracefully...');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    closeSocketServer().then(() => {
      import('./shared/database').then(({ default: pool }) => {
        pool.end().then(() => {
          logger.info('Database pool closed');
          import('./shared/redis').then(({ closeRedis }) => {
            closeRedis();
            process.exit(0);
          }).catch(() => process.exit(0));
        });
      });
    }).catch(() => process.exit(0));
  });
  // Force exit after 10s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Check for expired delegations every 10 minutes
setInterval(() => SettingsController.expireDelegations(), 600_000);
SettingsController.expireDelegations();

// Run compliance expiry checks every 6 hours (delayed on startup to avoid deadlock with migrations)
const COMPLIANCE_CHECK_INTERVAL = 6 * 60 * 60 * 1000;
setTimeout(() => {
  ComplianceNotificationService.runAllChecksForAllOrgs().catch(err => logger.error(err, 'Compliance startup check failed'));
  setInterval(() => ComplianceNotificationService.runAllChecksForAllOrgs(), COMPLIANCE_CHECK_INTERVAL);
}, 10_000);

// Run shift-start notifications every 5 minutes
import { SchedulingNotificationService } from './modules/scheduling/scheduling.notifications';
const SHIFT_START_NOTIFICATION_INTERVAL = 5 * 60 * 1000; // 5 minutes
setInterval(() => {
  SchedulingNotificationService.sendShiftStartNotifications()
    .then(result => { if (result.sent > 0) logger.info({ sent: result.sent, shifts: result.shifts }, 'Shift-start notifications sent') })
    .catch(err => logger.error(err, 'Shift-start notifications failed'));
}, SHIFT_START_NOTIFICATION_INTERVAL);

// Check for unclaimed shifts every 15 minutes
setInterval(() => {
  SchedulingNotificationService.checkUnclaimedShifts()
    .then(result => { if (result.notified > 0) logger.info({ notified: result.notified }, 'Unclaimed shift reminders sent') })
    .catch(err => logger.error(err, 'Unclaimed shift check failed'));
}, 15 * 60 * 1000);

// Send daily compliance digests to location managers (every hour; in-memory tracker enforces 24h)
setInterval(() => {
  ComplianceNotificationService.sendComplianceDigests()
    .then(count => { if (count > 0) logger.info({ orgs: count }, 'Compliance digest check complete') })
    .catch(err => logger.error(err, 'Compliance digest check failed'));
}, 60 * 60 * 1000);

// Scheduled evidence pack generation (every 6 hours; checks day-of-week/month per org)
setInterval(() => {
  ComplianceNotificationService.sendScheduledEvidencePacks()
    .catch(err => logger.error(err, 'Scheduled evidence pack generation failed'));
}, 6 * 60 * 60 * 1000);

// Overdue review notifications — daily at 7 AM
import { ReviewNotificationService } from './modules/reviews/review-notifications.service';
let lastReviewCheckDate = '';
function checkOverdueReviews() {
  const now = new Date();
  if (now.getHours() === 7) {
    const today = now.toISOString().slice(0, 10);
    if (lastReviewCheckDate !== today) {
      lastReviewCheckDate = today;
      ReviewNotificationService.checkOverdueReviews()
        .then(count => { if (count > 0) logger.info({ count, date: today }, 'Overdue review notifications sent'); })
        .catch(err => logger.error(err, 'Overdue review check failed'));
    }
  }
}
setInterval(checkOverdueReviews, 5 * 60 * 1000);

// Subscription expiry reminder check (every 12 hours — sends at 7d, 3d, 1d, and expiry/win-back milestones)
import { checkSubscriptionExpirations } from './shared/utils/trial-reminders';
setTimeout(() => {
  checkSubscriptionExpirations().catch(err => logger.error(err, 'Subscription reminder check failed'));
  setInterval(() => checkSubscriptionExpirations().catch(err => logger.error(err, 'Subscription reminder check failed')), 12 * 60 * 60 * 1000);
}, 15_000);

// Daily shift audit — send location managers a summary email at 7pm (19:00)
import { ShiftAuditService } from './modules/shift-audit/shift-audit.service';
let lastShiftAuditDate = '';
function checkShiftAudit() {
  const now = new Date();
  if (now.getHours() === 19) {
    const today = now.toISOString().slice(0, 10);
    if (lastShiftAuditDate !== today) {
      lastShiftAuditDate = today;
      ShiftAuditService.sendDailyAuditEmails(today)
        .then(count => { if (count > 0) logger.info({ count, date: today }, 'Daily shift audit emails sent'); })
        .catch(err => logger.error(err, 'Daily shift audit failed'));
    }
  }
}
setInterval(checkShiftAudit, 5 * 60 * 1000);

// Late medication alerts — email on-duty staff when scheduled administrations go overdue (per-org delay/toggle)
import { MedicationAlertService } from './modules/emedication/medication-alert.service';
setInterval(() => {
  MedicationAlertService.sendLateMedAlerts()
    .then(count => { if (count > 0) logger.info({ emails: count }, 'Late medication alert emails sent'); })
    .catch(err => logger.error(err, 'Late medication alert check failed'));
}, 5 * 60 * 1000);

// Alert org admins about locations with no manager (every 6 hours, plus on location mutations)
const LOCATION_COVERAGE_INTERVAL = 6 * 60 * 60 * 1000;
setTimeout(() => {
  SettingsController.checkLocationManagerCoverage()
    .then(count => { if (count > 0) logger.info({ notified: count }, 'Location manager coverage alerts sent'); })
    .catch(err => logger.error(err, 'Location manager coverage check failed'));
  setInterval(() => {
    SettingsController.checkLocationManagerCoverage()
      .then(count => { if (count > 0) logger.info({ notified: count }, 'Location manager coverage alerts sent'); })
      .catch(err => logger.error(err, 'Location manager coverage check failed'));
  }, LOCATION_COVERAGE_INTERVAL);
}, 30_000);

// Start email queue processor
import { EmailQueue } from './shared/utils/email.queue';
EmailQueue.startProcessor();

// Start the domain event outbox worker
import { EventWorker } from './modules/events/events.worker';
import { registerProductionConsumers } from './modules/events/consumers/register';
registerProductionConsumers();
EventWorker.start();

export default app;

