import { Request, Response } from 'express';
import { AppError } from '../../shared/middleware/error.middleware';
import { query } from '../../shared/database';
import { safeIo } from '../../shared/socket';
import { fetchLinkPreview } from '../../shared/utils/linkPreview';
import { UserRole } from '@meticle/shared';

const FILE_LIST_LIMIT = 100;

function orgId(req: Request): string {
  const value = req.user?.organizationId;
  if (!value) throw new AppError(403, 'Organization context required');
  return value;
}

function userId(req: Request): string {
  return req.user!.userId;
}

async function requireChannelMember(organizationId: string, channelId: string, userIdValue: string): Promise<void> {
  const access = await query(
    `SELECT 1 FROM chat_channels cc
     JOIN chat_members cm ON cm.channel_id = cc.id AND cm.user_id = $2
     WHERE cc.id = $1 AND cc.organization_id = $3`,
    [channelId, userIdValue, organizationId]
  );
  if (!access.rows.length) throw new AppError(403, 'You are not a member of this channel');
}

/**
 * Deliver a chat event to every member's live sockets, not just the sockets
 * that joined this channel's room.
 *
 * The server joins every socket to its owner's `user:${userId}` room on
 * connect, so fanning out to those rooms reaches a member's phone, their open
 * tabs and their desktop at once — whether or not any of them called
 * `chat:join` for this channel. The channel room stays in the set because the
 * typing, delivered and read signals still live there.
 *
 * One chained emit, not one per room: Socket.IO delivers a multi-room emit to
 * each socket once, so a socket sitting in both rooms gets a single copy. The
 * chain is built defensively because the no-op stub used outside a socket
 * context exposes `to()` without chaining — delivery is best-effort and must
 * never fail the request.
 */
function emitChatEvent(event: string, channelId: string, memberUserIds: string[], payload: Record<string, unknown>): void {
  try {
    const io = safeIo() as unknown as { to: (room: string) => unknown };
    let target: unknown = io.to(`channel:${channelId}`);
    for (const memberId of memberUserIds) {
      const next = target as { to?: (room: string) => unknown };
      if (typeof next.to === 'function') target = next.to(`user:${memberId}`);
    }
    (target as { emit: (event: string, payload: unknown) => void }).emit(event, payload);
  } catch {
    // Best-effort: the row is already stored, and push covers the rest.
  }
}

/**
 * Exact unread totals for a set of users, in one query.
 *
 * Mirrors `getUnreadCounts` per user: messages not sent by the user, not
 * deleted, newer than their per-channel read receipt. Members with nothing
 * unread are absent from the GROUP BY, so they are pre-filled with 0 — the
 * reader's own clients must be told "zero", not told nothing.
 */
async function unreadTotals(organizationId: string, memberIds: string[]): Promise<Record<string, number>> {
  const totals: Record<string, number> = {};
  for (const id of memberIds) totals[id] = 0;
  try {
    const result = await query(
      `SELECT cm.user_id AS member_id, COUNT(m.id)::int AS total
       FROM chat_members cm
       JOIN chat_channels cc ON cc.id = cm.channel_id AND cc.organization_id = $1
       JOIN org_chat_messages m ON m.organization_id = $1
         AND m.channel = cm.channel_id
         AND m.sender_id != cm.user_id
         AND m.deleted = FALSE
       LEFT JOIN org_chat_read_receipts rr ON rr.organization_id = $1
         AND rr.user_id = cm.user_id
         AND rr.channel = cm.channel_id
       WHERE cm.user_id = ANY($2::uuid[])
         AND m.created_at > COALESCE(rr.last_read_at, '1970-01-01'::timestamptz)
       GROUP BY cm.user_id`,
      [organizationId, memberIds]
    );
    for (const row of result.rows) totals[row.member_id] = Number(row.total) || 0;
  } catch {
    // Best-effort: the badge falls back to its reconcile poll.
  }
  return totals;
}

/**
 * Push each user's exact total to their own sockets, so every badge — the tab
 * that sent the message, the tabs that received it, the other devices — is
 * exact without waiting for a poll or a reconcile GET. Best-effort like every
 * other emit here: the row is already stored.
 */
function emitUnreadTotals(organizationId: string, memberIds: string[]): void {
  void unreadTotals(organizationId, memberIds).then(totals => {
    try {
      const io = safeIo() as unknown as { to: (room: string) => { emit: (event: string, payload: unknown) => void } };
      for (const [id, count] of Object.entries(totals)) {
        io.to(`user:${id}`).emit('chat:unread_total', { count });
      }
    } catch {
      // A badge that cannot be pushed is reconciled on the next poll.
    }
  }).catch(() => {});
}

