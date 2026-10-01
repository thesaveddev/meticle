import crypto from 'crypto';
import logger from './logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_BYTES = 32;

export class FieldEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FieldEncryptionError';
  }
}

/**
 * Shape of a ciphertext produced here: 32 hex IV, 32 hex tag, then hex payload.
 * Anything else is a legacy plaintext row, which has to stay readable until the
 * backfill has run — so this is what makes decryption idempotent and lets a
 * migration run without a dual-read window.
 */
const CIPHERTEXT = new RegExp(`^[0-9a-f]{${IV_LENGTH * 2}}:[0-9a-f]{${TAG_LENGTH * 2}}:[0-9a-f]+$`, 'i');

/** True when `value` is already encrypted by this module. */
export function isCiphertext(value: unknown): boolean {
  return typeof value === 'string' && CIPHERTEXT.test(value);
}

function getMasterKey(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw || raw.trim() === '') {
    throw new FieldEncryptionError(
      'FIELD_ENCRYPTION_KEY is not set. PII fields are encrypted with a per-tenant key derived from it, and there is no ' +
        'safe default: starting without one would write plaintext to columns that read as encrypted. Generate one with ' +
        "`openssl rand -hex 32` and set it before starting the API.",
    );
  }
  const trimmed = raw.trim();
  if (!/^[0-9a-f]+$/i.test(trimmed)) {
    throw new FieldEncryptionError('FIELD_ENCRYPTION_KEY must be hex. Generate one with `openssl rand -hex 32`.');
  }
  const key = Buffer.from(trimmed, 'hex');
  if (key.length !== KEY_BYTES) {
    throw new FieldEncryptionError(
      `FIELD_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes for ${ALGORITHM} (a ${KEY_BYTES * 2}-character hex string). Got ${key.length}.`,
    );
  }
  return key;
}

function deriveKey(orgId: string): Buffer {
  if (!orgId) {
    throw new FieldEncryptionError('An organization id is required to derive the encryption key for a field.');
  }
  const masterKey = getMasterKey();
  return Buffer.from(crypto.hkdfSync('sha256', masterKey, Buffer.from(orgId, 'utf8'), 'caredesk-pii', KEY_BYTES));
}

/**
 * Encrypts one field under a key derived per organization, so a ciphertext from
 * one tenant cannot be decrypted with another tenant's context even if rows are
 * mixed up somewhere.
 *
 * Throws rather than passing the value through when the key is missing. The
 * previous version returned the plaintext unchanged, which meant a missing key
 * turned encryption into a silent no-op — see T0-15, where that read as "the
 * cipher works, the key is just unset" and sent an operator to set a variable
 * that could not have helped.
 */
export function encryptField(plaintext: string, orgId: string): string | null {
  if (plaintext === null || plaintext === undefined || plaintext === '') return null;
  if (isCiphertext(plaintext)) {
    throw new FieldEncryptionError('Refusing to encrypt a value that is already ciphertext.');
  }
  const key = deriveKey(orgId);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return iv.toString('hex') + ':' + tag + ':' + encrypted;
}

/**
 * Returns a legacy plaintext row unchanged so the backfill can run without a
 * flag day, and so a read never fails on a row written before encryption existed.
 * Such rows are counted once per process so a column that never gets migrated
 * is visible in the logs rather than invisible.
 */
let legacyPlaintextWarnings = 0;
export function decryptField(ciphertext: string, orgId: string): string | null {
  if (ciphertext === null || ciphertext === undefined || ciphertext === '') return null;
  if (!isCiphertext(ciphertext)) {
    if (legacyPlaintextWarnings < 5) {
      logger.warn(`Row found with a plaintext value in an encrypted column (org ${orgId}). Run the backfill script.`);
      legacyPlaintextWarnings += 1;
    }
    return ciphertext;
  }
  const key = deriveKey(orgId);
  const parts = ciphertext.split(':');
  const [ivHex, tagHex, encrypted] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Raises if the environment cannot encrypt. Called at startup so a missing or
 * malformed key stops the process instead of quietly writing plaintext.
 */
export function assertFieldEncryptionConfigured(): void {
  getMasterKey();
}