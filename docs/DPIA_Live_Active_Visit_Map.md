# Data Protection Impact Assessment (DPIA)
## Live Active-Visit Map — MeticleCare

**Document version:** 1.4  
**Date:** 27 September 2026  
**Author:** MeticleCare Engineering  
**Review date:** 13 March 2027

### Revision history

| Version | Date | Change |
|---|---|---|
| 1.0 | 13 Sep 2026 | Initial draft. |
| 1.1 | 27 Sep 2026 | **Corrected against the implementation.** Version 1.0 described a capability we do not have. Every correction is listed below rather than quietly edited, because a data protection assessment that has been amended to match the product is only useful if the reader can see what changed. |
| 1.2 | 27 Sep 2026 | **Continuous collection removed, and an incorrect assurance in 1.1 retracted.** §1.1 of version 1.1 stated "no background location collection, no periodic sampling, and no tracking between or outside visits". That was wrong: the mobile app subscribed to the device position at 5-second / 10-metre intervals for as long as a visit screen was open before check-in. The claim was checked against documentation rather than against the code, and the code did not support it. The subscription is deleted, and this document is corrected. |
| 1.3 | 27 Sep 2026 | **The v1.1 retraction of the per-organisation kill switch is reversed, because the control now exists.** Version 1.0 claimed an organisation "can disable the live map feature per-location"; 1.1 retracted it as a control that did not exist. The control is now built — to 1.1's specification, not 1.0's wording — and §6 is restated as an implemented right, with a new §6.1 setting out exactly what "off" stops and the one thing it cannot preserve. Residual risk stays MEDIUM. |
| 1.4 | 27 Sep 2026 | **§5.2 stops being an intention and becomes a control, and two claims in it are withdrawn.** Carers are now shown what is collected, in the app, at first launch, with the acknowledgement recorded server-side. In the course of writing the notice, §5.2 was found to contradict §2.2 of this same document on retention, in the direction that flattered us. Also: the kill switch shipped in 1.3 had a gap — the navigation sheet read position without honouring it. |

**What changed in 1.4**

1. **The kill switch had a hole, found while writing the notice.** `MapPickerModal` took a
   position fix to estimate travel time without checking `location_tracking_enabled`, so a
   carer in an organisation that had switched location off was still prompted by the
   operating system and still had their position read. The read was device-only and stored
   nothing, so no data commitment was broken — but §6.1 of version 1.3 claimed "no position
   is taken" on mobile, and that was false. Fixed, and the fix is that absence of storage is
   not absence of collection: an employer that has told its workforce it does not track them
   cannot also have the app asking for a position on their behalf.

2. **§5.2 is now implemented rather than aspirational.** See the section for the full list.

3. **"Retained as part of the care record, not as a separate surveillance log" is withdrawn.**
   It contradicted §2.2, which records that no retention period has been determined. The
   in-app notice states no period and tells the worker to ask their employer.

4. **"Documented in employment contracts, staff handbook, and onboarding materials" is
   withdrawn as unevidenced.** Those are the care provider's documents. The in-app notice
   replaces the claim rather than the documents.

**What changed in 1.3**

1. **§6 "Right to restrict processing" is no longer a failure.** It now describes the
   implemented control and reverses the 1.1 retraction explicitly, rather than editing
   the sentence away. The retraction stays in the revision history because the reason it
   existed — an assurance that had never been verified — is the reason this control is
   built to a written specification.

2. **New §6.1 states what the switch does, per layer,** because "you can turn it off" is
   easy to say and easy to make misleadingly. The single most important thing to disclose
   is that switching off also switches off GPS visit verification, which is a genuine
   loss of assurance and is now stated in the product's own settings copy before the
   change is saved.

3. **The switch is not retroactive, is per organisation rather than per location, and
   does not revoke an operating-system permission the worker already granted.** Each of
   these is a limit a reader could otherwise assume away, and the mobile release that
   implements the app-side behaviour has not been cut yet.

**What changed in 1.2**

