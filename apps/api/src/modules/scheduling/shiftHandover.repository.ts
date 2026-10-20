/**
 * Shift handover — the defining artefact of supported living.
 *
 * The end of a supported-living shift is a transfer of responsibility for the
 * people in the setting. The only "handover" the platform had was the AI's
 * `prepare_handover` draft, a document Mica writes, which is not the same thing
 * as a per-shift record that a named worker acknowledges having read (mobile
 * blueprint §9.2).
 *
 * Two properties are deliberate:
 *
 *  * One current handover per shift, amended by keeping every version. The
 *    wording a colleague read has to survive the amendment that followed it,
 *    or a record of what was handed over cannot be produced after the fact.
 *  * Acknowledgement is by named staff and is never the author's own. An
 *    acknowledgement is evidence that somebody else took the shift over, and a
 *    handover acknowledged by the person who wrote it evidences nothing.
 */
import { query, transaction } from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import { ShiftAttendanceRepository, resolveRecordedAt } from './shiftAttendance.repository';
import type {
  ShiftAttendanceSource,
  ShiftHandover,
  ShiftHandoverAcknowledgement,
  ShiftHandoverInput,
  ShiftHandoverRevision,
  ShiftHandoverView,
} from './shiftAttendance.types';

/** A join that survives a user row whose staff profile has since been removed. */
const AUTHOR_NAME = `COALESCE(NULLIF(TRIM(sp.first_name || ' ' || sp.last_name), ''), u.email, 'Former user')`;

export class ShiftHandoverRepository {
  /**
   * Who may write a shift's handover: the staff on that shift, or a manager or
   * admin. A manager writing one on a worker's behalf is attributed to the
   * manager, never to the worker they wrote it for.
   */
  static async requireCanWrite(orgId: string, shiftId: string, userId: string, allowManagerWrite: boolean) {
    if (allowManagerWrite) return;
    const result = await query(
      `SELECT sa.id
       FROM shift_assignments sa
       JOIN staff_profiles sp ON sp.id = sa.staff_id
       JOIN shifts s ON s.id = sa.shift_id
       JOIN locations l ON l.id = s.location_id
       WHERE sa.shift_id = $1 AND sp.user_id = $2 AND l.organization_id = $3 AND sa.status <> 'rejected'`,
      [shiftId, userId, orgId]
    );
    if (!result.rows[0]) {
      throw new AppError(403, 'Only staff on this shift can record its handover');
    }
  }

