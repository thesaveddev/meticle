import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { UserRole } from '@meticle/shared';
import {
  processOutbox,
  listPendingEvents,
  getCorrelationChain,
  retryEvent,
  getEventById,
} from './events.outbox';

const router = Router();
router.use(authenticate);
router.use(requireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN));

// Internal event-outbox administration endpoints (blueprint §21.1).
// Reads are org-scoped via the caller's organizationId — cross-tenant event
// processing is the worker's job, not an API caller's.

/** Trigger an immediate drain of the caller's org pending events. */
router.post('/publish', asyncHandler(async (req, res) => {
  const stats = await processOutbox(req.user!.organizationId);
  res.json(stats);
}));

/** List events still waiting for delivery. */
router.get('/pending', asyncHandler(async (req, res) => {
  const events = await listPendingEvents(req.user!.organizationId);
  res.json(events);
}));

/** Reset a failed event so the worker retries it. */
router.post('/retry/:id', asyncHandler(async (req, res) => {
  const event = await retryEvent(req.user!.organizationId!, req.params.id!);
  res.json(event);
}));

/** Full chain of events sharing a correlation id (trace a business flow). */
router.get('/correlation/:id', asyncHandler(async (req, res) => {
  const chain = await getCorrelationChain(req.user!.organizationId!, req.params.id!);
  res.json(chain);
}));

/** Single event lookup (used by retry UIs to show error state). */
router.get('/:id', asyncHandler(async (req, res) => {
  const event = await getEventById(req.user!.organizationId!, req.params.id!);
  if (!event) {
    res.status(404).json({ statusCode: 404, message: 'Event not found in this organization' });
    return;
  }
  res.json(event);
}));

export default router;
