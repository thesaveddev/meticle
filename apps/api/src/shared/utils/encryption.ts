import crypto from 'crypto';
import logger from './logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  const key = process.env.FIELD_ENCRYPTION_KEY;
  if (!key) {
    logger.warn('FIELD_ENCRYPTION_KEY not set. PII columns are stored in plaintext.');
    return Buffer.alloc(0);
  }
  return Buffer.from(key, 'hex');
}

function deriveKey(orgId: string): Buffer {
  const masterKey = getMasterKey();
  if (masterKey.length === 0) return masterKey;
  return Buffer.from(crypto.hkdfSync('sha256', masterKey, Buffer.from(orgId, 'utf8'), 'caredesk-pii', 32));
}

export function encryptField(plaintext: string, orgId: string): string | null {
  if (!plaintext) return null;
  const key = deriveKey(orgId);
  if (key.length === 0) return plaintext;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return iv.toString('hex') + ':' + tag + ':' + encrypted;
}

export function decryptField(ciphertext: string, orgId: string): string | null {
  if (!ciphertext) return null;
  const key = deriveKey(orgId);
  if (key.length === 0) return ciphertext;
  const parts = ciphertext.split(':');
  if (parts.length !== 3) return ciphertext;
  const [ivHex, tagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
