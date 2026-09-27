/**
 * DMARC alignment for outbound mail.
 *
 * The envelope sender — the SMTP `MAIL FROM`, which becomes `Return-Path` — was
 * never set. nodemailer therefore derived it from the authenticated SMTP
 * credentials, so what the domain asserted depended on `SMTP_USER` rather than
 * on the code. If that credential was not on `meticlecare.com`, DMARC's SPF
 * alignment failed silently and DKIM alone carried the policy, with nothing in
 * the repository recording the arrangement.
 *
 * These assert the arrangement rather than the SMTP conversation: the received
 * `Return-Path` is the only thing that proves what went on the wire, because a
 * provider may rewrite it in transit.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { buildMailOptions, resolveSender } from '../shared/utils/email.queue';
import { domainOf, senderDomain, misalignedSenders } from '../shared/utils/email.service';

const MAIL = {
  from_email: 'security@meticlecare.com',
  to_email: 'someone@example.com',
  subject: 'Your Meticle Care verification code',
  html_body: '<p>123456</p>',
};

describe('outbound envelope sender', () => {
  it('carries the recipient in the envelope, not only the sender', () => {
    // Regression guard for a bug this suite missed once. Supplying an
    // `envelope` object makes it authoritative for the whole SMTP envelope
    // rather than a partial override, so `envelope: { from }` with no `to`
    // leaves nodemailer with no recipient: every message is rejected with
    // EENVELOPE "No recipients defined" before reaching the server. The
    // alignment assertions below all passed while delivery was totally broken,
    // because they only ever checked the sender.
    expect(buildMailOptions(MAIL).envelope.to).toBe(MAIL.to_email);
  });

  it('pins the envelope sender to the visible sender', () => {
    const options = buildMailOptions(MAIL);
    // Structural alignment: identical by construction, so no credential can
    // change what the domain asserts.
    expect(options.envelope.from).toBe(options.from);
  });

  it('keeps the envelope on the organisational domain', () => {
    expect(domainOf(buildMailOptions(MAIL).envelope.from)).toBe('meticlecare.com');
  });

  it('is deliverable, not merely aligned', () => {
    // The two properties are independent and both are required: an aligned
    // envelope with no recipient never sends, and a deliverable one on the
    // wrong domain fails DMARC. Asserted together so neither can regress alone.
    const options = buildMailOptions(MAIL);
    expect(options.envelope).toEqual({ from: MAIL.from_email, to: MAIL.to_email });
  });

  it('aligns every sender category, not just the one that was reported', () => {
    for (const category of ['notifications', 'billing', 'security', 'support', 'team'] as const) {
      const options = buildMailOptions({ ...MAIL, from_email: `${category}@meticlecare.com` });
      expect(domainOf(options.envelope.from), `${category} is not aligned`).toBe(senderDomain());
    }
  });

  it('refuses an off-domain SMTP_FROM rather than sending on it', () => {
    // This is not hypothetical. The application was previously configured with
    // SMTP_FROM pointing at an unrelated vendor's domain, left over from an
    // earlier integration. A queued row with no sender would have gone out
    // asserting that domain: DMARC alignment fails, and every recipient learns
    // which other company runs this system.
    const ORIGINAL = process.env.SMTP_FROM;
    process.env.SMTP_FROM = '***REMOVED***';
    try {
      const options = buildMailOptions({ ...MAIL, from_email: null });
      expect(options.from).toBe('noreply@meticlecare.com');
      expect(options.envelope.from).toBe('noreply@meticlecare.com');
      expect(domainOf(options.envelope.from)).toBe('meticlecare.com');
    } finally {
      if (ORIGINAL === undefined) delete process.env.SMTP_FROM;
      else process.env.SMTP_FROM = ORIGINAL;
    }
  });

  it('still honours SMTP_FROM when it is on the organisational domain', () => {
    const ORIGINAL = process.env.SMTP_FROM;
    process.env.SMTP_FROM = 'noreply@meticlecare.com';
    try {
      expect(resolveSender(null)).toBe('noreply@meticlecare.com');
    } finally {
      if (ORIGINAL === undefined) delete process.env.SMTP_FROM;
      else process.env.SMTP_FROM = ORIGINAL;
    }
  });

  it('prefers the row sender over SMTP_FROM in every case', () => {
    const ORIGINAL = process.env.SMTP_FROM;
    process.env.SMTP_FROM = '***REMOVED***';
    try {
      const options = buildMailOptions(MAIL);
      expect(options.from).toBe('security@meticlecare.com');
      expect(options.envelope.from).toBe('security@meticlecare.com');
    } finally {
      if (ORIGINAL === undefined) delete process.env.SMTP_FROM;
      else process.env.SMTP_FROM = ORIGINAL;
    }
  });

  it('never lets the SMTP login identity become a header', () => {
    // `SMTP_USER` is the credential presented in `auth: { user, pass }` and is
    // the one address in the configuration that is *not* under our control: on
    // this deployment it is a mailbox on the provider account from an earlier
    // vendor relationship. It is a username, not a sender, and it appears in no
    // header — but nothing stopped a future refactor from writing
    // `from: process.env.SMTP_USER`, which would disclose that vendor to every
    // recipient and fail DMARC alignment, and no other assertion here would
    // notice. This pins the separation.
    const ORIGINAL_USER = process.env.SMTP_USER;
    const ORIGINAL_FROM = process.env.SMTP_FROM;
    process.env.SMTP_USER = '***REMOVED***';
    delete process.env.SMTP_FROM;
    try {
      for (const from_email of [MAIL.from_email, null]) {
        const options = buildMailOptions({ ...MAIL, from_email });
        for (const [label, value] of [['from', options.from], ['envelope.from', options.envelope.from]] as const) {
          expect(domainOf(value), `${label} leaked the SMTP login domain`).toBe('meticlecare.com');
          expect(value).not.toContain('***REMOVED***');
        }
      }
      expect(resolveSender(null)).not.toContain('***REMOVED***');
    } finally {
      if (ORIGINAL_USER === undefined) delete process.env.SMTP_USER;
      else process.env.SMTP_USER = ORIGINAL_USER;
      if (ORIGINAL_FROM === undefined) delete process.env.SMTP_FROM;
      else process.env.SMTP_FROM = ORIGINAL_FROM;
    }
  });

  it('still carries DSN requests without disturbing the envelope', () => {
    const options = buildMailOptions({ ...MAIL, dsn_requested: true, dsn_id: 'abc-123' });
    expect(options.dsn).toMatchObject({ id: 'abc-123', recipient: MAIL.to_email });
    expect(options.envelope.from).toBe(MAIL.from_email);
  });
});

describe('sender domain consistency', () => {
  const ORIGINAL = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL };
    vi.resetModules();
  });

  it('reports every default sender as aligned', () => {
    // Guards the assumption in the doc comment on senderDomain(): the default
    // configuration must actually share one domain.
    expect(misalignedSenders()).toEqual([]);
  });

  it('names a category that has been pointed at another domain', async () => {
    // The failure this catches is caused by one env var and is invisible from
    // DNS, so it is reported at boot rather than found in a spam folder.
    // SENDERS is read at module load, so the module must be re-imported.
    process.env.SMTP_FROM_BILLING = 'invoices@someotherhost.com';
    vi.resetModules();
    const { misalignedSenders: check } = await import('../shared/utils/email.service');
    expect(check().join(' ')).toContain('billing=invoices@someotherhost.com');
  });

  it('reads the domain from a display-name address, not from the name', () => {
    // "Meticle Care <security@meticlecare.com>" is valid input for an SMTP
    // sender. Taking the text after the raw string's last '@' would yield
    // "meticlecare.com>" and report every sender as misaligned at boot.
    expect(domainOf('Meticle Care <security@meticlecare.com>')).toBe('meticlecare.com');
    expect(domainOf('security@meticlecare.com')).toBe('meticlecare.com');
    expect(domainOf('  SECURITY@MeticleCare.com ')).toBe('meticlecare.com');
  });

  it('reports a display-name sender as aligned rather than misaligned', async () => {
    process.env.SMTP_FROM_SUPPORT = 'Meticle Care <support@meticlecare.com>';
    vi.resetModules();
    const { misalignedSenders: check } = await import('../shared/utils/email.service');
    expect(check()).toEqual([]);
  });
});
