import { Request, Response } from 'express';
import { AppError } from '../../shared/middleware/error.middleware';
import { query } from '../../shared/database';

function orgId(req: Request): string {
  const value = req.user?.organizationId;
  if (!value) throw new AppError(403, 'Organization context required');
  return value;
}

function userId(req: Request): string {
  return req.user!.userId;
}

export class ChatController {
  static async listChannels(req: Request, res: Response) {
    const oid = orgId(req);
    const result = await query(
      `SELECT DISTINCT channel FROM org_chat_messages WHERE organization_id = $1 ORDER BY channel`,
      [oid]
    );
    const channels = result.rows.map((r: any) => r.channel);
    // Always include 'general'
    if (!channels.includes('general')) channels.unshift('general');
    res.json(channels);
  }

  static async listMessages(req: Request, res: Response) {
    const oid = orgId(req);
    const { channel } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const before = req.query.before as string | undefined;

    let sql = `
      SELECT m.*,
             COALESCE(sp.first_name || ' ' || sp.last_name, u.email) AS sender_name,
             u.email AS sender_email
      FROM org_chat_messages m
      JOIN users u ON u.id = m.sender_id
      LEFT JOIN staff_profiles sp ON sp.user_id = u.id
      WHERE m.organization_id = $1 AND m.channel = $2 AND m.deleted = FALSE
    `;
    const params: any[] = [oid, channel];

    if (before) {
      sql += ` AND m.created_at < $3`;
      params.push(before);
    }

    sql += ` ORDER BY m.created_at DESC LIMIT ${limit}`;
    const result = await query(sql, params);
    res.json(result.rows.reverse());
  }

  static async sendMessage(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const { channel } = req.params;
    const { message, reply_to_id } = req.body;

    if (!message || !message.trim()) throw new AppError(400, 'Message cannot be empty');
    if (message.length > 5000) throw new AppError(400, 'Message too long (max 5000 characters)');

    // Validate reply_to exists in same channel
    if (reply_to_id) {
      const replyCheck = await query(
        'SELECT id FROM org_chat_messages WHERE id = $1 AND organization_id = $2 AND channel = $3',
        [reply_to_id, oid, channel]
      );
      if (!replyCheck.rows.length) throw new AppError(404, 'Reply target not found');
    }

    const result = await query(
      `INSERT INTO org_chat_messages (organization_id, sender_id, channel, message, reply_to_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [oid, uid, channel, message.trim(), reply_to_id || null]
    );

    const msg = result.rows[0];

    // Fetch sender name
    const senderResult = await query(
      `SELECT COALESCE(sp.first_name || ' ' || sp.last_name, u.email) AS sender_name, u.email AS sender_email
       FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id WHERE u.id = $1`,
      [uid]
    );

    res.status(201).json({
      ...msg,
      sender_name: senderResult.rows[0]?.sender_name || 'Unknown',
      sender_email: senderResult.rows[0]?.sender_email || '',
    });
  }

  static async editMessage(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const { id } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) throw new AppError(400, 'Message cannot be empty');

    // Only sender can edit
    const existing = await query(
      'SELECT * FROM org_chat_messages WHERE id = $1 AND organization_id = $2',
      [id, oid]
    );
    if (!existing.rows.length) throw new AppError(404, 'Message not found');
    if (existing.rows[0].sender_id !== uid) throw new AppError(403, 'Can only edit your own messages');

    const result = await query(
      `UPDATE org_chat_messages SET message = $1, edited = TRUE, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [message.trim(), id]
    );
    res.json(result.rows[0]);
  }

  static async deleteMessage(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const { id } = req.params;

    const existing = await query(
      'SELECT * FROM org_chat_messages WHERE id = $1 AND organization_id = $2',
      [id, oid]
    );
    if (!existing.rows.length) throw new AppError(404, 'Message not found');
    if (existing.rows[0].sender_id !== uid) throw new AppError(403, 'Can only delete your own messages');

    await query(
      'UPDATE org_chat_messages SET deleted = TRUE, message = \'\' , updated_at = NOW() WHERE id = $1',
      [id]
    );
    res.json({ deleted: true });
  }

  static async markRead(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const { channel } = req.body;

    await query(
      `INSERT INTO org_chat_read_receipts (organization_id, user_id, channel, last_read_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (organization_id, user_id, channel)
       DO UPDATE SET last_read_at = NOW()`,
      [oid, uid, channel || 'general']
    );
    res.json({ ok: true });
  }

  static async getUnreadCounts(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);

    const result = await query(
      `SELECT m.channel,
              COUNT(*) AS unread_count
       FROM org_chat_messages m
       LEFT JOIN org_chat_read_receipts rr
         ON rr.organization_id = m.organization_id
         AND rr.user_id = $2
         AND rr.channel = m.channel
       WHERE m.organization_id = $1
         AND m.sender_id != $2
         AND m.deleted = FALSE
         AND m.created_at > COALESCE(rr.last_read_at, '1970-01-01'::timestamptz)
       GROUP BY m.channel`,
      [oid, uid]
    );

    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      counts[row.channel] = parseInt(row.unread_count);
    }
    res.json(counts);
  }
}
