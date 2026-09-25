import { describe, it, expect } from 'vitest';
import { fetchLinkPreview } from './linkPreview';

describe('link preview fetching', () => {
  // The preview is fetched by the server on a user's behalf, so a link must
  // never be able to steer the request at the API host's own network.
  it('refuses loopback addresses', async () => {
    await expect(fetchLinkPreview('http://127.0.0.1:8080/admin')).resolves.toBeNull();
  });

  it('refuses localhost by name', async () => {
    await expect(fetchLinkPreview('http://localhost:3000/')).resolves.toBeNull();
  });

  it('refuses private network ranges', async () => {
    await expect(fetchLinkPreview('http://10.0.0.5/internal')).resolves.toBeNull();
    await expect(fetchLinkPreview('http://192.168.1.1/router')).resolves.toBeNull();
    await expect(fetchLinkPreview('http://169.254.169.254/latest/meta-data/')).resolves.toBeNull();
  });

  it('refuses IPv6 loopback and link-local', async () => {
    await expect(fetchLinkPreview('http://[::1]/')).resolves.toBeNull();
    await expect(fetchLinkPreview('http://[fe80::1]/')).resolves.toBeNull();
  });

  it('refuses IPv4-mapped loopback', async () => {
    await expect(fetchLinkPreview('http://[::ffff:127.0.0.1]/')).resolves.toBeNull();
  });

  it('refuses non-http protocols', async () => {
    await expect(fetchLinkPreview('file:///etc/passwd')).resolves.toBeNull();
    await expect(fetchLinkPreview('gopher://example.com/')).resolves.toBeNull();
  });

  it('refuses values that are not URLs', async () => {
    await expect(fetchLinkPreview('not a url')).resolves.toBeNull();
    await expect(fetchLinkPreview('')).resolves.toBeNull();
  });

  it('returns null rather than throwing for a host that cannot be resolved', async () => {
    await expect(fetchLinkPreview('http://this-host-does-not-exist.invalid/')).resolves.toBeNull();
  });
});
