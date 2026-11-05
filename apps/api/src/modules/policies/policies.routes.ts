import { Router } from 'express';
import { PolicyController } from './policies.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { validate } from '../../shared/middleware/validate.middleware';
import { createPolicySchema, updatePolicySchema, sharePolicySchema, policyReadRequestsSchema } from '../../shared/validation/schemas';
import { UserRole } from '@meticle/shared';

const router = Router();

router.use(authenticate);

router.get('/categories', asyncHandler(PolicyController.getCategories));
router.post('/seed', requireRole(UserRole.ORG_ADMIN), asyncHandler(PolicyController.seedStandard));
router.get('/', asyncHandler(PolicyController.list));
router.get('/:id', asyncHandler(PolicyController.getById));
router.post('/', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createPolicySchema), asyncHandler(PolicyController.create));
router.patch('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updatePolicySchema), asyncHandler(PolicyController.update));
router.delete('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(PolicyController.delete));
// Reading history, not policy management: any authenticated staff member
// acknowledges in their own name; the list is scoped in the controller.
router.post('/:id/acknowledge', asyncHandler(PolicyController.acknowledge));
router.get('/:id/acknowledgements', asyncHandler(PolicyController.acknowledgements));
router.get('/:id/versions', asyncHandler(PolicyController.versions));
// 5.10: sharing, read requests and nudges are manager work — the caller acts
// for the organisation, never for themselves.
router.post('/:id/share', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(sharePolicySchema), asyncHandler(PolicyController.share));
router.post('/:id/read-requests', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(policyReadRequestsSchema), asyncHandler(PolicyController.readRequests));
router.post('/:id/remind', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(PolicyController.remind));

export default router;
