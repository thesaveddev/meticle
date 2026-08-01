import pool, { query } from '../../shared/database';
import { NotificationsController } from '../notifications/notifications.controller';
import { EmailService } from '../../shared/utils/email.service';
import logger, { logWarn } from '../../shared/utils/logger';
import { ComplianceRepository } from './compliance.repository';

const EXPIRING_SOON_DAYS = 14;

/** Tracks last digest send per org to enforce 24-hour cadence. */
const digestSentTracker = new Map<string, number>();

export class ComplianceNotificationService {
  /** Run all compliance checks for a single organization (HTTP requests). */
  static async runAllChecks(organizationId: string) {
    if (!organizationId) {
      throw new Error('organizationId is required for runAllChecks');
    }
    return this._runAllChecks(organizationId);
  }

  /** Run all compliance checks across every organization (cron job). */
  static async runAllChecksForAllOrgs() {
    return this._runAllChecks(undefined);
  }

  private static async _runAllChecks(organizationId?: string) {
    const results = {
      documents: { notified: 0, expiring: 0, expired: 0 },
      training: { notified: 0, expiring: 0, expired: 0 },
      competency: { notified: 0, due: 0 },
      snapshots: 0,
    };

    const docResults = await this.checkDocumentExpirations(organizationId);
    results.documents = docResults;

    const trainingResults = await this.checkTrainingExpirations(organizationId);
    results.training = trainingResults;

    const competencyResults = await this.checkCompetencyDue(organizationId);
    results.competency = competencyResults;

    // Take compliance snapshots
    const snapshotsCount = await this.takeSnapshots(organizationId);
    results.snapshots = snapshotsCount;

    // Check escalation thresholds
    const escalated = await this.checkEscalationThresholds(organizationId);
    (results as any).escalated = escalated;

    // Check predictive alerts
    const predicted = await this.checkPredictiveAlerts(organizationId);
    (results as any).predicted = predicted;

    logger.info({ results }, 'Compliance check complete');
    return results;
  }

  static async checkEscalationThresholds(organizationId?: string) {
    let sql = `SELECT id, name, compliance_alert_threshold FROM organizations WHERE compliance_alert_threshold IS NOT NULL`;
    const params: any[] = [];
    if (organizationId) {
      sql += ` AND id = $1`;
      params.push(organizationId);
    }
    const orgsResult = await query(sql, params);
    let escalated = 0;
    for (const org of orgsResult.rows) {
      const threshold = parseInt(org.compliance_alert_threshold);
      const compResult = await query(
        `SELECT ROUND(COUNT(*) FILTER (WHERE cr.status = 'complete')::numeric / NULLIF(COUNT(*), 0) * 100, 0) as rate
         FROM compliance_records cr
         JOIN staff_profiles sp ON cr.staff_id = sp.id
         JOIN users u ON sp.user_id = u.id
         WHERE u.organization_id = $1`,
        [org.id]
      );
      const rate = parseFloat(compResult.rows[0]?.rate || '100');
      if (rate < threshold) {
        const admins = await query(
          `SELECT u.id, u.email, COALESCE(NULLIF(sp.first_name || ' ' || sp.last_name, ''), u.email) as name
           FROM users u
           LEFT JOIN staff_profiles sp ON u.id = sp.user_id
           WHERE u.organization_id = $1 AND u.role IN ('ORG_ADMIN', 'MANAGER') AND u.status = 'active'`,
          [org.id]
        );
        for (const admin of admins.rows) {
          await NotificationsController.createNotification(
            admin.id, 'Compliance Alert — Threshold Breached',
            `Overall compliance (${Math.round(rate)}%) has fallen below your organisation's alert threshold of ${threshold}%. Immediate attention required.`,
            'compliance'
          ).catch(logWarn('complianceThresholdNotification'));
          if (admin.email) {
            EmailService.sendEmail(
              admin.email,
              `Meticle — Compliance Alert: Threshold Breached (${org.name})`,
              `<p>Hi ${admin.name},</p><p>The overall compliance rate for <strong>${org.name}</strong> has fallen below your organisation's alert threshold.</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><tr><td style="padding:12px;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px"><strong style="color:#DC2626;font-size:24px">${Math.round(rate)}%</strong><br/><span style="color:#6B7280;font-size:13px">Current compliance rate</span></td><td style="padding:12px;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px"><strong style="font-size:24px">${threshold}%</strong><br/><span style="color:#6B7280;font-size:13px">Alert threshold</span></td></tr></table><p style="color:#DC2626;font-weight:700">Immediate attention required.</p><p><a href="${process.env.FRONTEND_URL || ''}/compliance" style="display:inline-block;padding:10px 24px;background:#0F4C81;color:#fff;text-decoration:none;border-radius:6px">View Compliance Dashboard →</a></p>`
            ).catch(logWarn('complianceThresholdEmail'));
          }
        }
        escalated++;
      }
    }
    return escalated;
  }

