import { Request, Response } from 'express';
import { ChatRepository } from './chat.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { getIO, invalidateUserCaches } from '../../shared/socket';
import { NotificationsController } from '../notifications/notifications.controller';
import { EmailService } from '../../shared/utils/email.service';
import { query } from '../../shared/database';
import axios from 'axios';

export class ChatController {
  static async getChannels(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const userId = req.user!.userId;
    const channels = await ChatRepository.getChannels(orgId!, userId);
    res.json(channels);
  }

  static async getChannel(req: Request, res: Response) {
    const { channelId } = req.params;
    const orgId = req.user!.organizationId;
    const channel = await ChatRepository.getChannel(channelId, orgId!);
    if (!channel) throw new AppError(404, 'Channel not found');
    res.json(channel);
  }

  static async createGroup(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const userId = req.user!.userId;
    const { name, memberIds } = req.body;

    if (!name?.trim()) throw new AppError(400, 'Group name is required');

    // Verify all members belong to same org
    if (memberIds?.length) {
      const uniqueIds = [...new Set([...memberIds.filter((m: string) => m !== userId)])];
      if (uniqueIds.length > 0) {
        const validResult = await query(
          'SELECT COUNT(*)::int as cnt FROM users WHERE id = ANY($1) AND organization_id = $2',
          [uniqueIds, orgId]
        );
        if (validResult.rows[0].cnt !== uniqueIds.length) {
          throw new AppError(400, 'One or more members do not belong to your organization');
        }
      }
    }

    const channel = await ChatRepository.createChannel(orgId!, name, 'group', userId);

    // Add creator
    await ChatRepository.addMember(channel.id, userId);

    // Add specified members and notify them
    const addedUserIds: string[] = [];
    if (memberIds?.length) {
      for (const mid of memberIds) {
        if (mid !== userId) {
          await ChatRepository.addMember(channel.id, mid);
          addedUserIds.push(mid);
        }
      }
    }

    // Send notifications to all added members
    const creator = await ChatRepository.getUserInfo(userId);
    const creatorName = creator?.first_name
      ? `${creator.first_name} ${creator.last_name || ''}`.trim()
      : creator?.email?.split('@')[0] || 'Someone';

    for (const mid of addedUserIds) {
      try {
        await NotificationsController.createNotification(
          mid,
          'New Group',
          `${creatorName} added you to the group "${name}"`,
          'info'
        );
        const memberUser = await ChatRepository.getUserInfo(mid);
        if (memberUser?.email) {
          await EmailService.sendEmail(
            memberUser.email,
            `You've been added to "${name}" on Meticle`,
            `Hello,<br><br>${creatorName} has added you to the group "<strong>${name}</strong>" on Meticle.<br><br>Start chatting now!`,
          );
        }
      } catch { /* silent */ }
    }

    const members = await ChatRepository.getMembers(channel.id);
    res.status(201).json({ ...channel, members });
  }

  static async getMembers(req: Request, res: Response) {
    const { channelId } = req.params;
    const orgId = req.user!.organizationId;
    const channel = await ChatRepository.getChannel(channelId, orgId!);
    if (!channel) throw new AppError(404, 'Channel not found');
    const members = await ChatRepository.getMembers(channelId);
    res.json(members);
  }

  static async addMember(req: Request, res: Response) {
    const { channelId } = req.params;
    const { userId } = req.body;
    const orgId = req.user!.organizationId;
    const channel = await ChatRepository.getChannel(channelId, orgId!);
    if (!channel) throw new AppError(404, 'Channel not found');
    // Verify user belongs to same org
    const userCheck = await query('SELECT 1 FROM users WHERE id = $1 AND organization_id = $2', [userId, orgId]);
    if (userCheck.rows.length === 0) throw new AppError(400, 'User does not belong to your organization');
    const member = await ChatRepository.addMember(channelId, userId);

    const io = getIO();
    io.to(`channel:${channelId}`).emit('chat:member_joined', { channelId, userId });

    res.status(201).json(member);
  }

