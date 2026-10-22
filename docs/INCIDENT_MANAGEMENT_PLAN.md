# Incident Management — Foundation-First Implementation Plan

Source: user spec §1–26 (26 Oct 2026). Strategy per §26: three reusable engines first, then incident capabilities on top. No phase proceeds past failed acceptance criteria.

## 1. Where MeticleCare stands today

Existing (reuse, do not rewrite):
- Tables: `incident_categories`, `incidents`, `incident_involved_residents`, `incident_actions`, `incident_attachments` (`schema.sql`, `setup.ts`). RLS tenant isolation present (migrations 002/003). Idempotent create via `(organization_id, reported_by, client_submission_id)`.
- API: CRUD + categories + involved + actions + attachments + timeline (`incidents.*.ts`). Reporter field sanitisation, visibility scoping for CARE_WORKER, audit logs, `incident.created` domain event, AI triage consumer (`incident-triage.consumer.ts`), overdue-action event publisher.
- Web: `IncidentDirectoryPage`, `IncidentDetailPage` (AI triage, actions, evidence, timeline). Mobile: `ReportIncidentScreen` + offline queue.

Gaps vs spec (nothing here is a surprise — it is the work):
- No dynamic form engine (hardcoded fields, no conditional visibility, no versioning).
- No deterministic severity engine (severity is a free input + AI suggestion, no explainable rules version).
- No workflow engine (status is a 4-value column; no workstreams, SLAs, ack tracking, idempotent retries, reopen flow).
- No investigation, corrective-action verification, effectiveness review, external-reporting, duplicate detection, or config publication flows.

## 2. Architecture

```
web / mobile
  │  REST (Zod-validated, server-enforced)
  ▼
incidents API (thin: authz → engine calls → audit)
  ├── Form Engine   (definitions + evaluation + versioning)
  ├── Severity Engine (deterministic rules + explanations + overrides)
  └── Workflow Engine (state machine + tasks + SLAs + escalation + idempotency)
  │  publishes: incident.created / severity.assessed / workflow.task_due /
  │    workflow.escalated / investigation.* / action.* / reporting.* / incident.reopened
  ▼
Postgres (RLS) + outbox → consumers (notifications, AI triage, escalation sweeps)
```

Rules:
- Engines are independent modules with their own tables, versions, and tests. Incident code calls them; it does not embed their logic.
- All critical validation, permissions, and severity decisions run server-side. Frontend mirrors for UX only.
- Submitted answers, severity decisions, and workflow events are immutable history (append-only; amendments create new rows).
- Stable IDs for fields, categories, rules, workflow steps. Labels may change; IDs never do.

Component dependencies: `incidents` → `incident-forms`, `incident-severity`, `incident-workflow` → `events/outbox`, `notifications`, `audit`. New modules: `apps/api/src/modules/incident-forms`, `incident-severity`, `incident-workflow`. Frontend: one `DynamicForm` renderer reused by web + future mobile.

## 3. Data model + migration plan

New tables (all `organization_id`-scoped, RLS tenant policies mirroring `incidents`):
- `incident_form_definitions (id, org_id, key, name, status draft/published, version, effective_from, created_by, created_at)` + `incident_form_versions (immutable snapshot: fields, rules_ref, workflow_ref)` — published versions never updated.
- `incident_field_definitions (id, form_version_id, field_key stable, label, help, type, section, ordering, required, validation JSONB, options JSONB, defaults, visibility/requiredness/read-only conditions JSONB, repeating config, sensitivity, analytics mapping, severity/workflow deps)`.
- `incident_answers (incident_id, field_key, value JSONB, form_version_id, superseded_by, created_by, created_at)` — append-only; hidden-answer policy per field (`clear|preserve_inactive|retain_excluded`).
- `incident_severity_rules (id, org_id, version, dimensions JSONB, weights, escalation_conditions JSONB, status, effective_from, approved_by)` + `incident_severity_assessments (id, incident_id, rules_version, inputs hash, dimensions, score, provisional_level, explanation JSONB{rules_fired[]}, decided_by, decided_at, override_reason, supersedes_id)`.
- `incident_workflows (id, incident_id, definition_version, state, workstreams JSONB, created_at)` + `incident_workflow_tasks (id, workflow_id, kind, owner_role/user, due_at, ack_at, status, attempts, idempotency_key UNIQUE, fallback_to)` + `incident_workflow_events (append-only transitions)` + `incident_escalations (task_id, from_to, reason, at)`.
- Extend: `incidents` add `form_version_id`, `current_severity_assessment_id`, lifecycle state (draft/submitted/triage/…/closed/reopened as spec §4 — migrate existing 4 values), `reopened_of`; `incident_actions` add verifier/effectiveness fields; new `incident_investigations`, `incident_reporting_assessments`, `incident_links (parent/duplicate)`.

