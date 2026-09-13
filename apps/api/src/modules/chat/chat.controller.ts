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
    const uid = userId(req);

    // Get channels the user is a member of from chat_channels table (new system)
    const memberResult = await query(
      `SELECT cc.*, cm.unread_count,
              (SELECT COUNT(*) FROM chat_members cm2 WHERE cm2.channel_id = cc.id) AS member_count
       FROM chat_channels cc
       JOIN chat_members cm ON cm.channel_id = cc.id AND cm.user_id = $2
       WHERE cc.organization_id = $1
       ORDER BY cc.updated_at DESC NULLS LAST, cc.created_at DESC`,
      [oid, uid]
    );

    // Also get legacy string-based channels from org_chat_messages
    const legacyResult = await query(
      `SELECT DISTINCT channel FROM org_chat_messages WHERE organization_id = $1 ORDER BY channel`,
      [oid]
    );

    // Build channel list: new system channels + legacy channels as general
    const channels: any[] = [];

    for (const ch of memberResult.rows) {
      let channelName = ch.name;
      let otherMember: any = null;

      if (ch.type === 'dm') {
        // For DMs, show the other person's name
        const other = await query(
          `SELECT u.id, COALESCE(sp.first_name || ' ' || sp.last_name, u.email) AS name, u.email
           FROM chat_members cm2 JOIN users u ON u.id = cm2.user_id
           LEFT JOIN staff_profiles sp ON sp.user_id = u.id
           WHERE cm2.channel_id = $1 AND cm2.user_id != $2 LIMIT 1`,
          [ch.id, uid]
        );
        otherMember = other.rows[0] || null;
        channelName = otherMember?.name || 'Unknown';
      }

      // Get last message
      const lastMsg = await query(
        `SELECT m.content, m.created_at,
                COALESCE(sp.first_name || ' ' || sp.last_name, u.email) AS sender_name
         FROM org_chat_messages m
         JOIN users u ON u.id = m.sender_id
         LEFT JOIN staff_profiles sp ON sp.user_id = u.id
         WHERE m.organization_id = $1 AND m.channel = $2 AND m.deleted = FALSE
         ORDER BY m.created_at DESC LIMIT 1`,
        [oid, ch.id]
      );

      channels.push({
        id: ch.id,
        name: channelName,
        type: ch.type,
        other_member: otherMember,
        last_message: lastMsg.rows[0] || null,
        unread_count: ch.unread_count || 0,
        member_count: Number(ch.member_count) || 0,
        created_at: ch.created_at,
      });
    }

    // Add legacy 'general' channel if it has messages but user isn't in chat_channels
    const hasGeneral = memberResult.rows.some((r: any) => r.name === 'general');
    if (!hasGeneral) {
      const generalLegacy = legacyResult.rows.find((r: any) => r.channel === 'general');
      if (generalLegacy || true) {
        // Ensure general channel exists
        const genChannel = await query(
          `INSERT INTO chat_channels (organization_id, name, type, created_by)
           SELECT $1, 'general', 'general', $2
           WHERE NOT EXISTS (SELECT 1 FROM chat_channels WHERE organization_id = $1 AND name = 'general')
           RETURNING id`,
          [oid, uid]
        );
        let generalId = genChannel.rows[0]?.id;
        if (!generalId) {
          const existing = await query('SELECT id FROM chat_channels WHERE organization_id = $1 AND name = $2', [oid, 'general']);
          generalId = existing.rows[0]?.id;
        }
        if (generalId) {
          // Ensure user is a member
          await query(
            'INSERT INTO chat_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [generalId, uid]
          );
          const lastMsg = await query(
            `SELECT m.content, m.created_at, COALESCE(sp.first_name || ' ' || sp.last_name, u.email) AS sender_name
             FROM org_chat_messages m JOIN users u ON u.id = m.sender_id
             LEFT JOIN staff_profiles sp ON sp.user_id = u.id
             WHERE m.organization_id = $1 AND m.channel = 'general' AND m.deleted = FALSE
             ORDER BY m.created_at DESC LIMIT 1`,
            [oid]
          );
          if (!channels.find((c: any) => c.id === generalId)) {
            channels.unshift({
              id: generalId,
              name: 'general',
              type: 'general',
              other_member: null,
              last_message: lastMsg.rows[0] || null,
              unread_count: 0,
              member_count: 0,
              created_at: null,
            });
          }
        }
      }
    }

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

    const senderResult = await query(
      `SELECT COALESCE(sp.first_name || ' ' || sp.last_name, u.email) AS sender_name, u.email AS sender_email
       FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id WHERE u.id = $1`,
      [uid]
    );

    // Update channel updated_at
    await query(
      'UPDATE chat_channels SET updated_at = NOW() WHERE organization_id = $1 AND id = $2',
      [oid, channel]
    ).catch(() => {});

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
      `UPDATE org_chat_messages SET deleted = TRUE, message = '', updated_at = NOW() WHERE id = $1`,
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

  /* ─── New endpoints ───────────────────────────────────────── */

  static async ensureGeneral(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);

    const existing = await query(
      'SELECT id FROM chat_channels WHERE organization_id = $1 AND name = $2',
      [oid, 'general']
    );
    if (existing.rows.length) {
      await query('INSERT INTO chat_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [existing.rows[0].id, uid]);
      return res.json(existing.rows[0]);
    }

    const result = await query(
      `INSERT INTO chat_channels (organization_id, name, type, created_by) VALUES ($1, 'general', 'general', $2) RETURNING id`,
      [oid, uid]
    );
    await query('INSERT INTO chat_members (channel_id, user_id) VALUES ($1, $2)', [result.rows[0].id, uid]);
    res.json(result.rows[0]);
  }

  static async listOrgMembers(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const result = await query(
      `SELECT u.id, COALESCE(sp.first_name || ' ' || sp.last_name, u.email) AS name,
              u.email, u.role, u.status,
              sp.first_name, sp.last_name, sp.profile_picture_url
       FROM users u
       LEFT JOIN staff_profiles sp ON sp.user_id = u.id
       WHERE u.organization_id = $1 AND u.id != $2 AND u.status = 'active'
       ORDER BY COALESCE(sp.first_name, u.email)`,
      [oid, uid]
    );
    res.json(result.rows);
  }

  static async listChannelMembers(req: Request, res: Response) {
    const oid = orgId(req);
    const { channelId } = req.params;
    const result = await query(
      `SELECT u.id, COALESCE(sp.first_name || ' ' || sp.last_name, u.email) AS name,
              u.email, u.role, sp.profile_picture_url
       FROM chat_members cm
       JOIN users u ON u.id = cm.user_id
       LEFT JOIN staff_profiles sp ON sp.user_id = u.id
       WHERE cm.channel_id = $1 AND u.organization_id = $2
       ORDER BY COALESCE(sp.first_name, u.email)`,
      [channelId, oid]
    );
    res.json(result.rows);
  }

  static async removeChannelMember(req: Request, res: Response) {
    const oid = orgId(req);
    const { channelId, userId: targetUserId } = req.params;
    await query('DELETE FROM chat_members WHERE channel_id = $1 AND user_id = $2', [channelId, targetUserId]);
    res.json({ removed: true });
  }

  static async leaveChannel(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const { channelId } = req.params;
    await query('DELETE FROM chat_members WHERE channel_id = $1 AND user_id = $2', [channelId, uid]);
    res.json({ left: true });
  }

  static async createDM(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const { targetUserId } = req.params;

    if (targetUserId === uid) throw new AppError(400, 'Cannot create DM with yourself');

    // Check if DM already exists between these two users
    const existing = await query(
      `SELECT cc.id FROM chat_channels cc
       JOIN chat_members cm1 ON cm1.channel_id = cc.id AND cm1.user_id = $1
       JOIN chat_members cm2 ON cm2.channel_id = cc.id AND cm2.user_id = $2
       WHERE cc.organization_id = $3 AND cc.type = 'dm'`,
      [uid, targetUserId, oid]
    );
    if (existing.rows.length) {
      return res.json(existing.rows[0]);
    }

    // Create DM channel
    const target = await query(
      `SELECT COALESCE(sp.first_name || ' ' || sp.last_name, u.email) AS name
       FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id WHERE u.id = $1`,
      [targetUserId]
    );
    const dmName = target.rows[0]?.name || 'Direct Message';

    const result = await query(
      `INSERT INTO chat_channels (organization_id, name, type, created_by) VALUES ($1, $2, 'dm', $3) RETURNING id`,
      [oid, dmName, uid]
    );
    const channelId = result.rows[0].id;
    await query('INSERT INTO chat_members (channel_id, user_id) VALUES ($1, $2)', [channelId, uid]);
    await query('INSERT INTO chat_members (channel_id, user_id) VALUES ($1, $2)', [channelId, targetUserId]);
    res.status(201).json(result.rows[0]);
  }

  static async createGroup(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const { name, memberIds = [] } = req.body;

    if (!name || !name.trim()) throw new AppError(400, 'Group name is required');

    const result = await query(
      `INSERT INTO chat_channels (organization_id, name, type, created_by) VALUES ($1, $2, 'group', $3) RETURNING id`,
      [oid, name.trim(), uid]
    );
    const channelId = result.rows[0].id;

    // Add creator
    await query('INSERT INTO chat_members (channel_id, user_id) VALUES ($1, $2)', [channelId, uid]);
    // Add other members
    for (const mid of memberIds) {
      if (mid !== uid) {
        await query('INSERT INTO chat_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [channelId, mid]);
      }
    }

    res.status(201).json(result.rows[0]);
  }

  static async markChannelRead(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const { channelId } = req.params;

    // Update the chat_members unread_count
    await query(
      'UPDATE chat_members SET unread_count = 0 WHERE channel_id = $1 AND user_id = $2',
      [channelId, uid]
    );

    // Also update legacy read receipts
    const channelName = await query('SELECT name FROM chat_channels WHERE id = $1', [channelId]);
    if (channelName.rows[0]) {
      await query(
        `INSERT INTO org_chat_read_receipts (organization_id, user_id, channel, last_read_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (organization_id, user_id, channel)
         DO UPDATE SET last_read_at = NOW()`,
        [oid, uid, channelName.rows[0].name]
      );
    }

    res.json({ ok: true });
  }

  static async searchMessages(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const { q } = req.query;
    if (!q || String(q).trim().length < 2) throw new AppError(400, 'Search query too short');

    const searchTerm = `%${String(q).trim()}%`;
    const result = await query(
      `SELECT m.*, COALESCE(sp.first_name || ' ' || sp.last_name, u.email) AS sender_name,
              u.email AS sender_email
       FROM org_chat_messages m
       JOIN users u ON u.id = m.sender_id
       LEFT JOIN staff_profiles sp ON sp.user_id = u.id
       WHERE m.organization_id = $1 AND m.deleted = FALSE AND m.message ILIKE $2
       ORDER BY m.created_at DESC LIMIT 30`,
      [oid, searchTerm]
    );
    res.json(result.rows);
  }
}