  /**
   * Record the handover for a shift, or amend the one already there. The
   * returned `created` flag is what lets the controller answer 201 for a new
   * handover and 200 for an amendment, because they are different events to a
   * caller following the history.
   */
  static async recordHandover(args: {
    orgId: string;
    userId: string;
    shiftId: string;
    input: ShiftHandoverInput;
    source: ShiftAttendanceSource;
    allowManagerWrite: boolean;
  }): Promise<{ handover: ShiftHandover; created: boolean }> {
    const shift = await ShiftAttendanceRepository.getShiftForAttendance(args.orgId, args.shiftId);
    if (!shift) throw new AppError(404, 'Shift not found');
    await this.requireCanWrite(args.orgId, args.shiftId, args.userId, args.allowManagerWrite);

    const recordedAt = resolveRecordedAt(args.input.recorded_at).toISOString();
    const whatHappened = args.input.what_happened?.trim();
    if (!whatHappened) throw new AppError(400, 'A handover has to say what happened during the shift');

    return transaction(async (client) => {
      const existing = await client.query(
        `SELECT id, version FROM shift_handovers WHERE shift_id = $1 AND organization_id = $2 FOR UPDATE`,
        [args.shiftId, args.orgId]
      );

      const rowOf = async (id: string) => {
        const result = await client.query(
          `SELECT h.*, ${AUTHOR_NAME} AS author_name
           FROM shift_handovers h
           LEFT JOIN staff_profiles sp ON sp.user_id = h.author_id
           LEFT JOIN users u ON u.id = h.author_id
           WHERE h.id = $1`,
          [id]
        );
        return result.rows[0];
      };

      if (existing.rows[0]) {
        const version = existing.rows[0].version + 1;
        await client.query(
          `INSERT INTO shift_handover_revisions
             (organization_id, handover_id, version, author_id, what_happened, outstanding, who_is_aware, source, recorded_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            args.orgId, existing.rows[0].id, version, args.userId, whatHappened,
            args.input.outstanding || null, args.input.who_is_aware || null, args.source, recordedAt,
          ]
        );
        await client.query(
          `UPDATE shift_handovers
              SET author_id = $2, what_happened = $3, outstanding = $4, who_is_aware = $5,
                  version = $6, recorded_at = $7, updated_at = NOW()
            WHERE id = $1`,
          [
            existing.rows[0].id, args.userId, whatHappened,
            args.input.outstanding || null, args.input.who_is_aware || null, version, recordedAt,
          ]
        );
        const handover = await rowOf(existing.rows[0].id);
        return { handover: { ...handover, acknowledgements: [] }, created: false };
      }

      const created = await client.query(
        `INSERT INTO shift_handovers
           (organization_id, shift_id, author_id, what_happened, outstanding, who_is_aware, version, recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,1,$7)
         RETURNING id`,
        [
          args.orgId, args.shiftId, args.userId, whatHappened,
          args.input.outstanding || null, args.input.who_is_aware || null, recordedAt,
        ]
      );
      await client.query(
        `INSERT INTO shift_handover_revisions
           (organization_id, handover_id, version, author_id, what_happened, outstanding, who_is_aware, source, recorded_at)
         VALUES ($1,$2,1,$3,$4,$5,$6,$7,$8)`,
        [
          args.orgId, created.rows[0].id, args.userId, whatHappened,
          args.input.outstanding || null, args.input.who_is_aware || null, args.source, recordedAt,
        ]
      );
      const handover = await rowOf(created.rows[0].id);
      return { handover: { ...handover, acknowledgements: [] }, created: true };
    });
  }

  /** The handover, its amendment history and its acknowledgements. */
  static async getHandover(orgId: string, shiftId: string, viewerId: string): Promise<ShiftHandoverView> {
    const shift = await ShiftAttendanceRepository.getShiftForAttendance(orgId, shiftId);
    if (!shift) throw new AppError(404, 'Shift not found');

    const handoverResult = await query(
      `SELECT h.*, ${AUTHOR_NAME} AS author_name
       FROM shift_handovers h
       LEFT JOIN staff_profiles sp ON sp.user_id = h.author_id
       LEFT JOIN users u ON u.id = h.author_id
       WHERE h.shift_id = $1 AND h.organization_id = $2`,
      [shiftId, orgId]
    );
    const handover = handoverResult.rows[0];
    if (!handover) return { handover: null, revisions: [], viewer_acknowledged: false, viewer_is_author: false };

    const acknowledgements = await query(
      `SELECT a.id, a.user_id, a.staff_id, a.note, a.acknowledged_at,
              COALESCE(NULLIF(TRIM(sp.first_name || ' ' || sp.last_name), ''), u.email, 'Former user') AS acknowledged_by_name
       FROM shift_handover_acknowledgements a
       LEFT JOIN staff_profiles sp ON sp.id = a.staff_id
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.handover_id = $1
       ORDER BY a.acknowledged_at`,
      [handover.id]
    ) as { rows: ShiftHandoverAcknowledgement[] };

    const revisions = await query(
      `SELECT r.id, r.version, r.author_id, ${AUTHOR_NAME} AS author_name, r.what_happened, r.outstanding,
              r.who_is_aware, r.source, r.recorded_at, r.created_at
       FROM shift_handover_revisions r
       LEFT JOIN staff_profiles sp ON sp.user_id = r.author_id
       LEFT JOIN users u ON u.id = r.author_id
       WHERE r.handover_id = $1
       ORDER BY r.version DESC`,
      [handover.id]
    ) as { rows: ShiftHandoverRevision[] };

    return {
      handover: { ...handover, acknowledgements: acknowledgements.rows },
      revisions: revisions.rows,
      viewer_acknowledged: acknowledgements.rows.some((a) => a.user_id === viewerId),
      viewer_is_author: handover.author_id === viewerId,
    };
  }

  /** A named staff member confirms they have read the handover. */
  static async acknowledge(args: {
    orgId: string;
    userId: string;
    staffId: string | null;
    shiftId: string;
    note?: string | null;
  }): Promise<{
    acknowledgement: ShiftHandoverAcknowledgement;
    replayed: boolean;
    handover: { id: string; author_id: string; version: number };
  }> {
    const handoverResult = await query(
      `SELECT id, author_id, version FROM shift_handovers WHERE shift_id = $1 AND organization_id = $2`,
      [args.shiftId, args.orgId]
    );
    const handover = handoverResult.rows[0];
    if (!handover) throw new AppError(404, 'There is no handover on this shift to acknowledge');
    if (handover.author_id === args.userId) {
      throw new AppError(400, 'You cannot acknowledge your own handover');
    }

    const inserted = await query(
      `INSERT INTO shift_handover_acknowledgements (organization_id, handover_id, user_id, staff_id, note)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (handover_id, user_id) DO NOTHING
       RETURNING id`,
      [args.orgId, handover.id, args.userId, args.staffId, args.note || null]
    );

    return {
      acknowledgement: await this.getAcknowledgement(handover.id, args.userId),
      replayed: !inserted.rows[0],
      handover: { id: handover.id, author_id: handover.author_id, version: handover.version },
    };
  }

  /** The acknowledgement row for a named user on a handover. */
  static async getAcknowledgement(handoverId: string, userId: string): Promise<ShiftHandoverAcknowledgement> {
    const result = await query(
      `SELECT a.id, a.user_id, a.staff_id, a.note, a.acknowledged_at,
              COALESCE(NULLIF(TRIM(sp.first_name || ' ' || sp.last_name), ''), u.email, 'Former user') AS acknowledged_by_name
       FROM shift_handover_acknowledgements a
       LEFT JOIN staff_profiles sp ON sp.id = a.staff_id
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.handover_id = $1 AND a.user_id = $2`,
      [handoverId, userId]
    );
    return result.rows[0];
  }
}
