import { Request, Response } from 'express';
import { createDbsCheck, submitDbsCheck, getDbsChecks, getDbsCheck, updateDbsStatus, pollDbsStatus, getDbsStats } from './dbs.service';
import { recordCertificateMetadata, runDbsCertificatePurge } from './dbs.certificateRetention';
import {
  completeRenewal,
  getUpdateServiceStats,
  getUpdateServiceSubscription,
  listUpdateServiceSubscriptions,
  recordUpdateServiceCheck,
  setRenewalMarker,
  subscribeToUpdateService,
  withdrawConsent,
} from './dbs.updateService';
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

  /**
   * The certificate metadata a manager read off the paper certificate.
   *
   * Metadata only, and that is the whole feature: the permitted set is the
   * reference, the issue date, the recruitment decision and its date, a renewal
   * marker and a note. There is no upload here and no field for a copy or an
   * image of the certificate, because the handling rules forbid keeping one.
   */
  static async recordCertificate(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const check = await recordCertificateMetadata(orgId, req.user!.userId, req.params.id, req.body, req.ip);
    res.json(check);
  }

  /**
   * Run the retention purge now rather than waiting for the nightly sweep.
   *
   * An administrator's route because it is destructive and there is no undoing
   * it: a provider answering an erasure request, or cleaning up after a period
   * nobody decided about, needs to be able to act today.
   */
  static async purgeCertificates(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const run = await runDbsCertificatePurge({
      organizationId: orgId,
      trigger: 'manual',
      triggeredBy: req.user!.userId,
    });
    res.json(run);
  }

  // ── DBS Update Service re-checks ──────────────────────────────────────────
  //
  // A separate route family from `/dbs/checks` on purpose: a status check is not
  // an application, it has no provider and nothing is submitted. Keeping them
  // apart is what stops the UI (and a future adapter) treating one as the other.

  static async listUpdateService(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const { staffId, status, dueState } = req.query;
    const subscriptions = await listUpdateServiceSubscriptions(orgId, {
      staffId: staffId ? String(staffId) : undefined,
      status: status ? String(status) : undefined,
      dueState: dueState ? String(dueState) : undefined,
    });
    res.json(subscriptions);
  }

  static async getUpdateService(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    res.json(await getUpdateServiceSubscription(orgId, req.params.id));
  }

  static async updateServiceStats(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    res.json(await getUpdateServiceStats(orgId));
  }

  static async subscribeUpdateService(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const subscription = await subscribeToUpdateService(orgId, req.user!.userId, req.body, req.ip);
    res.status(201).json(subscription);
  }

  static async recordUpdateServiceCheck(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const subscription = await recordUpdateServiceCheck(orgId, req.user!.userId, req.params.id, req.body, req.ip);
    res.status(201).json(subscription);
  }

  static async setUpdateServiceRenewal(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const subscription = await setRenewalMarker(orgId, req.user!.userId, req.params.id, req.body, req.ip);
    res.json(subscription);
  }

  static async completeUpdateServiceRenewal(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const subscription = await completeRenewal(orgId, req.user!.userId, req.params.id, req.body, req.ip);
    res.json(subscription);
  }

  static async withdrawUpdateServiceConsent(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const subscription = await withdrawConsent(orgId, req.user!.userId, req.params.id, req.body.reason, req.ip);
    res.json(subscription);
  }
}
