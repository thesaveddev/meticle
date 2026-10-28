import { Suspense, lazy, useEffect, useState } from 'react'
import { UserRole } from '@meticle/shared'
import AuthGuard from '../components/AuthGuard'
import ErrorBoundary from '../components/ErrorBoundary'
import ModuleGuard from '../components/ModuleGuard'

const MarketingCompliancePage = lazy(() => import('../pages/marketing/CompliancePage'))
const AppCompliancePage = lazy(() => import('../pages/compliance/CompliancePage'))

/**
 * `/compliance` is both a public marketing page (the overview plus the
 * per-regulator pages under `/compliance/:slug`) and the in-app Compliance
 * hub — and the marketing declaration used to win for everyone. Two identical
 * static paths tie in the router's ranking, the marketing one is declared
 * first, so a signed-in user clicking Compliance in the app nav landed on the
 * marketing page instead of the hub.
 *
 * The index route asks the server who is visiting — the same question
 * `AuthGuard` asks (`/auth/me`, with its offline rule: a request that never
 * reached the server is not a sign-out, so a cached user still counts as
 * signed in). Signed in renders the protected hub with its exact role and
 * module gates, untouched; signed out renders the marketing overview.
 *
 * The `/compliance/:slug` marketing pages are deliberately not decided here.
 * The app's sub-pages (`identity`, `readiness`, …) outrank a dynamic segment
 * in the router, and no app page answers a regulator slug (`cqc`,
 * `care-inspectorate`, `ciw`, `rqia`), so there is nothing to disambiguate.
 */
export function ComplianceIndexRoute() {
  const [session, setSession] = useState<'checking' | 'signed-in' | 'signed-out'>('checking')

  useEffect(() => {
    let mounted = true
    import('../services/api')
      .then(({ default: api }) =>
        api
          .get('/auth/me', { silentError: true })
          .then(({ data }: any) => {
            if (mounted) setSession(data?.user ? 'signed-in' : 'signed-out')
          })
          .catch((error: any) => {
            if (!mounted) return
            let cached: unknown = null
            try {
              cached = JSON.parse(localStorage.getItem('user') || 'null')
            } catch {
              cached = null
            }
            setSession(error?.response || !cached ? 'signed-out' : 'signed-in')
          }),
      )
      .catch(() => {
        if (mounted) setSession('signed-out')
      })
    return () => {
      mounted = false
    }
  }, [])

  if (session === 'checking') {
    return <div role="status" aria-live="polite" style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  }

  if (session === 'signed-out') {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <MarketingCompliancePage />
        </Suspense>
      </ErrorBoundary>
    )
  }

  return (
    <AuthGuard
      allowedRoles={[UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER]}
    >
      <ModuleGuard module="compliance">
        <AppCompliancePage />
      </ModuleGuard>
    </AuthGuard>
  )
}