1. **§1.1 of version 1.1 contained a false assurance, and it is retracted.** It said there
   was "no periodic sampling". There was. `VisitScreen` called
   `Location.watchPositionAsync` with `timeInterval: 5000` and `distanceInterval: 10`,
   running for as long as the screen was mounted and the visit was not yet checked in.
   The values were never sent to the server — the subscription existed to drive a
   "42 m away" readout — but the device was being sampled continuously regardless, and
   that is what the sentence denied. Correcting a DPIA by asserting a property that was
   never verified is worse than leaving the original error in place, because it destroys
   the reader's ability to trust the rest of the document.

2. **The subscription is removed.** `watchDistance` is deleted from
   `apps/mobile/src/services/location.ts` and replaced by `measureVisitDistance`, a single
   fix taken when the carer taps **"Check my distance"**. No subscription, no interval, no
   timer.

3. **The three capture points are now enumerated exhaustively**, in §1.1. Every one of them
   is initiated by the carer. Nothing in the app reads position on a schedule, on screen
   mount, or in the background.

4. **§5.2 no longer tells carers something untrue.** Version 1.1 told them location is
   collected "only when they check in". From this version there are three on-demand points,
   and carers are told all three.

5. **Check-out GPS accuracy is now recorded** (`check_out_accuracy_meters`,
   migration `124`). The app has always sent it and the database was discarding it, so §2.1
   claimed a data quality indicator that was not in fact stored for check-out.

**What changed in 1.1, and why**

1. **§6 claimed a control that does not exist.** Version 1.0 stated the organisation "can
   disable the live map feature per-location". There is no such toggle, and no
   feature-flag mechanism anywhere in the product. A customer signing this document was
   signing a statement about a capability we do not have.
2. **The feature is not real-time.** Version 1.0 described "real-time (or near-real-time)
   location". The map plots the coordinate captured **at check-in**, and nothing else
   reaches the server. There is no background or periodic location collection.
3. **The stated purpose is not delivered by the data.** Lone-worker safety and emergency
   escalation are the reasons given for collecting location at all, and a check-in pin
   cannot support either. See §1.2 and §4.
4. **Retention stated for carer location was not evidenced.** Version 1.0 asserted 8 years
   as a recommendation with no basis given.
5. **§7 rate limiting and encryption described the wrong mechanisms.**
6. **Residual risk raised from LOW to MEDIUM**, because the mitigation for the most likely
   risk — a carer's trust — is entirely outside our control.  

---

## 1. Overview

### 1.1 Feature description

The Visit Check-In Map is a manager-facing dashboard that plots **the position a carer
recorded when they checked in to a visit**. It shows:

- **Checked-in visits:** the call, the client, the carer, and the coordinate captured at check-in
- **Scheduled visits:** the day's upcoming calls, with the client's registered address and no position

The map is visible only to users with ORG_ADMIN or MANAGER roles. Carers do **not** have
access to this feature.

**What is not collected.** There is no background location collection, no periodic
sampling, and no tracking between or outside visits. A carer with the app closed is not
tracked, and a carer who has not checked in has no position on the map at all.

**The three — and only three — moments the app reads position.** All three are initiated
by the carer. None runs on a timer, on screen mount, or while the app is closed.

| # | Trigger | What is read | Where it goes |
|---|---|---|---|
| 1 | Carer presses **Check in** | One fix, with accuracy | Sent to the server, stored as `check_in_*` on the visit |
| 2 | Carer presses **Check out** | One fix, with accuracy | Sent to the server, stored as `check_out_*` on the visit |
| 3 | Carer opens the **navigation** modal, or taps **"Check my distance"** | One fix, with accuracy | **Stays on the device.** Used to show a distance and a travel estimate. Never transmitted |

Points 1 and 2 are what the map shows. Point 3 exists so a carer can see whether they are
close enough to check in before they commit to the press; the authoritative threshold
check happens at point 1, on a fresh fix, and the press is refused if they are too far
away. The device requests *foreground* location permission only.

