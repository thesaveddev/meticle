process.noDeprecation = true;
import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import logger from './shared/utils/logger';
import { assertFieldEncryptionConfigured } from './shared/utils/encryption'
import { corsOrigin, resolveAllowedOrigins } from './shared/middleware/corsOrigin';
import dotenv from 'dotenv';
import { refreshDisposableEmailBlocklist } from './shared/utils/disposableEmail';
import { rateLimit } from './shared/middleware/rateLimit.middleware';
import { correlationId } from './shared/middleware/correlationId';
import { getHttpsOptions } from './shared/https';
import { senderDomain, misalignedSenders as senderAlignmentFailures } from './shared/utils/email.service';

import { setupDatabase } from './shared/database/setup';
import { closeDatabasePools } from './shared/database';
import { EmailQueue } from './shared/utils/email.queue';
import { EventWorker } from './modules/events/events.worker';
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
import incidentFormRoutes from './modules/incident-forms/incident-forms.routes';
import incidentSeverityRoutes from './modules/incident-severity/incident-severity.routes';
import incidentWorkflowRoutes from './modules/incident-workflow/incident-workflow.routes';
import invitationRoutes from './modules/organization/organization.routes';
import mfaRoutes from './modules/mfa/mfa.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import notificationRoutes from './modules/notifications/notifications.routes';
import pushRoutes from './modules/notifications/push.routes';
import emailUnsubscribeRoutes from './modules/notifications/email-unsubscribe.routes';
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
import familyFeedbackRoutes, { publicRouter as familyFeedbackPublicRoutes } from './modules/family-portal/familyFeedback.routes';
import emedicationRoutes from './modules/emedication/emedication.routes';
import aiRoutes from './modules/ai/ai.routes';
import delegationRoutes from './modules/delegations/delegation.routes';
import agencyRoutes from './modules/agencies/agencies.routes';
import dbsRoutes from './modules/dbs/dbs.routes';
import expensesRoutes from './modules/expenses/expenses.routes';
import platformAdminRoutes from './modules/platform-admin/platform-admin.routes';
import dsptRoutes from './modules/dspt/dspt.routes';
import compliancePortalRoutes from './modules/compliance-portal/compliance-portal.routes';
import bodyMapRoutes from './modules/body-map/bodyMap.routes';
import shiftAuditRoutes from './modules/shift-audit/shift-audit.routes';
import contactRoutes from './modules/contact/contact.routes';
import eventRoutes from './modules/events/events.routes';
import missionControlRoutes from './modules/mission-control/mission-control.routes';
import homecareRoutes, { publicInvoiceRouter, publicEmailDsnRouter } from './modules/homecare/homecare.routes';
import supervisionRoutes from './modules/supervisions/supervisions.routes';
import { BillingController } from './modules/billing/billing.controller';
import { ComplianceController } from './modules/compliance/compliance.controller';
import { ComplianceNotificationService } from './modules/compliance/compliance.notifications';
import { SettingsController } from './modules/settings/settings.controller';
import { errorHandler, notFoundHandler } from './shared/middleware/error.middleware';
import { authenticate } from './shared/middleware/auth.middleware';
import { asyncHandler } from './shared/middleware/asyncHandler';
import { rlsMiddleware } from './shared/middleware/rls.middleware';
import { requireCareOrganisation, requireSupportedLivingOnly, requireDomiciliaryOnly, requireOpenCallAccess } from './shared/middleware/requireServiceType';
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

  // Fails the boot rather than warning. A missing key used to degrade every
  // encrypted field to plaintext with nothing but this line, which is how T0-15
  // came to believe the cipher was working and only the variable was absent.
  try {
    assertFieldEncryptionConfigured();
  } catch (err) {
    logger.fatal(`PII field encryption is not usable: ${(err as Error).message}`);
    process.exit(1);
  }
})();

const app = express();
// One trusted hop: nginx (compose) terminates the edge and sets X-Forwarded-For.
// Without this, req.ip is always the proxy's address — per-IP rate limits treat
// every client as one, and audit logs record the proxy instead of the caller.
app.set('trust proxy', 1);
const httpsOptions = getHttpsOptions();
const httpServer = httpsOptions ? createHttpsServer(httpsOptions, app) : createServer(app);
const port = process.env.PORT || 3001;
let databaseReady = false;

