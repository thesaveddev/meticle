/**
 * Classifying why a queued email failed, for the operator dashboard.
 *
 * The queue stores one string per failure, written by `EmailQueue.processBatch`
 * as `` `${err.code}: ${err.message}` `` and by the DSN webhook as the
 * receiving server's diagnostic. That string is accurate and useless at a
 * glance: a dashboard row reading
 *
 *   `EENVELOPE: SMTP did not accept recipient alice@example.com`
 *
 * tells the reader nothing they can act on, and fifty of them is fifty rows of
 * scrolling. The question an operator actually has is smaller — *whose problem
 * is this?* — because the answer decides who gets called.
 *
 * So every failure resolves to a cause and, more usefully, an `owner`:
 *
 *   - `code`          we built the message wrong. Nothing external is at fault.
 *   - `configuration` our credentials or our DNS are wrong. Nobody in the
 *                     recipient's organisation can fix this.
 *   - `recipient`     the address is bad, full, or refusing us. Their problem.
 *   - `provider`      MXRocket or the network. Retry later.
 *   - `unattributed`  the string matched nothing we recognise, which is itself
 *                     worth surfacing rather than filing under "other".
 *
 * `unattributed` is deliberately a bucket rather than a fallback into
 * `provider`. An unrecognised failure is the case where a human needs to look,
 * so it must be visible in the count rather than dissolved into a category
 * that suggests somebody is already handling it.
 *
 * ## Why this dispatches on codes before text
 *
 * A first version ordered a flat list of regexes, longest match winning, and
 * three tests immediately showed why that is the wrong shape. SMTP failures
 * carry a *structured* code and *unstructured* prose, and the prose lies:
 *
 *   `450 4.2.0 <a@b.com>: Recipient address rejected: mailbox busy`
 *
 * says "Recipient address rejected", which reads exactly like a permanent
 * address failure, but the 450 makes it temporary and the recipient's server
 * is asking us to come back. Matching on prose sent that to the recipient when
 * the answer belonged to the provider. The mirror case is a bare `550`, which
 * shadowed the far more specific `5.7.1` policy rejection sitting behind it.
 *
 * So the order is: nodemailer's own code, then the SMTP status, then prose only
 * for failures carrying no status at all.
 */

/** What kind of failure this is. */
export type FailureCause =
  | 'envelope'         // we built a message that could not be sent
  | 'auth'             // our SMTP credentials were rejected
  | 'content'          // the receiver rejected the message itself
  | 'address'          // the address does not exist or will not accept mail
  | 'mailbox'          // the mailbox exists but cannot store the message
  | 'remote_temporary' // the remote server asked us to come back later
  | 'network'          // we could not hold a connection at all
  | 'bounced'          // accepted, then refused by a later hop
  | 'unattributed';    // nothing above matched

/** Who has to fix it. This is the field the dashboard sorts and colours by. */
export type FailureOwner = 'code' | 'configuration' | 'recipient' | 'provider' | 'unattributed';

export interface FailureClassification {
  cause: FailureCause;
  owner: FailureOwner;
  /** One line, written for a person deciding what to do next. */
  label: string;
  /**
   * Whether a retry could plausibly succeed.
   *
   * Distinct from `owner`: a full mailbox is the recipient's problem and is
   * usually worth another attempt, whereas a non-existent address is the
   * recipient's problem and never is.
   */
  retryable: boolean;
}

function result(
  cause: FailureCause,
  owner: FailureOwner,
  label: string,
  retryable: boolean,
): FailureClassification {
  return { cause, owner, label, retryable };
}

const LABELS = {
  envelope: result('envelope', 'code', 'Malformed message envelope — a defect in how we build the email', false),
  auth: result('auth', 'configuration', 'Our SMTP credentials were rejected — every send is failing', false),
  content: result('content', 'recipient', 'Rejected by the receiving server’s policy — spam, blocklist or restriction', false),
  address: result('address', 'recipient', 'Recipient address does not exist or refuses mail', false),
  mailbox: result('mailbox', 'recipient', 'Recipient mailbox is full or over quota', true),
  remoteTemporary: result('remote_temporary', 'provider', 'Receiving server asked us to retry later', true),
  network: result('network', 'provider', 'Connection lost or SMTP protocol error — usually transient', true),
  unclassifiedStatus: result('remote_temporary', 'provider', 'Receiving server returned an unclassified error', true),
  unattributed: result('unattributed', 'unattributed', 'Unrecognised failure — needs a human to read the raw message', true),
  bounced: result('bounced', 'recipient', 'Accepted by the first server, then refused by a later hop', true),
} as const;

