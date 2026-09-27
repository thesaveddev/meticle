# Email security action list — meticlecare.com

A working to-do list for closing out the domain's anti-spoofing posture. The
control itself is documented, with the reasoning and the evidence, in
`docs/SECURITY_POLICY.md` §7. This file is only the checklist.

Meticle Care sends care records, password resets and account-recovery mail from
`@meticlecare.com`. Anyone can send mail claiming that domain. Until the
receiving server is told to check, a spoofed "your password expires today" mail
from `security@meticlecare.com` lands in a carer's inbox and is indistinguishable
from the real thing.

**Do the steps in order.** Step 2 gates steps 3 onwards: publishing an enforcing
DMARC policy before signing is confirmed will send the organisation's own
legitimate mail to spam. **Step 2 passed on 27 September 2026**, on mail the
application itself sent, so the steps it gated are settled.

## Where things stand — 27 September 2026

Checked against public DNS (`ziggy.ns.cloudflare.com`; transport MXRocket,
`MX 10 safari.mxrouting.net`):

| Record | Found | State |
| --- | --- | --- |
| SPF | `v=spf1 include:mxroute.com -all` | **Done.** Authorises the sending provider and nobody else; `-all` is a hard fail |
| DKIM | `x._domainkey.meticlecare.com` — `v=DKIM1;k=rsa`, 2048-bit RSA | **Done.** Confirmed in use on the application's own mail, 27 Sep — see step 2 |
| DMARC | `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@meticlecare.com; pct=100` | **Enforcing, and now safe.** `p=quarantine` resolved publicly on 26 Sep; step 2 passed 27 Sep, which was the precondition for leaving it there |

## Blocking steps

- [x] **1. Re-check Cloudflare that the DMARC record actually saved.**
      **DONE 26 Sep 2026.** The record did save; an earlier check had simply
      been served from resolver cache. Public DNS now returns
      `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@meticlecare.com; pct=100`.

      This was urgent rather than advisory while step 2 was open, because an
      enforcing policy with unproven signing is the one combination that
      quarantines the organisation's own mail. Step 2 has since passed, so the
      edit is now correct — see step 4.

- [x] **2. Have the *application* send a test email to a real inbox you control.**
      **DONE 27 Sep 2026 — the application's own mail passes all three checks
      at Gmail, signed with the published key.**

      This is the evidence that counts, because it travelled the application's
      path rather than the mailbox's: `POST /api/auth/send-email-code` for an
      address with no account, enqueued by the app, submitted by the queue
      worker over authenticated SMTP, delivered by MXRocket to Gmail. Gmail's
      own verifier, from *Show original*:

      ```
      Authentication-Results: mx.google.com;
        dkim=pass header.i=@meticlecare.com header.s=x header.b=RWLJc9sL;
        spf=pass (google.com: domain of security@meticlecare.com designates
          136.175.108.148 as permitted sender) smtp.mailfrom=security@meticlecare.com;
        dmarc=pass (p=QUARANTINE sp=QUARANTINE dis=NONE) header.from=meticlecare.com
      DKIM-Signature: v=1; a=rsa-sha256; ... d=meticlecare.com; s=x; ...
      Return-Path: <security@meticlecare.com>
      Received: from mail-108-mta148.mxroute.com ([136.175.108.148]) by mx.google.com
        with ESMTPS ... for <itsopeyemi@gmail.com> (version=TLS1_3)
      ```

      What each part establishes:

      - `dkim=pass`, `header.i=@meticlecare.com`, `header.s=x` — signed with the
        key published at `x._domainkey.meticlecare.com`, and the signing domain
        matches the visible `From:`. This is the whole point of the step: an
        attacker cannot obtain a valid signature for this `From:` domain.
      - `spf=pass` — MXRocket is the only authorised sender, and `-all` holds.
      - `dmarc=pass` — and the parenthetical shows the *live* policy is
        `p=QUARANTINE`, so the enforce-in-practice claim in step 1 is not just
        in DNS.
      - `Return-Path: <security@meticlecare.com>` — see step 6.

      The message is unmistakably the application's: `From: security@meticlecare.com`
      is an entry in the `SENDERS` map, the `Message-ID` is app-generated, and
      the body is the app's own verification-code template.

      **Read `dkim=` specifically.** Do not accept `dmarc=pass` on its own. SPF
      is aligned and passes via `include:mxroute.com`, so DMARC would report
      `pass` on this domain *whether or not DKIM ever ran* — `dmarc=pass` with
      `dkim=none` is a real combination and would have read as success here.

      #### What the 26–27 Sep results did and did not prove

      Two earlier results were recorded and neither was sufficient, for reasons
      worth keeping:

      - A message hand-composed in the `notifications@meticlecare.com` mailbox
        also returned `dkim=pass header.s=x`, but carried
        `X-Authenticated-Id: notifications@meticlecare.com`. It was submitted
        from a mailbox, whereas the app authenticates with `SMTP_USER` — a
        different credential on the same domain. DKIM signing is applied
        per-domain by the sending MTA and need not behave identically for a
        different authenticated identity, which is exactly what step 2 is for.
      - A test to `opeyemi@meticlecare.com` proved the envelope question — see
        step 6 — but was delivered by `safari.mxrouting.net` over **LMTP** to
        another mailbox on the *same* provider. Sender and recipient shared a
        path, so acceptance by Gmail or Outlook was never exercised, and the
        header block came from the provider's own scanner rather than a
        third-party verifier.

      #### Re-running this check

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

      #### One observation from the 27 Sep run: allow for the queue delay

      Gmail reported `Delivered after 10 seconds`, and the timestamps agree —
      `Date: 12:43:30`, accepted by MXRocket at `12:43:36`, received by Google
      at `12:43:40`. Delivery once submitted is fast, and Gmail was not the
      source of the delay.

      The delay was between the request and the SMTP submission, and the
      request returns long before that: `send-email-code` enqueues and
      responds immediately, so a `200 {"message":"Verification code sent"}`
      means *queued*, not *sent*. Do not diagnose a slow request by re-firing
      it inside a minute — `rateLimit(5, 60_000)` on the route means retries
      can exhaust the budget and then fail silently with no mail queued at all.
      Wait a minute, or read the queue directly via
      `GET /api/platform-admin/email-queue` as a SUPER_ADMIN, which is the only
      view that distinguishes "never queued" from "queued and not yet sent".

