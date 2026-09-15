import { Request, Response } from 'express';
import { BodyMapRepository } from './bodyMap.repository';
import { requirePersonChildInOrg, requirePersonInOrg } from '../../shared/database/tenant';

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
    res.status(201).json(entry);
  }

  static async updateEntry(req: Request, res: Response) {
    const orgId = (req as any).user.organizationId;
    const { id } = req.params;
    await requirePersonChildInOrg(req.user!, 'body_map_entries', id);
    const entry = await BodyMapRepository.updateEntry(orgId, id, req.body);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    res.json(entry);
  }

  static async deleteEntry(req: Request, res: Response) {
    const orgId = (req as any).user.organizationId;
    const { id } = req.params;
    await requirePersonChildInOrg(req.user!, 'body_map_entries', id);
    await BodyMapRepository.deleteEntry(orgId, id);
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
