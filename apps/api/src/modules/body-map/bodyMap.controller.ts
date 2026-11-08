import { Request, Response } from 'express';
import { BodyMapRepository } from './bodyMap.repository';
import { requirePersonChildInOrg, requirePersonInOrg } from '../../shared/database/tenant';
import { AuditRepository } from '../audit/audit.repository';

/**
 * The auditable shape of a body-map row.
 *
 * `description` is deliberately absent. It is clinical free text, so a copy of it
 * in `audit_logs.new_data` would be a second plaintext copy of the same record —
 * the same reason the `incident.created` event payload stopped carrying its
 * description. The audit row still says who changed which entry, when, and what
 * kind of condition at which zone; the narrative lives only in its own column.
 */
function auditable(entry: any) {
  if (!entry) return null;
  return {
    person_id: entry.person_id,
    body_view: entry.body_view,
    body_zone: entry.body_zone,
    condition_type: entry.condition_type,
    severity: entry.severity,
    status: entry.status,
    recorded_date: entry.recorded_date,
    resolved_date: entry.resolved_date,
  };
}

export class BodyMapController {
  static async getEntries(req: Request, res: Response) {
    const orgId = (req as any).user.organizationId;
    const { personId } = req.params;
    await requirePersonInOrg(req.user!, personId);
    const entries = await BodyMapRepository.getEntries(orgId, personId);
    res.json(entries);
  }

  static async getActiveEntries(req: Request, res: Response) {
    const orgId = (req as any).user.organizationId;
    const { personId } = req.params;
    await requirePersonInOrg(req.user!, personId);
    const entries = await BodyMapRepository.getActiveEntries(orgId, personId);
    res.json(entries);
  }

  static async getEntry(req: Request, res: Response) {
    const orgId = (req as any).user.organizationId;
    const { id } = req.params;
    await requirePersonChildInOrg(req.user!, 'body_map_entries', id);
    const entry = await BodyMapRepository.getEntry(orgId, id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    res.json(entry);
  }

  static async createEntry(req: Request, res: Response) {
    const orgId = (req as any).user.organizationId;
    const userId = req.user!.userId;
    await requirePersonInOrg(req.user!, req.body.person_id);
    const entry = await BodyMapRepository.createEntry(orgId, req.body, userId);
    await AuditRepository.log({
      user_id: userId,
      action: 'create',
      entity_type: 'body_map_entry',
      entity_id: entry.id,
      new_data: auditable(entry),
      ip_address: req.ip,
    });
    res.status(201).json(entry);
  }

  static async updateEntry(req: Request, res: Response) {
    const orgId = (req as any).user.organizationId;
    const { id } = req.params;
    await requirePersonChildInOrg(req.user!, 'body_map_entries', id);
    const existing = await BodyMapRepository.getEntry(orgId, id);
    const entry = await BodyMapRepository.updateEntry(orgId, id, req.body);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    await AuditRepository.log({
      user_id: req.user!.userId,
      action: 'update',
      entity_type: 'body_map_entry',
      entity_id: entry.id,
      old_data: auditable(existing),
      new_data: auditable(entry),
      ip_address: req.ip,
    });
    res.json(entry);
  }

  static async deleteEntry(req: Request, res: Response) {
    const orgId = (req as any).user.organizationId;
    const { id } = req.params;
    await requirePersonChildInOrg(req.user!, 'body_map_entries', id);
    // Read before deleting: once the row is gone there is nothing left to say
    // what was removed, and a body-map entry is evidence of a skin condition.
    const existing = await BodyMapRepository.getEntry(orgId, id);
    await BodyMapRepository.deleteEntry(orgId, id);
    await AuditRepository.log({
      user_id: req.user!.userId,
      action: 'delete',
      entity_type: 'body_map_entry',
      entity_id: id,
      old_data: auditable(existing),
      ip_address: req.ip,
    });
    res.status(204).send();
  }

  static async getHistory(req: Request, res: Response) {
    const orgId = (req as any).user.organizationId;
    const { personId } = req.params;
    const limit = Number(req.query.limit) || 50;
    await requirePersonInOrg(req.user!, personId);
    const entries = await BodyMapRepository.getHistory(orgId, personId, limit);
    res.json(entries);
  }

  static async getStats(req: Request, res: Response) {
    const orgId = (req as any).user.organizationId;
    const { personId } = req.params;
    await requirePersonInOrg(req.user!, personId);
    const stats = await BodyMapRepository.getStats(orgId, personId);
    res.json(stats);
  }
}