**This was not always true, and the change is recorded rather than quietly made.**
Until 27 Sep 2026 the app subscribed to position at 5-second / 10-metre intervals
whileever a visit screen was open before check-in, in order to update that distance
readout continuously. The values were never transmitted and never left the device, but
the sampling was continuous and is not "collecting only at check-in and check-out" by any
reasonable reading. It was removed. The previous version of this document asserted that
no such sampling existed, which was an unverified claim; see the revision history.

**The honest limitation, stated plainly.** A pin on this map is a *historical* position: where
the carer was when they arrived. It does not move. A manager therefore cannot use it to
find a carer who is somewhere else now, to detect that a visit has overrun, or to
establish what happened during a visit. The feature was named "Live Map" and described as
real-time in version 1.0 of this document and in the interface; both were wrong and have
been corrected. If a customer needs current whereabouts, this feature does not provide it,
and the honest answer is that the product does not do that today.

### 1.2 Purpose and necessity

The purposes the implementation actually supports are:

1. **Operational oversight of attendance** — confirming a carer was physically at the
   client's address at the start of the call, which is the evidence base for both
   electronic visit verification and the timesheet.
2. **Dispatch and allocation** — seeing which calls have been attended and which have not,
   to reassign or follow up.
3. **Supervision of care delivery** — supporting CQC expectations that visits are taking
   place where and when they should.

**Purposes this feature does NOT support, which version 1.0 wrongly claimed:**

- *Live whereabouts during a visit.* The pin does not update.
- *Emergency escalation for a lone worker in difficulty.* Without a current position, and
  without alerting when a check-in is missed, this map cannot locate someone. The
  capability that does address this is the **overdue-call alert** (`homecare.reminders.ts`),
  which notifies a manager when a call passes its end time without being closed out. That is
  a separate feature and it is the one that should be pointed to for safety purposes.
- *Monitoring carer performance or punctuality as a disciplinary matter.* The recorded
  check-in time is an operational record. Whether it may be used for performance management
  is an employment matter for the organisation, not a technical one — see §5.

**Necessity:** a single coordinate at check-in is the minimum needed to evidence arrival.
Given the purposes above, no continuous tracking is necessary, and none occurs.

### 1.3 Legal basis

| Basis | Article | Justification |
|---|---|---|
| **Legitimate interest** | Art. 6(1)(f) UK GDPR | Employer has a legitimate interest in lone-worker safety and operational oversight during working time |
| **Health and social care** | Art. 9(2)(h) UK GDPR / DPA 2018 Sch.1 Para.2 | Processing of location data linked to care delivery is necessary for health and social care purposes |

---

## 2. Data processed

### 2.1 Personal data

| Data element | Source | Retention | Purpose |
|---|---|---|---|
| Carer GPS coordinates (latitude, longitude) | Mobile device, **at check-in and check-out only** — the two points that are stored. A third on-demand read drives a distance display and never leaves the device. See §1.1 | Held on the visit record. **No period is specified by MeticleCare.** See §2.2 | Evidence of arrival; dispatch |
| GPS accuracy (meters) | Mobile device, at both stored points | With the visit record. `check_in_accuracy_meters` and `check_out_accuracy_meters`; the latter added 27 Sep 2026, because the app was already sending it and the database was discarding it | Data quality indicator |
| Carer name and staff ID | Staff profile | With the visit record | Identification on map |
| Visit status | System | With the visit record | Operational visibility |
| Client name and address | Person profile | With the visit record | Map display and navigation |

### 2.2 Retention — corrected

Version 1.0 stated that carer location is retained "per org care-records retention policy
(recommended 8 years)". That was an unevidenced recommendation and it conflated two
different records.

**What MeticleCare can and should say.** The care record attached to a *client's* visit is
health data and belongs to the organisation, with whatever retention policy applies to
client records. The carer location stored alongside it is a field of that record.

