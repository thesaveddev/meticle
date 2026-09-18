# MeticleCare AI product roadmap

Updated: 2026-09-18

## Existing AI integrations

- AI-assisted daily-note generation and approval
- Existing-note analysis, safeguarding, mood and care-plan analysis
- Compliance gap analysis
- Incident severity triage
- Rota analysis and rota generation
- Meal-plan and shopping-list generation
- Competency question generation
- AI configuration, provider fallback, budgets and AI audit logs

## Implemented intelligence surface

The authenticated web route `/intelligence` provides a single workspace for:

- Person Care Summary (`care_summary`)
- Manager Briefing (`manager_briefing`)
- Change Detection (`change_detection`)
- Risk Signals (`risk_signals`)
- Compliance Copilot (`compliance_copilot`)
- Natural-language Data Assistant (`natural_language_assistant`)
- End-of-day Intelligence (`end_of_day_intelligence`)
- Domiciliary Operations Copilot (`domiciliary_operations_copilot`)
- Rules-first Operational Anomaly Detection (`operational_anomaly_detection`)
- Explainable Rota Alternatives (`rota_alternatives`)
- Competency Coaching (`competency_coaching`)
- Manager-reviewed Family Communication Drafts (`family_communication_draft`)

The API routes are under `/ai/*` and require both role access and an explicit organisation AI feature toggle. The data layer applies organisation filtering before records are sent to the provider. Person summaries require a person ID and verify it through tenant-scoped queries.

All generated results are:

- Labelled as AI-assisted.
- Date-range bounded.
- Returned with source type and source ID references.
- Audited with user, capability, period, source IDs, provider, model, token usage and duration.
- Validated against a structured response schema.
- Presented as signals or suggested follow-up, never clinical decisions or compliance determinations.

Deterministic risk/change/compliance items are generated from source records before the model response and merged with validated AI items. This means the AI does not create the underlying event or exception.

## Manager Briefing

Route: `/manager-briefing`

API: `POST /ai/manager-briefing`

The original manager briefing remains available as a focused experience and is restricted to `ORG_ADMIN` and `MANAGER` roles.

## Governance boundaries

- RBAC and tenant filtering happen before model input.
- Minimum necessary fields are selected.
- Human review is required before action, saving, publishing, notifying or sharing.
- Source references are required for generated items.
- No unsupported diagnosis, medication instruction, safeguarding conclusion or regulatory judgement is produced.
- AI-generated state is visibly labelled.
- AI configuration, feature toggles, budgets and audit records are organisation-scoped.
- If AI is disabled, unconfigured, not enabled for the capability or over budget, the API fails safely without exposing records to a provider.

## Still requiring product hardening

- Replace source-ID display with route-aware `View source` links for every record type.
- Add a dedicated person selector rather than requiring a pasted person ID.
- Deterministic compliance currently covers training, risk assessments, competency assessments and incident actions; add reviews and identity documents next.
- Add a query-intent layer for the natural-language assistant; currently the assistant sends a bounded record set and question to the configured model, rather than executing arbitrary SQL.
- Add mobile intelligence surfaces after the web workflow is accepted.
- Add retention/deletion controls and formal AI governance review before public marketing claims.
- Keep rota alternatives advisory and family drafts manager-reviewed; neither endpoint publishes or sends changes.