/**
 * The SMTP status a failure carries, read only from the position a server
 * actually writes it.
 *
 * Anchored deliberately. Scanning anywhere for `[45]\d\d` misreads a port —
 * `ECONNECTION: connect ECONNREFUSED 1.2.3.4:587` would be read as a 587
 * server error — so this only accepts a code at the very start of the message
 * or immediately after nodemailer's `Message failed: ` prefix.
 */
function smtpStatus(message: string): { code: number; enhanced?: string } | null {
  const match = /^(?:Message failed:\s*)?([45]\d\d)(?:\s+(\d+\.\d+\.\d+))?/.exec(message.trim());
  if (!match) return null;
  return { code: Number(match[1]), enhanced: match[2] };
}

/** From the status alone, before any prose is consulted. */
function classifyByStatus(code: number, enhanced: string | undefined): FailureClassification | null {
  // Auth codes are checked first, before the enhanced-code dispatch below.
  // `535 5.7.8 Authentication credentials invalid` is an auth failure whose
  // enhanced code happens to sit in the 5.7 (policy) block, and dispatching on
  // the enhanced code alone files our rejected password as the recipient's
  // policy refusing us — which sends the operator to entirely the wrong place.
  if (code === 530 || code === 535) return LABELS.auth;

  // 4xx is the server asking for a retry, whatever the prose says.
  if (code >= 400 && code < 500) return LABELS.remoteTemporary;

  // Enhanced codes are more specific than the bare status, so they lead.
  if (enhanced?.startsWith('5.1.')) return LABELS.address;
  if (enhanced?.startsWith('5.2.')) return LABELS.mailbox;
  if (enhanced?.startsWith('5.7.')) return LABELS.content;

  switch (code) {
    case 552: return LABELS.mailbox;
    case 553: return LABELS.address;   // invalid mailbox name
    case 554: return LABELS.content;   // transaction failed, policy
    case 550: return LABELS.address;   // mailbox unavailable
    default: return LABELS.unclassifiedStatus;
  }
}

/** Prose, for failures that carry no status at all. */
function classifyByText(message: string): FailureClassification | null {
  if (/(over ?quota|mailbox (is )?full|insufficient system storage)/i.test(message)) return LABELS.mailbox;
  if (/(5\.7\.|message rejected|rejected due to|blacklist|block ?list|spam|unsubscribe)/i.test(message)) return LABELS.content;
  if (/(5\.1\.1|user unknown|unknown user|no such user|recipient address rejected|does not exist|mailbox unavailable)/i.test(message)) {
    return LABELS.address;
  }
  if (/(try again (later|again)|too many (connections|messages)|temporar(y|ily))/i.test(message)) {
    return LABELS.remoteTemporary;
  }
  return null;
}

/**
 * Resolves a stored `email_queue.error_message` to a cause and an owner.
 *
 * `dsnBounced` is passed separately because a DSN is only identifiable from
 * `last_dsn_status`; the message it leaves behind is the *receiving* server's
 * wording, which varies by host and often contains no status code at all.
 * Treating those as unknown would bury exactly the class where the message was
 * accepted once and refused later, which is the case operators most often
 * mistake for "it worked".
 *
 * The flag is authoritative and is not overridden by the stored message. A DSN
 * can only be issued for a message a server accepted, and the webhook
 * overwrites `error_message` with its own diagnostic on a bounce — so a row
 * carrying both a bounce and an old send error is not a state the code can
 * produce, and where a bounce exists the refusal is the more recent fact about
 * what happened to the message.
 */
export function classifyFailure(
  errorMessage: string | null | undefined,
  options: { dsnBounced?: boolean } = {},
): FailureClassification {
  if (options.dsnBounced) return LABELS.bounced;

  const message = (errorMessage ?? '').trim();
  if (!message) return LABELS.unattributed;

  // nodemailer's own codes are unambiguous and outrank anything in the prose.
  if (/\bEENVELOPE\b/i.test(message)) return LABELS.envelope;
  if (/\bEAUTH\b/i.test(message)) return LABELS.auth;
  if (/\b(ESOCKET|EPROTOCOL|ECONNECTION|ECONNREFUSED|ECONNRESET|EDNS|ETIMEDOUT)\b/i.test(message)) {
    return LABELS.network;
  }

  const status = smtpStatus(message);
  if (status) {
    const byStatus = classifyByStatus(status.code, status.enhanced);
    // A recognised status settles it. Only an unrecognised one falls through
    // to prose, and then the prose is what is left to go on.
    if (byStatus && byStatus !== LABELS.unclassifiedStatus) return byStatus;
    const byText = classifyByText(message);
    if (byText) return byText;
    return LABELS.unclassifiedStatus;
  }

  return classifyByText(message) ?? LABELS.unattributed;
}