  static async removeMember(req: Request, res: Response) {
    const { channelId, userId } = req.params;
    const orgId = req.user!.organizationId;
    const channel = await ChatRepository.getChannel(channelId, orgId!);
    if (!channel) throw new AppError(404, 'Channel not found');
    await ChatRepository.removeMember(channelId, userId);

    const io = getIO();
    io.to(`channel:${channelId}`).emit('chat:member_left', { channelId, userId });
    // Force the removed member's sockets out of the channel room and refresh caches
    for (const s of io.sockets.sockets.values()) {
      if (s.data.user?.userId === userId) {
        s.leave(`channel:${channelId}`);
        const list = s.data.joinedChannels as string[] | undefined;
        if (Array.isArray(list)) {
          const idx = list.indexOf(channelId);
          if (idx !== -1) list.splice(idx, 1);
        }
      }
    }
    invalidateUserCaches(userId);

    res.json({ message: 'Member removed' });
  }

  static async getMessages(req: Request, res: Response) {
    const { channelId } = req.params;
    const userId = req.user!.userId;
    const orgId = req.user!.organizationId;
    const channel = await ChatRepository.getChannel(channelId, orgId!);
    if (!channel) throw new AppError(404, 'Channel not found');

    const limit = parseInt(req.query.limit as string) || 50;
    const before = req.query.before as string;
    const messages = await ChatRepository.getMessages(channelId, limit, before);

    const lastReadAt = await ChatRepository.getMemberLastRead(channelId, userId);

    // Attach reactions to each message
    const reactions = await ChatRepository.getReactionsForMessages(messages.map((m: any) => m.id), userId);
    const messagesWithReactions = messages.map((m: any) => ({ ...m, reactions: reactions[m.id] || [] }));

    // For DM channels, get the other member's last_read_at so senders can see read status
    let otherLastReadAt = null;
    let memberReads: any[] = [];
    if (channel.type === 'dm') {
      const members = await ChatRepository.getMembers(channelId);
      const otherMember = members.find((m: any) => m.user_id !== userId);
      if (otherMember) {
        otherLastReadAt = await ChatRepository.getMemberLastRead(channelId, otherMember.user_id);
      }
    } else {
      // Group/general channels: expose each other member's read time so the UI can show "seen by X"
      memberReads = await ChatRepository.getMemberReads(channelId, userId);
    }

    res.json({ messages: messagesWithReactions, last_read_at: lastReadAt, other_last_read_at: otherLastReadAt, member_reads: memberReads });
  }

