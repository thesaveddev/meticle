import { Router } from 'express';
import emedicationRoutes from './emedication.routes';

const router = Router();
router.use('/emedication', emedicationRoutes);

export default router;
