import { query } from '../../shared/database';

export class ChatRepository {
  static async getChannels(organizationId: string, userId: string) {
    const result = await query(
      `SELECT cc.*, 
        (SELECT COUNT(*) FROM chat_messages cm WHERE cm.channel_id = cc.id) as message_count,
        (SELECT COALESCE(NULLIF(cm.content, ''), '📎 ' || cm.file_name, '') FROM chat_messages cm WHERE cm.channel_id = cc.id ORDER BY cm.created_at DESC LIMIT 1) as last_message,
        (SELECT cm2.created_at FROM chat_messages cm2 WHERE cm2.channel_id = cc.id ORDER BY cm2.created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM chat_messages cm3 WHERE cm3.channel_id = cc.id AND cm3.created_at > COALESCE(cm4.last_read_at, '1970-01-01')) as unread_count,
        (SELECT json_agg(json_build_object('user_id', cm5.user_id, 'first_name', sp2.first_name, 'last_name', sp2.last_name, 'email', u2.email))
         FROM chat_members cm5
         JOIN users u2 ON cm5.user_id = u2.id
         LEFT JOIN staff_profiles sp2 ON u2.id = sp2.user_id
         WHERE cm5.channel_id = cc.id) as members
       FROM chat_channels cc
       JOIN chat_members cm4 ON cm4.channel_id = cc.id AND cm4.user_id = $2
       WHERE cc.organization_id = $1
       ORDER BY 
         CASE cc.type 
           WHEN 'general' THEN 0 
           WHEN 'dm' THEN 2 
           ELSE 1 
         END,
         last_message_at DESC NULLS LAST, cc.created_at DESC`,
      [organizationId, userId]
    );
    return result.rows;
  }

  static async getChannel(channelId: string, organizationId: string) {
    const result = await query(
      `SELECT cc.*, 
        (SELECT COUNT(*) FROM chat_messages cm WHERE cm.channel_id = cc.id) as message_count
       FROM chat_channels cc
       WHERE cc.id = $1 AND cc.organization_id = $2`,
      [channelId, organizationId]
    );
    return result.rows[0] || null;
  }

  static async createChannel(organizationId: string, name: string, type: string, createdBy: string) {
    const result = await query(
      `INSERT INTO chat_channels (organization_id, name, type, created_by) VALUES ($1, $2, $3, $4) RETURNING *`,
      [organizationId, name, type, createdBy]
    );
    return result.rows[0];
  }

  static async addMember(channelId: string, userId: string) {
    const result = await query(
      `INSERT INTO chat_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *`,
      [channelId, userId]
    );
    return result.rows[0] || null;
  }

  static async removeMember(channelId: string, userId: string) {
    await query('DELETE FROM chat_members WHERE channel_id = $1 AND user_id = $2', [channelId, userId]);
  }

  static async getMembers(channelId: string) {
    const result = await query(
      `SELECT cm.*, u.email, sp.first_name, sp.last_name, sp.profile_picture_url
       FROM chat_members cm
       JOIN users u ON cm.user_id = u.id
       LEFT JOIN staff_profiles sp ON u.id = sp.user_id
       WHERE cm.channel_id = $1
       ORDER BY sp.first_name`,
      [channelId]
    );
    return result.rows;
  }

  static async getMessages(channelId: string, limit = 50, before?: string) {
    let sql = `SELECT cm.*, u.email, sp.first_name, sp.last_name, sp.profile_picture_url
               FROM chat_messages cm
               JOIN users u ON cm.sender_id = u.id
               LEFT JOIN staff_profiles sp ON u.id = sp.user_id
               WHERE cm.channel_id = $1`;
    const params: any[] = [channelId];

    if (before) {
      params.push(before);
      sql += ` AND cm.created_at < $2`;
    }

    sql += ` ORDER BY cm.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(sql, params);
    return result.rows.reverse();
  }

  static async sendMessage(channelId: string, senderId: string, content: string, fileUrl?: string, fileName?: string) {
    const result = await query(
      `INSERT INTO chat_messages (channel_id, sender_id, content, file_url, file_name) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [channelId, senderId, content, fileUrl || null, fileName || null]
    );

    // Update channel updated_at
    await query('UPDATE chat_channels SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [channelId]);

    // Fetch full message with user info
    const fullMsg = await query(
      `SELECT cm.*, u.email, sp.first_name, sp.last_name, sp.profile_picture_url
       FROM chat_messages cm
       JOIN users u ON cm.sender_id = u.id
       LEFT JOIN staff_profiles sp ON u.id = sp.user_id
       WHERE cm.id = $1`,
      [result.rows[0].id]
    );
    return fullMsg.rows[0];
  }