**The point requiring a legal decision, not an engineering one.** Whether a carer's
position — the record of where a named employee was at a given moment — should be retained
on the same 8-year basis as the clinical notes of the visit is **not settled**. It is
arguable that location is not a care record at all, is retained for a much shorter period
for attendance purposes, and should not be swept into a clinical retention schedule
because it happens to share a row.

Version 1.0 resolved this by asserting a period. It should have raised it. **The DPO or
data protection adviser engaged for the organisation-wide DPIA must settle this**, and the
answer needs to be reflected here. Until then, this document does not specify a retention
period for carer location and the organisation should not rely on one being implied.

### 2.2 Data NOT processed

- Continuous location tracking outside of assigned, checked-in visits
- Location data from personal or off-duty time
- Speed, route, or trajectory data
- Any biometric data

---

## 3. Proportionality assessment

| Question | Assessment |
|---|---|
| Is the processing necessary for the stated purpose? | **Yes, for the corrected purposes.** Evidence of arrival needs a position. No continuous tracking is needed for attendance verification, and none occurs. |
| Can the purpose be achieved with less data? | **Partly — and version 1.0 said "no", which was not honest.** For *arrival evidence*, a check-in that did not occur is itself meaningful: an absent coordinate is evidence of non-arrival. The weaker design, recording only whether a check-in happened, would satisfy the evidential purpose without storing where. Coordinates are retained because they also support dispatch and dispute resolution, which is a choice, not a necessity. |
| Is the scope of processing limited to what is necessary? | **Yes.** One coordinate at check-in and one at check-out. Nothing between, nothing after. |
| Is the data retention proportionate? | **Not yet determined.** See §2.2. This assessment cannot be completed until a period is set by someone qualified to set it. |
| Is the processing limited to authorised personnel? | **Yes.** Only ORG_ADMIN and MANAGER. Carers cannot see other carers' locations. |

---

## 4. Risks and mitigations

### 4.1 Identified risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Unauthorised access to carer location data | Low | High | RBAC enforced: only ORG_ADMIN/MANAGER roles. JWT authentication required. RLS policies scope data to the user's organisation. |
| 2 | Location data used for purposes other than safety/operations | Low | Medium | Feature is documented as safety-only. Organisation's AI governance policy prohibits using location data for performance monitoring or disciplinary purposes without explicit policy approval. |
| 3 | Carer feels surveilled or distrustful | Medium | Medium | Staff transparency: GPS collection is documented in employment contracts and staff handbook. Data is only collected during active, assigned visits. No off-duty tracking. |
| 4 | GPS data inaccuracy leading to false safety conclusions | Medium | Low | Accuracy_meters is displayed. Managers are trained that coordinates are indicative, not definitive. |
| 5 | Data breach exposing carer locations | Low | High | Standard platform security: TLS in transit, AES-256 at rest for sensitive fields, database-level RLS, API rate limiting, audit logging on all data access. |
| 6 | Cross-tenant data leakage | Low | Critical | Tenant isolation enforced at every API endpoint via org_id scoping. RLS policies on all homecare tables. |

### 4.2 Residual risk rating

**MEDIUM** — raised from LOW in version 1.1.

The individual technical risks above are low, and the access controls genuinely hold. The
rating is driven by one thing instead: **the highest-likelihood risk, a carer losing trust
or objecting, has a mitigation we do not control.** Every mitigation in §4.1 for that risk
is a document or conversation held by the *organisation* with its own staff, and we have no
mechanism to confirm any of them happened, and no way to switch the feature off if they
did not. A provider with a unionised or works-council-represented workforce is a materially
different proposition from one without.

This is not a reason not to ship the feature. It is a reason not to describe it as low
risk, and not to let an organisation sign this document believing the controls are ours.

---

## 5. Staff transparency and consent

### 5.1 Communication to carers

Before the Visit Check-In Map is enabled for an organisation, the following must be in place:

