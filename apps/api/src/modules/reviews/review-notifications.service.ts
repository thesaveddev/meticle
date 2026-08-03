import pool from '../../shared/database';
import { NotificationsController } from '../notifications/notifications.controller';
import { EmailService } from '../../shared/utils/email.service';
import logger from '../../shared/utils/logger';

interface OverdueItem {
  entity_type: string;
  item_name: string;
  person_name: string;
  person_id: string;
  due_date: string;
  organization_id: string;
  location_id: string | null;
  location_name: string | null;
  manager_user_id: string | null;
  manager_email: string | null;
  manager_name: string | null;
}

export class ReviewNotificationService {
  static async checkOverdueReviews(): Promise<number> {
    let notificationCount = 0;
    try {
      const orgsResult = await pool.query(
        `SELECT DISTINCT organization_id FROM people WHERE organization_id IS NOT NULL`
      );
      const orgIds: string[] = orgsResult.rows.map((r: any) => r.organization_id);

      for (const orgId of orgIds) {
        const overdue = await this.getOverdueReviews(orgId);
        if (overdue.length === 0) continue;

        const orgAdmins = await this.getOrgAdmins(orgId);
        const locationManagers = new Map<string, { user_id: string; email: string; name: string }[]>();

        for (const item of overdue) {
          if (item.manager_user_id && !locationManagers.has(item.location_id || '')) {
            locationManagers.set(item.location_id || '', [
              { user_id: item.manager_user_id, email: item.manager_email || '', name: item.manager_name || '' },
            ]);
          }
        }

        for (const item of overdue) {
          const friendlyDue = new Date(item.due_date).toLocaleDateString('en-GB');
          const title = `${this.entityLabel(item.entity_type)} overdue`;
          const message = `"${item.item_name}" for ${item.person_name} was due by ${friendlyDue}.`;

          const notified = new Set<string>();

          // Notify location manager
          if (item.manager_user_id && !notified.has(item.manager_user_id)) {
            notified.add(item.manager_user_id);
            try {
              await NotificationsController.createNotification(
                item.manager_user_id, title, message, 'compliance'
              );
              notificationCount++;
              if (item.manager_email) {
                await this.sendReviewEmail(
                  item.manager_email, item.manager_name || 'Manager',
                  item, friendlyDue
                );
              }
            } catch (e) { /* non-critical */ }
          }

          // Notify org admins (skip already-notified manager)
          for (const admin of orgAdmins) {
            if (notified.has(admin.user_id)) continue;
            notified.add(admin.user_id);
            try {
              await NotificationsController.createNotification(
                admin.user_id, title, message, 'compliance'
              );
              notificationCount++;
              if (admin.email) {
                await this.sendReviewEmail(
                  admin.email, admin.name || 'Admin', item, friendlyDue
                );
              }
            } catch (e) { /* non-critical */ }
          }
        }
      }

      if (notificationCount > 0) {
        logger.info({ notificationCount, orgCount: orgIds.length }, 'Overdue review notifications sent');
      }
    } catch (err: any) {
      logger.error(err, 'Overdue review check failed');
    }
    return notificationCount;
  }

