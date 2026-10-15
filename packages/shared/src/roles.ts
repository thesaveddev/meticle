/**
 * The roles the application has, in the shared package because three surfaces
 * need the same list: the API's route guards, the web app's `AuthGuard`, and the
 * generated page-access table both are read from.
 *
 * It lives in its own module rather than in `index.ts` for one reason: the
 * generated table (`pageAccess.generated.ts`) types its roles as this enum, so it
 * cannot name a role the application does not have — and `index.ts` re-exports
 * that table, which would be an import cycle if the enum were in `index.ts`
 * itself. Nothing else changes: every importer still writes
 * `import { UserRole } from '@meticle/shared'`.
 */
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ORG_ADMIN = 'ORG_ADMIN',
  MANAGER = 'MANAGER',
  CARE_WORKER = 'CARE_WORKER',
  COMPLIANCE_OFFICER = 'COMPLIANCE_OFFICER'
}
