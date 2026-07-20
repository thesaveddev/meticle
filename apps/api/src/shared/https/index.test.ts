import { describe, it, expect, vi } from 'vitest';

vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('mock-cert-content'),
}));

describe('getHttpsOptions', () => {
  it('should return null when HTTPS env is not set', async () => {
    delete process.env.HTTPS;
    const { getHttpsOptions } = await import('./index');
    expect(getHttpsOptions()).toBeNull();
  });

  it('should return cert options when HTTPS env is true', async () => {
    process.env.HTTPS = 'true';
    process.env.HTTPS_CERT_PATH = '/certs/cert.pem';
    process.env.HTTPS_KEY_PATH = '/certs/key.pem';
    const { getHttpsOptions } = await import('./index');
    const opts = getHttpsOptions();
    expect(opts).not.toBeNull();
    expect(opts!.cert).toBe('mock-cert-content');
    expect(opts!.key).toBe('mock-cert-content');
  });
});
