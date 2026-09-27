/**
 * Registry of claims that appear in public marketing or legal copy.
 *
 * The problem this exists to solve: a public page once advertised "Point-in-time
 * recovery" when we only take a nightly snapshot, and "ISO 27001" when neither
 * we nor our host held any such certificate. Both were found by hand, months
 * apart. Nothing stopped the second one going back in, and nothing would have
 * stopped either reaching a customer.
 *
 * So claims are recorded here with the evidence that permits them, and
 * `marketingClaims.test.ts` fails the build when a page says something this
 * file does not allow.
 *
 * The rule: **nothing may be said on a public page unless it is either
 * obviously fine or registered here with a reason.** A claim with no entry is
 * an accident waiting to ship.
 *
 * Not named `.test.ts`, so vitest's include pattern (which matches only
 * `*.test.ts` and `*.test.tsx` under `src`) will not collect this file as a
 * suite and try to run it.
 */

/** Where public copy lives. Anything a customer can read on a public route. */
export const PUBLIC_COPY_GLOBS = [
  'src/pages/marketing/*.tsx',
  'src/pages/legal/*.tsx',
]

/**
 * Claims we cannot evidence today. Any occurrence in public copy is a failure.
 *
 * Each entry records what evidence *would* permit it, so this is a to-do list
 * rather than a permanent list of things that are forbidden forever.
 */
export const FORBIDDEN_CLAIMS: {
  label: string
  pattern: RegExp
  why: string
  whatWouldPermitIt: string
  /**
   * Files permitted to carry this claim, with the reason recorded here.
   *
   * Used sparingly and only where editing the copy is not ours to decide — see
   * the uptime entry, which is a contractual service level in the Terms of Use
   * that a solicitor should rule on, not an engineer.
   */
  exemptFiles?: string[]
}[] = [
  {
    label: 'ISO 27001',
    pattern: /ISO[\s/]*(?:IEC[\s]*)?27001/i,
    why: 'Neither we nor the hosting provider hold ISO 27001. A previous version of the privacy policy claimed it; it was removed on 26 Sep 2026 because there is no certificate to cite.',
    whatWouldPermitIt: 'A certificate covering us or our host, with its scope and expiry recorded here.',
  },
  {
    label: 'Cyber Essentials',
    pattern: /Cyber Essentials/i,
    why: 'Not held, and never applied for.',
    whatWouldPermitIt: 'A current certificate, or an in-date assessment covering the relevant scope.',
  },
  {
    label: 'NHS accreditation or Data Security Toolkit certification',
    pattern: /NHS\s+(?:Data Security Toolkit|Digital Accreditation|accredited|approved)/i,
    why: 'We have no NHS accreditation and have not submitted a DSPT. Selling to an NHS trust makes this claim more likely to be checked, not less.',
    whatWouldPermitIt: 'A published DSPT submission covering the service, or NHS Digital accreditation.',
  },
  {
    label: 'CQC registration',
    pattern: /CQC[-\s]registered/i,
    why: 'We are not a registered provider. Whether we need to be is still an open question (tracker T2-7), and we should not answer it in marketing copy before we know.',
    whatWouldPermitIt: 'A registration number, or a written legal position that we are a software supplier and out of scope.',
  },
  {
    label: 'Penetration tested',
    pattern: /penetration[-\s]tested|pen[-\s]tested/i,
    why: 'No independent penetration test has been carried out. We have secured this codebase ourselves, repeatedly, which is precisely why an outside pair of eyes has not happened yet (tracker T2-1).',
    whatWouldPermitIt: 'A completed CREST/CHECK-registered test, with date and scope.',
  },
  {
    label: 'Point-in-time recovery',
    pattern: /point[-\s]in[-\s]time recovery/i,
    why: 'Our backup job is a nightly `pg_dump`. Nothing archives the Postgres write-ahead log, so the only recoverable state is the last snapshot. Claiming PITR means promising to rewind to an arbitrary moment, which we cannot do.',
    whatWouldPermitIt: 'WAL archiving in the backup job (pgBackRest, wal-g or `archive_command`), plus a proven restore.',
  },
  {
    label: 'Restore tested',
    pattern: /restore[-\s]tested|disaster[-\s]recovery[-\s]tested/i,
    why: 'No restore has ever been performed (tracker T0-2). Backups existing and backups restoring are separate claims and only the first is true.',
    whatWouldPermitIt: 'A completed restore into a scratch database with the result recorded.',
  },
  {
    label: 'Absolute data residency',
    pattern: /no data (?:ever )?leaves|none of your data (?:ever )?leaves|never leaves (?:the UK|our jurisdiction)/i,
    why: 'Cannot be evidenced. Application data sits on a UK server, but Cloudflare sits in front of the site and our transactional mail is sent by a US-based provider. "No data leaves UK jurisdiction" is an absolute we have not verified and are not in a position to guarantee.',
    whatWouldPermitIt: 'A documented data-flow review covering CDN, email, backups and subprocessors, and a decision that the claim is defensible as written.',
  },
  {
    label: 'Numeric uptime promise',
    pattern: /\b\d{2,3}(?:\.\d+)?\s*%\s*(?:uptime|availability|uptime SLA)/i,
    why: 'We cannot evidence an availability figure. Uptime Kuma is deployed but nobody has confirmed a monitor exists, let alone what it has recorded (tracker T0-4). A number on a marketing page that we cannot substantiate is exactly what an NHS procurement questionnaire finds, and it is far harder to walk back once a customer has relied on it.',
    whatWouldPermitIt: 'Measured availability over a stated period from a monitor we have verified is working.',
    // The one place a number is allowed to appear is the Terms of Use, and only
    // because changing a contractual service level is not an engineer's call.
    // It is tracked as a registered claim below, and it must never appear on a
    // marketing page — a "target" in binding terms is a commitment; the same
    // number in a brochure is a promise we cannot keep.
    exemptFiles: ['src/pages/legal/TermsOfUsePage.tsx'],
  },
]

