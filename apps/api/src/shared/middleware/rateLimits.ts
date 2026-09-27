/**
 * Rate limits that can be moved without a code change.
 *
 * The reason this exists: the signup limits were tuned against the real number
 * of people a care home puts on one internet connection, which is a number we
 * cannot exercise in CI without also weakening production. Hard-coded limits
 * meant either shipping a guess or editing code to check it.
 *
 * Two rules make this safe to expose as configuration:
 *
 *   1. A bad value falls back to the compiled-in default rather than becoming
 *      unlimited. A typo must never be able to remove a protection.
 *   2. A value is clamped to a multiple of that default. Setting a limit to
 *      30000 by accident — a stray zero, a copied production value — would
 *      otherwise turn off the abuse bound entirely, which is the one outcome
 *      worse than a limit that is slightly too tight.
 *
 * The defaults are the values that are live now, so removing the environment
 * variables from any environment changes nothing.
 */
import logger from '../utils/logger';

/** Values above this multiple of the default are refused and clamped. */
const MAX_MULTIPLE = 10;

function parse(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Resolve one limit: environment value if sane, otherwise the default.
 *
 * @param name  Environment variable name.
 * @param fallback The value in force when the variable is absent or unusable.
 */
export function configuredLimit(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;

  const parsed = parse(raw);
  if (parsed === null) {
    logger.warn(
      { name, raw, fallback },
      'Rate limit environment variable is not a positive integer; using the built-in default',
    );
    return fallback;
  }

  const ceiling = fallback * MAX_MULTIPLE;
  if (parsed > ceiling) {
    logger.warn(
      { name, raw: parsed, fallback, ceiling },
      'Rate limit exceeds the maximum permitted multiple of the default; clamping',
    );
    return ceiling;
  }
  return parsed;
}

/**
 * The limits the auth surface uses, resolved once at module load.
 *
 * Read at load rather than per request so a misconfigured value is reported
 * once in the logs rather than on every request that trips it.
 */
export const AUTH_LIMITS = {
  /**
   * Per IP, per 15 minutes.
   *
   * Registration is limited per IP, which is the wrong unit for a single
   * customer. A care home is the normal onboarding unit: one organisation, one
   * office, one NAT egress address. When that home activates, 15-30 staff
   * register inside the same hour and every one of them shares `req.ip`, so a
   * per-IP budget sized for "one person guessing passwords" becomes a
   * per-organisation budget that the customer's own staff collectively exhaust.
   * The limit then reads as our software being broken at the exact moment we
   * are trying to win the account.
   *
   * 30 is sized to seat a full care home in one sitting, and it is safe to
   * raise this far specifically because registration is gated on proven
   * mailbox ownership: `AuthController.register` rejects any caller who has
   * not already completed `verify-email-code` for that address within the
   * hour, so every one of these 30 requests corresponds to a real inbox someone
   * genuinely controls. That proof gate is the actual abuse control here; this
   * counter is only backstop against scripted volume, which 30 still bounds.
   *
   * Password guessing is unaffected — that is `/login`, below.
   */
  register: configuredLimit('RATE_LIMIT_REGISTER', 30),

  /**
   * Per IP, per minute.
   *
   * The two rate limits on the verification-code endpoint are not redundant,
   * and they are not interchangeable. The precise control is per recipient and
   * already lives in the controller: three codes per address per 15 minutes,
   * enforced in the database. That is what stops one mailbox being spammed, and
   * no amount of raising a per-IP number can replace it.
   *
   * The per-IP limit exists for a different abuse — one caller spraying many
   * *different* victim addresses, which the per-recipient cap cannot see at
   * all. It has to be a volume bound, and it is sized with that in mind rather
   * than with the legitimate case, because the two are indistinguishable by
   * shape: an office of twenty staff requesting twenty codes and an attacker
   * requesting twenty codes look identical from the server.
   *
   * That is why it was raised from 5 to 10 per minute. The harm from one
   * unwanted verification email is small — fixed content, no link, no data — so
   * a tight cap buys little safety while making the single most common moment in
   * onboarding fail for reasons that look like a bug. Ten per minute still
   * bounds one host to a nuisance-level volume, and the client waits the limit
   * out (`withRateLimitRetry`) instead of showing an error, so a burst of twenty
   * people onboarding together succeeds without anyone seeing a failure.
   */
  emailCode: configuredLimit('RATE_LIMIT_EMAIL_CODE', 10),

  /**
   * Per IP, per hour. Five was sized for one person, and one care home is not
   * one person: a morning where four staff cannot remember their password is an
   * ordinary working day, not an attack. A reset can only reach an address that
   * already has an account, so it is a capacity limit rather than a security
   * control, and the client waits it out rather than showing an error.
   */
  forgotPassword: configuredLimit('RATE_LIMIT_FORGOT_PASSWORD', 20),
} as const;

/**
 * Login is deliberately NOT configurable.
 *
 * Every limit above is a capacity decision — how many people share an office
 * connection — and getting it wrong causes a support ticket. The login limit is
 * a security control, and a variable that can turn password-guessing
 * protection off is not a knob any environment should be able to touch. It also
 * has a second layer, `LOGIN_MAX_ATTEMPTS` per account, so the per-IP number is
 * not the only thing standing between an attacker and a wordlist.
 */
export const LOGIN_RATE_LIMIT = 10;