  static async sendMessage(req: Request, res: Response) {
    const { channelId } = req.params;
    const userId = req.user!.userId;
    const orgId = req.user!.organizationId;
    const { content, file_url, file_name } = req.body;

    if (!content?.trim() && !file_url) throw new AppError(400, 'Message content or file is required');

    const channel = await ChatRepository.getChannel(channelId, orgId!);
    if (!channel) throw new AppError(404, 'Channel not found');

    // Verify sender is a member
    const members = await ChatRepository.getMembers(channelId);
    if (!members.find((m: any) => m.user_id === userId)) {
      throw new AppError(403, 'You are not a member of this channel');
    }

    const message = await ChatRepository.sendMessage(channelId, userId, content, file_url, file_name);

    // Also add to chat_files so it appears in Shared Files tab
    if (file_url && file_name) {
      try {
        await ChatRepository.addFile(channelId, userId, file_name, file_url, 0, '');
      } catch { /* non-critical */ }
    }

    // Real-time broadcast
    const io = getIO();
    io.to(`channel:${channelId}`).emit('chat:message', message);

    // Notify other channel members
    const sender = await ChatRepository.getUserInfo(userId);
    const senderName = sender?.first_name
      ? `${sender.first_name} ${sender.last_name || ''}`.trim()
      : sender?.email?.split('@')[0] || 'Someone';

    for (const m of members) {
      if (m.user_id !== userId) {
        try {
          await NotificationsController.createNotification(
            m.user_id,
            senderName,
            content?.substring(0, 100) || (file_name ? `Shared a file: ${file_name}` : 'New message'),
            'info'
          );
        } catch { /* silent */ }
      }
    }

    // @mentions: notify specifically-mentioned members
    if (content) {
      try {
        const mentioned = await this.extractMentions(content, orgId!);
        for (const uid of mentioned) {
          if (uid === userId) continue;
          await NotificationsController.createNotification(
            uid,
            `${senderName} mentioned you`,
            content.substring(0, 140),
            'chat'
          );
          io.to(`user:${uid}`).emit('chat:mention', { channelId, messageId: message.id, senderName });
        }
      } catch { /* silent */ }
    }

    // Emit total unread count per recipient for global notification dot
    for (const m of members) {
      if (m.user_id !== userId) {
        try {
          const unreadResult = await query(
            `SELECT COALESCE(SUM(sub.unread), 0) as total FROM (
              SELECT COUNT(*) as unread
              FROM chat_messages cm
              JOIN chat_members cmem ON cmem.channel_id = cm.channel_id AND cmem.user_id = $1
              WHERE cm.created_at > COALESCE(cmem.last_read_at, '1970-01-01')
            ) sub`,
            [m.user_id]
          );
          const totalUnread = parseInt(unreadResult.rows[0]?.total || '0');
          io.to(`user:${m.user_id}`).emit('chat:unread_total', { count: totalUnread });
        } catch { /* silent */ }
      }
    }

    res.status(201).json(message);
  }

  static async extractMentions(content: string, organizationId: string) {
    const members = await ChatRepository.getOrgMembers(organizationId);
    const mentioned: string[] = [];
    const atWords = new Set(
      content.split(/\s+/)
        .filter((w: string) => w.startsWith('@') && w.length > 1)
        .map((w: string) => w.slice(1).toLowerCase())
    );
    for (const m of members) {
      const first = (m.first_name || '').toLowerCase();
      const last = (m.last_name || '').toLowerCase();
      const full = `${m.first_name || ''} ${m.last_name || ''}`.toLowerCase().trim();
      if ((first && atWords.has(first)) || (last && atWords.has(last)) || (full && atWords.has(full))) {
        mentioned.push(m.id);
      }
    }
    return mentioned;
  }

  static async editMessage(req: Request, res: Response) {
    const { channelId, messageId } = req.params;
    const userId = req.user!.userId;
    const { content } = req.body;

    if (!content?.trim()) throw new AppError(400, 'Message content is required');

    const message = await ChatRepository.getFullMessage(messageId);
    if (!message || message.channel_id !== channelId) throw new AppError(404, 'Message not found');
    if (message.sender_id !== userId) throw new AppError(403, 'You can only edit your own messages');

    const updated = await ChatRepository.updateMessage(messageId, content);
    const io = getIO();
    io.to(`channel:${channelId}`).emit('chat:message_updated', updated);

    res.json(updated);
  }

  static async deleteMessage(req: Request, res: Response) {
    const { channelId, messageId } = req.params;
    const userId = req.user!.userId;

    const message = await ChatRepository.getFullMessage(messageId);
    if (!message || message.channel_id !== channelId) throw new AppError(404, 'Message not found');
    if (message.sender_id !== userId) throw new AppError(403, 'You can only delete your own messages');

    await ChatRepository.deleteMessage(messageId);
    const io = getIO();
    io.to(`channel:${channelId}`).emit('chat:message_deleted', { channelId, messageId });

    res.json({ message: 'Message deleted' });
  }

