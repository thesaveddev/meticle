import { Request, Response } from 'express';
import { EMedicationRepository, EMedicationAuditRepository } from './emedication.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { query } from '../../shared/database';
import { MedicationAlertService } from './medication-alert.service';

export class EMedicationController {
  static getOrgId(req: Request): string {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new AppError(403, 'Organization context required');
    return orgId;
  }

  static async getStaffProfileId(userId: string): Promise<string | null> {
    const result = await query(`SELECT id FROM staff_profiles WHERE user_id = $1`, [userId]);
    return result.rows[0]?.id || null;
  }

  // ── Records ──
  static async listRecords(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const { personId } = req.query as any;
    const records = await EMedicationRepository.findRecords(orgId, personId);
    res.json(records);
  }

  static async getRecord(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const record = await EMedicationRepository.findRecordById(req.params.id, orgId);
    if (!record) throw new AppError(404, 'Medication record not found');
    const items = await EMedicationRepository.findItems(req.params.id);
    res.json({ ...record, items });
  }

  static async createRecord(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const { person_id, title, start_date, end_date, status } = req.body;
    if (!person_id || !title || !start_date || !end_date) {
      throw new AppError(400, 'person_id, title, start_date, and end_date are required');
    }
    const record = await EMedicationRepository.createRecord(orgId, {
      person_id, title, start_date, end_date, status,
      created_by: req.user!.userId
    });

    await EMedicationAuditRepository.log({
      organization_id: orgId, action: 'create_record', entity_type: 'record',
      entity_id: record.id, user_id: req.user!.userId,
      changes: { person_id, title, start_date, end_date, status }, ip_address: req.ip
    });

    res.status(201).json(record);
  }

  static async updateRecord(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const record = await EMedicationRepository.updateRecord(req.params.id, orgId, req.body);
    if (!record) throw new AppError(404, 'Medication record not found');

    await EMedicationAuditRepository.log({
      organization_id: orgId, action: 'update_record', entity_type: 'record',
      entity_id: record.id, user_id: req.user!.userId, changes: req.body, ip_address: req.ip
    });

    res.json(record);
  }

  static async deleteRecord(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    await EMedicationRepository.deleteRecord(req.params.id, orgId);

    await EMedicationAuditRepository.log({
      organization_id: orgId, action: 'delete_record', entity_type: 'record',
      entity_id: req.params.id, user_id: req.user!.userId, changes: {}, ip_address: req.ip
    });

    res.json({ message: 'Medication record deleted' });
  }

  // ── Items ──
  static async addItem(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const record = await EMedicationRepository.findRecordById(req.params.recordId, orgId);
    if (!record) throw new AppError(404, 'Medication record not found');

    const { name, dosage, unit, route, frequency, times, instructions, is_prn, is_active } = req.body;
    if (!name || !dosage || !frequency) {
      throw new AppError(400, 'name, dosage, and frequency are required');
    }
    const item = await EMedicationRepository.createItem(req.params.recordId, {
      name, dosage, unit, route, frequency, times, instructions, is_prn, is_active,
      created_by: req.user!.userId
    });

    if (!is_prn) {
      const stockItem = await EMedicationRepository.findOrCreateStockForItem(orgId, record.person_id, { name, dosage, unit: unit || 'mg' });
      await EMedicationRepository.updateItem(item.id, { stock_item_id: stockItem.id });
      item.stock_item_id = stockItem.id;
    }

    await EMedicationAuditRepository.log({
      organization_id: orgId, action: 'add_item', entity_type: 'item',
      entity_id: item.id, user_id: req.user!.userId,
      changes: { name, dosage, unit, route, frequency, times, is_prn }, ip_address: req.ip
    });

    res.status(201).json(item);
  }

  static async updateItem(req: Request, res: Response) {
    const item = await EMedicationRepository.updateItem(req.params.itemId, req.body);
    if (!item) throw new AppError(404, 'Medication item not found');

    const orgId = EMedicationController.getOrgId(req);
    await EMedicationAuditRepository.log({
      organization_id: orgId, action: 'update_item', entity_type: 'item',
      entity_id: item.id, user_id: req.user!.userId, changes: req.body, ip_address: req.ip
    });

    res.json(item);
  }