- [x] **3. If step 2 shows no `dkim=pass` — enable DKIM signing in MXRocket.**
      **NOT NEEDED 27 Sep 2026.** Gmail reported `dkim=pass` with
      `header.s=x` for mail from this domain, matching the published key, so
      signing is already enabled in the MXRocket panel. Recorded for the case
      where a later message comes back `dkim=none` after a panel change.

- [x] **4. Until step 2 passes, keep DMARC at `p=none`.**
      **SATISFIED 27 Sep 2026 — the precondition held.** Step 2 passed on the
      application's own mail at Gmail, so `p=quarantine` is now in the right
      order and should be **left as it is**:

      ```
      Authentication-Results: ... dmarc=pass (p=QUARANTINE sp=QUARANTINE dis=NONE)
      ```

      The forwarding risk this step guards against is the one that made
      `p=quarantine` premature, and step 2 is precisely what retires it. SPF
      alignment breaks when a care home or NHS trust relays mail through a
      shared gateway; DKIM survives that, because the signature covers headers
      rather than the sending IP. With `dkim=pass` confirmed on the sending
      path, a forwarded message still authenticates and still aligns, so it
      will not be quarantined for the wrong reason.

      What `p=quarantine` *should* now catch is the intended target: anyone
      sending as `meticlecare.com` without a valid signature. Left at
      `p=quarantine` for now, because the reports go to
      `dmarc-reports@meticlecare.com` and the decision to go to `p=reject`
      should be made from the report volume rather than on the day it is
      changed. Note the fail-open setting: `dis=NONE` means the policy is
      enforced with no relaxed treatment for subdomains.

- [x] **5. Confirm `dmarc-reports@meticlecare.com` exists as a real mailbox.**
      **Confirmed 26 Sep 2026.** Reports are sent *by the receiving server* to
      this address. If it did not exist they would bounce, you would get no
      reports, and the setup would look correct because the DNS record is right.- [x] **6. Verify the envelope sender is aligned.**
      **DONE 27 Sep 2026 — confirmed on the wire by a third-party verifier.**

      `buildMailOptions` pins `envelope: { from }` to the visible sender, so
      `MAIL FROM` is on `meticlecare.com` by construction and does not depend on
      `SMTP_USER`. An off-domain `SMTP_FROM` is refused rather than used — the
      local dev env turned out to hold a leftover `caredesk@reydesk.com`, which
      would have failed alignment and disclosed an unrelated vendor to every
      recipient.

      The wire proof, from the same Gmail message as step 2 — note these are
      Google's, not MXRocket's, so nothing here can be self-reported:

      ```
      Return-Path: <security@meticlecare.com>
      Received: from mail-108-mta148.mxroute.com ([136.175.108.148])
        by mx.google.com with ESMTPS ... for <itsopeyemi@gmail.com>
      Received-SPF: pass (google.com: domain of security@meticlecare.com
        designates 136.175.108.148 as permitted sender) client-ip=136.175.108.148;
      ```

      `Return-Path` is the envelope sender and it is
      `security@meticlecare.com` — the same address as `From:`, and therefore
      aligned. MXRocket did **not** rewrite the return path in transit, and
      `smtp.mailfrom=security@meticlecare.com` in Google's
      `Authentication-Results` independently agrees. No third-party domain
      appears in any header. This also settles the
      `SMTP_USER=caredesk@reydesk.com` question: that value is only ever the
      SMTP auth username and reaches no header. (`X-Authenticated-Id:
      notifications@meticlecare.com` is MXRocket's own account identifier for
      the submitting credential; it is not a sender and recipients do not see
      it.)

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
just "does our mail sign" — it is "does our only mail path still work". That
check was done properly on 27 Sep 2026, on the application's own path rather
than the mailbox path, and it passed.

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
