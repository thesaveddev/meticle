import express, { Express } from 'express'
import cors from 'cors'
import pinoHttp from 'pino-http'
import crypto from 'crypto'
import logger from '../shared/utils/logger'
import { errorHandler, notFoundHandler } from '../shared/middleware/error.middleware'
import { authenticate } from '../shared/middleware/auth.middleware'
import { asyncHandler } from '../shared/middleware/asyncHandler'
import { rateLimit } from '../shared/middleware/rateLimit.middleware'
import { metricsMiddleware } from '../shared/metrics'
import { correlationId } from '../shared/middleware/correlationId'
import { rlsMiddleware } from '../shared/middleware/rls.middleware'

import pool from '../shared/database'

// Route imports
import authRoutes from '../modules/auth/auth.routes'
import orgRoutes from '../modules/orgs/org.routes'
import staffRoutes from '../modules/staff/staff.routes'
import complianceRoutes from '../modules/compliance/compliance.routes'
import schedulingRoutes from '../modules/scheduling/scheduling.routes'
import personRoutes from '../modules/people/people.routes'
import leaveRoutes from '../modules/leave/leave.routes'
import notificationRoutes from '../modules/notifications/notifications.routes'
import incidentRoutes from '../modules/incidents/incidents.routes'
import trainingRoutes from '../modules/training/training.routes'
import competencyRoutes from '../modules/competency/competency.routes'
import cqcRoutes from '../modules/cqc/cqc.routes'
import dashboardRoutes from '../modules/dashboard/dashboard.routes'
import appointmentRoutes from '../modules/appointments/appointments.routes'
import policyRoutes from '../modules/policies/policies.routes'
import goalRoutes from '../modules/goals/goals.routes'
import healthRoutes from '../modules/health/health.routes'
import settingsRoutes from '../modules/settings/settings.routes'
import billingRoutes from '../modules/billing/billing.routes'
import emedicationRoutes from '../modules/emedication/emedication.routes'
import chatRoutes from '../modules/chat/chat.routes'
import permissionRoutes from '../modules/permissions/permissions.routes'
import auditRoutes from '../modules/audit/audit.routes'
import aiRoutes from '../modules/ai/ai.routes'
import surveyRoutes from '../modules/surveys/surveys.routes'
import taskRoutes from '../modules/tasks/tasks.routes'
import roomCheckRoutes from '../modules/room-checks/room-checks.routes'
import mobileRoutes from '../modules/mobile/mobile.routes'
import familyPortalRoutes from '../modules/family-portal/familyPortal.routes'
import dbsRoutes from '../modules/dbs/dbs.routes'
import expensesRoutes from '../modules/expenses/expenses.routes'
import dsptRoutes from '../modules/dspt/dspt.routes'
import delegationRoutes from '../modules/delegations/delegation.routes'
import agencyRoutes from '../modules/agencies/agencies.routes'
import insightsRoutes from '../modules/insights/insights.routes'
import reportingRoutes from '../modules/reporting/reporting.routes'
import marketplaceRoutes from '../modules/marketplace/marketplace.routes'
import mfaRoutes from '../modules/mfa/mfa.routes'
import invitationRoutes from '../modules/organization/organization.routes'

export function createTestApp(): Express {
  const app = express()

  app.use(correlationId)
  app.use(cors({ origin: true, credentials: true }))
  app.use(pinoHttp({ logger, autoLogging: false, genReqId: (req) => (req as any).requestId || crypto.randomUUID() }))
  app.use('/api', rateLimit(1000, 60_000))
  app.use(metricsMiddleware)
  app.use(rlsMiddleware)
  app.use(express.json({ limit: '15mb' }))

  app.use('/auth', authRoutes)
  app.use('/mfa', mfaRoutes)
  app.use('/organizations', orgRoutes)
  app.use('/organizations', invitationRoutes)
  app.use('/staff', staffRoutes)
  app.use('/compliance', complianceRoutes)
  app.use('/shifts', schedulingRoutes)
  app.use('/marketplace', marketplaceRoutes)
  app.use('/reporting', reportingRoutes)
  app.use('/insights', insightsRoutes)
  app.use('/people', personRoutes)
  app.use('/incidents', incidentRoutes)
  app.use('/dashboard', dashboardRoutes)
  app.use('/notifications', notificationRoutes)
  app.use('/permissions', permissionRoutes)
  app.use('/training', trainingRoutes)
  app.use('/competency', competencyRoutes)
  app.use('/cqc', cqcRoutes)
  app.use('/surveys', surveyRoutes)
  app.use('/dspt', dsptRoutes)
  app.use('/leave', leaveRoutes)
  app.use('/settings', settingsRoutes)
  app.use('/chat', chatRoutes)
  app.use('/billing', billingRoutes)
  app.use('/audit', auditRoutes)
  app.use('/appointments', appointmentRoutes)
  app.use('/policies', policyRoutes)
  app.use('/emedication', emedicationRoutes)
  app.use('/goals', goalRoutes)
  app.use('/health', healthRoutes)
  app.use('/ai', aiRoutes)
  app.use('/family-portal', familyPortalRoutes)
  app.use('/delegations', delegationRoutes)
  app.use('/agencies', agencyRoutes)
  app.use('/dbs', dbsRoutes)
  app.use('/expenses', expensesRoutes)
  app.use('/tasks', taskRoutes)
  app.use('/room-checks', roomCheckRoutes)
  app.use('/mobile', mobileRoutes)

  app.get('/health/live', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

export function getTestDbUrl(): string {
  return process.env.DATABASE_URL || 'postgres://meticle_app:meticle_app_dev@localhost:5432/meticle'
}
