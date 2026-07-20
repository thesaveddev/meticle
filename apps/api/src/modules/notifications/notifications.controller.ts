import { Request, Response } from 'express';
import pool from '../../shared/database';
import { getIO } from '../../shared/socket';

export class NotificationsController {
  static async getMyNotifications(req: Request, res: Response) {
    const userId = req.user!.userId;
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [userId]
    );
    res.json(result.rows);
  }

  static async getUnreadCount(req: Request, res: Response) {
    const userId = req.user!.userId;
    const result = await pool.query(
      'SELECT COUNT(*)::int as count FROM notifications WHERE user_id = $1 AND read = FALSE',
      [userId]
    );
    res.json({ count: result.rows[0].count });
  }

  static async markAsRead(req: Request, res: Response) {
    const { id } = req.params;
    const userId = req.user!.userId;
    await pool.query(
      'UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    res.json({ message: 'Marked as read' });
  }

  static async markAllAsRead(req: Request, res: Response) {
    const userId = req.user!.userId;
    await pool.query(
      'UPDATE notifications SET read = TRUE WHERE user_id = $1',
      [userId]
    );
    res.json({ message: 'All marked as read' });
  }

  static async createNotification(userId: string, title: string, message: string, type: string = 'info') {
    const notifyUserIds = new Set<string>([userId]);
    try {
      const delegateRes = await pool.query(
        `SELECT delegate_manager_id FROM manager_delegations
         WHERE primary_manager_id = $1 AND is_active = true
           AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)`,
        [userId]
      );
      for (const row of delegateRes.rows) notifyUserIds.add(row.delegate_manager_id);
    } catch { /* delegation lookup non-critical */ }

    for (const uid of notifyUserIds) {
      try {
        if (type && type !== 'info') {
          const prefRes = await pool.query(
            'SELECT enabled FROM notification_preferences WHERE user_id = $1 AND notification_type = $2',
            [uid, type]
          );
          if (prefRes.rows.length > 0 && !prefRes.rows[0].enabled) continue;
        }

        const result = await pool.query(
          'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4) RETURNING *',
          [uid, title, message, type]
        );
        const io = getIO();
        io.to(`user:${uid}`).emit('notification', result.rows[0]);
        const countRes = await pool.query(
          "SELECT COUNT(*)::int as count FROM notifications WHERE user_id = $1 AND read = FALSE",
          [uid]
        );
        io.to(`user:${uid}`).emit('unread_count', { count: countRes.rows[0].count });
      } catch { /* notification per user non-critical */ }
    }
  }

  static async getPreferences(req: Request, res: Response) {
    const userId = req.user!.userId;
    const types = ['compliance', 'training', 'documents', 'leave', 'shift', 'swap', 'overtime', 'survey', 'delegation', 'general'];
    const existing = await pool.query('SELECT notification_type, enabled FROM notification_preferences WHERE user_id = $1', [userId]);
    const map: Record<string, boolean> = {};
    existing.rows.forEach((r: any) => { map[r.notification_type] = r.enabled });
    const prefs = types.map(t => ({ notification_type: t, enabled: map[t] !== false }));
    res.json(prefs);
  }

  static async updatePreference(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { notification_type, enabled } = req.body;
    await pool.query(
      `INSERT INTO notification_preferences (user_id, notification_type, enabled) VALUES ($1,$2,$3)
       ON CONFLICT (user_id, notification_type) DO UPDATE SET enabled = EXCLUDED.enabled`,
      [userId, notification_type, enabled]
    );
    res.json({ notification_type, enabled });
  }
}
