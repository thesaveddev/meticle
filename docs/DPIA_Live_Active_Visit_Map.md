# Data Protection Impact Assessment (DPIA)
## Live Active-Visit Map — MeticleCare

**Document version:** 1.0  
**Date:** 13 September 2026  
**Author:** MeticleCare Engineering  
**Review date:** 13 March 2027  

---

## 1. Overview

### 1.1 Feature description

The Live Active-Visit Map is a manager-facing dashboard feature that displays the real-time (or near-real-time) location of on-duty domiciliary care workers during their assigned visits. It shows:

- **Active visits:** Visits currently in progress, with the carer's last known GPS coordinates
- **Scheduled visits:** Upcoming visits for the day, with the client's registered address

The map is only visible to users with ORG_ADMIN or MANAGER roles. Carers do **not** have access to this feature. The map does **not** track carers outside of their assigned, checked-in visits.

### 1.2 Purpose and necessity

The purpose of the Live Active-Visit Map is to:

1. Enable managers to oversee the safety and whereabouts of lone workers during domiciliary care visits
2. Support emergency escalation when a carer reports a disruption or safety concern
3. Provide operational visibility for scheduling and reassignment decisions
4. Support CQC regulatory requirements for supervising the delivery of care

**Necessity:** GPS coordinates are collected only during an active (checked-in) visit. This is the minimum data needed to fulfil the stated purposes. No continuous or off-duty tracking occurs.

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
| Carer GPS coordinates (latitude, longitude) | Mobile device during check-in/check-out | Retained with the visit record per org care-records retention policy (recommended 8 years) | Lone-worker safety, audit trail |
| GPS accuracy (meters) | Mobile device | Retained with visit | Data quality indicator |
| Carer name and staff ID | Staff profile | Retained with visit | Identification on map |
| Visit status | System | Retained with visit | Operational visibility |
| Client name and address | Person profile | Retained with visit | Map display and navigation |

### 2.2 Data NOT processed

- Continuous location tracking outside of assigned, checked-in visits
- Location data from personal or off-duty time
- Speed, route, or trajectory data
- Any biometric data

---

## 3. Proportionality assessment

| Question | Assessment |
|---|---|
| Is the processing necessary for the stated purpose? | **Yes.** GPS coordinates are the minimum data needed to show a carer's location on a map. Without location data, the feature cannot fulfil its safety purpose. |
| Can the purpose be achieved with less data? | **No.** The feature requires coordinates to display on a map. Name and visit status are needed to identify which carer is at which location. |
| Is the scope of processing limited to what is necessary? | **Yes.** Coordinates are captured only during checked-in visits. No tracking occurs outside this window. |
| Is the data retention proportionate? | **Yes.** GPS coordinates are retained as part of the immutable visit audit record, consistent with care-records retention policy. No separate short-life GPS stream exists. |
| Is the processing limited to authorised personnel? | **Yes.** Only ORG_ADMIN and MANAGER roles can access the map. Carers cannot see other carers' locations. |

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

After mitigations: **LOW**

---

## 5. Staff transparency and consent

### 5.1 Communication to carers

Before the Live Active-Visit Map is enabled for an organisation, the following must be in place:

1. **Employment contract clause:** Staff contracts must include a clause about GPS location collection during assigned visits for lone-worker safety purposes
2. **Staff handbook entry:** A clear, plain-English explanation of what data is collected, when, why, and who can see it
3. **Notice board / intranet notice:** A summary notice in staff areas explaining the GPS monitoring policy
4. **Right to be informed:** Staff are informed during onboarding and whenever the policy changes

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
| **Right to restrict processing** | Organisation can disable the live map feature per-location if a staff member raises a valid objection. |
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
| **Rate limiting** | Standard API rate limiting applies (200/min general). |
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

---

## 10. Relationship to other DPIAs

This DPIA covers the Live Active-Visit Map specifically. It should be read alongside:

- The organisation's overall Employee Monitoring Policy
- The organisation's GPS and Location Data Policy (if separate)
- The MeticleCare Privacy Policy
- The MeticleCare Data Processing Agreement

---

*This document is a template and must be completed and signed by the data controller (the care organisation) before the Live Active-Visit Map is enabled in production. MeticleCare provides the technical implementation; the organisation is responsible for ensuring its own legal and policy obligations are met.*
