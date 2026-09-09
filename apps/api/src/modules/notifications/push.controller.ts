import { Request, Response } from 'express';
import { AppError } from '../../shared/middleware/error.middleware';
import { getWebPushPublicKey, removePushSubscription, upsertPushSubscription } from './push.service';

function authContext(req: Request) {
  const user = req.user;
  if (!user?.userId || !user.organizationId) throw new AppError(403, 'Organization context required');
  return user;
}

export class PushController {
  static async getConfig(req: Request, res: Response) {
    authContext(req);
    res.json({ enabled: !!getWebPushPublicKey(), publicKey: getWebPushPublicKey() });
  }

  static async subscribe(req: Request, res: Response) {
    const user = authContext(req);
    const subscription = req.body?.subscription;
    if (!subscription || typeof subscription !== 'object') throw new AppError(400, 'A push subscription is required');
    const result = await upsertPushSubscription({
      organizationId: user.organizationId!,
      userId: user.userId,
      subscription,
      userAgent: req.get('user-agent') || undefined,
    });
    res.status(201).json({ subscribed: true, id: result.id });
  }

  static async unsubscribe(req: Request, res: Response) {
    const user = authContext(req);
    const endpoint = req.body?.endpoint;
    if (typeof endpoint !== 'string' || endpoint.length < 1 || endpoint.length > 4096) throw new AppError(400, 'A valid subscription endpoint is required');
    await removePushSubscription(user.userId, endpoint);
    res.json({ subscribed: false });
  }
}