// Do not serve application traffic until schema setup and migrations have completed.
// A failed migration is a startup failure, not a degraded application state.
const databaseReadyPromise = setupDatabase()
  .then(() => {
    databaseReady = true;
    logger.info('Database is ready; application traffic enabled');
  })
  .catch((err) => {
    logger.fatal(err, 'Failed to setup database; refusing to serve traffic');
    process.exit(1);
    throw err;
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
app.use(cors({
  // Policy lives in `shared/middleware/corsOrigin.ts` so it can be tested
  // without booting a database. A rejected origin must not be a thrown Error:
  // `cors` forwards that to the error handler, which answers 500 for what is a
  // normal, expected lack of permission — see the module for the production
  // evidence. `callback(null, false)` is the correct rejection.
  origin: corsOrigin(resolveAllowedOrigins()),
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

// Keep liveness available while the database is starting, but never allow an
// application request to race migrations or use a partially initialized schema.
app.use((req, res, next) => {
  if (!databaseReady && req.path !== '/health/live' && req.path !== '/health/ready') {
    return res.status(503).json({
      statusCode: 503,
      code: 'STARTING_UP',
      message: 'Service is starting. Please try again shortly.',
    });
  }
  next();
});

// Health probes must remain useful while dependencies are unavailable. They do
// not need a request-scoped RLS client.
app.use((req, _res, next) => {
  if (req.path === '/health/live' || req.path === '/health/ready' || req.path === '/metrics') {
    return next();
  }
  return rlsMiddleware(req, _res, next);
});

app.post('/billing/webhook', express.raw({ type: 'application/json' }), asyncHandler(BillingController.handleWebhook));
app.use('/homecare/email/dsn-callback', express.raw({ type: 'application/json' }), publicEmailDsnRouter);
app.use(express.json({ limit: '15mb' }));
app.get('/files/private/:filename', authenticate, asyncHandler(ComplianceController.servePrivateFile));
app.get('/files/:id', authenticate, asyncHandler(ComplianceController.serveFile));

// Routes
app.use('/auth', authRoutes);
app.use('/mfa', mfaRoutes);
app.use('/organizations', orgRoutes);
app.use('/organizations', invitationRoutes);
app.use('/staff', staffRoutes);
app.use('/compliance', complianceRoutes);
app.use('/shifts', authenticate, requireOpenCallAccess, schedulingRoutes);
app.use('/marketplace', marketplaceRoutes);
app.use('/reporting', reportingRoutes);
app.use('/insights', insightsRoutes);
app.use('/people', authenticate, requireCareOrganisation, personRoutes);
app.use('/incidents', authenticate, requireCareOrganisation, incidentRoutes);
app.use('/incident-forms', authenticate, requireCareOrganisation, incidentFormRoutes);
app.use('/incident-severity', authenticate, requireCareOrganisation, incidentSeverityRoutes);
app.use('/incident-workflow', authenticate, requireCareOrganisation, incidentWorkflowRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/notifications', notificationRoutes);
app.use('/notifications/push', pushRoutes);
// Public: an unsubscribe link has to work without a session to be a real way out.
app.use('/email', emailUnsubscribeRoutes);
app.use('/permissions', permissionRoutes);
app.use('/training', trainingRoutes);
app.use('/competency', competencyRoutes);
app.use('/cqc', cqcRoutes);
app.use('/surveys', surveysRoutes);
app.use('/api/surveys', surveyPublicRoutes);
app.use('/dspt', dsptRoutes); // no auth — public survey form submission
app.use('/compliance-portal', compliancePortalRoutes);
app.use('/leave', authenticate, requireCareOrganisation, leaveRoutes);
app.use('/settings', settingsRoutes);
app.use('/chat', chatRoutes);
app.use('/billing', billingRoutes);
app.use('/audit', auditRoutes);
app.use('/appointments', authenticate, requireSupportedLivingOnly, appointmentRoutes);
app.use('/policies', policyRoutes);
app.use('/emedication', authenticate, requireSupportedLivingOnly, emedicationRoutes);
app.use('/goals', authenticate, requireCareOrganisation, goalRoutes);
app.use('/ai', aiRoutes);
app.use('/family-portal', familyPortalRoutes);
app.use('/api/family-portal', familyPortalPublicRoutes);
app.use('/family-feedback', familyFeedbackRoutes);
app.use('/api/family-feedback', familyFeedbackPublicRoutes);
app.use('/api/client-invoices', publicInvoiceRouter);
app.use('/delegations', delegationRoutes);
app.use('/agencies', authenticate, requireSupportedLivingOnly, agencyRoutes);
app.use('/dbs', dbsRoutes);
app.use('/expenses', authenticate, requireSupportedLivingOnly, expensesRoutes);
app.use('/mission-control', missionControlRoutes);
app.use('/platform-admin', platformAdminRoutes);
// Health checks — must be BEFORE /health routes to avoid auth middleware clash
app.get('/health/live', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/health/email', async (req: Request, res: Response) => {
  const healthSecret = process.env.HEALTH_EMAIL_SECRET;
  if (!healthSecret || req.headers['x-health-secret'] !== healthSecret) {
    return res.status(404).json({ statusCode: 404, message: 'Not Found' });
  }
  const configured = !!(process.env.SMTP_HOST && process.env.SMTP_USER);
  let queueStats: Record<string, any> | { error: string } | null = null;
  try {
    const { query } = await import('./shared/database');
    const result = await query(
      `SELECT status, COUNT(*)::int as count FROM email_queue GROUP BY status`
    );
    const stats: Record<string, any> = {};
    for (const row of result.rows) {
      stats[row.status] = row.count;
    }
    const failed = await query(
      `SELECT id, to_email, subject, error_message, retry_count, created_at FROM email_queue WHERE status = 'failed' ORDER BY created_at DESC LIMIT 5`
    );
    stats.recent_failures = failed.rows;
    queueStats = stats;
  } catch {
    queueStats = { error: 'Could not query email_queue table' };
  }
  res.json({
    configured,
    queue: queueStats,
    timestamp: new Date().toISOString(),
  });
});
app.get('/health/ready', asyncHandler(async (req: Request, res: Response) => {
  const dbOk = databaseReady && await healthCheck();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    database: dbOk ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
}));

// Scheduled-job heartbeats, on the same unauthenticated footing as `/health/ready`
// because the monitor that polls it (`monitor/health_check.py`) has no token. It
// reports job names, timestamps and summaries only — platform operations metadata, never
// a provider's data — and answers 200 even when a job is late, because a health endpoint
// that fails for a stale nightly job would restart containers rather than tell anybody
// about the job.
app.get('/health/jobs', asyncHandler(async (_req: Request, res: Response) => {
  const jobs = await readJobHeartbeats();
  const stale = jobs.filter(job => job.stale);
  res.json({
    status: stale.length === 0 ? 'ok' : 'stale',
    stale: stale.map(job => ({
      job: job.job_name,
      description: job.job_name in EXPECTED_JOB_CADENCE ? EXPECTED_JOB_CADENCE[job.job_name].description : null,
      last_completed_at: job.last_completed_at,
      last_success_at: job.last_success_at,
      age_minutes: job.age_minutes,
      max_age_minutes: job.max_age_minutes,
      last_error: job.last_error,
    })),
    jobs,
    timestamp: new Date().toISOString(),
  });
}));

app.use('/health', authenticate, requireCareOrganisation, healthRoutes);
app.use('/nutrition', authenticate, requireSupportedLivingOnly, nutritionRoutes);
app.use('/body-map', bodyMapRoutes);
app.use('/tasks', authenticate, requireSupportedLivingOnly, taskRoutes);
app.use('/room-checks', authenticate, requireSupportedLivingOnly, roomCheckRoutes);
app.use('/mobile', mobileRoutes);
app.use('/shift-audit', shiftAuditRoutes);
app.use('/events', eventRoutes);
app.use('/contact', contactRoutes); // public — website contact form
app.use('/homecare', authenticate, requireDomiciliaryOnly, homecareRoutes); // Phase 2 domiciliary-care operations
app.use('/supervisions', supervisionRoutes);
// chat routes already registered above

// Prometheus metrics — restricted to localhost/internal IPs in production
app.get('/metrics', asyncHandler(async (req: Request, res: Response) => {
  const metricsSecret = process.env.METRICS_SECRET;
  if (process.env.NODE_ENV === 'production' && !metricsSecret) {
    res.status(404).json({ statusCode: 404, message: 'Not Found' });
    return;
  }
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

// Swagger docs. The production guard is inside setupSwagger itself, so it
// cannot be bypassed by a future call site. Off unless SWAGGER_ENABLED=true.
setupSwagger(app);
if (process.env.NODE_ENV === 'production' && process.env.SWAGGER_ENABLED !== 'true') {
  logger.info('Swagger disabled in production. Set SWAGGER_ENABLED=true to expose it deliberately.');
}

// Socket.io — initialize only after migrations have completed.
databaseReadyPromise.then(() => initSocketServer(httpServer)).catch((err) => {
  logger.warn({ err }, 'Socket.io init (non-fatal)');
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Refresh the disposable email blocklist at startup and every 24h
refreshDisposableEmailBlocklist().catch(() => {});
const disposableEmailRefreshTimer = setInterval(() => refreshDisposableEmailBlocklist().catch(() => {}), 24 * 60 * 60 * 1000);
disposableEmailRefreshTimer.unref();

databaseReadyPromise.then(() => {
  httpServer.listen(port, () => {
    logger.info({ port, nodeEnv: process.env.NODE_ENV }, `Meticle API running on port ${port}`);
  });
});

// Graceful shutdown. Every timer/worker and both database pools must stop so a
// rolling deploy does not leave open handles or duplicate background processors.
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.warn({ signal }, 'Shutting down gracefully...');
  const forcedShutdownTimer = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
  EmailQueue.stopProcessor();
  EventWorker.stop();
  try { await closeSocketServer(); } catch (err) { logger.warn({ err }, 'Socket shutdown failed'); }
  await new Promise<void>((resolve) => {
    if (!(httpServer as any).listening) {
      resolve();
      return;
    }
    httpServer.close(() => resolve());
    const closeAllConnections = (httpServer as any).closeAllConnections;
    if (typeof closeAllConnections === 'function') closeAllConnections.call(httpServer);
  }).catch(() => undefined);
  try { await closeDatabasePools(); } catch (err) { logger.warn({ err }, 'Database pool shutdown failed'); }
  try {
    const { closeRedis } = await import('./shared/redis');
    await closeRedis();
  } catch (err) {
    logger.warn({ err }, 'Redis shutdown failed');
  }
  clearTimeout(forcedShutdownTimer);
  logger.info('Shutdown complete');
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Check for expired delegations every 10 minutes, but never query before startup
// migrations have completed.
databaseReadyPromise.then(() => {
  SettingsController.expireDelegations().catch((err) => logger.error(err, 'Initial delegation expiry check failed'));
  setInterval(() => SettingsController.expireDelegations().catch((err) => logger.error(err, 'Delegation expiry check failed')), 600_000);
});

// Run compliance expiry checks every 6 hours (delayed on startup to avoid deadlock with migrations)
const COMPLIANCE_CHECK_INTERVAL = 6 * 60 * 60 * 1000;
databaseReadyPromise.then(() => setTimeout(() => {
  ComplianceNotificationService.runAllChecksForAllOrgs().catch(err => logger.error(err, 'Compliance startup check failed'));
  setInterval(() => ComplianceNotificationService.runAllChecksForAllOrgs(), COMPLIANCE_CHECK_INTERVAL);
}, 10_000));

// Run shift-start notifications every 5 minutes
import { SchedulingNotificationService } from './modules/scheduling/scheduling.notifications';
import { runHomecareVisitReminders, runHomecareOverdueAlerts } from './modules/homecare/homecare.reminders';
import { runHomecareDigestEmails } from './modules/homecare/homecare.digests';
const SHIFT_START_NOTIFICATION_INTERVAL = 5 * 60 * 1000; // 5 minutes
setInterval(() => {
  if (!databaseReady) return;
  runHomecareVisitReminders().catch(err => logger.error(err, 'Homecare visit reminder check failed'));
  runHomecareOverdueAlerts().catch(err => logger.error(err, 'Homecare overdue alert check failed'));
  runHomecareDigestEmails().then(result => { if (result.sent > 0 || result.failed > 0) logger.info(result, 'Homecare digest email check complete') }).catch(err => logger.error(err, 'Homecare digest email check failed'));
}, 5 * 60 * 1000);

setInterval(() => {
  if (!databaseReady) return;
  SchedulingNotificationService.sendShiftStartNotifications()
    .then(result => { if (result.sent > 0) logger.info({ sent: result.sent, shifts: result.shifts }, 'Shift-start notifications sent') })
    .catch(err => logger.error(err, 'Shift-start notifications failed'));
}, SHIFT_START_NOTIFICATION_INTERVAL);

// Check for unclaimed shifts every 15 minutes
setInterval(() => {
  if (!databaseReady) return;
  SchedulingNotificationService.checkUnclaimedShifts()
    .then(result => { if (result.notified > 0) logger.info({ notified: result.notified }, 'Unclaimed shift reminders sent') })
    .catch(err => logger.error(err, 'Unclaimed shift check failed'));
}, 15 * 60 * 1000);

// Nightly carer-location retention.
//
// This one is hourly-checked rather than set to a 24-hour interval, because a
// setInterval that fires once a day drifts with process restarts and will
// happily skip a day across a deploy. Instead the tick runs often and the job
// itself decides whether the day is done, keyed on the date rather than on the
// clock — so it runs once, at some point in the small hours, and again after
// every restart on the same day without re-running on the minute.
//
// Why nightly and not hourly: a retention period is measured in days, and
// deleting a position one day after its period expired rather than one day
// before it is not a meaningful difference to anyone reading the receipt. What
// matters is that it happens without a human, which an hourly job does not
// improve on and does make more expensive to run.
//
// Providers with no period set are skipped rather than written a receipt saying
// nothing was deleted. See runScheduledLocationPurges.
const LOCATION_RETENTION_CHECK_INTERVAL = 60 * 60 * 1000; // every hour
let lastLocationRetentionDate = '';
function runLocationRetentionCheck() {
  if (!databaseReady) return;
  const today = new Date().toISOString().slice(0, 10);
  if (today === lastLocationRetentionDate) return;
  lastLocationRetentionDate = today;
  runScheduledLocationPurges()
    .then(result => { if (result.runs > 0) logger.info(result, 'Carer location retention check complete') })
    .catch(err => logger.error(err, 'Carer location retention check failed'));
}
import { runScheduledLocationPurges } from './modules/homecare/locationRetention';
databaseReadyPromise.then(() => setTimeout(runLocationRetentionCheck, 20_000));
setInterval(runLocationRetentionCheck, LOCATION_RETENTION_CHECK_INTERVAL);

// Send daily compliance digests to location managers (every hour; in-memory tracker enforces 24h)
setInterval(() => {
  if (!databaseReady) return;
  ComplianceNotificationService.sendComplianceDigests()
    .then(count => { if (count > 0) logger.info({ orgs: count }, 'Compliance digest check complete') })
    .catch(err => logger.error(err, 'Compliance digest check failed'));
}, 60 * 60 * 1000);

// Deliver due scheduled custom reports by email (hourly; each schedule's
// next_run_at is in the org's own timezone, so delivery lands within the
// hour after the configured time, and the sweep stamps a heartbeat).
import { runDueReportSchedules } from './modules/reporting/reporting.delivery';
setInterval(() => {
  if (!databaseReady) return;
  runDueReportSchedules()
    .then(result => { if (result.sent > 0 || result.failed > 0) logger.info(result, 'Scheduled report delivery check complete') })
    .catch(err => logger.error(err, 'Scheduled report delivery check failed'));
}, 60 * 60 * 1000);

// Scheduled evidence pack generation (every 6 hours; checks day-of-week/month per org)
setInterval(() => {
  if (!databaseReady) return;
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
setInterval(() => {
  if (databaseReady) checkOverdueReviews();
}, 5 * 60 * 1000);

// Stripe subscription status sync (every hour — keeps DB in sync with Stripe)
// This is the source of truth for subscription status. Webhooks may be missed,
// but this job self-heals by comparing Stripe's canonical state against the DB.
import { syncStripeSubscriptionStatus } from './shared/utils/stripe-sync';
databaseReadyPromise.then(() => setTimeout(() => {
  syncStripeSubscriptionStatus().catch(err => logger.error(err, 'Stripe sync failed'));
  setInterval(() => {
    syncStripeSubscriptionStatus().catch(err => logger.error(err, 'Stripe sync failed'));
  }, 60 * 60 * 1000); // Every hour
}, 20_000));

// Subscription expiry reminder check (every 12 hours — sends at 7d, 3d, 1d, and expiry/win-back milestones)
import { checkSubscriptionExpirations, checkInvoiceReminders, runWinbackCampaign } from './shared/utils/trial-reminders';
databaseReadyPromise.then(() => setTimeout(() => {
  checkSubscriptionExpirations().catch(err => logger.error(err, 'Subscription reminder check failed'));
  checkInvoiceReminders().catch(err => logger.error(err, 'Invoice reminder check failed'));
  runWinbackCampaign().then(r => { if (r.sent > 0 || r.deleted > 0) logger.info(r, 'Winback campaign run complete'); }).catch(err => logger.error(err, 'Winback campaign failed'));
  setInterval(() => {
    checkSubscriptionExpirations().catch(err => logger.error(err, 'Subscription reminder check failed'));
    checkInvoiceReminders().catch(err => logger.error(err, 'Invoice reminder check failed'));
    runWinbackCampaign().then(r => { if (r.sent > 0 || r.deleted > 0) logger.info(r, 'Winback campaign run complete'); }).catch(err => logger.error(err, 'Winback campaign failed'));
  }, 6 * 60 * 60 * 1000);
}, 15_000));

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
setInterval(() => {
  if (databaseReady) checkShiftAudit();
}, 5 * 60 * 1000);

// Late medication alerts — email on-duty staff when scheduled administrations go overdue (per-org delay/toggle)
import { MedicationAlertService } from './modules/emedication/medication-alert.service';
setInterval(() => {
  if (!databaseReady) return;
  MedicationAlertService.sendLateMedAlerts()
    .then(count => { if (count > 0) logger.info({ emails: count }, 'Late medication alert emails sent'); })
    .catch(err => logger.error(err, 'Late medication alert check failed'));
}, 5 * 60 * 1000);

// Stock reorder sweep — re-warn managers about active stock lines still at or
// below their reorder level (per-line dedupe via last_reorder_alerted_at,
// default 24h between re-warnings), so a low line never has to be discovered
// by asking Mica. Runs in the same 5-minute cadence as the late-med sweep.
const stockReorderTimer = setInterval(() => {
  if (!databaseReady) return;
  MedicationAlertService.sendStockReorderAlerts()
    .then(count => { if (count > 0) logger.info({ emails: count }, 'Stock reorder sweep emails sent'); })
    .catch(err => logger.error(err, 'Stock reorder sweep check failed'));
}, 5 * 60 * 1000);
stockReorderTimer.unref();

// DBS Update Service re-checks — remind managers when a status check falls due,
// goes overdue, or a certificate renewal is still outstanding.
//
// Every six hours rather than every five minutes, because the thing being
// measured is a calendar date: nothing here changes within a day except by
// crossing midnight, and DBS does not push changes to employers at all. The
// reminder ledger (dbs_update_service_reminders) is what makes even a frequent
// tick safe — one notification per (subscription, kind, due date) — so the
// cadence is about how quickly a provider is told, not about how often it can
// be told.
import { runUpdateServiceReminders } from './modules/dbs/dbs.updateService';
const DBS_UPDATE_SERVICE_CHECK_INTERVAL = 6 * 60 * 60 * 1000;
const dbsUpdateServiceTimer = setInterval(() => {
  if (!databaseReady) return;
  runUpdateServiceReminders()
    .then(result => { if (result.notified > 0) logger.info(result, 'DBS update service reminders sent'); })
    .catch(err => logger.error(err, 'DBS update service reminder check failed'));
}, DBS_UPDATE_SERVICE_CHECK_INTERVAL);
dbsUpdateServiceTimer.unref();

// DBS certificate retention — the six-month rule, enforced by a job rather than
// by a paragraph in a plan (docs/DBS_INTEGRATION_PLAN.md §5 and §6).
//
// Nightly, and date-keyed for the same reason the carer-location purge is: a
// 24-hour `setInterval` drifts with restarts and will skip a day across a
// deploy, and a period measured in months does not need to be more punctual
// than the day. Hourly ticks then cost one indexed read.
//
// Only providers with a check genuinely past its date are visited, so an
// organisation with nothing to purge runs nothing and logs nothing — the runs
// that appear in the log are the ones worth reading.
import { runScheduledDbsCertificatePurges } from './modules/dbs/dbs.certificateRetention';
import { DBS_CERTIFICATE_RETENTION_JOB, surfaceStalledRetentionSweep } from './modules/dbs/dbs.certificateRetentionAlert';
import { EXPECTED_JOB_CADENCE, readJobHeartbeats, readStaleJobs } from './shared/jobs/heartbeat';
const DBS_RETENTION_CHECK_INTERVAL = 60 * 60 * 1000; // every hour
let lastDbsRetentionDate = '';
function runDbsRetentionCheck() {
  if (!databaseReady) return;
  const today = new Date().toISOString().slice(0, 10);
  if (today === lastDbsRetentionDate) return;
  lastDbsRetentionDate = today;
  runScheduledDbsCertificatePurges()
    .then(result => { if (result.purged > 0 || result.failed > 0) logger.info(result, 'DBS certificate retention check complete') })
    .catch(err => logger.error(err, 'DBS certificate retention check failed'));
}
databaseReadyPromise.then(() => setTimeout(runDbsRetentionCheck, 25_000));
setInterval(runDbsRetentionCheck, DBS_RETENTION_CHECK_INTERVAL);

// The heartbeat check: is the retention job still running at all?
//
// The purge raises its warnings from inside its own run, so it cannot warn about its
// own absence — a job that stopped is a job that says nothing, and certificate
// information then sits in the database indefinitely while the provider believes a
// nightly job is deleting it. So this reads the heartbeat, names the job in the log and
// in `/health/jobs`, and — the part a manager sees — judges each provider's held
// certificate information directly, so the over-retention alert is raised whether or not
// a sweep was there to raise it.
//
// Hourly, and the first check waits ten minutes after boot so a normal startup's own
// run has had its chance to stamp the heartbeat. A stale reading is logged once per
// check rather than per request: this is a condition, not an event.
const JOB_HEARTBEAT_CHECK_INTERVAL = 60 * 60 * 1000;
async function checkJobHeartbeats() {
  try {
    const stale = await readStaleJobs();
    for (const job of stale) {
      logger.error(
        { job: job.job_name, lastCompletedAt: job.last_completed_at, ageMinutes: job.age_minutes, maxAgeMinutes: job.max_age_minutes },
        'Scheduled job has not completed a run inside its declared cadence',
      );
    }
    if (stale.some(job => job.job_name === DBS_CERTIFICATE_RETENTION_JOB)) {
      const surfaced = await surfaceStalledRetentionSweep();
      if (surfaced.flagged > 0) {
        logger.error(surfaced, 'Providers are holding DBS certificate information past retention with no purge running');
      }
    }
  } catch (err) {
    logger.error(err, 'Job heartbeat check failed');
  }
}
databaseReadyPromise.then(() => setTimeout(() => { if (databaseReady) void checkJobHeartbeats(); }, 10 * 60 * 1000));
const jobHeartbeatTimer = setInterval(() => { if (databaseReady) void checkJobHeartbeats(); }, JOB_HEARTBEAT_CHECK_INTERVAL);
jobHeartbeatTimer.unref();

// Handover due at shift end — the last open event type in the supported-living
// blueprint's §9.9. A shift that ends with no handover recorded is a transfer of
// responsibility that silently did not happen, and until now nothing told the worker
// who owed one: the record existed (§9.2), but its absence was invisible unless a
// manager happened to open the rota.
//
// Every fifteen minutes rather than nightly, because the nudge is only worth anything
// while the worker can still remember the shift and the daily plan email has not long
// gone out. A frequent tick is safe: `shifts.handover_due_notified_at` (migration 154)
// makes it one nudge per shift however often this runs.
import { runHandoverDueSweep } from './modules/scheduling/shiftHandoverDue';
const HANDOVER_DUE_CHECK_INTERVAL = 15 * 60 * 1000; // every 15 minutes
const handoverDueTimer = setInterval(() => {
  if (!databaseReady) return;
  runHandoverDueSweep()
    .then(result => { if (result.published > 0) logger.info(result, 'Handover-due nudges raised') })
    .catch(err => logger.error(err, 'Handover-due sweep failed'));
}, HANDOVER_DUE_CHECK_INTERVAL);
handoverDueTimer.unref();
databaseReadyPromise.then(() => setTimeout(() => {
  runHandoverDueSweep()
    .then(result => { if (result.published > 0) logger.info(result, 'Handover-due nudges raised') })
    .catch(err => logger.error(err, 'Handover-due sweep failed'));
}, 40_000));

// Room check overdue — blueprint §9.9's last event type. A room check is a daily
// record of an occupied room's cleanliness and safety, and the gap the product could
// not see was the *absence* of one: there is nothing in the table to be "due".
//
// Every thirty minutes, because the rule is time-of-day shaped: nothing is overdue
// until the provider's own day passes 18:00, and once it has, the nudge is worth
// having quickly. A frequent tick is safe — `room_check_nudges` (migration 155)
// records what has been said, so a room is reported once a day however often this
// runs, and nothing at all happens before the due hour.
import { runRoomCheckOverdueSweep } from './modules/room-checks/roomCheckOverdue';
const ROOM_CHECK_OVERDUE_INTERVAL = 30 * 60 * 1000; // every 30 minutes
const roomCheckOverdueTimer = setInterval(() => {
  if (!databaseReady) return;
  runRoomCheckOverdueSweep()
    .then(result => { if (result.published > 0) logger.info(result, 'Room-check-overdue nudges raised') })
    .catch(err => logger.error(err, 'Room-check-overdue sweep failed'));
}, ROOM_CHECK_OVERDUE_INTERVAL);
roomCheckOverdueTimer.unref();
databaseReadyPromise.then(() => setTimeout(() => {
  runRoomCheckOverdueSweep()
    .then(result => { if (result.published > 0) logger.info(result, 'Room-check-overdue nudges raised') })
    .catch(err => logger.error(err, 'Room-check-overdue sweep failed'));
}, 55_000));

// Alert org admins about locations with no manager (every 6 hours, plus on location mutations)
const LOCATION_COVERAGE_INTERVAL = 6 * 60 * 60 * 1000;
databaseReadyPromise.then(() => setTimeout(() => {
  SettingsController.checkLocationManagerCoverage()
    .then(count => { if (count > 0) logger.info({ notified: count }, 'Location manager coverage alerts sent'); })
    .catch(err => logger.error(err, 'Location manager coverage check failed'));
  setInterval(() => {
    if (!databaseReady) return;
    SettingsController.checkLocationManagerCoverage()
      .then(count => { if (count > 0) logger.info({ notified: count }, 'Location manager coverage alerts sent'); })
      .catch(err => logger.error(err, 'Location manager coverage check failed'));
  }, LOCATION_COVERAGE_INTERVAL);
}, 30_000));

// Start email queue processor only after the database is ready.
databaseReadyPromise.then(() => EmailQueue.startProcessor());

// Clean permanently failed email jobs daily. Failed rows older than three days no longer
// need to remain in the operational queue, while recent failures stay available for review/retry.
const FAILED_EMAIL_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;
databaseReadyPromise.then(() => {
  EmailQueue.cleanupFailedOlderThan(3).catch(err => logger.error(err, 'Initial failed email cleanup failed'));
  const cleanupTimer = setInterval(() => {
    EmailQueue.cleanupFailedOlderThan(3).catch(err => logger.error(err, 'Scheduled failed email cleanup failed'));
  }, FAILED_EMAIL_CLEANUP_INTERVAL);
  cleanupTimer.unref();
});

// End-of-period payslips. Carers are emailed their payslip as a PDF attachment on the
// 1st of each month, covering the calendar month that just closed. A period that has
// already been queued is skipped, so a restart cannot double-send a payslip.
import { sendMonthlyPayslips } from './modules/homecare/payslip.service';
let lastPayslipPeriod = '';
function checkMonthlyPayslips() {
  const now = new Date();
  if (now.getDate() !== 1) return;
  const period = now.toISOString().slice(0, 7);
  if (lastPayslipPeriod === period) return;
  lastPayslipPeriod = period;
  sendMonthlyPayslips(now)
    .then(result => logger.info(result, 'Payslip emails queued for closed period'))
    .catch(err => logger.error(err, 'Payslip email run failed'));
}
setInterval(() => {
  if (databaseReady) checkMonthlyPayslips();
}, 60 * 60 * 1000);

// Warn if SMTP is not configured — emails will silently fail
if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
  logger.warn('SMTP not configured — emails will NOT be delivered. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
} else {
  logger.info({ host: process.env.SMTP_HOST, user: process.env.SMTP_USER }, 'Email: SMTP configured');
}

// DMARC alignment depends on the visible senders sharing one domain. A
// `SMTP_FROM_*` override pointing somewhere else is easy to make and invisible
// from DNS, so it is surfaced at boot rather than discovered from a spam
// folder. The envelope sender is pinned to the visible sender, so this is the
// only remaining way for alignment to drift.
const misalignedSenders = senderAlignmentFailures();
if (misalignedSenders.length > 0) {
  logger.error(
    { misalignedSenders, expectedDomain: senderDomain() },
    'Email: sender addresses do not share one domain — DMARC alignment will fail for these categories',
  );
} else {
  logger.info({ domain: senderDomain() }, 'Email: all sender categories aligned for DMARC');
}

// Start the domain event outbox worker
import { registerProductionConsumers } from './modules/events/consumers/register';
databaseReadyPromise.then(() => {
  registerProductionConsumers();
  EventWorker.start();
});

export default app;

