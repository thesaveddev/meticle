# Email security action list — meticlecare.com

A working to-do list for closing out the domain's anti-spoofing posture. The
control itself is documented, with the reasoning and the evidence, in
`docs/SECURITY_POLICY.md` §7. This file is only the checklist.

Meticle Care sends care records, password resets and account-recovery mail from
`@meticlecare.com`. Anyone can send mail claiming that domain. Until the
receiving server is told to check, a spoofed "your password expires today" mail
from `security@meticlecare.com` lands in a carer's inbox and is indistinguishable
from the real thing.

**Do the steps in order.** Step 2 gates steps 3 onwards. Publishing an enforcing
DMARC policy before signing is confirmed will send the organisation's own
legitimate mail to spam.

## Where things stand — 26 September 2026

Checked against public DNS (`ziggy.ns.cloudflare.com`; transport MXRocket,
`MX 10 safari.mxrouting.net`):

| Record | Found | State |
| --- | --- | --- |
| SPF | `v=spf1 include:mxroute.com -all` | **Done.** Authorises the sending provider and nobody else; `-all` is a hard fail |
| DKIM | `x._domainkey.meticlecare.com` — `v=DKIM1;k=rsa`, 2048-bit RSA | **Key published.** Whether it is used is unproven — see step 2 |
| DMARC | `v=DMARC1; p=none; rua=mailto:dmarc-reports@meticlecare.com` | **Monitoring only.** A `p=quarantine` edit was made on 26 Sep 2026 but is not resolving publicly |

## Blocking steps

- [x] **1. Re-check Cloudflare that the DMARC record actually saved.**
      **DONE 26 Sep 2026.** The record did save; an earlier check had simply
      been served from resolver cache. Public DNS now returns
      `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@meticlecare.com; pct=100`.

      This makes step 4 urgent rather than advisory — see there.

