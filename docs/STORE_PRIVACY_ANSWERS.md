# Store privacy answers — Meticle Care mobile

Draft answers for the Google Play Data safety form and the Apple App Privacy
"App Privacy" label, derived from the code rather than from assumptions. Every
row below cites where the behaviour comes from, so it can be re-checked when the
code changes.

Scope note: these are the **mobile** app's answers. The web app loads OpenStreetMap
tiles on its live map (`apps/web/src/pages/homecare/LiveMapPage.tsx:79`), which
discloses staff visit coordinates to the OSM Foundation. The mobile app loads no
map tiles and has no analytics, advertising or crash-reporting SDK — verified
against `apps/mobile/package.json` dependencies.

**You own these answers before submitting them.** Where a question needs a
commercial or legal position rather than a code fact, it is marked ⚠️.

## What the app handles

| Data | Source in code |
| --- | --- |
| Name, email, phone, address, date of birth, profile photo | `users`, `staff_profiles` in `apps/api/src/shared/database/schema.sql` |
| Client health records, care notes, body maps, risk assessments | `BodyMapScreen`, `ClientDetailScreen`, `NutritionScreen` |
| Medication and safeguarding/incident records | `ReportIncidentScreen`, incident module |
| Precise location at check-in and check-out | `expo-location`; `VisitScreen` check-in. **Conditional** — collected only where the worker's employer has location recording switched on **and** that worker has agreed to it. A worker who declines, or who has not yet answered, has no position read, sent, stored or plotted |
| The worker's own location decision (agreed / declined) | `StaffNoticeScreen`; `POST /homecare/location-decision`, `staff_location_decisions` (migration 133). No position is ever attached to it |
| Photos and file attachments as evidence | `expo-image-picker`, chat file metadata |
| Chat messages between staff | `ChatScreen` |
| Payroll and mileage figures | `CarerTotalsScreen`, `services/payslip.ts` |
| Credentials, MFA secret, backup codes | `users` table |
| Device push token | `services/notifications.ts:116` (`getExpoPushTokenAsync`) |
| Audit log of who did what | `AuditRepository` |

## Google Play — Data safety form

Top-level: **Your app collects or shares some of the required user data types: Yes**

| Data type | Collected | Shared | Purpose |
| --- | --- | --- | --- |
| Location — precise | Yes | No | App functionality |
| Personal info — name, email, phone, address, date of birth, user IDs | Yes | No | App functionality |
| Financial info — payroll, mileage, payslips | Yes | No | App functionality |
| Health and fitness — health records | Yes | No | App functionality |
| Photos and videos | Yes | No | App functionality |
| Messages — in-app chat | Yes | No | App functionality |
| App activity — in-app actions, audit log | Yes | No | App functionality |
| Device or other IDs — push token | Yes | **Yes** (Expo) | App functionality |

- **Is any of this collected for analytics or advertising?** No. There is no
  analytics or ads SDK in the mobile dependency tree.
- **Precise location is declared as collected, and it is conditional.** The "Yes"
  is correct — the app does collect it, for the workers it applies to. Two
  conditions now sit in front of it, and a reviewer comparing the declaration to
  the app's behaviour should be told both rather than discovering them: the
  worker's employer must have location recording switched on, and that worker
  must have agreed (migration 133, `DPIA` §5.3). A worker who has declined or has
  not yet answered is not collected from — silence is not agreement. The app also
  collects and stores **the worker's decision itself**, which is personal data
  about an employee and is declared above; it holds no position. If the decision
  is later found to need its own line on either form, that is a judgement for
  whoever signs the declaration, not a code fact.
- **Is data encrypted in transit?** Yes — all API traffic is HTTPS. The binary
  declares `ITSAppUsesNonExemptEncryption: false` in `apps/mobile/app.json`, so
  App Store Connect will not ask the encryption questions.
- **Do you provide a way for users to request data deletion?** Yes — Settings →
  "Delete my account" (`SettingsScreen.tsx`), which calls
  `POST /staff/self-deactivate` and then clears the local session.
- **Data shared with a third party:** the Expo Push Service, which receives the
  device push token and the notification payload so reminders can be delivered.
  No other processor is in the mobile path; email goes out over SMTP from
  infrastructure you control.

⚠️ **The one that will be scrutinised.** The Play form asks what happens to data
after deletion. The honest answer is *partly deleted, partly retained*, and it
should be given plainly rather than answered "yes, deleted":

