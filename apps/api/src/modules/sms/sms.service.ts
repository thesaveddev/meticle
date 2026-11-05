import { query } from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import { decryptField, encryptField } from '../../shared/utils/encryption';
import { AuditRepository } from '../audit/audit.repository';
import { SmsQueue } from './sms.queue';
import logger from '../../shared/utils/logger';

/**
 * Per-organisation SMS configuration, kept in `organizations.sms_config`.
 *
 * The shape on disk is `{ enabled, from_number, account_sid_enc,
 * auth_token_enc }`. The secrets are encrypted under the organisation key —
 * a Twilio auth token spends the holder's money, so unlike the AI provider
 * keys it is never stored beside the flag that uses it in the clear, and no
 * read path returns it, masked or otherwise. A provided value always replaces
 * the stored one; an empty string clears it. There is no masked-echo dance
 * because the API never echoes.
 */

export interface SmsSecrets {
  accountSid: string | null;
  authToken: string | null;
}

export interface SmsPublicConfig {
  enabled: boolean;
  fromNumber: string | null;
  /** Whether a send could go out right now. */
  configured: boolean;
}

const PHONE_RE = /^\+\d{7,15}$/;
export const SMS_BODY_MAX = 1600;

function rowToSecrets(orgId: string, row: any): SmsSecrets {
  return {
    accountSid: (row?.account_sid_enc ? decryptField(row.account_sid_enc, orgId) : null) || null,
    authToken: (row?.auth_token_enc ? decryptField(row.auth_token_enc, orgId) : null) || null,
  };
}

export async function getSmsSecrets(orgId: string): Promise<(SmsSecrets & { enabled: boolean; fromNumber: string | null })> {
  const res = await query(`SELECT sms_config FROM organizations WHERE id = $1`, [orgId]);
  const cfg = res.rows[0]?.sms_config || {};
  return {
    enabled: cfg.enabled === true,
    fromNumber: cfg.from_number || null,
    ...rowToSecrets(orgId, cfg),
  };
}

export async function getSmsConfig(orgId: string): Promise<SmsPublicConfig> {
  const { enabled, fromNumber, accountSid, authToken } = await getSmsSecrets(orgId);
  return { enabled, fromNumber, configured: enabled && Boolean(accountSid && authToken && fromNumber) };
}

export async function updateSmsConfig(
  orgId: string,
  userId: string,
  ip: string | undefined,
  input: { enabled?: boolean; accountSid?: string; authToken?: string; fromNumber?: string | null },
): Promise<SmsPublicConfig> {
  const current = await query(`SELECT sms_config FROM organizations WHERE id = $1`, [orgId]);
  const previous = current.rows[0]?.sms_config || {};
  const next: Record<string, unknown> = {
    enabled: input.enabled !== undefined ? input.enabled : previous.enabled === true,
    from_number: input.fromNumber !== undefined ? (input.fromNumber || null) : previous.from_number || null,
    account_sid_enc: previous.account_sid_enc || null,
    auth_token_enc: previous.auth_token_enc || null,
  };
  if (input.accountSid !== undefined) {
    next.account_sid_enc = input.accountSid.trim() === '' ? null : encryptField(input.accountSid.trim(), orgId);
  }
  if (input.authToken !== undefined) {
    next.auth_token_enc = input.authToken.trim() === '' ? null : encryptField(input.authToken.trim(), orgId);
  }
  await query(`UPDATE organizations SET sms_config = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [
    JSON.stringify(next),
    orgId,
  ]);
  // The audit names that the credentials changed, never the credentials: the
  // audit log is readable by more people than the settings page.
  await AuditRepository.log({
    user_id: userId,
    action: 'update',
    entity_type: 'organization_sms_config',
    entity_id: orgId,
    old_data: { enabled: previous.enabled === true, from_number: previous.from_number || null, credentials_set: Boolean(previous.account_sid_enc && previous.auth_token_enc) },
    new_data: {
      enabled: next.enabled,
      from_number: next.from_number,
      credentials_set: Boolean(next.account_sid_enc && next.auth_token_enc),
      credentials_changed: Boolean(input.accountSid !== undefined || input.authToken !== undefined),
    },
    ip_address: ip,
  }).catch(() => {});
  logger.info({ orgId, enabled: next.enabled }, 'SMS config updated');
  const { enabled, fromNumber, accountSid, authToken } = await getSmsSecrets(orgId);
  return { enabled, fromNumber, configured: enabled && Boolean(accountSid && authToken && fromNumber) };
}

/**
 * Queue one operational SMS — a shift reminder, a cover request, a compliance
 * nudge to a manager. Staff operational messaging, not marketing: there is no
 * bulk send here, one call is one recipient, and the body cap keeps a message
 * to a few segments.
 */
export async function queueSms(
  orgId: string,
  args: {
    to: string;
    body: string;
    createdBy?: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  },
) {
  const to = args.to.trim();
  if (!PHONE_RE.test(to)) {
    throw new AppError(400, 'A destination mobile number in international format is required (e.g. +447700900123).');
  }
  const text = args.body.trim();
  if (!text) throw new AppError(400, 'Message text is required.');
  if (text.length > SMS_BODY_MAX) {
    throw new AppError(400, `Message text must be ${SMS_BODY_MAX} characters or fewer.`);
  }
  const cfg = await getSmsSecrets(orgId);
  if (!cfg.enabled) throw new AppError(400, 'SMS is not enabled for this organisation.');
  if (!cfg.accountSid || !cfg.authToken || !cfg.fromNumber) {
    throw new AppError(400, 'SMS is enabled but the Twilio account is not fully configured.');
  }
  return SmsQueue.enqueue(orgId, {
    to,
    body: text,
    createdBy: args.createdBy,
    relatedEntityType: args.relatedEntityType,
    relatedEntityId: args.relatedEntityId,
  });
}