/** Every member's id for a channel; an empty channel still notifies the caller. */
async function channelMemberIds(channelId: string, fallbackId: string): Promise<string[]> {
  try {
    const result = await query('SELECT user_id FROM chat_members WHERE channel_id = $1', [channelId]);
    const ids = result.rows.map((m: { user_id: string }) => m.user_id);
    return ids.length > 0 ? ids : [fallbackId];
  } catch {
    return [fallbackId];
  }
}

export class ChatController {
  static async uploadFile(req: Request, res: Response) {
    if (!req.file) throw new AppError(400, 'No file provided');
    res.json({ url: `/files/private/${req.file.filename}`, originalName: req.file.originalname });
  }

  // ─── Shared files ──────────────────────────────────────────
  // A shared file is an ordinary chat message that carries an attachment. The
  // gallery therefore reads from the message table rather than a second store,
  // so a file can never appear in the list without existing in the channel.

  private static fileSelect() {
    return `SELECT m.id,
                   m.channel AS channel_id,
                   m.file_name,
                   m.file_url,
                   m.file_size,
                   m.file_type,
                   m.created_at,
                   u.id AS sender_id,
                   sp.first_name,
                   sp.last_name,
                   u.email`;
  }

  static async listChannelFiles(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const { channelId } = req.params;
    await requireChannelMember(oid, channelId, uid);

    const result = await query(
      `${ChatController.fileSelect()}
       FROM org_chat_messages m
       JOIN users u ON u.id = m.sender_id
       LEFT JOIN staff_profiles sp ON sp.user_id = u.id
       WHERE m.organization_id = $1
         AND m.channel = $2
         AND m.file_url IS NOT NULL
         AND m.deleted = FALSE
       ORDER BY m.created_at DESC
       LIMIT ${FILE_LIST_LIMIT}`,
      [oid, channelId]
    );
    res.json(result.rows);
  }

  static async uploadChannelFile(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const { channelId } = req.params;
    await requireChannelMember(oid, channelId, uid);
    if (!req.file) throw new AppError(400, 'No file provided');

    const fileUrl = `/files/private/${req.file.filename}`;
    const result = await query(
      `INSERT INTO org_chat_messages (organization_id, sender_id, channel, message, file_url, file_name, file_size, file_type)
       VALUES ($1, $2, $3, '', $4, $5, $6, $7)
       RETURNING id, channel AS channel_id, file_name, file_url, file_size, file_type, created_at`,
      [oid, uid, channelId, fileUrl, req.file.originalname, req.file.size, req.file.mimetype]
    );

    const senderResult = await query(
      `SELECT COALESCE(sp.first_name || ' ' || sp.last_name, u.email) AS sender_name
       FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id WHERE u.id = $1`,
      [uid]
    );

    const record = {
      ...result.rows[0],
      sender_id: uid,
      first_name: senderResult.rows[0]?.sender_name || '',
      email: '',
    };

    await query('UPDATE chat_channels SET updated_at = NOW() WHERE organization_id = $1 AND id = $2', [oid, channelId])
      .catch(() => {});

    // The client listens for chat:file_added to refresh the gallery and for
    // chat:message to show the attachment in the conversation, so emit both.
    // Both fan out to every member's own sockets too (see `emitChatEvent`),
    // so a member who never joined this channel's room still sees the
    // attachment land.
    const fileMembers = await channelMemberIds(channelId, uid);
    emitChatEvent('chat:file_added', channelId, fileMembers, { channelId });
    emitChatEvent(
      'chat:message',
      channelId,
      fileMembers,
      {
        ...record,
        message: '',
        content: '',
        channel_id: channelId,
        sender_name: senderResult.rows[0]?.sender_name || 'Unknown',
      }
    );

    res.status(201).json(record);
  }