1. **Employment contract clause:** Staff contracts must include a clause about GPS location collection during assigned visits for lone-worker safety purposes
2. **Staff handbook entry:** A clear, plain-English explanation of what data is collected, when, why, and who can see it
3. **Notice board / intranet notice:** A summary notice in staff areas explaining the GPS monitoring policy
4. **Right to be informed:** Staff are informed during onboarding and whenever the policy changes
5. **Consultation where required:** For an organisation with a recognised union or works
   council, the introduction of staff location monitoring is a consultation matter as well as
   a contractual one. This is the step most likely to be skipped and the one most likely to
   cause a dispute.

**MeticleCare cannot verify any of items 1-5 happened.** They are all obligations of the
employer, and the organisation holds the evidence. A customer signing this document is
signing that *they* have met them, not that we have.

**Consequence worth stating plainly:** because there is no per-organisation switch (see §6),
an organisation that has not done this work has no clean way to simply turn the feature off.
That makes step 5 the one to take most seriously before enabling anything, and it is a
strong argument for the kill switch being built before this feature is offered to any
unionised provider.

### 5.2 What carers are told, and where

**IMPLEMENTED in v1.3 — until then this section was an intention, not a control.** Versions 1.0
to 1.2 of this document stated what carers "should know" without anything in the product
telling them. A transparency statement that exists only in a data protection assessment
reaches the regulator and not the person being tracked.

The notice is shown in the mobile app at first launch, once per worker per version, and the
acknowledgement is recorded server-side (`staff_data_notices`, migration `127`) so an employer
asked to evidence that their staff were informed has something to show. Content lives in
`apps/mobile/src/content/staffLocationNotice.ts`, where each capture point carries a reference
to the code that proves it, and `staffLocationNotice.test.ts` asserts the claims against the
implementation.

What it tells them:

- GPS is collected **only** when they press Check in or Check out on an assigned visit
- The app also reads their position **when they ask it to** — tapping "Check my distance",
  or opening the navigation modal to see travel time. That reading stays on the phone and
  is never sent to MeticleCare
- GPS is **not** collected during travel between visits, during breaks, or off-duty, and it
  is **not** tracked continuously. There is no background collection, and nothing runs on
  a timer
- Only managers (not other carers) can see their location on the map
- **Their employer can see the recorded position against their name**, along with the client's
  name and address, the time, and the accuracy of the reading
- Turning the phone's location permission off means they cannot check in, and the employer
  sees that they have not
- The position is never sent to an AI provider
- How long it is kept is **the employer's decision**, and they are told to ask their employer

**Two corrections to what earlier versions of this document said here:**

1. **"Retained as part of the care record, not as a separate surveillance log" is withdrawn.**
   Versions 1.0 to 1.2 of §5.2 said this while §2.2 of the same document recorded that the
   retention period for carer location had **not been determined** and had been escalated to
   the DPO. The two sections contradicted each other, and the more reassuring of the two was
   the wrong one. The notice therefore states no period at all, and tells the worker who
   decides.
2. **"Documented in employment contracts, staff handbook, and onboarding materials" is
   withdrawn as unevidenced.** Those documents belong to the care provider, not to
   MeticleCare, and nothing in this repository supports the claim. The control that does
   exist is the in-app notice described above.

---

## 6. Data subject rights

| Right | Implementation |
|---|---|
| **Right to be informed** | **IMPLEMENTED in-app, v1.3.** The carer-facing location notice (`apps/mobile/src/content/staffLocationNotice.ts`) is shown at first launch, once per worker per version, and the acknowledgement is recorded in `staff_data_notices`. Earlier versions of this document claimed the information was "documented in employment contracts, staff handbook, and onboarding materials" — those belong to the care provider and nothing here evidenced them. That claim is withdrawn; see §5.2. |
| **Right of access** | Subject Access Requests include GPS coordinates from visit records. Response within 30 days per UK GDPR. |
| **Right to rectification** | GPS coordinates are immutable (captured at check-in/out). Correction is not technically possible; a note can be appended to the visit record. |
| **Right to erasure** | GPS coordinates are part of the care record retained under legal obligation (care-records retention policy). Erasure requests are assessed on a case-by-case basis per the organisation's SAR policy. |
| **Right to restrict processing** | **IMPLEMENTED — v1.2, and the v1.1 retraction is hereby reversed.** v1.0 claimed a per-location disable control that did not exist; v1.1 retracted it. The control now exists, built to the v1.1 retraction's own specification rather than to the v1.0 wording. `PUT /homecare/settings/location-tracking` (`{ enabled: false }`), restricted to `ORG_ADMIN`, writes `organizations.location_tracking_enabled` together with `location_tracking_disabled_at` and `location_tracking_disabled_by`. Aware of the position a worker is in is a data-minimisation decision, and it is the organisation's to make, not MeticleCare's. |
| **Right to object** | Staff can raise an objection to their employer. The organisation must demonstrate compelling legitimate grounds that override the objection, or cease processing for that individual. |