/**
 * Claims that are permitted only because someone recorded why, and what the
 * state of the evidence is.
 *
 * `status: 'pending'` is the interesting one. It means we are saying this
 * today on the strength of an assumption rather than a check. Pending entries
 * must name the tracker item that will close them, and the test fails if that
 * item stops appearing in the readiness list — so a pending claim cannot
 * quietly outlive the decision that was supposed to settle it.
 */
export const REGISTERED_CLAIMS: {
  label: string
  pattern: RegExp
  status: 'verified' | 'pending'
  /** Why this is allowed. Required. "Trust me" is not a reason. */
  evidence: string
  /** For `verified`: a repo path that must exist. Keeps the citation checkable. */
  evidencePath?: string
  owner: string
  /** For `pending`: the tracker item in docs/GO_LIVE_READINESS.md that closes it. */
  closesOn?: string
  notes?: string
}[] = [
  {
    label: '99.9% uptime target in the Terms of Use',
    pattern: /99\.9\s*%\s*uptime/i,
    status: 'pending',
    evidence: 'The Terms of Use state "We target 99.9% uptime but cannot guarantee uninterrupted service", with a 48-hour planned-maintenance commitment. It is qualified, which is why it is tolerated rather than treated as a marketing overclaim — but it is still a service level in a contract, and we cannot currently evidence any availability figure at all.',
    owner: 'Adetoye',
    closesOn: 'T0-8',
    notes: 'Two things to settle, and neither is mine to settle: whether the solicitor is content with this drafting, and whether 99.9% is a number we can actually stand behind once monitoring is verified (T0-4). If monitoring shows we are nowhere near it, the number has to change, and it is better to change it before signature than after a customer relies on it. Do not move this wording to a marketing page.',
  },
  {
    label: 'ICO registered',
    pattern: /ICO registered/i,
    status: 'pending',
    evidence: 'No ICO registration number exists yet. The public pages state the claim but cite nothing. Decision taken 27 Sep 2026: register and keep the claim, then print the number on the page.',
    owner: 'Adetoye',
    closesOn: 'T0-1',
    notes: 'The claim is not true until the number is on the page, so this stays registered-and-pending rather than being deleted.',
  },
  {
    label: 'AES-256 / encryption at rest',
    pattern: /AES-?256|encrypted at rest/i,
    status: 'pending',
    evidence: 'Column-level encryption genuinely exists: pgcrypto is installed in the schema and `apps/api/src/shared/utils/encryption.ts` uses aes-256-gcm over an HKDF-derived per-tenant key. What is NOT verified is that the production master key is set.',
    evidencePath: 'apps/api/src/shared/utils/encryption.ts',
    owner: 'Opeyemi',
    closesOn: 'T0-15',
    notes: 'CRITICAL: if FIELD_ENCRYPTION_KEY is unset, getMasterKey() returns an empty buffer, encryptField() returns the plaintext unchanged, and the only signal is a log warning — "PII columns are stored in plaintext". The claim degrades silently. Copy also implies whole-database encryption, which is broader than what we do; scoping it to sensitive fields would be more accurate.',
  },
  {
    label: 'TLS 1.3',
    pattern: /TLS 1\.3/i,
    status: 'pending',
    evidence: 'TLS 1.3 is confirmed on the outbound mail path (observed in Gmail Received headers: version=TLS1_3). TLS 1.3 is NOT yet confirmed for the web and API edge, which is terminated by our own nginx.',
    owner: 'Opeyemi',
    closesOn: 'T0-16',
    notes: 'Verify the negotiated version against meticlecare.com and either keep the claim or restate it as TLS 1.2+.',
  },
]

/**
 * Phrases that look like a forbidden claim but are not — our disclaimers.
 *
 * These are asserted to be *present on specific pages*, not merely tolerated
 * somewhere on the site. That distinction is not pedantry: a site-wide
 * "does any page carry this?" check is satisfied as long as one page does, so
 * deleting the qualification from an individual compliance page passes while a
 * reader landing on that page meets an unqualified promise. Per-page is the
 * only granularity that matches the risk.
 *
 * Paths are relative to `apps/web`, the same base as PUBLIC_COPY_GLOBS.
 */
export const REQUIRED_DISCLAIMERS: {
  label: string
  phrase: RegExp
  why: string
  requiredIn: string[]
}[] = [
  {
    label: 'Compliance is not guaranteed',
    phrase: /does not guarantee compliance/i,
    why: 'We support inspection readiness. We do not produce a CQC rating and must never imply we do.',
    requiredIn: [
      'src/pages/marketing/CompliancePage.tsx',
      'src/pages/marketing/FeaturePage.tsx',
      'src/pages/marketing/PublicSitePage.tsx',
    ],
  },
  {
    label: 'Regulatory outcome is not claimed',
    phrase: /without claiming to guarantee any regulatory outcome/i,
    why: 'The domiciliary pages must carry the same qualification as the others, so a reader cannot meet a stronger promise on one page than we make on another.',
    requiredIn: ['src/pages/marketing/SolutionsPage.tsx'],
  },
]