  static async leaveGroup(req: Request, res: Response) {
    const { channelId } = req.params;
    const userId = req.user!.userId;
    const orgId = req.user!.organizationId;

    const channel = await ChatRepository.getChannel(channelId, orgId!);
    if (!channel) throw new AppError(404, 'Channel not found');
    if (channel.type !== 'group') throw new AppError(400, 'You can only leave group channels');

    await ChatRepository.leaveChannel(channelId, userId);
    const io = getIO();
    io.to(`channel:${channelId}`).emit('chat:member_left', { channelId, userId });
    // Force the leaver's sockets out of the channel room and refresh caches
    for (const s of io.sockets.sockets.values()) {
      if (s.data.user?.userId === userId) {
        s.leave(`channel:${channelId}`);
        const list = s.data.joinedChannels as string[] | undefined;
        if (Array.isArray(list)) {
          const idx = list.indexOf(channelId);
          if (idx !== -1) list.splice(idx, 1);
        }
      }
    }
    invalidateUserCaches(userId);

    res.json({ message: 'Left group' });
  }

  static async searchMessages(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const userId = req.user!.userId;
    const { q } = req.query;

    if (!q || typeof q !== 'string' || !q.trim()) {
      res.json([]);
      return;
    }

    const results = await ChatRepository.searchMessages(orgId!, userId, q.trim());
    res.json(results);
  }

  static async toggleReaction(req: Request, res: Response) {
    const { channelId, messageId } = req.params;
    const userId = req.user!.userId;
    const { emoji } = req.body;

    if (!emoji || typeof emoji !== 'string' || emoji.length > 32) {
      throw new AppError(400, 'A valid emoji is required');
    }

    const message = await ChatRepository.getFullMessage(messageId);
    if (!message || message.channel_id !== channelId) throw new AppError(404, 'Message not found');

    const reactions = await ChatRepository.getReactions(messageId, userId);
    const existing = reactions.find((r: any) => r.emoji === emoji);
    if (existing?.reacted_by_me) {
      await ChatRepository.removeReaction(messageId, userId, emoji);
    } else {
      await ChatRepository.addReaction(messageId, userId, emoji);
    }

    const updated = await ChatRepository.getReactions(messageId, userId);
    const io = getIO();
    io.to(`channel:${channelId}`).emit('chat:reactions', { channelId, messageId, reactions: updated });

    res.json({ reactions: updated });
  }

  static async markRead(req: Request, res: Response) {
    const { channelId } = req.params;
    const userId = req.user!.userId;
    await ChatRepository.markRead(channelId, userId);
    // Notify channel members so read receipts update live without a reload
    const io = getIO();
    io.to(`channel:${channelId}`).emit('chat:read', { channelId, userId });
    res.json({ message: 'Read' });
  }

  static async getOrgMembers(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const members = await ChatRepository.getOrgMembers(orgId!);
    res.json(members);
  }

  static async ensureGeneralChannel(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const userId = req.user!.userId;
    const channel = await ChatRepository.ensureGeneralChannel(orgId!, userId);
    res.json(channel);
  }

  static async getOrCreateDM(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const userId = req.user!.userId;
    const { targetUserId } = req.params;

    if (targetUserId === userId) throw new AppError(400, 'Cannot DM yourself');

    // Verify target user belongs to same org
    const userCheck = await query('SELECT 1 FROM users WHERE id = $1 AND organization_id = $2', [targetUserId, orgId]);
    if (userCheck.rows.length === 0) throw new AppError(400, 'User not found in your organization');

    const channel = await ChatRepository.getOrCreateDMChannel(orgId!, userId, targetUserId);
    res.json(channel);
  }

  static async getFiles(req: Request, res: Response) {
    const { channelId } = req.params;
    const orgId = req.user!.organizationId;
    const channel = await ChatRepository.getChannel(channelId, orgId!);
    if (!channel) throw new AppError(404, 'Channel not found');
    const files = await ChatRepository.getFiles(channelId);
    res.json(files);
  }

