import { ReactNode, useEffect, useState } from 'react'
import { Box, CircularProgress } from '@mui/material'
import { Navigate, Outlet } from 'react-router-dom'
import { UserRole } from '@meticle/shared'
import api from '../services/api'

interface AuthGuardProps {
  allowedRoles?: UserRole[]
  children?: ReactNode
}

function cachedUser(): any {
  try {
    const value = localStorage.getItem('user')
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

/**
 * Gate a route on a live session.
 *
 * There is nothing in the browser to check synchronously any more, and that is
 * the point: the session is an httpOnly cookie, so `localStorage` holds no
 * credential and the old `if (!token) redirect` would send every signed-in user
 * to the login page. `/auth/me` is the question instead, and the answer is the
 * server's — which also supplies the role this guard gates on, so a stale
 * cached role cannot open a page the account no longer has.
 *
 * Offline is the one case that is not a sign-out. A request that never reached
 * the server has no response, and there a cached user still renders the page,
 * exactly as the product behaved when the token lived in localStorage and an
 * offline reload did not sign anybody out. A 401 — the server answering — is a
 * sign-out, and it is the interceptor that clears the leftover browser state.
 */
export default function AuthGuard({ allowedRoles, children }: AuthGuardProps) {
  const [user, setUser] = useState<any>(() => cachedUser())
  const [status, setStatus] = useState<'checking' | 'signed-in' | 'signed-out'>('checking')

  useEffect(() => {
    let mounted = true
    api.get('/auth/me', { silentError: true })
      .then(({ data }) => {
        const currentUser = data.user
        if (!mounted || !currentUser) return
        setUser(currentUser)
        localStorage.setItem('user', JSON.stringify(currentUser))
        // Redirect to onboarding if org hasn't completed it yet (skip if already on /onboarding)
        const currentPath = window.location.pathname
        if (data.organization && data.organization.onboarding_completed === false && currentUser.role !== 'SUPER_ADMIN' && currentPath !== '/onboarding') {
          window.location.href = '/onboarding'
          return
        }
        setStatus('signed-in')
      })
      .catch((error: any) => {
        if (!mounted) return
        const reachedServer = Boolean(error?.response)
        setStatus(reachedServer || !cachedUser() ? 'signed-out' : 'signed-in')
      })

    return () => { mounted = false }
  }, [])

  if (status === 'signed-out') return <Navigate to="/login" replace />
  if (status === 'checking') return (
    <Box role="status" aria-live="polite" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
      <CircularProgress size={36} sx={{ color: '#0164C8' }} />
    </Box>
  )

  if (allowedRoles && (!user || !allowedRoles.includes(user.role))) {
    return <Navigate to="/unauthorized" replace />
  }

  return children ? <>{children}</> : <Outlet />
}