> On request we erase the account and its contact and identifying data —
> email, password hash, MFA secret and backup codes, date of birth, phone,
> address, profile photo, emergency contacts, and any outstanding reset
> tokens. We retain the professional name, role and staff ID of a worker who
> performed care activity, together with the records themselves, because a
> visit, incident or room check is only evidence if it can be attributed to
> the person who performed it. Safeguarding enquiries, CQC inspections and
> court proceedings all require that attribution. This retention rests on our
> legal obligation as a regulated care provider, not on convenience.

Google permits retention on this basis. It is also the answer that would survive
being questioned.

## Apple — App Privacy label

- **Do you or your third-party partners collect data from this app?** Yes
- **Data linked to the user:** name, email, phone, address, date of birth,
  precise location, health and fitness, photos or videos, messages, financial
  info, user ID, device ID (push token)
- **Data not linked to the user:** none
- **Data used for tracking:** **No.** Nothing is used for tracking as Apple
  defines it (third-party advertising or marketing, or sharing with a data
  broker). Declaring "no tracking" avoids the App Tracking Transparency prompt
  and the ATT requirement entirely — worth preserving, so do not add an
  analytics SDK without re-reading this.
- **Purposes:** App Functionality only
- **Third-party partners:** Expo (push notification delivery), named under
  User ID and Device ID for App Functionality

## Account deletion and retention — the position in code

`POST /staff/self-deactivate` now does a two-tier erase, in one transaction:

**Erased** — `users.email` (replaced with `deleted-<uuid>@deleted.invalid`),
`password_hash` (replaced with random bytes), `email_verified`,
`force_password_reset`, `mfa_secret`, `backup_codes`; and in `staff_profiles`:
`birth_date`, `phone`, `address`, `city`, `country`, `postal_code`,
`profile_picture_url`. Plus every `emergency_contacts` row and every
outstanding `verification_tokens` row.

**Retained** — `first_name`, `last_name`, role, `staff_id`, employment details,
and every visit, incident, room check, timesheet, payroll and audit row that
references the user.

The `status = 'deactivated'` flag then makes `authenticate` reject every
subsequent request with 403 (`auth.middleware.ts:114`) and blocks the socket
(`shared/socket/index.ts:212`), so the login is genuinely closed rather than
merely hidden.

Covered by `apps/api/src/modules/staff/account-deletion.integration.test.ts` —
six tests asserting both halves: the erasure *and* the surviving attribution.

## Before you submit

⚠️ **Check the public privacy policy against reality.** Section 5 of
`apps/web/src/pages/legal/PrivacyPolicyPage.tsx` claimed ISO 27001-certified
infrastructure. Contabo's own site does not substantiate it — they publish no
certificate, and their only claim is that "most of our facilities hold
internationally recognized ISO certifications", which names no standard and
describes facilities rather than their own ISMS. The wording has been replaced
across the site with claims that can be evidenced: TLS 1.3 in transit,
database-level tenant isolation, MFA, and auditable record access.
Do not reintroduce an ISO 27001 claim until a certificate exists to cite.
ISO 27001 remains a planned item (target Q2 2027) in the funding and sales
documents, which describe it as preparation rather than held — that framing is
correct and should stay.

⚠️ **The same correction was missed on the web privacy policy.** Section 5 of
that page still read "Encrypted in transit (TLS 1.3) and at rest (AES-256)" and
"Hosted in the United Kingdom with a GDPR-compliant infrastructure provider" as
of this pass. The claim audit (F9, F10 in `docs/CLAIM_REGISTER.md`) had withdrawn
the at-rest claim outright — `pgcrypto` is installed in `setup.ts` under a
comment promising column-level encryption and a repo-wide search for
`pgp_sym_encrypt` returns nothing, so the application does not encrypt anything
at rest — but the fix was only ever applied to the marketing site. The web
privacy policy is the URL Play reads for the Data safety form, so the claim was
live on the one page that is submitted to Google. Now corrected to match F9/F10:
UK storage with the AI exception stated, and encryption in transit only, with
at-rest named as the infrastructure provider's responsibility.

The other half of that correction is the "GDPR-compliant infrastructure
provider" phrasing, which was compliance language asserted on a customer's
behalf. A care provider is the controller here; we are the processor. We can
describe the contract we hold with our own host, but we do not certify that a
customer's processing of health data is compliant.

⚠️ **Retention schedule.** The policy states "Account data: active period + 90
days after cancellation", but the code erases account data immediately on
self-deletion. Immediate erasure is stricter than the policy promises, so it is
not a conflict — but there is no scheduled 90-day purge job, so anything that
depends on that clause is not implemented.

⚠️ **Confirm the lawful basis for retaining the professional name with your DPO
or legal adviser** before the Data safety form is submitted. The engineering
supports it; the policy position is a legal call.
