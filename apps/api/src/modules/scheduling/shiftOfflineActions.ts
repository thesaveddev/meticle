/**
 * The offline action contract for shift attendance and handover.
 *
 * This is the visit check-in contract applied to supported living: a phone with
 * no signal queues the action, sends it later, and is retried until it lands.
 * The key that makes that safe is the uniqueness of (organization_id,
 * action_key) on `shift_offline_actions`, so a replay is recognised as the same
 * action rather than performed twice (mobile blueprint §9.1).
 *
 * One deliberate difference from `recordOfflineAction` in the homecare
 * repository: that one checks for the key, then does the work, then records it,
 * which leaves a window where two concurrent retries both pass the check and
 * both perform the action. Here the key is claimed in the ledger *before* the
 * work, so the unique constraint — not a read-then-write race — is what
 * prevents the double record. A claim whose work then fails is marked failed,
 * which is the same outcome the visit ledger reaches: the key is spent, and a
 * retry of it is refused with the reason it failed.
 */
import { query } from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import logger from '../../shared/utils/logger';
import type { ShiftOfflineActionType } from './shiftAttendance.types';

export interface ShiftOfflineActionResult<T> {
  replayed: boolean;
  status: 'processed';
  result?: T;
}

export async function recordShiftOfflineAction<T>(args: {
  orgId: string;
  shiftId: string;
  userId: string;
  actionType: ShiftOfflineActionType;
  input: { action_key?: string | null };
  perform: () => Promise<T>;
}): Promise<ShiftOfflineActionResult<T>> {
  const actionKey = args.input?.action_key;
  if (!actionKey) throw new AppError(400, 'Offline action key is required');

  const existing = await query(
    'SELECT status, error_message FROM shift_offline_actions WHERE organization_id = $1 AND action_key = $2',
    [args.orgId, actionKey]
  );
  if (existing.rows[0]) {
    if (existing.rows[0].status === 'failed') {
      throw new AppError(409, existing.rows[0].error_message || 'Offline action previously failed');
    }
    // Already accepted. `processing` counts as accepted: the work it claims is
    // in flight behind this same key, and the constraint is what guarantees it
    // happens once.
    return { replayed: true, status: 'processed' };
  }

  const claimed = await query(
    `INSERT INTO shift_offline_actions (organization_id, shift_id, user_id, action_key, action_type, payload, status)
     VALUES ($1,$2,$3,$4,$5,$6,'processing')
     ON CONFLICT (organization_id, action_key) DO NOTHING
     RETURNING id`,
    [args.orgId, args.shiftId, args.userId, actionKey, args.actionType, JSON.stringify(args.input)]
  );
  if (!claimed.rows[0]) {
    // Another request claimed the key between the read and this insert.
    return { replayed: true, status: 'processed' };
  }

  try {
    const result = await args.perform();
    await query(
      `UPDATE shift_offline_actions SET status = 'processed', processed_at = NOW() WHERE id = $1`,
      [claimed.rows[0].id]
    );
    return { replayed: false, status: 'processed', result };
  } catch (error: any) {
    await query(
      `UPDATE shift_offline_actions SET status = 'failed', error_message = $2 WHERE id = $1`,
      [claimed.rows[0].id, String(error?.message || 'Offline action failed').slice(0, 1000)]
    ).catch((updateError) =>
      logger.error({ err: updateError?.message, actionKey }, 'Failed to record a failed shift offline action')
    );
    throw error;
  }
}
