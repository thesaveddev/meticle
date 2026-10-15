/**
 * Every page's access, read out of the router — GENERATED, do not edit.
 *
 * Written by `scripts/design/route-access.mjs` from `apps/web/src/App.tsx` and
 * verified by `design:check`, which CI runs: editing the router without
 * regenerating this file is a red build. Run `npm run design:sync`.
 *
 * The router is the only place a page's gate is written, and this is what makes
 * that true for the server as well. Mica offers to open pages from a spoken
 * answer (`apps/api/src/modules/ai/mica.facts.ts`), so it has to know whether the
 * carer who asked can open the page — and before this table it had its own
 * hand-written copy of that answer, which no change to a route would have
 * updated. A carer was asked "want me to open the training matrix?" and sent to
 * /unauthorized by the role the route already excluded.
 *
 * `roles` is the route's own `allowedRoles`, or null when it names none — which
 * means every authenticated role, not "no restriction". `authenticated` is false
 * for the public marketing and auth routes, which no offer may ever target.
 * `module` is the route's `ModuleGuard` module where it names one literally, so
 * the second half of a page's gate is recorded next to the first — and both halves
 * are read. Mica resolves the caller's own modules (`mica.moduleAccess.ts`, which
 * asks the two questions `GET /permissions/:userId` answers), and withholds the
 * offer where the organisation's service model does not provide that module or the
 * caller's level for it is 'none': a page the guard would refuse is not a door to
 * ask a carer to open.
 *
 * A path the router declares twice (`/compliance` is both a marketing page and an
 * application page) carries the restrictions of every declaration, because for an
 * offer the safe reading is the restrictive one.
 *
 * 128 routes, 83 of them authenticated.
 */

// The enum itself, not its names as strings: this file is generated from text,
// and typing the rows as `UserRole` is what makes a role the router spells in a
// way this cannot read a compile error rather than an entry nothing matches.
import { UserRole } from './roles'

export interface PageAccess {
  /** True when the route sits inside the router's authenticated area. */
  authenticated: boolean
  /** The route's own `allowedRoles`, or null when it names none. */
  roles: readonly UserRole[] | null
  /** The route's `ModuleGuard` module, or null when it has none. */
  module: string | null
}

