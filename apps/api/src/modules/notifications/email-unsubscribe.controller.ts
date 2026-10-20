import { Request, Response } from 'express';
import { AppError } from '../../shared/middleware/error.middleware';
import {
  recordEmailOptOut,
  scopeLabel,
  verifyUnsubscribeToken,
} from '../../shared/utils/emailUnsubscribe';
import logger from '../../shared/utils/logger';

/**
 * The public half of the unsubscribe link — no session, on purpose.
 *
 * A person who wants out of an email should not have to remember a password, and
 * the address in the link is often the only identity they still have here: a
 * leaver, a relative invited to a survey, an admin whose organisation has gone.
 *
 * The token is signed, so the endpoint trusts it rather than an id in the query.
 * `describe` exists so the page can say *what* will stop before it stops it; the
 * POST does the stopping and is idempotent, because a mail client's one-click
 * button and a second press of the page's own button are the same request.
 */

function tokenFrom(req: Request): string {
  const fromQuery = typeof req.query.token === 'string' ? req.query.token : '';
  const fromBody = req.body && typeof req.body.token === 'string' ? req.body.token : '';
  return (fromQuery || fromBody).trim();
}

export class EmailUnsubscribeController {
  /** What a valid link is about, so the page can name the address and the category. */
  static async describe(req: Request, res: Response) {
    const parsed = verifyUnsubscribeToken(tokenFrom(req));
    if (!parsed) {
      throw new AppError(400, 'This unsubscribe link is not valid. Reply to the email you received and we will take you off the list.');
    }
    res.json({
      email: parsed.email,
      scope: parsed.scope,
      scope_label: scopeLabel(parsed.scope),
    });
  }

  static async unsubscribe(req: Request, res: Response) {
    const parsed = verifyUnsubscribeToken(tokenFrom(req));
    if (!parsed) {
      throw new AppError(400, 'This unsubscribe link is not valid. Reply to the email you received and we will take you off the list.');
    }
    // RFC 8058 clients POST `List-Unsubscribe=One-Click`; the page posts a JSON
    // body. Either way the token decides who is unsubscribing, never the body.
    const oneClick = !req.body?.token && req.body != null;
    await recordEmailOptOut({
      email: parsed.email,
      scope: parsed.scope,
      source: oneClick ? 'one-click' : 'link',
    });
    logger.info({ scope: parsed.scope, source: oneClick ? 'one-click' : 'link' }, 'Email unsubscribe recorded');
    res.json({ unsubscribed: true, email: parsed.email, scope: parsed.scope });
  }
}
