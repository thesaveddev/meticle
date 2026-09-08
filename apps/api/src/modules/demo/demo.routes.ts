import { Router } from 'express';
import { demoAccess } from './demo.controller';

const router = Router();

// Public endpoint — no auth required
router.post('/access', demoAccess);

export default router;
