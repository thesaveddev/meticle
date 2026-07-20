import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { query } from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';

const router = Router();
router.use(authenticate);

router.get('/delegation-audit/:delegationId', asyncHandler(async (req, res) => {
  const user = req.user!;
  const { delegationId } = req.params;
  const result = await query(
    `SELECT dal.*, u.email as delegate_email,
            sp.first_name as delegate_first_name, sp.last_name as delegate_last_name
     FROM delegation_audit_logs dal
     JOIN users u ON dal.delegate_user_id = u.id
     LEFT JOIN staff_profiles sp ON u.id = sp.user_id
     WHERE dal.delegation_id = $1
       AND (dal.primary_manager_id = $2 OR dal.delegate_user_id = $2 OR $3 = true)
     ORDER BY dal.created_at DESC`,
    [delegationId, user.userId, user.role === 'ORG_ADMIN']
  );
  res.json(result.rows);
}));

export default router;