  static async deleteItem(req: Request, res: Response) {
    const result = await EMedicationRepository.deleteItem(req.params.itemId);

    const orgId = EMedicationController.getOrgId(req);
    await EMedicationAuditRepository.log({
      organization_id: orgId, action: 'delete_item', entity_type: 'item',
      entity_id: req.params.itemId, user_id: req.user!.userId, changes: { archived: result === 'archived' }, ip_address: req.ip
    });

    res.json({ message: result === 'archived' ? 'Medication archived (has administration records)' : 'Medication item deleted' });
  }

  // ── Administrations ──
  static async getAdministrations(req: Request, res: Response) {
    const { startDate, endDate } = req.query as any;
    const admins = await EMedicationRepository.findAdministrations(req.params.itemId, startDate, endDate);
    res.json(admins);
  }

  static async logAdministration(req: Request, res: Response) {
    const {
      emedication_item_id, scheduled_time, status, notes, administered_time, staff_user_id,
      prn_reason, prn_effectiveness, wastage_amount, wastage_reason, batch_number, expiry_date
    } = req.body;
    if (!emedication_item_id || !scheduled_time || !status) {
      throw new AppError(400, 'emedication_item_id, scheduled_time, and status are required');
    }
    const staffUserId = staff_user_id || req.user!.userId;
    let staffProfileId: string | null = await EMedicationController.getStaffProfileId(staffUserId);
    if (!staffProfileId) {
      if (req.user!.role === 'ORG_ADMIN') {
        const newProfile = await query(
          `INSERT INTO staff_profiles (user_id, first_name, last_name, medication_competent) VALUES ($1, 'System', 'Admin', true) ON CONFLICT (user_id) DO UPDATE SET medication_competent = true RETURNING id`,
          [staffUserId]
        );
        staffProfileId = newProfile.rows[0].id;
      } else {
        throw new AppError(400, 'Staff profile not found for the selected user');
      }
    }
    if (!staffProfileId) throw new AppError(400, 'Staff profile not found for the selected user');

    // Check medication competence (skip for ORG_ADMIN who can manage the system)
    if (req.user!.role !== 'ORG_ADMIN') {
      const competent = await query(
        `SELECT medication_competent FROM staff_profiles WHERE id = $1`,
        [staffProfileId]
      );
      if (!competent.rows[0]?.medication_competent) {
        throw new AppError(403, 'Staff member has not passed medication assessment and cannot administer medications');
      }
    }

    // Block marking as given when linked stock is empty
    let stockBefore: { quantity: number; reorder_level: number } | null = null;
    let linkedStockItemId: string | null = null;
    if (status === 'given') {
      const itemResult = await query(`SELECT stock_item_id, name FROM emedication_items WHERE id = $1`, [emedication_item_id]);
      linkedStockItemId = itemResult.rows[0]?.stock_item_id || null;
      if (linkedStockItemId) {
        const stock = await EMedicationRepository.getStockForItem(emedication_item_id);
        if (stock && stock.quantity !== null && Number(stock.quantity) <= 0) {
          throw new AppError(409, `Cannot mark as given: no stock available for ${itemResult.rows[0]?.name || 'this medication'}. Log a delivery or stock adjustment first.`);
        }
        if (stock && !stock.person_id) {
          const rec = await query(
            `SELECT er.person_id FROM emedication_items mi JOIN emedication_records er ON er.id = mi.emedication_record_id WHERE mi.id = $1`,
            [emedication_item_id]
          );
          if (rec.rows[0]?.person_id) {
            await query(`UPDATE emedication_stock SET person_id = $2 WHERE id = $1 AND person_id IS NULL`, [linkedStockItemId, rec.rows[0].person_id]);
          }
        }
        stockBefore = { quantity: Number(stock?.quantity ?? 0), reorder_level: Number(stock?.reorder_level ?? 0) };
      }
    }

    const admin = await EMedicationRepository.upsertAdministration({
      emedication_item_id,
      staff_id: staffProfileId,
      scheduled_time,
      status,
      notes: notes || '',
      administered_time: administered_time || (status === 'given' ? new Date().toISOString() : undefined),
      prn_reason, prn_effectiveness, wastage_amount, wastage_reason, batch_number, expiry_date
    });

    const orgIdAdmin = EMedicationController.getOrgId(req);

    if (status === 'given' && linkedStockItemId) {
      const stockAfter = await EMedicationRepository.deductStockFromAdministration(linkedStockItemId);
      if (stockBefore && stockAfter &&
          stockBefore.quantity > stockBefore.reorder_level &&
          stockAfter.quantity <= stockAfter.reorder_level) {
        await MedicationAlertService.notifyReorder(orgIdAdmin, linkedStockItemId, stockAfter);
      }
    }

    await EMedicationAuditRepository.log({
      organization_id: orgIdAdmin,
      action: status === 'given' ? 'administer' : status,
      entity_type: 'administration',
      entity_id: admin.id,
      user_id: req.user!.userId,
      changes: { status, scheduled_time, emedication_item_id, staff_user_id: staffUserId, prn_reason, wastage_amount },
      ip_address: req.ip
    });

    res.status(201).json(admin);
  }

