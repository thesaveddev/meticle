# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Registered managers** (ORG_ADMIN / MANAGER): run care operations end to end — rota, medication (eMAR), compliance evidence, leave, incidents, training. Work in the office and on the go.
- **Care workers** (CARE_WORKER): claim shifts, log care notes, take medication records, check in on the mobile/PWA surfaces, and communicate with the team.
- **Relatives & families**: read care notes, care plans, goals, and observations through the Family Portal.
- **Owners & operations leads**: oversight via reporting, insights, billing, and CQC readiness.

## Product Purpose

MeticleCare is a connected care-management platform for UK supported living providers. It runs the whole care working day — rota, medication, notes, compliance, leave, incidents, training — from one platform, with multi-tenant isolation. Success means a care team can run their entire operations day credibly from one connected system: every shift staffed safely, every medication given and recorded, every note captured at the point of care, every compliance claim backed by real records.

## Positioning

One honest, connected platform for UK care operations, grounded in the records the team already keeps. It refuses the metric-stacked, icon-card SaaS default: every claim is supported by real data (live compliance snapshots, real rota, real evidence packs, CQC readiness scored from actual records), and every role sees the surface shaped for the part of the day they own.

## Operating Context

- UK supported-living providers, CQC-regulated, working across 3+ locations with shifts, departments, and teams.
- Shift-based staffing: rota planner with min safe staffing per location, 11-hour rest enforcement, overtime, conflict blocking.
- Care is recorded at the point of care — daily notes, observations, MAR administrations, room checks, incident reports — often on phones/tablets (PWA with GPS check-in and voice-to-text).
- Compliance is continuous: evidence packs (KLOE), identity monitoring, training matrix, competency assessments, DSPT, policies.
- Real-time teamwork: chat with presence, read receipts, typing indicators; notifications for OT, delegations, and assignments.
- Multi-tenant: orgs are isolated (tenant helpers today, RLS policies enforced on all tables via dual-pool + AsyncLocalStorage).
- Finances flow through Stripe subscriptions, agencies billing, and payroll/timesheet work-in-progress.

## Capabilities and Constraints

- Backend: Express modular monolith, 37 modules, raw SQL (no ORM), Zod validation, Redis cache (in-memory fallback), Socket.IO realtime with JWT auth + DB validation + rate limiting, Prometheus metrics, Swagger auto-docs, AES-256-GCM per-org encryption.
- Frontend: React 18 + TypeScript + MUI 5, TanStack React Query, React Router 6, ~50 pages, PWA offline.
- Auth: JWT access + refresh, MFA (TOTP), RBAC + per-request permission checks; role changes reflect instantly via `/auth/me`.
- Role rules: ORG_ADMIN promotes other ORG_ADMINs; MANAGERs cannot change own role; manager cannot self-approve leave; manager/admin leave routes to a different ORG_ADMIN with fallback to any other.
- Chat: channels (general/group/dm), messages, files, link previews, reactions, read receipts, presence, member management.
- Email: branded HTML templates, DB-backed queue with retry.
- Constraints: no eye icons for "view" affordances (OpenInNew/Download instead); cards/rows open read-only detail dialogs on click; error messages inside modals; tables paginated; buttons have loading spinners; guard `npx tsc --noEmit` in both apps/web and apps/api.

## Brand Commitments

- Name: MeticleCare.
- Two-key color system: deep navy `#0F4C81` identity + single emerald `#10B981` accent; everything else warm neutral (bone `#F7F4EE` grounds, white, charcoal ink `#1B2430`, hairline `#E7E1D6`). No third hue (no purple, cyan, orange accents).
- Inter across 400–900 only; hierarchy by weight, tracking, case — no second typeface.
- Editorial 1px hairlines; flat surfaces; deep-ink seated shadows reserved for floating objects; emerald only as small marks / focus ring.
- Voice: serious care software for people who read paper.

## Evidence on Hand

- Seed script (`apps/api/src/scripts/seed-orbis.ts`): full demo org with 22 staff, 18 service users, shifts, eMAR, leave, incidents, training, compliance records.
- `DESIGN.md`: marketing-site design contract (editorial-operations world, palette, typography, layout).
- Real backend data models across all 37 modules (no fabricated metrics; KPIs computed from live data).
- CI: GitHub Actions lint + typecheck + test + build.

## Product Principles

1. Records are the product: every compliance claim, insight, and readiness score must be backed by real data the team already keeps.
2. One working day, one platform: the rota, medication, notes, and compliance must feel like one connected system, not a portal of apps.
3. Safe operations over convenience: min safe staffing, rest windows, conflict blocking, and delegation rules are enforced, not suggested.
4. Isolation by default: org boundaries hold at the data layer, and roles gate every action.
5. The point of care is primary: phones and tablets in the field are first-class surfaces, not afterthoughts.

## Accessibility & Inclusion

- Keyboard-reachable everywhere; focus-visible ring on interactive elements.
- Contrast pairs target AA/AAA on the two-key palette (ink on bone ~13:1, mist on white/bone AA).
- `prefers-reduced-motion` honored (skip entrances, disable pulses).
- Inter at 400–900; readable secondary copy at relaxed line heights.