  /** Analyse compliance trend over the last 60 days. Alert if declining toward threshold. */
  static async checkPredictiveAlerts(organizationId?: string) {
    let sql = `SELECT id, name, compliance_alert_threshold FROM organizations WHERE predictive_alerts_enabled = true`;
    const params: any[] = [];
    if (organizationId) { sql += ` WHERE id = $1`; params.push(organizationId); }
    const orgsResult = await query(sql, params);
    let alerted = 0;

    for (const org of orgsResult.rows) {
      const threshold = parseInt(org.compliance_alert_threshold) || 70;
      const days = 60;

      const snapResult = await query(
        `SELECT snapshot_date, ROUND(AVG(overall_score)::numeric, 2) as avg_score
         FROM compliance_snapshots
         WHERE organization_id = $1 AND snapshot_date >= CURRENT_DATE - interval '1 day' * $2
         GROUP BY snapshot_date ORDER BY snapshot_date`,
        [org.id, days]
      );
      const rows = snapResult.rows;
      if (rows.length < 14) continue; // need at least 2 weeks of data

      // Simple linear regression to detect trend
      const n = rows.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += parseFloat(rows[i].avg_score);
        sumXY += i * parseFloat(rows[i].avg_score);
        sumX2 += i * i;
      }
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const lastScore = parseFloat(rows[n - 1].avg_score);
      const projected = lastScore + slope * 30; // project 30 days ahead

      // Alert if declining significantly and approaching threshold
      if (slope < -0.1 && (projected < threshold || lastScore < threshold + 5)) {
        const admins = await query(
          `SELECT u.id, u.email, COALESCE(NULLIF(sp.first_name || ' ' || sp.last_name, ''), u.email) as name
           FROM users u
           LEFT JOIN staff_profiles sp ON u.id = sp.user_id
           WHERE u.organization_id = $1 AND u.role IN ('ORG_ADMIN', 'MANAGER') AND u.status = 'active'`,
          [org.id]
        );
        const trendMsg = `Compliance is declining (${slope.toFixed(1)}% per day trend). Current: ${Math.round(lastScore)}%. ${projected < threshold ? `Projected to fall below ${threshold}% threshold within 30 days.` : `Nearing threshold.`}`;
        for (const admin of admins.rows) {
          await NotificationsController.createNotification(
            admin.id, 'Predictive Alert — Compliance Declining',
            trendMsg, 'compliance'
          ).catch(logWarn('predictiveAlertNotification'));
          if (admin.email) {
            EmailService.sendEmail(
              admin.email,
              `Meticle — Predictive Alert: Compliance Declining (${org.name})`,
              `<p>Hi ${admin.name},</p><p>Compliance for <strong>${org.name}</strong> is on a declining trend.</p><p>${trendMsg}</p><p><a href="${process.env.FRONTEND_URL || ''}/compliance" style="display:inline-block;padding:10px 24px;background:#0F4C81;color:#fff;text-decoration:none;border-radius:6px">View Compliance Dashboard →</a></p>`
            ).catch(logWarn('predictiveAlertEmail'));
          }
        }
        alerted++;
      }
    }
    return alerted;
  }

  static async takeSnapshots(organizationId?: string) {
    // Get all active staff across all orgs (or one org) with their compliance rates
    let sql =
      `SELECT sp.id as staff_id, u.organization_id,
              ROUND(COUNT(*) FILTER (WHERE cr.status = 'complete')::numeric / NULLIF(COUNT(*), 0) * 100, 2) as score
       FROM staff_profiles sp
       JOIN users u ON sp.user_id = u.id
       LEFT JOIN compliance_records cr ON cr.staff_id = sp.id
       WHERE u.status = 'active'`;
    const params: any[] = [];
    if (organizationId) {
      sql += ` AND u.organization_id = $1`;
      params.push(organizationId);
    }
    sql += ` GROUP BY sp.id, u.organization_id HAVING COUNT(*) > 0`;
    const snapResult = await query(sql, params);
    const rows = snapResult.rows;

    if (rows.length === 0) return 0;

    // Batch insert snapshots for today
    const today = new Date().toISOString().split('T')[0];
    let inserted = 0;
    for (const row of rows) {
      try {
        await query(
          `INSERT INTO compliance_snapshots (staff_id, organization_id, overall_score, snapshot_date)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (staff_id, snapshot_date) DO UPDATE SET overall_score = EXCLUDED.overall_score`,
          [row.staff_id, row.organization_id, row.score, today]
        );
        inserted++;
      } catch (err) {
        // Skip duplicate or errored inserts
      }
    }
    return inserted;
  }

  static async checkDocumentExpirations(organizationId?: string) {
    const result = { notified: 0, expiring: 0, expired: 0 };

    let sql =
      `SELECT d.id, d.type, d.expiry_date, d.status, d.renewal_status,
               sp.id as staff_id, sp.first_name, sp.last_name, sp.user_id,
              u.email, u.organization_id
       FROM documents d
       JOIN staff_profiles sp ON d.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       WHERE u.status = 'active'
         AND d.status NOT IN ('expired', 'rejected')
         AND (
           d.expiry_date <= CURRENT_DATE + interval '1 day' * $1
           OR d.expiry_date <= CURRENT_DATE
         )`;
    const params: any[] = [EXPIRING_SOON_DAYS];
    if (organizationId) {
      sql += ` AND u.organization_id = $2`;
      params.push(organizationId);
    }
    const docsResult = await query(sql, params);
    const rows = docsResult.rows;

    for (const doc of rows) {
      const isExpired = doc.expiry_date && new Date(doc.expiry_date) <= new Date();
      const staffName = `${doc.first_name} ${doc.last_name}`.trim();

      if (isExpired) {
        // In-app to staff
        NotificationsController.createNotification(
          doc.user_id, 'Document Expired',
          `Your ${doc.type} has expired. Please upload a renewed copy immediately.`,
          'compliance'
        ).catch(logWarn('documentExpiringNotification'));

        // Auto-set renewal to requested for identity-type documents (DBS, Passport, Visa, RTW)
        const identityTypes = ['DBS', 'PASSPORT', 'VISA', 'RIGHT_TO_WORK'];
        if (identityTypes.includes(doc.type) && doc.renewal_status !== 'requested' && doc.renewal_status !== 'renewed') {
          await query('UPDATE documents SET renewal_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['requested', doc.id]);
          const autoRenewalTitle = `${doc.type} Renewal Auto-Requested`;
          const autoRenewalMsg = `Your ${doc.type} has expired. A renewal has been automatically requested. Please upload your renewed ${doc.type} as soon as possible.`;
          NotificationsController.createNotification(
            doc.user_id, autoRenewalTitle, autoRenewalMsg, 'compliance'
          ).catch(logWarn('autoRenewalNotification'));
          if (doc.email) {
            EmailService.sendDocumentExpiredEmail(doc.email, staffName, doc.type).catch(logWarn('autoRenewalEmail'));
          }
        }

        result.expired++;
      } else {
        NotificationsController.createNotification(
          doc.user_id, 'Document Expiring Soon',
          `Your ${doc.type} expires on ${new Date(doc.expiry_date).toLocaleDateString()}. Please upload a renewed copy.`,
          'compliance'
        ).catch(logWarn('documentExpiryNotification'));

        result.expiring++;
      }

      // Email to staff
      if (doc.email) {
        if (isExpired) {
          EmailService.sendDocumentExpiredEmail(doc.email, staffName, doc.type).catch(logWarn('documentExpiredEmail'));
        } else {
          EmailService.sendDocumentExpiringEmail(doc.email, staffName, doc.type, new Date(doc.expiry_date).toLocaleDateString()).catch(logWarn('documentExpiringEmail'));
        }
      }

      // Notify org managers/admins about expired docs only (avoids spam for expiring)
      if (isExpired) {
        await this.notifyOrgAdmins(doc.organization_id, 'Document Expired',
          `${staffName}'s ${doc.type} has expired and needs immediate attention.`,
          `/staff/${doc.staff_id}`
        );
      }

      result.notified++;
    }

    return result;
  }

  static async checkTrainingExpirations(organizationId?: string) {
    const result = { notified: 0, expiring: 0, expired: 0 };

    let sql =
      `SELECT tr.id, tr.expires_at, tr.status as record_status,
              tm.name as module_name,
              sp.id as staff_id, sp.first_name, sp.last_name, sp.user_id,
              u.email, u.organization_id
       FROM training_records tr
       JOIN training_modules tm ON tr.module_id = tm.id
       JOIN staff_profiles sp ON tr.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       WHERE u.status = 'active'
         AND tr.status = 'completed'
         AND tr.expires_at IS NOT NULL
         AND (
           tr.expires_at <= CURRENT_DATE + interval '1 day' * $1
           OR tr.expires_at <= CURRENT_DATE
         )`;
    const params: any[] = [EXPIRING_SOON_DAYS];
    if (organizationId) {
      sql += ` AND u.organization_id = $2`;
      params.push(organizationId);
    }
    const trainingResult = await query(sql, params);
    const rows = trainingResult.rows;

    for (const rec of rows) {
      const isExpired = new Date(rec.expires_at) <= new Date();
      const staffName = `${rec.first_name} ${rec.last_name}`.trim();
      const expiryStr = new Date(rec.expires_at).toLocaleDateString();

      if (isExpired) {
        NotificationsController.createNotification(
          rec.user_id, 'Training Expired',
          `Your "${rec.module_name}" training has expired. Please complete refresher training.`,
          'compliance'
        ).catch(logWarn('trainingExpiringNotification'));
        result.expired++;
      } else {
        NotificationsController.createNotification(
          rec.user_id, 'Training Expiring Soon',
          `Your "${rec.module_name}" training expires on ${expiryStr}. Please schedule refresher training.`,
          'compliance'
        ).catch(logWarn('trainingExpiryNotification'));
        result.expiring++;
      }

      if (rec.email) {
        if (isExpired) {
          EmailService.sendTrainingExpiredEmail(rec.email, staffName, rec.module_name).catch(logWarn('trainingExpiredEmail'));
        } else {
          EmailService.sendTrainingExpiringEmail(rec.email, staffName, rec.module_name, expiryStr).catch(logWarn('trainingExpiringEmail'));
        }
      }

      // Notify admin about expired training
      if (isExpired) {
        await this.notifyOrgAdmins(rec.organization_id, 'Training Expired',
          `${staffName}'s "${rec.module_name}" training has expired.`,
          `/staff/${rec.staff_id}`
        );
      }

      result.notified++;
    }

    return result;
  }

  static async checkCompetencyDue(organizationId?: string) {
    const result = { notified: 0, due: 0 };

    let sql =
      `SELECT ca.id, ca.assessed_at, ca.reassessment_date,
              ct.name as template_name,
              sp.id as staff_id, sp.first_name, sp.last_name, sp.user_id,
              u.email, u.organization_id
       FROM competency_assessments ca
       JOIN competency_templates ct ON ca.template_id = ct.id
       JOIN staff_profiles sp ON ca.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       WHERE u.status = 'active'
         AND ca.reassessment_date IS NOT NULL
         AND ca.reassessment_date <= CURRENT_DATE + interval '1 day' * $1`;
    const params: any[] = [EXPIRING_SOON_DAYS];
    if (organizationId) {
      sql += ` AND u.organization_id = $2`;
      params.push(organizationId);
    }
    const compResult = await query(sql, params);
    const rows = compResult.rows;

    for (const comp of rows) {
      const isOverdue = new Date(comp.reassessment_date) <= new Date();
      const staffName = `${comp.first_name} ${comp.last_name}`.trim();
      const dueStr = new Date(comp.reassessment_date).toLocaleDateString();

      if (isOverdue) {
        NotificationsController.createNotification(
          comp.user_id, 'Competency Reassessment Overdue',
          `Your "${comp.template_name}" competency reassessment was due on ${dueStr}. Please schedule reassessment.`,
          'compliance'
        ).catch(logWarn('competencyDueNotification'));
      } else {
        NotificationsController.createNotification(
          comp.user_id, 'Competency Reassessment Due Soon',
          `Your "${comp.template_name}" competency reassessment is due on ${dueStr}. Please schedule it.`,
          'compliance'
        ).catch(logWarn('competencyOverdueNotification'));
      }

      if (comp.email) {
        EmailService.sendCompetencyDueEmail(comp.email, staffName, comp.template_name, dueStr, isOverdue).catch(logWarn('competencyDueEmail'));
      }

      result.due++;
      result.notified++;
    }

    return result;
  }

  private static async notifyOrgAdmins(orgId: string, title: string, message: string, link?: string) {
    const admins = await query(
      `SELECT id FROM users WHERE organization_id = $1 AND role IN ('ORG_ADMIN', 'MANAGER') AND status = 'active'`,
      [orgId]
    );
    for (const admin of admins.rows) {
      NotificationsController.createNotification(admin.id, title, message, 'compliance').catch(logWarn('escalationNotification'));
    }
  }

  /** Send daily compliance digest emails to location managers for orgs that have it enabled. */
  static async sendComplianceDigests() {
    const enabledOrgs = await query(
      `SELECT id, name FROM organizations WHERE compliance_digest_enabled = true AND status = 'active'`
    );

    for (const org of enabledOrgs.rows) {
      // Rate-limit to once per 24 hours per org
      const lastSent = digestSentTracker.get(org.id);
      if (lastSent && Date.now() - lastSent < 86_400_000) continue;

      // Get all incomplete compliance records for this org, grouped by location and staff
      const result = await query(
        `SELECT
           l.id as location_id, l.name as location_name, l.manager_id,
           sp.id as staff_id,
           COALESCE(NULLIF(sp.first_name || ' ' || sp.last_name, ''), u.email) as staff_name,
           cc.name as requirement_name, cc.category
         FROM compliance_records cr
         JOIN compliance_config cc ON cr.requirement_id = cc.id
         JOIN staff_profiles sp ON cr.staff_id = sp.id
         JOIN users u ON sp.user_id = u.id
         LEFT JOIN locations l ON sp.location_id = l.id
         WHERE u.organization_id = $1
           AND cr.status != 'complete'
           AND u.status = 'active'
         ORDER BY l.name NULLS LAST, sp.first_name, sp.last_name`,
        [org.id]
      );

      // Group by location → staff → requirements
      const locations = new Map<string, { name: string; managerId: string | null; staff: Map<string, { staffName: string; items: { requirement: string; category: string }[] }> }>();

      for (const row of result.rows) {
        const locId = row.location_id || '__unassigned';
        if (!locations.has(locId)) {
          locations.set(locId, {
            name: row.location_name || 'Unassigned',
            managerId: row.manager_id,
            staff: new Map()
          });
        }
        const loc = locations.get(locId)!;
        if (!loc.staff.has(row.staff_id)) {
          loc.staff.set(row.staff_id, { staffName: row.staff_name, items: [] });
        }
        loc.staff.get(row.staff_id)!.items.push({
          requirement: row.requirement_name,
          category: row.category
        });
      }

      // Send email to each location's manager
      for (const [, loc] of locations) {
        if (!loc.managerId) continue;
        if (loc.staff.size === 0) continue;

        // Get manager email and name
        const mgrResult = await query(
          `SELECT u.email, COALESCE(NULLIF(sp.first_name || ' ' || sp.last_name, ''), u.email) as manager_name
           FROM users u
           LEFT JOIN staff_profiles sp ON u.id = sp.user_id
           WHERE u.id = $1 AND u.status = 'active'`,
          [loc.managerId]
        );
        if (mgrResult.rows.length === 0) continue;
        const mgr = mgrResult.rows[0];

        const staffItems = Array.from(loc.staff.values()).map(s => ({
          staffName: s.staffName,
          incomplete: s.items
        }));

        try {
          await EmailService.sendComplianceDigestEmail(
            mgr.email,
            mgr.manager_name,
            loc.name,
            staffItems
          );
          logger.info({ orgId: org.id, locationId: loc.managerId, staff: loc.staff.size }, 'Compliance digest sent');
        } catch (err) {
          logWarn('complianceDigestEmail')(err);
        }
      }

      digestSentTracker.set(org.id, Date.now());
    }

    return enabledOrgs.rows.length;
  }

  /** Generate and email evidence packs for orgs with auto_evidence_pack enabled on their schedule. */
  static async sendScheduledEvidencePacks() {
    try {
    const enabledOrgs = await query(
      `SELECT id, name, auto_evidence_pack_frequency FROM organizations WHERE auto_evidence_pack_enabled = true AND status = 'active'`
    );

    for (const org of enabledOrgs.rows) {
      const freq = org.auto_evidence_pack_frequency || 'monthly';
      const now = new Date();
      const dayOfMonth = now.getDate();
      const dayOfWeek = now.getDay();

      if (!(freq === 'monthly' ? dayOfMonth === 1 : dayOfWeek === 1)) continue;

      try {
        const pack = await ComplianceRepository.getEvidencePack(org.id);

        const admins = await query(
          `SELECT u.email, COALESCE(sp.first_name || ' ' || sp.last_name, u.email) as name
           FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id
           WHERE u.organization_id = $1 AND u.role = 'ORG_ADMIN' AND u.status = 'active'`,
          [org.id]
        );

        for (const admin of admins.rows) {
          if (admin.email) {
            EmailService.sendEmail(
              admin.email,
              `Meticle Evidence Pack — ${org.name} (${new Date().toLocaleDateString('en-GB')})`,
              `<p>Hi ${admin.name},</p><p>Your ${freq} evidence pack for <strong>${org.name}</strong> has been generated.</p><p><a href="${process.env.FRONTEND_URL || ''}/compliance/evidence-packs" style="color:#0F4C81">View in Meticle →</a></p><p style="color:#6B7280;font-size:12px">Staff: ${pack.summary?.total_staff || 0} · People: ${pack.summary?.total_service_users || 0} · Training: ${pack.summary?.training_records || 0}</p>`
            ).catch(logWarn('scheduledPackEmail'));
          }
        }
      } catch (err) {
        logWarn('scheduledEvidencePack')(err);
      }
    }
    } catch (err) {
      logWarn('scheduledEvidencePack')(err);
    }
  }
}