  static async updateAdministration(req: Request, res: Response) {
    if (req.body.status === 'given') {
      const itemResult = await query(
        `SELECT a.emedication_item_id, i.stock_item_id, i.name
         FROM emedication_administrations a
         JOIN emedication_items i ON a.emedication_item_id = i.id
         WHERE a.id = $1`, [req.params.adminId]);
      if (itemResult.rows[0]?.stock_item_id) {
        const stock = await EMedicationRepository.getStockForItem(itemResult.rows[0].emedication_item_id);
        if (stock && stock.quantity !== null && Number(stock.quantity) <= 0) {
          throw new AppError(409, `Cannot mark as given: no stock available for ${itemResult.rows[0]?.name || 'this medication'}. Log a delivery or stock adjustment first.`);
        }
      }
    }

    const admin = await EMedicationRepository.updateAdministration(req.params.adminId, req.body);
    if (!admin) throw new AppError(404, 'Administration record not found');

    const orgIdAdmin = EMedicationController.getOrgId(req);
    await EMedicationAuditRepository.log({
      organization_id: orgIdAdmin,
      action: 'update_administration',
      entity_type: 'administration',
      entity_id: admin.id,
      user_id: req.user!.userId,
      changes: req.body,
      ip_address: req.ip
    });

    res.json(admin);
  }

  // ── MAR Chart ──
  static async getMarChart(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const { date } = req.query as any;
    const chart = await EMedicationRepository.getMarChart(req.params.recordId, orgId, date);
    if (!chart) throw new AppError(404, 'Medication record not found');
    res.json(chart);
  }

  // ── Overdue ──
  static async getOverdue(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const overdue = await EMedicationRepository.getOverdueAdministrations(orgId);
    res.json(overdue);
  }

  static async getOverdueCount(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const count = await EMedicationRepository.getOverdueCount(orgId);
    res.json({ count });
  }

  // ── Ensure monthly MAR ──
  static async ensureMonthlyMar(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const { personId } = req.body;
    if (!personId) throw new AppError(400, 'personId is required');
    const result = await EMedicationRepository.ensureMonthlyMar(orgId, personId, req.user!.userId);
    res.json(result);
  }

  // ── Archive old MARs ──
  static async archivePreviousMars(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const count = await EMedicationRepository.archivePreviousMonthMars(orgId);
    res.json({ archived: count });
  }

  // ── Audit Logs ──
  static async getAuditLogs(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const { entity_type, entity_id } = req.query as any;
    const logs = await EMedicationAuditRepository.getLogs(orgId, entity_type, entity_id);
    res.json(logs);
  }

  // ── Stock ──
  static async listStock(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const includeArchived = req.query.includeArchived === 'true';
    const personId = req.query.personId as string | undefined;
    const stock = await EMedicationRepository.listStock(orgId, includeArchived, personId);
    res.json(stock);
  }

  static async createStock(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const item = await EMedicationRepository.createStockItem(orgId, req.body);

    await EMedicationAuditRepository.log({
      organization_id: orgId, action: 'create_stock', entity_type: 'stock',
      entity_id: item.id, user_id: req.user!.userId, changes: req.body, ip_address: req.ip
    });

    res.status(201).json(item);
  }

  static async updateStock(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const item = await EMedicationRepository.updateStock(req.params.id, orgId, req.body);
    if (!item) throw new AppError(404, 'Stock item not found');

    await EMedicationAuditRepository.log({
      organization_id: orgId, action: 'update_stock', entity_type: 'stock',
      entity_id: item.id, user_id: req.user!.userId, changes: req.body, ip_address: req.ip
    });

    res.json(item);
  }

  static async archiveStock(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const item = await EMedicationRepository.archiveStock(req.params.id, orgId);
    if (!item) throw new AppError(404, 'Stock item not found');

    await EMedicationAuditRepository.log({
      organization_id: orgId, action: 'archive_stock', entity_type: 'stock',
      entity_id: req.params.id, user_id: req.user!.userId, changes: { status: 'archived' }, ip_address: req.ip
    });

    res.json(item);
  }