  static async markRead(channelId: string, userId: string) {
    await query(
      `UPDATE chat_members SET last_read_at = CURRENT_TIMESTAMP WHERE channel_id = $1 AND user_id = $2`,
      [channelId, userId]
    );
  }

  static async getMemberLastRead(channelId: string, userId: string) {
    const result = await query(
      `SELECT last_read_at FROM chat_members WHERE channel_id = $1 AND user_id = $2`,
      [channelId, userId]
    );
    return result.rows[0]?.last_read_at || null;
  }

  static async ensureGeneralChannel(organizationId: string, userId: string) {
    const existing = await query(
      `SELECT id FROM chat_channels WHERE organization_id = $1 AND type = 'general' LIMIT 1`,
      [organizationId]
    );
    if (existing.rows.length > 0) {
      // Ensure caller is a member
      await this.addMember(existing.rows[0].id, userId);
      return existing.rows[0];
    }

    const channel = await this.createChannel(organizationId, 'General', 'general', userId);

    // Add all active org members
    const members = await query(
      `SELECT id FROM users WHERE organization_id = $1 AND status = 'active'`,
      [organizationId]
    );
    for (const m of members.rows) {
      await this.addMember(channel.id, m.id);
    }

    return channel;
  }

  static async getOrgMembers(organizationId: string) {
    const result = await query(
      `SELECT u.id, u.email, u.role, sp.first_name, sp.last_name, sp.profile_picture_url
       FROM users u
       LEFT JOIN staff_profiles sp ON u.id = sp.user_id
       WHERE u.organization_id = $1 AND u.status = 'active'
       ORDER BY sp.first_name, sp.last_name`,
      [organizationId]
    );
    return result.rows;
  }

  static async getUserInfo(userId: string) {
    const result = await query(
      `SELECT u.id, u.email, sp.first_name, sp.last_name, sp.profile_picture_url
       FROM users u
       LEFT JOIN staff_profiles sp ON u.id = sp.user_id
       WHERE u.id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  static async getOrCreateDMChannel(organizationId: string, user1Id: string, user2Id: string) {
    // Find existing DM between these two users
    const existing = await query(
      `SELECT cc.* FROM chat_channels cc
       WHERE cc.organization_id = $1 AND cc.type = 'dm'
       AND EXISTS (SELECT 1 FROM chat_members cm WHERE cm.channel_id = cc.id AND cm.user_id = $2)
       AND EXISTS (SELECT 1 FROM chat_members cm WHERE cm.channel_id = cc.id AND cm.user_id = $3)`,
      [organizationId, user1Id, user2Id]
    );
    if (existing.rows.length > 0) return existing.rows[0];

    // Get user names for channel name
    const user2 = await query('SELECT email, sp.first_name, sp.last_name FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id WHERE u.id = $1', [user2Id]);
    const name = user2.rows[0]?.first_name
      ? `${user2.rows[0].first_name} ${user2.rows[0].last_name || ''}`.trim()
      : user2.rows[0]?.email?.split('@')[0] || user2Id;

    const channel = await this.createChannel(organizationId, name, 'dm', user1Id);
    await this.addMember(channel.id, user1Id);
    await this.addMember(channel.id, user2Id);
    return channel;
  }

  static async getFiles(channelId: string) {
    const result = await query(
      `SELECT cf.*, u.email, sp.first_name, sp.last_name
       FROM chat_files cf
       JOIN users u ON cf.uploaded_by = u.id
       LEFT JOIN staff_profiles sp ON u.id = sp.user_id
       WHERE cf.channel_id = $1
       ORDER BY cf.created_at DESC`,
      [channelId]
    );
    return result.rows;
  }

  static async addFile(channelId: string, uploadedBy: string, fileName: string, fileUrl: string, fileSize?: number, fileType?: string) {
    const result = await query(
      `INSERT INTO chat_files (channel_id, uploaded_by, file_name, file_url, file_size, file_type)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [channelId, uploadedBy, fileName, fileUrl, fileSize || null, fileType || null]
    );
    return result.rows[0];
  }

  static async deleteFile(fileId: string, channelId: string) {
    await query('DELETE FROM chat_files WHERE id = $1 AND channel_id = $2', [fileId, channelId]);
  }
}
