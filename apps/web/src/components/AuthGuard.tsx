import { ReactNode, useEffect, useState } from 'react'
import { Box, CircularProgress } from '@mui/material'
import { Navigate, Outlet } from 'react-router-dom'
import { UserRole } from '@meticle/shared'
import api from '../services/api'

interface AuthGuardProps {
  allowedRoles?: UserRole[]
  children?: ReactNode
}

export default function AuthGuard({ allowedRoles, children }: AuthGuardProps) {
  const token = localStorage.getItem('accessToken')
  const [user, setUser] = useState<any>(() => {
    try {
      const value = localStorage.getItem('user')
      return value ? JSON.parse(value) : null
    } catch {
      return null
    }
  })
  const [checking, setChecking] = useState(Boolean(token))

  useEffect(() => {
    if (!token) {
      setChecking(false)
      return
    }

    let mounted = true
    api.get('/auth/me')
      .then(({ data }) => {
        const currentUser = data.user
        if (!mounted) return
        setUser(currentUser)
        localStorage.setItem('user', JSON.stringify(currentUser))
        // Redirect to onboarding if org hasn't completed it yet (skip if already on /onboarding)
        const currentPath = window.location.pathname
        if (data.organization && data.organization.onboarding_completed === false && currentUser.role !== 'SUPER_ADMIN' && currentPath !== '/onboarding') {
          window.location.href = '/onboarding'
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setChecking(false)
      })

    return () => { mounted = false }
  }, [token])

  if (!token) return <Navigate to="/login" replace />
  if (checking) return (
    <Box role="status" aria-live="polite" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
      <CircularProgress size={36} sx={{ color: '#0F4C81' }} />
    </Box>
  )

  if (allowedRoles && (!user || !allowedRoles.includes(user.role))) {
    return <Navigate to="/unauthorized" replace />
  }

  return children ? <>{children}</> : <Outlet />
}