  static async deleteStock(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    await EMedicationRepository.deleteStock(req.params.id, orgId);

    await EMedicationAuditRepository.log({
      organization_id: orgId, action: 'delete_stock', entity_type: 'stock',
      entity_id: req.params.id, user_id: req.user!.userId, changes: {}, ip_address: req.ip
    });

    res.json({ message: 'Stock item deleted' });
  }

  // ── Daily Count Items (per-medication) ──
  static async getMedicationQuantitiesForCount(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const { recordId } = req.params;
    const record = await EMedicationRepository.findRecordById(recordId, orgId);
    if (!record) throw new AppError(404, 'Medication record not found');
    const meds = await EMedicationRepository.getMedicationExpectedQuantities(recordId);
    res.json(meds);
  }

  static async listDailyCountItems(req: Request, res: Response) {
    const items = await EMedicationRepository.findDailyCountItems(req.params.dailyCountId);
    res.json(items);
  }

  static async upsertDailyCountItem(req: Request, res: Response) {
    const item = await EMedicationRepository.upsertDailyCountItem(req.body);
    res.json(item);
  }

  // ── Deliveries ──
  static async listDeliveries(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const deliveries = await EMedicationRepository.listDeliveries(orgId);
    res.json(deliveries);
  }

  static async getDelivery(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const delivery = await EMedicationRepository.getDelivery(req.params.id, orgId);
    if (!delivery) throw new AppError(404, 'Delivery not found');
    res.json(delivery);
  }

  static async createDelivery(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const delivery = await EMedicationRepository.createDelivery(orgId, req.body);

    await EMedicationAuditRepository.log({
      organization_id: orgId, action: 'create_delivery', entity_type: 'delivery',
      entity_id: delivery.id, user_id: req.user!.userId, changes: req.body, ip_address: req.ip
    });

    res.status(201).json(delivery);
  }

  // ── Import Medications from Previous Month ──
  static async importFromPreviousMonth(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const result = await EMedicationRepository.importMedicationsFromPreviousMonth(req.params.recordId, orgId, req.user!.userId);

    await EMedicationAuditRepository.log({
      organization_id: orgId, action: 'import_from_previous_month', entity_type: 'record',
      entity_id: req.params.recordId, user_id: req.user!.userId, changes: result, ip_address: req.ip
    });

    res.json(result);
  }

  // ── Staff medication competence ──
  static async toggleMedicationCompetence(req: Request, res: Response) {
    const { medication_competent } = req.body;
    const result = await query(`
      UPDATE staff_profiles SET medication_competent = $1
      WHERE id = $2 RETURNING id, first_name, last_name, medication_competent`,
      [medication_competent, req.params.staffProfileId]);
    if (result.rows.length === 0) throw new AppError(404, 'Staff profile not found');

    const orgId = EMedicationController.getOrgId(req);
    await EMedicationAuditRepository.log({
      organization_id: orgId,
      action: 'toggle_medication_competence',
      entity_type: 'staff_profile',
      entity_id: req.params.staffProfileId,
      user_id: req.user!.userId,
      changes: { medication_competent },
      ip_address: req.ip
    });

    res.json(result.rows[0]);
  }

  // ── Daily Counts ──
  static async listDailyCounts(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const { personId } = req.query as any;
    const counts = await EMedicationRepository.findDailyCounts(orgId, personId);
    res.json(counts);
  }

  static async createDailyCount(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const count = await EMedicationRepository.createDailyCount(orgId, req.body);

    await EMedicationAuditRepository.log({
      organization_id: orgId, action: 'create_daily_count', entity_type: 'daily_count',
      entity_id: count.id, user_id: req.user!.userId, changes: req.body, ip_address: req.ip
    });

    res.status(201).json(count);
  }

  // ── Stock Adjustments ──
  static async listStockAdjustments(req: Request, res: Response) {
    const adjustments = await EMedicationRepository.findStockAdjustments(req.params.stockItemId);
    res.json(adjustments);
  }

  static async createStockAdjustment(req: Request, res: Response) {
    const orgId = EMedicationController.getOrgId(req);
    const adjustment = await EMedicationRepository.createStockAdjustment(orgId, req.body);
    res.status(201).json(adjustment);
  }
}