  static async deleteChannelFile(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const { channelId, fileId } = req.params;
    await requireChannelMember(oid, channelId, uid);

    const existing = await query(
      `SELECT id, sender_id FROM org_chat_messages
       WHERE id = $1 AND organization_id = $2 AND channel = $3 AND file_url IS NOT NULL`,
      [fileId, oid, channelId]
    );
    if (!existing.rows.length) throw new AppError(404, 'File not found');
    if (existing.rows[0].sender_id !== uid && req.user!.role !== UserRole.ORG_ADMIN) {
      throw new AppError(403, 'You can only remove files you shared');
    }

    // Clear the attachment rather than deleting the message, so a message that
    // carried both text and a file keeps its text.
    await query(
      `UPDATE org_chat_messages
       SET file_url = NULL, file_name = NULL, file_size = NULL, file_type = NULL, updated_at = NOW()
       WHERE id = $1`,
      [fileId]
    );
    // Fanned out like every other chat event, so a member who never joined
    // this channel's room still sees the gallery and the conversation update.
    const fileEventMembers = await channelMemberIds(channelId, uid);
    emitChatEvent('chat:file_added', channelId, fileEventMembers, { channelId });
    emitChatEvent('chat:message_deleted', channelId, fileEventMembers, { channelId, messageId: fileId });
    res.json({ deleted: true });
  }