### 6.1 What the kill switch actually does — and its one casualty

Stated precisely because "you can turn it off" is a claim that is easy to make and easy to make misleadingly. When an organisation sets the switch off:

| Layer | Behaviour when off |
|---|---|
| API — check-in / check-out | No position is read. Coordinates are **not collected**. The visit is recorded normally and sets `location_capture_skipped = true`. |
| API — GPS proximity check | Skipped. There is no fix to check against, so the 500 m threshold cannot apply. |
| API — `GET /dashboard/live-map` | Returns **403**. Not an empty result — an explicit refusal, so a stale client cannot quietly keep plotting pins. |
| Web — navigation | The map link is not rendered. |
| Web — map page | Reachable by direct URL, and explains that the organisation has switched location off rather than showing a retry button. |
| Mobile | No permission is requested, no position is taken, no distance check is offered. |

**The casualty is GPS visit verification.** Turning this off also turns off the "you are within 500 m of the client" check at check-in, because that check is a comparison against a position we would then not have. This is a real loss of assurance and the settings copy states it before the change is saved. It is the trade the organisation is choosing: verification of *where* the carer was, or collection of *where the carer is*. It cannot be scoped down to "off for the map, on for verification" without keeping the collection, which is the thing some organisations are switching off in the first place.

**What the switch deliberately does not do**, and this is a decision rather than a gap:

- **It is per organisation, not per location or per worker.** Several claiming organisations share one tenant in this product, so a per-location control could not be enforced in the data model without a claim-level model that does not exist. "Off" is genuinely all-or-nothing per provider.
- **It is not retroactive.** Coordinates already captured stay in the record and remain subject to the retention question escalated to the DPO. Switching collection off is a forward-looking control.
- **It does not self-apply to a worker's device.** A carer who previously granted the OS location permission keeps it at OS level; the app simply stops reading it. The mobile release that implements this has not been cut yet.

**Audit position.** The change is auditable, and that is the point of `location_tracking_disabled_at` / `_by`: "when did this provider stop collecting, and who authorised it" is the first question of any workforce-monitoring review, and it cannot be answered from a settings page once the setting has been changed more than once. Viewing the map is separately logged as a `view` audit row (user, timestamp, IP — and deliberately **not** coordinates, which would create a second copy of staff location with its own retention question).

### 6.2 Residual risk, restated

Unchanged from v1.1 at **MEDIUM**, and the switch does not lower it. It removes the customer's ability to *object* to collection in practice for the subset of providers who use it; it does not change the lawful basis, the retention position (still escalated to the DPO), or the fact that a minority of providers will leave it on. An organisation that leaves the switch on has still agreed to workforce monitoring, and that agreement should be evidenced at contract rather than at signup.

---

## 7. Technical safeguards

