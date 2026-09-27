# Data Protection Impact Assessment (DPIA)
## Live Active-Visit Map — MeticleCare

**Document version:** 1.1  
**Date:** 27 September 2026  
**Author:** MeticleCare Engineering  
**Review date:** 13 March 2027

### Revision history

| Version | Date | Change |
|---|---|---|
| 1.0 | 13 Sep 2026 | Initial draft. |
| 1.1 | 27 Sep 2026 | **Corrected against the implementation.** Version 1.0 described a capability we do not have. Every correction is listed below rather than quietly edited, because a data protection assessment that has been amended to match the product is only useful if the reader can see what changed. |

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
sampling, and no tracking between or outside visits. The mobile app requests
*foreground* location permission only, and the one coordinate it captures is taken at the
moment of check-in. A carer with the app closed is not tracked, and a carer who has not
checked in has no position on the map at all.

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
| Carer GPS coordinates (latitude, longitude) | Mobile device, **at check-in and check-out only** | Held on the visit record. **No period is specified by MeticleCare.** See §2.2 | Evidence of arrival; dispatch |
| GPS accuracy (meters) | Mobile device | With the visit record | Data quality indicator |
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

### 5.2 What carers should know

- GPS is collected **only** when they check in to an assigned visit
- GPS is **not** collected during travel between visits, during breaks, or off-duty
- Only managers (not other carers) can see their location on the map
- Location data is retained as part of the care record, not as a separate surveillance log
- They can request a copy of their location data under Subject Access Request rights

---

## 6. Data subject rights

| Right | Implementation |
|---|---|
| **Right to be informed** | Documented in employment contracts, staff handbook, and onboarding materials |
| **Right of access** | Subject Access Requests include GPS coordinates from visit records. Response within 30 days per UK GDPR. |
| **Right to rectification** | GPS coordinates are immutable (captured at check-in/out). Correction is not technically possible; a note can be appended to the visit record. |
| **Right to erasure** | GPS coordinates are part of the care record retained under legal obligation (care-records retention policy). Erasure requests are assessed on a case-by-case basis per the organisation's SAR policy. |
| **Right to restrict processing** | **NOT IMPLEMENTED — corrected in 1.1.** Version 1.0 claimed the organisation "can disable the live map feature per-location". **No such control exists**, and there is no feature-flag mechanism in the product. An organisation that wants to switch this off currently has no in-product way to do so. Until a kill switch is built, a customer who does not want staff location data at all must be told plainly that this capability is not switched off per organisation, and must rely on the contract and access controls instead. **Building the switch is tracked as item T0-6 in `docs/GO_LIVE_READINESS.md`.** |
| **Right to object** | Staff can raise an objection to their employer. The organisation must demonstrate compelling legitimate grounds that override the objection, or cease processing for that individual. |

---

## 7. Technical safeguards

| Safeguard | Implementation |
|---|---|
| **Access control** | RBAC: only ORG_ADMIN, MANAGER roles. Module-level permission: `homecare`. |
| **Organisation scoping** | All queries scoped to user's organisation_id. RLS policies on all homecare tables. |
| **Encryption in transit** | TLS 1.2+ on all API communication |
| **Encryption at rest** | PostgreSQL with standard encryption. GPS coordinates stored as DECIMAL(9,6). |
| **Audit logging** | All API access to live-map endpoint is logged in audit_logs with user_id, timestamp, and IP. |
| **Rate limiting** | General API limiting applies. The map endpoint itself is behind authentication and role checks; the specific figure is not material to the risk here. |
| **Encryption at rest** | Sensitive PII columns are encrypted at application level with AES-256-GCM under a per-tenant derived key (`apps/api/src/shared/utils/encryption.ts`), on top of the host's disk encryption. **Caveat:** if `FIELD_ENCRYPTION_KEY` is unset the encryption degrades to plaintext with only a log warning. Whether it is set in the customer's own deployment is something the organisation must verify — see readiness item T0-15. |
| **Data minimisation** | Only coordinates, accuracy, and visit metadata returned. No route history, speed, or trajectory. |
| **No real-time streaming** | Map data is fetched on demand (pull), not pushed in real-time. Carers are not continuously tracked. |

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
