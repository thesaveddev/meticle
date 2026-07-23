import { Request, Response } from 'express';
import { createDbsCheck, submitDbsCheck, getDbsChecks, getDbsCheck, updateDbsStatus, pollDbsStatus, getDbsStats } from './dbs.service';
import { DbsStatus } from './dbs.types';

export class DbsController {
  static async create(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const check = await createDbsCheck(orgId, { ...req.body, staff_id: req.body.staffId });
    res.status(201).json(check);
  }

  static async submit(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const check = await submitDbsCheck(orgId, req.params.id);
    res.json(check);
  }

  static async list(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const checks = await getDbsChecks(orgId);
    res.json(checks);
  }

  static async get(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const check = await getDbsCheck(orgId, req.params.id);
    res.json(check);
  }

  static async updateStatus(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const { status, certificateNumber } = req.body;
    const check = await updateDbsStatus(orgId, req.params.id, status as DbsStatus, certificateNumber);
    res.json(check);
  }

  static async poll(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const check = await pollDbsStatus(orgId, req.params.id);
    res.json(check);
  }

  static async stats(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const stats = await getDbsStats(orgId);
    res.json(stats);
  }
}