| Safeguard | Implementation |
|---|---|
| **Access control** | RBAC: only ORG_ADMIN, MANAGER roles. Module-level permission: `homecare`. |
| **Organisation scoping** | All queries scoped to user's organisation_id. RLS policies on all homecare tables. |
| **Encryption in transit** | TLS 1.2+ on all API communication |
| **Storage precision** | GPS coordinates stored as `NUMERIC(10,7)` on `homecare_visits`. That is roughly 1 cm, far finer than any consumer GPS, and the accuracy figure is what makes a reading interpretable. |
| **Audit logging — capture** | Check-in and check-out both write an `audit_logs` row carrying the coordinates, the accuracy, and the requester's user_id and IP. The check-out row was **added 27 Sep 2026**: the position was being stored on the visit but not in the audit trail, so "where was this carer when they completed the call" was not answerable from the audit record alone. |
| **Audit logging — access** | **Added 27 Sep 2026, and it corrects a false claim in version 1.0 and 1.1.** Both stated that all access to the live-map endpoint is logged in `audit_logs`. It was not: `getLiveMap` performed no audit call, so there was no record of who opened the map. The endpoint now writes a `view` row with user_id, timestamp and IP. It records that the map was opened and how many positions were returned, and deliberately does **not** copy the coordinates into the audit row — that would create a second copy of staff locations with its own retention question. |
| **Rate limiting** | General API limiting applies. The map endpoint itself is behind authentication and role checks; the specific figure is not material to the risk here. |
| **Encryption at rest** | Sensitive PII columns are encrypted at application level with AES-256-GCM under a per-tenant derived key (`apps/api/src/shared/utils/encryption.ts`), on top of the host's disk encryption. **Caveat:** if `FIELD_ENCRYPTION_KEY` is unset the encryption degrades to plaintext with only a log warning. Whether it is set in the customer's own deployment is something the organisation must verify — see readiness item T0-15. |
| **Data minimisation** | Only coordinates, accuracy, and visit metadata are stored. No route history, speed, heading, or trajectory — the schema has nowhere to put them, so they cannot be collected even by accident. |
| **No continuous collection** | Map data is fetched on demand (pull), not pushed. Carers are not continuously tracked, and the app holds no position subscription at all. Enforced by tests in `apps/mobile/src/screens/__tests__/VisitScreen.test.tsx` ("reads no position until the carer asks for it", "takes exactly one fix per tap, and no more") and by the absence of any `watchPositionAsync` call in `apps/mobile/src`. Reintroducing a subscription fails those tests. |

---

## 8. DPIA review schedule

| Event | Action |
|---|---|
| **Annual review** | Next review: 13 March 2027 |
| **Feature change** | Re-assess if GPS collection scope, retention, or access controls change |
| **Regulatory change** | Re-assess if ICO, CQC, or UK GDPR guidance changes regarding employee location monitoring |
| **Data breach** | Immediate review if location data is involved in a breach |
| **Staff complaint** | Review if a staff member raises a formal objection |

---

## 9. Approval

| Role | Name | Date | Signature |
|---|---|---|---|
| Data Controller (Org Admin) | _[Organisation to complete]_ | _[Date]_ | _[Signature]_ |
| Data Protection Officer (if appointed) | _[Organisation to complete]_ | _[Date]_ | _[Signature]_ |
| Engineering Lead | _[MeticleCare]_ | 13 September 2026 | Digital |

**This document has not been through independent review.** It was written by engineers and
signed by an engineering lead. The corrections in version 1.1 were made because the
implementation was checked against the document, not because a data protection professional
reviewed it. Before this is relied on to satisfy a customer due diligence questionnaire or
an inspection, it needs a qualified reviewer. That review is readiness item T0-5.

---

## 10. Relationship to other DPIAs

This DPIA covers the Live Active-Visit Map specifically. It should be read alongside:

- The organisation's overall Employee Monitoring Policy
- The organisation's GPS and Location Data Policy (if separate)
- The MeticleCare Privacy Policy
- The MeticleCare Data Processing Agreement — **this does not exist yet.** Our Terms of Use
  reference a DPA that has not been written (readiness item T0-9). Do not rely on it.

---

*This document is a template and must be completed and signed by the data controller (the care organisation) before the Live Active-Visit Map is enabled in production. MeticleCare provides the technical implementation; the organisation is responsible for ensuring its own legal and policy obligations are met.*