  static async uploadFile(req: Request, res: Response) {
    const { channelId } = req.params;
    const userId = req.user!.userId;
    const orgId = req.user!.organizationId;

    const channel = await ChatRepository.getChannel(channelId, orgId!);
    if (!channel) throw new AppError(404, 'Channel not found');

    if (!req.file) throw new AppError(400, 'No file provided');

    const fileUrl = '/files/private/' + req.file.filename;
    const file = await ChatRepository.addFile(
      channelId,
      userId,
      req.file.originalname,
      fileUrl,
      req.file.size,
      req.file.mimetype
    );

    // Notify members about new shared file
    const members = await ChatRepository.getMembers(channelId);
    const uploader = await ChatRepository.getUserInfo(userId);
    const uploaderName = uploader?.first_name
      ? `${uploader.first_name} ${uploader.last_name || ''}`.trim()
      : uploader?.email?.split('@')[0] || 'Someone';

    const io = getIO();
    for (const m of members) {
      if (m.user_id !== userId) {
        io.to(`user:${m.user_id}`).emit('notification', {
          title: channel.name,
          message: `${uploaderName} shared a file: ${req.file.originalname}`,
          type: 'info',
        });
      }
    }

    // Notify all channel members to reload shared files
    io.to(`channel:${channelId}`).emit('chat:file_added', { channelId });

    res.status(201).json(file);
  }

  static async deleteFile(req: Request, res: Response) {
    const { channelId, fileId } = req.params;
    const orgId = req.user!.organizationId;
    const channel = await ChatRepository.getChannel(channelId, orgId!);
    if (!channel) throw new AppError(404, 'Channel not found');
    await ChatRepository.deleteFile(fileId, channelId);
    res.json({ message: 'File deleted' });
  }

  static async getLinkPreview(req: Request, res: Response) {
    const { url } = req.query;
    if (!url || typeof url !== 'string') throw new AppError(400, 'URL is required');

    // SSRF protection: validate URL
    let parsed: URL;
    try {
      parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new AppError(400, 'Only http and https URLs are allowed');
      }
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '[::1]' ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal') ||
        /^10\./.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
        /^192\.168\./.test(hostname) ||
        /^169\.254\./.test(hostname) ||
        /^100\.(6[4-9]|7\d|8\d|9\d|1[01]\d|12[0-7])\./.test(hostname) ||
        hostname.startsWith('[::ffff:') ||
        hostname.startsWith('[fc') ||
        hostname.startsWith('[fd') ||
        /^0:/i.test(hostname)
      ) {
        throw new AppError(400, 'URL points to a private or reserved network address');
      }

      // DNS resolution check: resolve hostname and verify resolved IPs are not private
      const dns = await import('dns/promises');
      const { address: resolvedIp } = await dns.lookup(hostname, { family: 4, all: false });
      if (
        resolvedIp === '127.0.0.1' ||
        resolvedIp === '0.0.0.0' ||
        resolvedIp.startsWith('10.') ||
        resolvedIp.startsWith('172.') ||
        resolvedIp.startsWith('192.168.') ||
        resolvedIp.startsWith('169.254.') ||
        resolvedIp.startsWith('100.') ||
        resolvedIp === '::1'
      ) {
        throw new AppError(400, 'URL resolves to a private or reserved network address');
      }
    } catch (e: any) {
      if (e instanceof AppError) throw e;
      throw new AppError(400, 'Invalid URL');
    }

    try {
      const response = await axios.get(url, {
        timeout: 5000,
        maxContentLength: 5 * 1024 * 1024, // 5MB response limit
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MeticleBot/1.0)' },
      });
      const html = response.data as string;
      const og: Record<string, string> = {};

      const extractMeta = (prop: string) => {
        const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
        const match = html.match(regex);
        if (match) return match[1];
        const regex2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i');
        const match2 = html.match(regex2);
        return match2 ? match2[1] : '';
      };

      og.title = extractMeta('og:title') || extractMeta('twitter:title') || '';
      og.description = extractMeta('og:description') || extractMeta('twitter:description') || '';
      og.image = extractMeta('og:image') || extractMeta('twitter:image') || '';
      og.url = url;

      // Fallback: extract <title> tag
      if (!og.title) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) og.title = titleMatch[1].trim();
      }

      res.json(og);
    } catch {
      res.json({ title: '', description: '', image: '', url });
    }
  }
}
