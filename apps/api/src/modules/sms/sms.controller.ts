import type { Request, Response } from 'express';
import { getSmsConfig, queueSms, updateSmsConfig } from './sms.service';
import { getSmsSecrets } from './sms.service';
import { SmsQueue, smsStatusCallbackUrl } from './sms.queue';
import { verifyTwilioSignature } from './sms.twilio';

/**
 * Organisation SMS setup, one manual send, and the Twilio delivery webhook.
 *
 * Two routes live here with different trust: the config and send endpoints
 * sit behind `authenticate` + role, while `/sms/status` is public — Twilio
 * cannot hold a session. The webhook's authentication is the Twilio signature
 * over the exact configured callback URL, verified against the organisation
 * named in the query string before anything is written.
 */

export class SmsController {
  static async getConfig(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });
    res.json({ config: await getSmsConfig(orgId) });
  }

  static async updateConfig(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    const userId = req.user?.userId;
    if (!orgId || !userId) return res.status(400).json({ error: { message: 'Organization and user required' } });
    const config = await updateSmsConfig(orgId, userId, req.ip, req.body || {});
    res.json({ config });
  }

  static async send(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    const userId = req.user?.userId;
    if (!orgId || !userId) return res.status(400).json({ error: { message: 'Organization and user required' } });
    const row = await queueSms(orgId, {
      to: req.body?.to,
      body: req.body?.body,
      createdBy: userId,
    });
    if (!row) return res.status(200).json({ queued: false, reason: 'An identical message is already queued.' });
    res.status(201).json({ queued: true, id: row.id });
  }

  static async handleStatus(req: Request, res: Response) {
    const orgId = typeof req.query.org === 'string' ? req.query.org : '';
    const params = Object.fromEntries(
      Object.entries(req.body || {}).map(([k, v]) => [k, String(v)]),
    ) as Record<string, string>;
    const sid = params.MessageSid || '';
    // The acknowledgement is 200 either way: Twilio retries a non-2xx, and a
    // receipt that cannot be verified or matched must not become a retry
    // storm. Nothing is written before the signature checks out.
    if (!orgId || !sid) return res.status(200).send('OK');
    const secrets = await getSmsSecrets(orgId).catch(() => null);
    const verified =
      secrets?.authToken &&
      verifyTwilioSignature(secrets.authToken, smsStatusCallbackUrl(orgId), params, req.headers['x-twilio-signature'] as string | undefined);
    if (!verified) return res.status(200).send('OK');
    await SmsQueue.recordDelivery(sid, params.MessageStatus || '', params.ErrorMessage || undefined);
    return res.status(200).send('OK');
  }
}
