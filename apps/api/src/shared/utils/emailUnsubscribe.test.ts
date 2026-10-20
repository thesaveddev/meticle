import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  appendUnsubscribeFooter,
  apiBaseUrl,
  unsubscribeHeaders,
  unsubscribeOneClickUrl,
  unsubscribePageUrl,
  unsubscribeToken,
  verifyUnsubscribeToken,
} from './emailUnsubscribe';

const previousSecret = process.env.EMAIL_UNSUBSCRIBE_SECRET;

beforeEach(() => {
  process.env.EMAIL_UNSUBSCRIBE_SECRET = 'a-test-unsubscribe-secret';
});

afterAll(() => {
  if (previousSecret === undefined) delete process.env.EMAIL_UNSUBSCRIBE_SECRET;
  else process.env.EMAIL_UNSUBSCRIBE_SECRET = previousSecret;
});

describe('unsubscribe tokens', () => {
  it('round-trips the address and the scope, normalised', () => {
    const token = unsubscribeToken('  Carer@Example.COM ', 'notifications');
    expect(token).toBeTruthy();
    expect(verifyUnsubscribeToken(token)).toEqual({ email: 'carer@example.com', scope: 'notifications' });
  });

  it('carries the scope it was minted for, so a marketing link cannot stop alerts', () => {
    const token = unsubscribeToken('carer@example.com', 'marketing');
    expect(verifyUnsubscribeToken(token)?.scope).toBe('marketing');
  });

  it('refuses a tampered token rather than acting for the address it names', () => {
    const token = unsubscribeToken('carer@example.com', 'notifications')!;
    const [scope, , signature] = token.split('.');
    const forgedAddress = Buffer.from('someone-else@example.com', 'utf8').toString('base64url');
    expect(verifyUnsubscribeToken(`${scope}.${forgedAddress}.${signature}`)).toBeNull();
    expect(verifyUnsubscribeToken(`${scope}.${Buffer.from('carer@example.com').toString('base64url')}.x${signature.slice(1)}`)).toBeNull();
  });

  it('refuses a token with an unknown scope, or no token at all', () => {
    const token = unsubscribeToken('carer@example.com', 'notifications')!;
    const [, encoded, signature] = token.split('.');
    expect(verifyUnsubscribeToken(`spam.${encoded}.${signature}`)).toBeNull();
    expect(verifyUnsubscribeToken('')).toBeNull();
    expect(verifyUnsubscribeToken(null)).toBeNull();
    expect(verifyUnsubscribeToken('not-a-token')).toBeNull();
  });

  it('refuses to mint a token without a secret, and says so', () => {
    delete process.env.EMAIL_UNSUBSCRIBE_SECRET;
    const previousJwt = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    expect(unsubscribeToken('carer@example.com', 'notifications')).toBeNull();
    if (previousJwt !== undefined) process.env.JWT_SECRET = previousJwt;
    process.env.EMAIL_UNSUBSCRIBE_SECRET = 'a-test-unsubscribe-secret';
  });
});

describe('the footer a recipient sees', () => {
  it('is appended before the end of the document and names what stops', () => {
    const html = '<html><body><p>Digest</p></body></html>';
    const url = unsubscribePageUrl(unsubscribeToken('carer@example.com', 'notifications')!);
    const withFooter = appendUnsubscribeFooter(html, url, 'notifications');

    expect(withFooter.indexOf('Unsubscribe from')).toBeGreaterThan(-1);
    expect(withFooter.indexOf('Unsubscribe from')).toBeLessThan(withFooter.indexOf('</body>'));
    expect(withFooter).toContain('notification, reminder and survey emails');
    // The link has to be the working one, not a placeholder.
    expect(withFooter).toContain(url);
  });

  it('still adds the line to a fragment with no body element', () => {
    const withFooter = appendUnsubscribeFooter('<p>Hello</p>', 'https://meticlecare.com/unsubscribe?token=x', 'marketing');
    expect(withFooter.startsWith('<p>Hello</p>')).toBe(true);
    expect(withFooter).toContain('product and billing update emails');
  });
});

describe('one-click headers', () => {
  const previousApiUrl = process.env.PUBLIC_API_URL;

  afterAll(() => {
    if (previousApiUrl === undefined) delete process.env.PUBLIC_API_URL;
    else process.env.PUBLIC_API_URL = previousApiUrl;
  });

  it('gives a mail client both the URL and the POST contract', () => {
    const headers = unsubscribeHeaders('https://meticlecare.com/unsubscribe?token=x');
    expect(headers['List-Unsubscribe']).toContain('<https://meticlecare.com/unsubscribe?token=x>');
    expect(headers['List-Unsubscribe']).toContain('mailto:unsubscribe@meticlecare.com');
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  /**
   * The two URLs are not interchangeable, and this is the test that keeps them
   * apart: the footer link has to be a page a person reads, and the header has to
   * be an endpoint that acts on a POST. Pointing the header at the page is the
   * failure that looks like success — the client gets a 200 from the app shell and
   * the mail keeps coming.
   */
  it('sends a mail client to the API and a person to the page', () => {
    delete process.env.PUBLIC_API_URL;
    const token = unsubscribeToken('carer@example.com', 'notifications')!;

    const page = unsubscribePageUrl(token);
    const oneClick = unsubscribeOneClickUrl(token);

    expect(page).toContain('/unsubscribe?token=');
    expect(oneClick).toContain('/api/email/unsubscribe?token=');
    expect(page).not.toBe(oneClick);
    // Same token both times: one opt-out, reachable two ways.
    expect(new URL(page).search).toBe(new URL(oneClick).search);

    const listed = unsubscribeHeaders(oneClick)['List-Unsubscribe'];
    expect(listed).toContain(`<${oneClick}>`);
    expect(listed).not.toContain(`<${page}>`);
  });

  it('uses an explicit API origin when the API is not served under the app', () => {
    process.env.PUBLIC_API_URL = 'https://api.meticlecare.com/';
    expect(apiBaseUrl()).toBe('https://api.meticlecare.com');
    expect(unsubscribeOneClickUrl(unsubscribeToken('carer@example.com', 'marketing')!))
      .toContain('https://api.meticlecare.com/email/unsubscribe?token=');
  });
});
