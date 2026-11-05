import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyTwilioSignature } from './sms.twilio';

/**
 * The webhook's only authentication is this signature, so the verifier is
 * tested against the construction it claims to implement — sign here with
 * plain node:crypto, verify with the module — rather than against itself.
 */

const AUTH_TOKEN = 'test-auth-token';

function sign(url: string, params: Record<string, string>): string {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  return crypto.createHmac('sha1', AUTH_TOKEN).update(data).digest('base64');
}

const URL = 'https://api.meticlecare.com/api/sms/status?org=org-1';
const PARAMS = { MessageSid: 'SM123', MessageStatus: 'delivered', To: '+447700900123' };

describe('verifyTwilioSignature', () => {
  it('accepts a correctly signed callback', () => {
    expect(verifyTwilioSignature(AUTH_TOKEN, URL, PARAMS, sign(URL, PARAMS))).toBe(true);
  });

  it('rejects a tampered field', () => {
    const sig = sign(URL, PARAMS);
    expect(verifyTwilioSignature(AUTH_TOKEN, URL, { ...PARAMS, MessageStatus: 'failed' }, sig)).toBe(false);
  });

  it('rejects a signature for a different URL', () => {
    const sig = sign(URL, PARAMS);
    expect(verifyTwilioSignature(AUTH_TOKEN, `${URL}&extra=1`, PARAMS, sig)).toBe(false);
  });

  it('rejects a wrong token, a missing signature and a malformed one', () => {
    const sig = sign(URL, PARAMS);
    expect(verifyTwilioSignature('wrong-token', URL, PARAMS, sig)).toBe(false);
    expect(verifyTwilioSignature(AUTH_TOKEN, URL, PARAMS, undefined)).toBe(false);
    expect(verifyTwilioSignature(AUTH_TOKEN, URL, PARAMS, 'not-base64!!')).toBe(false);
  });
});