Migration plan: one numbered migration per engine (`16x_*.sql` after current head 159), each with RLS policies + rollback notes; seed the §3 category library as a published v1 form + v1 severity rules (weights 40/25/20/10/5 as starting point, flagged non-clinical pending governance sign-off).

## 4. API contracts (engine boundaries)

```
Form:      GET /incident-forms/:key (published) · POST /incident-forms (draft)
           POST /incident-forms/:id/publish · POST /incident-forms/evaluate (answers → visible/required/invalid)
Severity:  POST /incident-severity/assess { incident_id|answers, rules_version? } → { level, dimensions, explanation[], provisional, missing[] }
           POST /incident-severity/override { assessment_id, level, reason } (perm-gated)
Workflow:  POST /incident-workflow/start { incident_id } (idempotent)
           POST /incident-workflow/tasks/:id/ack|complete|extend · GET /incidents/:id/workflow
Incidents: existing routes unchanged; create/update attach form_version_id + trigger assess→workflow; new
           POST /incidents/:id/submit|reopen, GET /incidents/:id/assessments, /workflow, /duplicates
```

All mutating engine calls are idempotent (client `idempotency_key` / `client_submission_id`), emit domain events via outbox, and write audit rows before responding (existing `rls.middleware` pattern).

## 5. Rules evaluation order (normative)

Severity (§8.4): 1 validate → 2 emergency indicators → 3 safeguarding fast-path → 4 actual harm → 5 potential harm → 6 urgency + continuing risk → 7 category escalations → 8 weighted score (only if sufficient data) → 9 recurrence modifiers → 10 provisional level → 11 explanation + tasks → 12 human review/override. Invariants: weighted score never downgrades a mandatory escalation; `unknown` ≠ `no harm` (provisional + owner + deadline); every reassessment appends, never overwrites.

Form (§5): parent change → re-evaluate conditions (equals/not-one-of/contains/empty/comparisons/dates + AND/OR/NOT on values, never labels) → update options → revalidate → recalc → re-evaluate workflow → warn on material severity change; hidden answers per field policy; submitted history immutable.

## 6. Threat model

- Tenant isolation: RLS on every new table + `migrationRegistration`-style coverage test; no frontend-only scoping. Cross-tenant access test per entity.
- Safeguarding: restricted fields/attachments behind `incidents.safeguarding` permission; alleged persons get no implicit access; access logging; exports exclude restricted material unless authorised (export audit row).
- Integrity: append-only answers/assessments/events; audit trail non-editable; emergency access recorded with reason + review.
- Abuse: Zod + server re-validation, file scan/size limits, rate limits on submit/publish, idempotency prevents duplicate incidents/tasks on retry.
- AI: advisory only — never lowers severity, closes, diagnoses, or submits reports; outputs labelled draft with model/version, sources, and approver.

## 7. Test scenarios (acceptance gates, §23)

Form: category switch branches; parent change updates deps; hidden-answer policies; contradictory combos rejected; unknown≠No; save/resume; old versions reproduce.
Severity: mandatory escalation survives low score; uncertainty path; explanation present; new finding appends; override needs perm + reason; reassessment fires tasks.
Workflow: one ref + one workflow on submit; critical routes correctly; unacked → fallback; failures visible/recoverable; retries duplicate-free; overdue reminders fire.
Investigation/closure: evidence traceable; approvals unbypassable; blockers explained; exceptions recorded; reopen preserves history; open actions survive closure.
Security: cross-tenant denial; safeguarding restriction; audit on every amendment; permission-respecting exports; integration failures never silent.
Analytics: dashboards reconcile; history stable across config change; repeat-event definitions documented; exposure denominators used.

## 8. Phased plan with exit criteria

- P0 Foundations (§26.1–26.3): form engine → severity engine → workflow engine, each with migrations + contracts + regression suites. Exit: the three criteria in §26.1–26.3 demonstrated.
- P1 Capture → P2 Triage/severity → P3 Investigation → P4 Corrective actions + effectiveness → P5 Reporting/closure/reopen → P6 Module links (people, MAR snapshot-ref, staff, risk/care-plan review tasks) → P7 Analytics + AI-assist (governed) → P8 Admin sandbox/publish + cross-service reporting. Each phase: acceptance criteria + automated tests + dependency doc.
- Engineering rules (§26.5) apply throughout: no duplicated conditionals, no hardcoded thresholds in UI, versioned definitions, server enforcement, synthetic test data.

## 9. Deployment, monitoring, backup

- Migrations run in order with checksums (existing runner); feature-flag engines per org until P2 passes pilot validation.
- Monitoring: outbox lag + failed-job visibility, escalation-SLA breach alert, `GET /health/jobs`-style staleness for sweeps (overdue actions, unacked criticals), `/metrics` counters per engine.
- Backup/recovery: point-in-time Postgres restore tested; legal-hold overrides retention deletes; rollback = publish previous approved config version (data never rewritten).
- Pilot: 1–2 providers validate against real policies before controlled rollout (§24 items 1–12 checklist).