export const PAGE_ACCESS: Readonly<Record<string, PageAccess>> = {
  '/': { authenticated: false, roles: null, module: null },
  '/*': { authenticated: true, roles: null, module: null },
  '/about': { authenticated: false, roles: null, module: null },
  '/agencies': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER], module: 'agencies' },
  '/app': { authenticated: false, roles: null, module: null },
  '/appointments': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER], module: 'appointments' },
  '/availability': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER], module: 'homecare' },
  '/billing': { authenticated: true, roles: [UserRole.ORG_ADMIN], module: 'billing' },
  '/blog': { authenticated: false, roles: null, module: null },
  '/blog/:slug': { authenticated: false, roles: null, module: null },
  '/call-assignment': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER], module: 'call_scheduling' },
  '/call-scheduling': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER], module: 'call_scheduling' },
  '/call-scheduling/day': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER], module: 'call_scheduling' },
  '/carer-totals': { authenticated: true, roles: null, module: null },
  '/case-studies': { authenticated: false, roles: null, module: null },
  '/chat': { authenticated: true, roles: null, module: 'chat' },
  '/client-billing': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER], module: 'client_billing' },
  '/compliance': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER], module: 'compliance' },
  '/compliance-badges': { authenticated: false, roles: null, module: null },
  '/compliance/:slug': { authenticated: false, roles: null, module: null },
  '/compliance/competency': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER], module: 'compliance' },
  '/compliance/dspt': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER], module: 'compliance' },
  '/compliance/engagement': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER], module: 'compliance' },
  '/compliance/evidence': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER], module: 'compliance' },
  '/compliance/homecare': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER], module: 'compliance' },
  '/compliance/identity': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER], module: 'compliance' },
  '/compliance/readiness': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER], module: 'compliance' },
  '/compliance/records': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER], module: 'compliance' },
  '/compliance/satisfaction': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER], module: 'compliance' },
  '/compliance/supervisions': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER], module: 'compliance' },
  '/compliance/training': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER], module: 'compliance' },
  '/contact': { authenticated: false, roles: null, module: null },
  '/cookie-policy': { authenticated: false, roles: null, module: null },
  '/cookies': { authenticated: false, roles: null, module: null },
  '/dashboard': { authenticated: true, roles: null, module: 'dashboard' },
  '/delete-account': { authenticated: false, roles: null, module: null },
  '/download': { authenticated: false, roles: null, module: null },
  '/earnings': { authenticated: true, roles: null, module: null },
  '/emedication': { authenticated: true, roles: null, module: 'emedication' },
  '/emedication/archived': { authenticated: true, roles: null, module: 'emedication' },
  '/expenses': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER], module: 'expenses' },
  '/family-portal/:token': { authenticated: false, roles: null, module: null },
  '/family-portal/feedback/:token': { authenticated: false, roles: null, module: null },
  '/features': { authenticated: false, roles: null, module: null },
  '/features/:slug': { authenticated: false, roles: null, module: null },
  '/forgot-password': { authenticated: false, roles: null, module: null },
  '/homecare': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER], module: 'homecare' },
  '/how-it-works': { authenticated: false, roles: null, module: null },
  '/incidents': { authenticated: true, roles: null, module: 'incidents' },
  '/incidents/:id': { authenticated: true, roles: null, module: 'incidents' },
  '/insights': { authenticated: true, roles: null, module: 'reporting' },
  '/intelligence': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER], module: 'reporting' },
  '/invoice/:token': { authenticated: false, roles: null, module: null },
  '/learn': { authenticated: false, roles: null, module: null },
  '/leave': { authenticated: true, roles: null, module: 'leave' },
  '/live-map': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER], module: 'homecare' },
  '/locations': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER], module: 'settings' },
  '/locations/:locationId': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER], module: 'settings' },
  '/login': { authenticated: false, roles: null, module: null },
  '/manager-briefing': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER], module: 'reporting' },
  '/marketplace': { authenticated: true, roles: null, module: 'marketplace' },
  '/meal-plans': { authenticated: true, roles: null, module: 'nutrition' },
  '/medications': { authenticated: true, roles: null, module: 'emedication' },
  '/mfa-challenge': { authenticated: false, roles: null, module: null },
  '/mfa-setup': { authenticated: false, roles: null, module: null },
  '/mileage': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER], module: 'mileage_travel' },
  '/mission-control': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER], module: null },
  '/mission-control/alerts': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER], module: null },
  '/mission-control/calls': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER], module: null },
  '/mission-control/care': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER], module: null },
  '/mission-control/compliance': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER], module: null },
  '/mission-control/incidents': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER], module: null },
  '/mission-control/staffing': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER], module: null },
  '/mission-control/today': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER], module: null },
  '/mobile': { authenticated: false, roles: null, module: null },
  '/mobile/check-in': { authenticated: true, roles: null, module: null },
  '/mobile/voice-notes': { authenticated: true, roles: null, module: null },
  '/my-profile': { authenticated: true, roles: null, module: null },
  '/my-week': { authenticated: true, roles: null, module: null },
  '/notifications': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER], module: null },
  '/nutrition': { authenticated: true, roles: null, module: 'nutrition' },
  '/onboarding': { authenticated: true, roles: null, module: null },
  '/organizations': { authenticated: true, roles: [UserRole.ORG_ADMIN], module: null },
  '/payroll-export': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER], module: null },
  '/payroll-timesheets': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER], module: null },
  '/people': { authenticated: true, roles: null, module: 'people' },
  '/people/:id': { authenticated: true, roles: null, module: 'people' },
  '/platform': { authenticated: false, roles: null, module: null },
  '/platform-admin': { authenticated: true, roles: [UserRole.SUPER_ADMIN], module: null },
  '/platform-admin/email-queue': { authenticated: true, roles: [UserRole.SUPER_ADMIN], module: null },
  '/platform-admin/organizations/:id': { authenticated: true, roles: [UserRole.SUPER_ADMIN], module: null },
  '/policies': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER], module: 'policies' },
  '/policies/:id': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER], module: 'policies' },
  '/portal/dashboard': { authenticated: false, roles: null, module: null },
  '/portal/login': { authenticated: false, roles: null, module: null },
  '/pricing': { authenticated: false, roles: null, module: null },
  '/privacy': { authenticated: false, roles: null, module: null },
  '/privacy-policy': { authenticated: false, roles: null, module: null },
  '/register': { authenticated: false, roles: null, module: null },
  '/reporting': { authenticated: true, roles: null, module: 'reporting' },
  '/reports': { authenticated: true, roles: null, module: 'reporting' },
  '/reports/:reportId': { authenticated: true, roles: null, module: 'reporting' },
  '/reset-expired': { authenticated: false, roles: null, module: null },
  '/reset-invalid': { authenticated: false, roles: null, module: null },
  '/reset-password': { authenticated: false, roles: null, module: null },
  '/reset-success': { authenticated: false, roles: null, module: null },
  '/room-checks': { authenticated: true, roles: null, module: 'room_checks' },
  '/schedule': { authenticated: true, roles: null, module: 'scheduling' },
  '/scheduling': { authenticated: true, roles: null, module: 'scheduling' },
  '/scheduling/overtime-claims': { authenticated: true, roles: null, module: 'scheduling' },
  '/security': { authenticated: false, roles: null, module: null },
  '/settings': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER], module: 'settings' },
  '/shift-marketplace': { authenticated: true, roles: null, module: 'marketplace' },
  '/signup': { authenticated: false, roles: null, module: null },
  '/solutions/:slug': { authenticated: false, roles: null, module: null },
  '/staff': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER], module: 'staff_directory' },
  '/staff/:userId': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER], module: 'staff_directory' },
  '/survey/engagement/:token': { authenticated: false, roles: null, module: null },
  '/survey/satisfaction/:token': { authenticated: false, roles: null, module: null },
  '/swap-transfer': { authenticated: true, roles: null, module: null },
  '/tasks': { authenticated: true, roles: null, module: 'tasks' },
  '/terms': { authenticated: false, roles: null, module: null },
  '/terms-of-service': { authenticated: false, roles: null, module: null },
  '/terms-of-use': { authenticated: false, roles: null, module: null },
  '/training': { authenticated: true, roles: [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER], module: 'training' },
  '/unauthorized': { authenticated: true, roles: null, module: null },
  '/verify-email': { authenticated: false, roles: null, module: null },
  '/weekly-planner': { authenticated: true, roles: null, module: null },
}