- [ ] **2. Have the *application* send a test email to a real inbox you control.**
      **PARTIALLY ANSWERED — envelope passed 26 Sep, DKIM signing confirmed
      27 Sep, but still over the mailbox path rather than the application's.**

      A message sent by hand from `notifications@meticlecare.com` to a Gmail
      account on 27 September 2026 returned, from Gmail's own verifier:

      ```
      Authentication-Results: mx.google.com;
        dkim=pass header.i=@meticlecare.com header.s=x;
        spf=pass ... smtp.mailfrom=notifications@meticlecare.com;
        dmarc=pass (p=QUARANTINE sp=QUARANTINE dis=NONE) header.from=meticlecare.com
      DKIM-Signature: ... d=meticlecare.com; s=x;
      Return-Path: <notifications@meticlecare.com>
      ```

      **DKIM signing is enabled** for the domain and uses the published
      selector `x`, so step 3 can be struck. That is the useful half of this
      result and it is not in doubt.

      What it does **not** establish is that the *application* passes. The
      header carries `X-Authenticated-Id: notifications@meticlecare.com` — the
      message was submitted from a mailbox, by hand, over MXRocket's webmail
      composer. The application authenticates with a different credential
      (`SMTP_USER`, still a previous vendor's address), and DKIM signing is
      applied per-domain by the sending MTA, which need not behave the same for
      a different authenticated identity. This is precisely the case step 2
      exists to catch, and the warning below applies.

      A test to `opeyemi@meticlecare.com` also produced:

      ```
      Return-Path: <security@meticlecare.com>
      Received: ... (envelope-from <security@meticlecare.com>)
      From: security@meticlecare.com
      Message-ID: <...@meticlecare.com>
      ```

      That settles the envelope-sender question: `MAIL FROM` is
      `security@meticlecare.com` on the wire, MXRocket did not rewrite the
      return path, and no third-party domain appears in any header. It also
      answers the `SMTP_USER=***REMOVED***` question — that value is
      only ever the SMTP auth username and reaches no header.

      Two reasons this does **not** close the step:

      - There is no `Authentication-Results` header in what was captured, so
        SPF, DKIM and DMARC remain unverified.
      - The message was delivered by `safari.mxrouting.net` over **LMTP** to
        another mailbox on the *same* provider. Sender and recipient share a
        path, so nothing about acceptance by Gmail or Outlook was exercised —
        and the header block came from the provider's own spam scanner, not
        from a third-party `Authentication-Results`.

      To finish: send the same test to an external inbox (Gmail) and read
      *Show original* there.

      **Do not use mail-tester.com, and do not use the password-reset form.**
      Both were tried on 26 September 2026 and neither works:

      - `POST /api/auth/forgot-password` returns `200` and sends nothing when the
        address has no account. `auth.controller.ts` looks the user up first and
        returns the same non-enumerable message either way, so a throwaway
        address produces a cheerful "check your inbox" and no email.
      - `POST /api/auth/send-email-code` would send to any address, but rejects
        disposable domains — and it rejects `srv1.mail-tester.com` on the
        MX lookup even though the domain is not in the package list. Verified:
        `400 Temporary email addresses are not allowed`.

      Both are working as designed. Use an address you own on a real provider:

      1. `POST /api/auth/send-email-code` with your own address (any
         non-disposable address not already registered — no account needed).
         From a shell:

         ```bash
         curl -X POST https://meticlecare.com/api/auth/send-email-code \
           -H "Content-Type: application/json" \
           -d '{"email":"you@yourprovider.com"}'
         ```

      2. Wait for the message. Mail is **queued**, not sent inline — the request
         only enqueues, and a worker delivers. Allow a minute.
      3. In Gmail: *Show original*. In Outlook: *View message details*. Read the
         `Authentication-Results` header.

      Look for:

      ```
      dkim=pass   (d=meticlecare.com, s=x)
      spf=pass
      dmarc=pass
      ```

      `dkim=none`, `dkim=fail`, or no DKIM line at all means the key is
      decorative. Record the result in this file.

      **A hand-written email from your own mailbox does not count.** It travels
      your mailbox's path, which is already known to work. The point is the
      application's path, because that is the one an attacker impersonates.

- [x] **3. If step 2 shows no `dkim=pass` — enable DKIM signing in MXRocket.**
      **NOT NEEDED 27 Sep 2026.** Gmail reported `dkim=pass` with
      `header.s=x` for mail from this domain, matching the published key, so
      signing is already enabled in the MXRocket panel. Recorded for the case
      where a later message comes back `dkim=none` after a panel change.

- [ ] **4. Until step 2 passes, keep DMARC at `p=none`.**
      **ACTION REQUIRED 26 Sep 2026 — this is now the wrong way round.**
      DMARC was observed live as
      `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@meticlecare.com; pct=100`
      while step 2 is still unproven, which is the exact situation this step
      exists to prevent. `pct=100` means there is no partial rollout to soften
      it: every message that fails DMARC goes to recipients' spam folders.

      The specific risk is forwarding. Meticle's mail goes to care homes and
      NHS trusts, where a message is routinely relayed through a trust mail
      gateway or a shared mailbox. SPF alignment breaks the moment that
      happens, and under `p=quarantine` those messages land in spam — with the
      worst possible content: a password reset or an invoice. DKIM survives
      forwarding; SPF does not. That is why the order is DKIM first, then
      quarantine.

      Either confirm `dkim=pass` and `dmarc=pass` on an external inbox, or
      revert the record to `p=none` until that is recorded in step 2.

- [x] **5. Confirm `dmarc-reports@meticlecare.com` exists as a real mailbox.**
      **Confirmed 26 Sep 2026.** Reports are sent *by the receiving server* to
      this address. If it did not exist they would bounce, you would get no
      reports, and the setup would look correct because the DNS record is right.

- [ ] **6. Verify the envelope sender is aligned.**
      **Code side: done.** `buildMailOptions` pins `envelope: { from }` to the
      visible sender, so `MAIL FROM` is on `meticlecare.com` by construction and
      no longer depends on `SMTP_USER`. An off-domain `SMTP_FROM` is now refused
      rather than used — the local dev env turned out to hold a leftover
      `***REMOVED***`, which would have failed alignment and disclosed an
      unrelated vendor to every recipient.

      Still to confirm, and only this one:
      1. In the headers from step 2, `Return-Path` shows
         `bounce@…meticlecare.com` or similar. MXRocket may rewrite the return
         path in transit, and the received header is the only proof of what went
         on the wire.

      > **Not** `DEPLOY_SMTP_FROM`. That secret is the `From:` of GitHub
      > Actions' own deploy-failure alert, read by `.github/scripts/notify-deploy.py`
      > and sent to `DEPLOY_ALERT_TO`. It has no connection to the application's
      > mail, and an earlier draft of this runbook wrongly sent the owner
      > looking for it. The application's sender is `SENDERS` in
      > `apps/api/src/shared/utils/email.service.ts` — all `@meticlecare.com` —
      > written into `email_queue.from_email` at enqueue time.

- [ ] **7. ~~Decide the office mail provider.~~ ANSWERED 26 Sep 2026: neither.**
      All organisational mail is handled by MXRocket — the same provider that
      hosts the MX record and sends the application's mail. Staff replying from
      their `@meticlecare.com` mailbox authenticate over SMTP to MXRocket, so
      their mail is signed with the `x` key and passes DMARC. No second DKIM
      CNAME is needed and no staff mail will be caught by `p=quarantine`.

      What this leaves open is narrower than it looked, and is in the section
      below: client-side forwarding, and any third-party tool that sends as the
      domain.

## Hardening

- [ ] **8. Set `v=spf1 -all` TXT at `dmarc-reports.meticlecare.com`.**
      Stops the report mailbox itself being spoofed, and stops report traffic
      being treated as spam by your own filters.

- [ ] **9. Enable Cloudflare Email Security and add `ruf=` to the DMARC record.**
      `rua=` delivers gzipped XML attachments that nobody reads unaided. A
      reporting service parses them and shows sources, counts and alignment
      failures. Keep `rua` as the assessor's evidence that reporting is on and
      pointed somewhere real.

- [ ] **10. Publish MTA-STS and TLS-RPT.**
      `_mta-sts` TXT plus a policy at `https://mta-sts.meticlecare.com/.well-known/mta-sts.txt`,
      and `_smtp._tls` TXT for TLS-RPT. Stops an active on-path attacker
      downgrading the session to plaintext. The policy host must be served over
      HTTPS with a valid certificate.

- [ ] **11. Run a spoof test from a domain you do not own.**
      Send yourself a message with `From: security@meticlecare.com` from an
      unrelated mailbox. Confirm it lands in spam, not the inbox. This is the
      only thing that proves the policy is *enforced* rather than merely
      *published*.

- [ ] **12. Review reports weekly for a clean quarter, then move to `p=reject`.**
      Any source reported against `meticlecare.com` that is not MXRocket is an
      active spoofing attempt. During the quarantine period also look for
      *legitimate* senders being failed — that is how step 7's fallout shows up.

- [ ] **13. Optional: BIMI.**
      Needs a Verified Mark Certificate — a paid per-brand certificate. Only
      worth it once DMARC is at `p=reject`, because BIMI is only honoured by
      receivers that already trust the domain.

## Step 7 answered — what actually remains

The organisation runs on neither Microsoft 365 nor Google Workspace. Everything
runs through MXRocket, so staff replies are signed and aligned and
`p=quarantine` will not catch the organisation's own mail.

Two things can still leave the domain unaligned, and both are habits or tools
rather than infrastructure:

- [ ] **14. Issue the staff rule: send as `@meticlecare.com` only from the
      MXRocket account, and never configure a personal Microsoft or Google
      account to send as the domain.** A personal account sending as
      `@meticlecare.com` is signed by that provider, fails alignment, and is
      indistinguishable from an attack to the recipient.
- [ ] **15. Prohibit client-side auto-forwarding to a personal address.** This is
      the sharper one. A mail-client rule that forwards a copy re-sends it from
      the forwarding provider: unaligned, and sent from a mailbox the recipient
      trusts. `p=quarantine` will catch it, but the habit should not be relied
      on to be absorbed by a DNS record.
- [ ] **16. Inventory third-party tools that send as the domain.** A helpdesk, a
      CRM, a form-notification service — anything posting to a recipient on the
      organisation's behalf. Each one needs its own DKIM or it will be
      quarantined. The `ruf=` reporting from step 9 is how these get found.
- [ ] **17. Add the staff rules to security-awareness material.** Staff cannot
      comply with a rule they have not been told.

### One consequence worth knowing

MXRocket is now the single sending path for the whole domain. If their signing
is disabled or their service is unavailable, every `@meticlecare.com` message
fails DMARC at once rather than a fraction of them. That is accepted — the
alternative is several providers each needing their own key and alignment, which
is materially more work for a small organisation.

It is also why step 2 is the most important step on this list. The check is not
just "does our mail sign" — it is "does our only mail path still work".

### Reducing it

- [ ] **18. Provision a second sending provider as a standby, not a replacement.**
      Amazon SES or Postmark — either is cheap and can be left unconfigured for
      sending. The point is to have the account, not to use it.
- [ ] **19. Publish its DKIM CNAME and add it to SPF.** The SPF record becomes
      `v=spf1 include:mxroute.com include:<second-provider> -all`. Two of the ten
      permitted DNS lookups are used, so there is headroom. The trailing `-all`
      must stay.
- [ ] **20. Write down a break-glass contact route that does not use email.**
      Staff mailboxes are on MXRocket too, so an outage stops receiving as well
      as sending, and no amount of standby sending capacity fixes that. For a
      care organisation this is the part that actually matters — it belongs in
      the business-continuity plan, not just the security policy.

Why this and not something else: a second provider does **not** help if MXRocket
silently stops signing, which is the more likely failure. Monitoring catches
that within days; architecture does not catch it faster. The second provider is
worth having for outage and for not having a single DNS mistake be total.

## Recording the outcome

When steps 1–6 are done, update the table in `docs/SECURITY_POLICY.md` §7 with
the verified values and the date, and tick the corresponding rows in the §7.4
outstanding table. The policy is assessor evidence, so it should never lag
behind the live configuration.

**Last reviewed:** 26 September 2026
**Owner:** _unassigned — assign a named owner_
