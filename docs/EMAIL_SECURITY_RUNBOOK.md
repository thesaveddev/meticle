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

- [ ] **1. Re-check Cloudflare that the DMARC record actually saved.**
      Public DNS still returns `p=none`. Either the edit did not save, or it has
      not propagated past the 300-second TTL and resolver caches. Confirm in the
      Cloudflare DNS panel, then re-check that it resolves as
      `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@meticlecare.com; pct=100`.

- [ ] **2. Send an app email to `mail-tester.com` and read the headers.**
      This is the gate for everything below. The DKIM *public key* being
      published proves nothing about whether MXRocket *signs* with it — signing
      happens at send time, and can be off while the key sits in DNS looking
      perfect. Look for:

      ```
      dkim=pass   (d=meticlecare.com, s=x)
      spf=pass
      dmarc=pass
      ```

      `dkim=none`, `dkim=fail`, or no DKIM line at all means the key is
      decorative. Record the result in this file.

- [ ] **3. If step 2 shows no `dkim=pass` — enable DKIM signing in MXRocket.**
      The public key is already published at selector `x`, so this is a panel
      setting, not a DNS change. Re-run step 2 until it passes.

- [ ] **4. Until step 2 passes, keep DMARC at `p=none`.**
      If `p=quarantine` went live first, put it back. SPF alone is not enough:
      it fails DMARC alignment the moment mail passes through a forwarder — an
      NHS trust relay, a shared inbox, a support tool — and quarantine sends
      that to spam. DKIM survives forwarding; SPF does not.

- [ ] **5. Confirm `dmarc-reports@meticlecare.com` exists as a real mailbox.**
      Reports are sent *by the receiving server* to this address. If it does not
      exist, they bounce, you get no reports, and the mailbox looks configured
      because the DNS record is right. Create it, and confirm it accepts mail.

- [ ] **6. Verify the MXRocket envelope / bounce domain is `@meticlecare.com`.**
      DMARC SPF alignment fails if the `MAIL FROM` envelope sender is not on the
      organisational domain — visible `From:` is not enough. Check in the MXRocket
      panel, or read the `Return-Path` header from step 2's message.

- [ ] **7. Decide the office mail provider: Microsoft 365, Google Workspace, or neither.**
      **This is a decision, not a task — see the section below. It blocks
      `p=quarantine` from being a clean state.**

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

## The decision behind step 7 — staff mail from other providers

Enforcing DMARC does not only stop attackers. It also fails mail sent *by the
organisation* from anywhere other than the authorised relay, and the most likely
place is a staff member replying from a personal phone or a personal Outlook
account set to send as `@meticlecare.com`.

That mail is signed by Microsoft (`d=outlook.com`) or not signed at all. DMARC
sees an organisational domain that authorises neither, and under `p=quarantine`
a colleague's legitimate reply goes to spam. From the receiving side it is
**indistinguishable from an attack** — same visible address, same alignment
failure. Only the reports tell them apart, and only once someone is reading them.

Three ways this can be resolved:

| Situation | What to do |
| --- | --- |
| Office uses Microsoft 365 or Google Workspace | Publish that provider's DKIM CNAME in DNS beside the MXRocket key. Both sign, staff replies pass. **This is the clean answer.** |
| Staff have no organisational mailbox | Accept that their replies fail DMARC. The workaround is that they send from a personal address and the recipient is told to expect it. This must be written down as accepted risk, not left to be discovered. |
| Mixed | Both of the above, per person |

Then:

- [ ] **14. Issue the staff rule:** send from the `@meticlecare.com` mailbox,
      not a personal device.
- [ ] **15. Add the corresponding note to security-awareness material.** Staff
      cannot comply with a rule they have not been told.

## Recording the outcome

When steps 1–6 are done, update the table in `docs/SECURITY_POLICY.md` §7 with
the verified values and the date, and tick the corresponding rows in the §7.4
outstanding table. The policy is assessor evidence, so it should never lag
behind the live configuration.

**Last reviewed:** 26 September 2026
**Owner:** _unassigned — assign a named owner_