  private static async getOverdueReviews(orgId: string): Promise<OverdueItem[]> {
    const result = await pool.query(
      `SELECT * FROM (
        SELECT 'care_plan' AS entity_type, cp.title AS item_name,
          su.first_name || ' ' || su.last_name AS person_name,
          su.id AS person_id, su.organization_id, su.location_id,
          l.name AS location_name, COALESCE(l.manager_id,
            (SELECT sp.user_id FROM staff_profiles sp JOIN users u ON sp.user_id = u.id
             WHERE u.role = 'MANAGER' AND u.organization_id = su.organization_id
               AND sp.location_id = su.location_id LIMIT 1)) AS manager_user_id,
          mgr.email AS manager_email,
          msp.first_name || ' ' || msp.last_name AS manager_name,
          cp.review_date AS due_date
        FROM care_plans cp
        JOIN people su ON cp.person_id = su.id
        LEFT JOIN locations l ON su.location_id = l.id
        LEFT JOIN users mgr ON l.manager_id = mgr.id
        LEFT JOIN staff_profiles msp ON l.manager_id = msp.user_id
        WHERE su.organization_id = $1
          AND cp.review_date IS NOT NULL AND cp.review_date < CURRENT_DATE
          AND (cp.status IS NULL OR cp.status = 'active')

        UNION ALL

        SELECT 'risk_assessment', ra.type,
          su.first_name || ' ' || su.last_name,
          su.id, su.organization_id, su.location_id,
          l.name, COALESCE(l.manager_id,
            (SELECT sp.user_id FROM staff_profiles sp JOIN users u ON sp.user_id = u.id
             WHERE u.role = 'MANAGER' AND u.organization_id = su.organization_id
               AND sp.location_id = su.location_id LIMIT 1)),
          mgr.email,
          msp.first_name || ' ' || msp.last_name,
          ra.review_date
        FROM risk_assessments ra
        JOIN people su ON ra.person_id = su.id
        LEFT JOIN locations l ON su.location_id = l.id
        LEFT JOIN users mgr ON l.manager_id = mgr.id
        LEFT JOIN staff_profiles msp ON l.manager_id = msp.user_id
        WHERE su.organization_id = $1
          AND ra.review_date IS NOT NULL AND ra.review_date < CURRENT_DATE

        UNION ALL

        SELECT 'care_assessment', ca.assessment_type || ' Assessment',
          su.first_name || ' ' || su.last_name,
          su.id, su.organization_id, su.location_id,
          l.name, COALESCE(l.manager_id,
            (SELECT sp.user_id FROM staff_profiles sp JOIN users u ON sp.user_id = u.id
             WHERE u.role = 'MANAGER' AND u.organization_id = su.organization_id
               AND sp.location_id = su.location_id LIMIT 1)),
          mgr.email,
          msp.first_name || ' ' || msp.last_name,
          ca.next_review_date
        FROM care_assessments ca
        JOIN people su ON ca.person_id = su.id
        LEFT JOIN locations l ON su.location_id = l.id
        LEFT JOIN users mgr ON l.manager_id = mgr.id
        LEFT JOIN staff_profiles msp ON l.manager_id = msp.user_id
        WHERE su.organization_id = $1
          AND ca.next_review_date IS NOT NULL AND ca.next_review_date < CURRENT_DATE

        UNION ALL

        SELECT 'dnacpr', 'DNACPR Review',
          su.first_name || ' ' || su.last_name,
          su.id, su.organization_id, su.location_id,
          l.name, COALESCE(l.manager_id,
            (SELECT sp.user_id FROM staff_profiles sp JOIN users u ON sp.user_id = u.id
             WHERE u.role = 'MANAGER' AND u.organization_id = su.organization_id
               AND sp.location_id = su.location_id LIMIT 1)),
          mgr.email,
          msp.first_name || ' ' || msp.last_name,
          su.dnacpr_review_date
        FROM people su
        LEFT JOIN locations l ON su.location_id = l.id
        LEFT JOIN users mgr ON l.manager_id = mgr.id
        LEFT JOIN staff_profiles msp ON l.manager_id = msp.user_id
        WHERE su.organization_id = $1
          AND su.dnacpr_review_date IS NOT NULL AND su.dnacpr_review_date < CURRENT_DATE

        UNION ALL

        SELECT 'capacity', 'Capacity Assessment',
          su.first_name || ' ' || su.last_name,
          su.id, su.organization_id, su.location_id,
          l.name, COALESCE(l.manager_id,
            (SELECT sp.user_id FROM staff_profiles sp JOIN users u ON sp.user_id = u.id
             WHERE u.role = 'MANAGER' AND u.organization_id = su.organization_id
               AND sp.location_id = su.location_id LIMIT 1)),
          mgr.email,
          msp.first_name || ' ' || msp.last_name,
          sca.review_date
        FROM person_capacity_assessments sca
        JOIN people su ON sca.person_id = su.id
        LEFT JOIN locations l ON su.location_id = l.id
        LEFT JOIN users mgr ON l.manager_id = mgr.id
        LEFT JOIN staff_profiles msp ON l.manager_id = msp.user_id
        WHERE su.organization_id = $1
          AND sca.review_date IS NOT NULL AND sca.review_date < CURRENT_DATE

        UNION ALL

        SELECT 'goal', g.title,
          su.first_name || ' ' || su.last_name,
          su.id, su.organization_id, su.location_id,
          l.name, COALESCE(l.manager_id,
            (SELECT sp.user_id FROM staff_profiles sp JOIN users u ON sp.user_id = u.id
             WHERE u.role = 'MANAGER' AND u.organization_id = su.organization_id
               AND sp.location_id = su.location_id LIMIT 1)),
          mgr.email,
          msp.first_name || ' ' || msp.last_name,
          g.review_date
        FROM person_goals g
        JOIN people su ON g.person_id = su.id
        LEFT JOIN locations l ON su.location_id = l.id
        LEFT JOIN users mgr ON l.manager_id = mgr.id
        LEFT JOIN staff_profiles msp ON l.manager_id = msp.user_id
        WHERE su.organization_id = $1
          AND g.review_date IS NOT NULL AND g.review_date < CURRENT_DATE
          AND (g.status IS NULL OR g.status = 'active')
      ) reviews
      ORDER BY due_date ASC`,
      [orgId]
    );
    return result.rows;
  }

  private static async getOrgAdmins(
    orgId: string
  ): Promise<{ user_id: string; email: string; name: string }[]> {
    const result = await pool.query(
      `SELECT u.id AS user_id, u.email,
              COALESCE(sp.first_name || ' ' || sp.last_name, u.email) AS name
       FROM users u
       LEFT JOIN staff_profiles sp ON u.id = sp.user_id
       WHERE u.organization_id = $1
         AND u.role IN ('ORG_ADMIN', 'MANAGER')
         AND u.status = 'active'`,
      [orgId]
    );
    return result.rows;
  }

  private static entityLabel(type: string): string {
    const map: Record<string, string> = {
      care_plan: 'Care plan review',
      risk_assessment: 'Risk assessment review',
      care_assessment: 'Care assessment review',
      dnacpr: 'DNACPR review',
      capacity: 'Capacity assessment review',
      goal: 'Goal review',
    };
    return map[type] || 'Review';
  }

  private static async sendReviewEmail(
    to: string,
    recipientName: string,
    item: OverdueItem,
    friendlyDue: string
  ): Promise<void> {
    if (!to) return;
    const subject = `Overdue review: ${item.item_name} for ${item.person_name}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #E5E7EB; border-radius: 8px;">
        <h2 style="color: #DC2626; margin-top: 0;">Overdue Review</h2>
        <p>Hello ${recipientName},</p>
        <p>
          A <strong>${item.item_name}</strong> for <strong>${item.person_name}</strong>
          ${item.location_name ? ` at <strong>${item.location_name}</strong>` : ''}
          was due for review by <strong>${friendlyDue}</strong> and is now overdue.
        </p>
        <p style="color: #6B7280; font-size: 14px;">
          Please review and update this item at your earliest convenience.
          Log in to <a href="https://meticlecare.com" style="color: #0F4C81;">Meticle</a> to take action.
        </p>
      </div>`;
    try {
      await EmailService.sendEmail(to, subject, html);
    } catch { /* email non-critical */ }
  }
}