  static async getLinkPreview(req: Request, res: Response) {
    const url = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!url) throw new AppError(400, 'A url is required');
    const preview = await fetchLinkPreview(url);
    // A link with no readable metadata is normal, not an error: the client
    // falls back to showing the plain link.
    res.json(preview || { url, title: '', description: '', image: '' });
  }

  static async listChannels(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);

    // Get channels the user is a member of from chat_channels table (new system)
    const memberResult = await query(
      `SELECT cc.*,
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
        `SELECT m.message AS content, m.created_at,
                COALESCE(sp.first_name || ' ' || sp.last_name, u.email) AS sender_name
         FROM org_chat_messages m
         JOIN users u ON u.id = m.sender_id
         LEFT JOIN staff_profiles sp ON sp.user_id = u.id
         WHERE m.organization_id = $1 AND m.channel = $2
         ORDER BY m.created_at DESC LIMIT 1`,
        [oid, ch.id]
      );

      const unread = await query(
        `SELECT COUNT(*)::int AS count
         FROM org_chat_messages m
         LEFT JOIN org_chat_read_receipts rr
           ON rr.organization_id = m.organization_id
          AND rr.user_id = $3
          AND rr.channel = $2
         WHERE m.organization_id = $1
           AND (m.channel = $2 OR ($4 = 'general' AND m.channel = 'general'))
           AND m.sender_id != $3
           AND m.deleted = FALSE
           AND m.created_at > COALESCE(rr.last_read_at, '1970-01-01'::timestamptz)`,
        [oid, ch.id, uid, ch.name]
      );

      const members = await query(
        `SELECT cm2.user_id, sp.first_name, sp.last_name, u.email, sp.profile_picture_url
         FROM chat_members cm2
         JOIN users u ON u.id = cm2.user_id
         LEFT JOIN staff_profiles sp ON sp.user_id = u.id
         WHERE cm2.channel_id = $1
         ORDER BY COALESCE(sp.first_name, u.email)`,
        [ch.id]
      );

      channels.push({
        id: ch.id,
        name: channelName,
        type: ch.type,
        channel_type: ch.type,
        other_member: otherMember,
        last_message: lastMsg.rows[0]?.content || null,
        last_message_at: lastMsg.rows[0]?.created_at || null,
        unread_count: Number(unread.rows[0]?.count) || 0,
        member_count: Number(ch.member_count) || 0,
        members: members.rows,
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
          const lastMsg = await query(            `SELECT m.message AS content, m.created_at, COALESCE(sp.first_name || ' ' || sp.last_name, u.email) AS sender_name
             FROM org_chat_messages m
             JOIN users u ON u.id = m.sender_id
             LEFT JOIN staff_profiles sp ON sp.user_id = u.id
             WHERE m.organization_id = $1 AND m.channel = 'general' AND m.deleted = FALSE
             ORDER BY m.created_at DESC LIMIT 1`,
            [oid]
          );
              const unread = await query(
                `SELECT COUNT(*)::int AS count
                 FROM org_chat_messages m
                 LEFT JOIN org_chat_read_receipts rr
                   ON rr.organization_id = m.organization_id
                  AND rr.user_id = $2
                  AND rr.channel = $3
                 WHERE m.organization_id = $1
                   AND (m.channel = 'general' OR m.channel = $3)
                   AND m.sender_id != $2
                   AND m.deleted = FALSE
                   AND m.created_at > COALESCE(rr.last_read_at, '1970-01-01'::timestamptz)`,
                [oid, uid, generalId]
              );
          if (!channels.find((c: any) => c.id === generalId)) {
            channels.unshift({
              id: generalId,
              name: 'general',
              type: 'general',
              channel_type: 'general',
              other_member: null,
              last_message: lastMsg.rows[0]?.content || null,
              last_message_at: lastMsg.rows[0]?.created_at || null,
              unread_count: Number(unread.rows[0]?.count) || 0,
              member_count: Number((await query('SELECT COUNT(*)::int AS count FROM chat_members WHERE channel_id = $1', [generalId])).rows[0]?.count) || 0,
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
    const uid = userId(req);
    const { channel } = req.params;
    await requireChannelMember(oid, channel, uid);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const before = req.query.before as string | undefined;

    const channelInfo = await query(
      'SELECT name FROM chat_channels WHERE id = $1 AND organization_id = $2',
      [channel, oid]
    );
    const channelName = channelInfo.rows[0]?.name as string | undefined;
    const channelFilter = channelName === 'general' ? `m.channel = $2 OR m.channel = 'general'` : 'm.channel = $2';

    // A message is delivered when the recipient has successfully received the
    // message list (or the realtime event and calls the same endpoint). Keep
    // this separate from read receipts so one tick and two ticks remain distinct.
    await query(
      `INSERT INTO org_chat_message_deliveries (message_id, organization_id, user_id)
       SELECT m.id, $1, $2
       FROM org_chat_messages m
       WHERE m.organization_id = $1
         AND (${channelName === 'general' ? "m.channel = $3 OR m.channel = 'general'" : 'm.channel = $3'})
         AND m.sender_id != $2
         AND m.deleted = FALSE
       ON CONFLICT (message_id, user_id) DO NOTHING`,
      [oid, uid, channel]
    );

    let sql = `
      SELECT m.*,
             (SELECT MIN(d.delivered_at) FROM org_chat_message_deliveries d
              WHERE d.message_id = m.id AND d.user_id <> m.sender_id) AS delivered_at,
             COALESCE(sp.first_name || ' ' || sp.last_name, u.email) AS sender_name,
             u.email AS sender_email
      FROM org_chat_messages m
      JOIN users u ON u.id = m.sender_id
      LEFT JOIN staff_profiles sp ON sp.user_id = u.id
      WHERE m.organization_id = $1
        AND (${channelFilter})
        AND m.deleted = FALSE
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

  static async markDelivered(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const { channelId } = req.params;
    await requireChannelMember(oid, channelId, uid);
    const channelInfo = await query('SELECT name FROM chat_channels WHERE id = $1 AND organization_id = $2', [channelId, oid]);
    const channelName = channelInfo.rows[0]?.name;

    const messageIds = Array.isArray(req.body?.messageIds) ? req.body.messageIds.filter((id: unknown) => typeof id === 'string').slice(0, 100) : [];
    if (messageIds.length > 0) {
      await query(
        `INSERT INTO org_chat_message_deliveries (message_id, organization_id, user_id)
         SELECT m.id, $1, $2
         FROM org_chat_messages m
         WHERE m.organization_id = $1
           AND (${channelName === 'general' ? "m.channel = $3 OR m.channel = 'general'" : 'm.channel = $3'})
           AND m.id = ANY($4::uuid[])
           AND m.sender_id != $2
           AND m.deleted = FALSE
         ON CONFLICT (message_id, user_id) DO NOTHING`,
        [oid, uid, channelId, messageIds]
      );

      // Fanned out to every member's sockets (not just this channel's room)
      // so the sender's ticks update on all of their devices at once.
      emitChatEvent('chat:delivered', channelId, await channelMemberIds(channelId, uid), {
        channelId,
        userId: uid,
        messageIds,
        deliveredAt: new Date().toISOString(),
      });
    }
    res.json({ ok: true, messageIds });
  }

  static async getReadReceipts(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const { channelId } = req.params;
    const channelNameResult = await query(
      'SELECT name FROM chat_channels WHERE id = $1 AND organization_id = $2',
      [channelId, oid]
    );
    const channelName = channelNameResult.rows[0]?.name || null;
    const reads = await query(
      `SELECT rr.user_id, rr.last_read_at,
              u.email, sp.first_name, sp.last_name
       FROM org_chat_read_receipts rr
       JOIN users u ON u.id = rr.user_id
       LEFT JOIN staff_profiles sp ON sp.user_id = u.id
       WHERE rr.organization_id = $1
         AND (rr.channel = $2 OR ($3 IS NOT NULL AND rr.channel = $3))
         AND rr.user_id != $4`,
      [oid, channelId, channelName, uid]
    );
    res.json({
      other_last_read_at: reads.rows.length === 1 ? reads.rows[0].last_read_at : null,
      member_reads: reads.rows,
    });
  }

  static async sendMessage(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const { channel } = req.params;
    await requireChannelMember(oid, channel, uid);
    const messageText = String(req.body.message ?? req.body.content ?? '').trim();
    const { reply_to_id, file_url, file_name } = req.body;

    if (!messageText && !file_url) throw new AppError(400, 'Message cannot be empty');
    if (messageText.length > 5000) throw new AppError(400, 'Message too long (max 5000 characters)');

    if (reply_to_id) {
      const replyCheck = await query(
        'SELECT id FROM org_chat_messages WHERE id = $1 AND organization_id = $2 AND channel = $3',
        [reply_to_id, oid, channel]
      );
      if (!replyCheck.rows.length) throw new AppError(404, 'Reply target not found');
    }

    const result = await query(
      `INSERT INTO org_chat_messages (organization_id, sender_id, channel, message, reply_to_id, file_url, file_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [oid, uid, channel, messageText, reply_to_id || null, file_url || null, file_name || null]
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

    // Every member's id, sender included: push goes to everyone but the
    // sender, while the socket fan-out below includes the sender so their
    // other devices sync silently (clients never badge their own messages).
    const memberIds: string[] = await query('SELECT user_id FROM chat_members WHERE channel_id = $1', [channel])
      .then(result => result.rows.map((m: { user_id: string }) => m.user_id))
      .catch(() => []);

    // Send push notifications to other channel members
    try {
      const channelInfo = await query(
        'SELECT name FROM chat_channels WHERE id = $1 AND organization_id = $2',
        [channel, oid]
      );
      const channelName = channelInfo.rows[0]?.name || 'Chat';
      const senderName = senderResult.rows[0]?.sender_name || 'Someone';

      const { sendPushNotification } = await import('../notifications/push.service');
      for (const memberId of memberIds) {
        if (memberId === uid) continue;
        sendPushNotification(memberId, {
          title: channelName,
          body: `${senderName}: ${(messageText || file_name || 'shared a file').substring(0, 120)}`,
          data: { type: 'chat', channelId: channel },
          url: '/chat',
        }, 'chat').catch(() => {});
      }
    } catch (e) {
      // Notification failure should not block the message send
    }

    // Notify connected clients immediately — the channel room plus every
    // member's own sockets, so chat lands like WhatsApp instead of waiting for
    // the channel to be opened. Push delivery remains best effort.
    emitChatEvent(
      'chat:message',
      channel,
      memberIds.length > 0 ? memberIds : [uid],
      {
        ...msg,
        channel_id: channel,
        content: msg.message,
        message: msg.message,
        sender_name: senderResult.rows[0]?.sender_name || 'Unknown',
        sender_email: senderResult.rows[0]?.sender_email || '',
      }
    );

    // Exact badge counts for every member's sockets, including the sender's
    // other devices (which drop to their own unchanged total, not to zero).
    emitUnreadTotals(oid, memberIds.length > 0 ? memberIds : [uid]);

    res.status(201).json({
      ...msg,
      message: msg.message,
      content: msg.message,
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
    await requireChannelMember(oid, existing.rows[0].channel, uid);

    const result = await query(
      `UPDATE org_chat_messages SET message = $1, edited = TRUE, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [message.trim(), id]
    );
    // An edit is a live event too: without this, only the sender's device
    // shows the new text until everyone else reopens the conversation.
    emitChatEvent('chat:message_updated', existing.rows[0].channel, await channelMemberIds(existing.rows[0].channel, uid), {
      ...result.rows[0],
      channel_id: existing.rows[0].channel,
      content: result.rows[0].message,
      message: result.rows[0].message,
    });
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
    await requireChannelMember(oid, existing.rows[0].channel, uid);

    await query(
      `UPDATE org_chat_messages SET deleted = TRUE, message = '', updated_at = NOW() WHERE id = $1`,
      [id]
    );
    // A delete is a live event too: without this, only the sender's device
    // hides the message until everyone else reopens the conversation.
    emitChatEvent('chat:message_deleted', existing.rows[0].channel, await channelMemberIds(existing.rows[0].channel, uid), {
      channelId: existing.rows[0].channel,
      messageId: id,
    });
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
    const uid = userId(req);
    const { channelId } = req.params;
    await requireChannelMember(oid, channelId, uid);
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
    const uid = userId(req);
    const { channelId, userId: targetUserId } = req.params;
    const channel = await query('SELECT created_by, type FROM chat_channels WHERE id = $1 AND organization_id = $2', [channelId, oid]);
    if (!channel.rows.length) throw new AppError(404, 'Channel not found');
    await requireChannelMember(oid, channelId, uid);
    if (channel.rows[0].type === 'dm') throw new AppError(400, 'Members cannot be removed from a direct message');
    if (channel.rows[0].created_by !== uid && !['MANAGER', 'ADMIN', 'OWNER'].includes(req.user!.role)) {
      throw new AppError(403, 'Only the group creator or a manager can remove members');
    }
    await query('DELETE FROM chat_members WHERE channel_id = $1 AND user_id = $2', [channelId, targetUserId]);
    res.json({ removed: true });
  }

  static async leaveChannel(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const { channelId } = req.params;
    await requireChannelMember(oid, channelId, uid);
    await query('DELETE FROM chat_members WHERE channel_id = $1 AND user_id = $2', [channelId, uid]);
    res.json({ left: true });
  }

  static async createDM(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const { targetUserId } = req.params;

    if (targetUserId === uid) throw new AppError(400, 'Cannot create DM with yourself');

    const targetOrg = await query('SELECT id FROM users WHERE id = $1 AND organization_id = $2 AND status = \'active\'', [targetUserId, oid]);
    if (!targetOrg.rows.length) throw new AppError(404, 'User is not an active member of this organization');

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
    // Add only active members from the same organization; never trust client-supplied IDs.
    const validMembers = await query(
      `SELECT id FROM users WHERE organization_id = $1 AND status = 'active' AND id = ANY($2::uuid[])`,
      [oid, memberIds.filter((id: unknown) => typeof id === 'string')]
    );
    for (const mid of validMembers.rows) {
      if (mid.id !== uid) {
        await query('INSERT INTO chat_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [channelId, mid.id]);
      }
    }

    res.status(201).json(result.rows[0]);
  }

  static async markChannelRead(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const { channelId } = req.params;
    await requireChannelMember(oid, channelId, uid);

    // Keep both read stores in sync: legacy messages use the receipt table,
    // while the channel model uses chat_members.last_read_at.
    await query(
      'UPDATE chat_members SET unread_count = 0 WHERE channel_id = $1 AND user_id = $2',
      [channelId, uid]
    );

    const readChannel = channelId;
    await query(
      `INSERT INTO org_chat_read_receipts (organization_id, user_id, channel, last_read_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (organization_id, user_id, channel)
       DO UPDATE SET last_read_at = NOW()`,
      [oid, uid, readChannel]
    );

    // Fanned out to every member's sockets so read ticks clear on all of the
    // reader's devices and update on everyone else's, even without a join.
    emitChatEvent('chat:read', channelId, await channelMemberIds(channelId, uid), {
      channelId,
      userId: uid,
      lastReadAt: new Date().toISOString(),
    });

    // The reader's own badge (every device, every tab) is now exact.
    emitUnreadTotals(oid, [uid]);

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

  static async addReaction(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = userId(req);
    const { channel, messageId } = req.params;
    const access = await query(
      `SELECT 1 FROM chat_channels cc
       JOIN chat_members cm ON cm.channel_id = cc.id AND cm.user_id = $2
       WHERE cc.id = $1 AND cc.organization_id = $3`,
      [channel, uid, oid]
    );
    if (!access.rows.length) throw new AppError(403, 'You are not a member of this channel');
    const { emoji } = req.body;
    if (!emoji || !emoji.trim()) throw new AppError(400, 'Emoji is required');

    await query(
      `INSERT INTO org_chat_reactions (message_id, user_id, emoji)
       VALUES ($1, $2, $3)
       ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
      [messageId, uid, emoji.trim()]
    );
    // A reaction is a live event too, with per-emoji counts. Each client keeps
    // its own reacted_by_me flags and merges the counts in (see useChat).
    const reactionCounts = await query(
      `SELECT emoji, COUNT(*) AS count FROM org_chat_reactions WHERE message_id = $1 GROUP BY emoji`,
      [messageId]
    ).catch(() => ({ rows: [] as { emoji: string; count: string }[] }));
    emitChatEvent('chat:reactions', channel, await channelMemberIds(channel, uid), {
      channelId: channel,
      messageId,
      reactions: reactionCounts.rows.map((r: { emoji: string; count: string }) => ({
        emoji: r.emoji,
        count: Number(r.count),
      })),
    });
    res.json({ ok: true });
  }
}
