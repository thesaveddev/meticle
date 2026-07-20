import { useEffect, useState, ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { UserRole } from '@caredesk/shared'
import { CircularProgress, Box } from '@mui/material'
import api from '../services/api'

interface AuthGuardProps {
  allowedRoles?: UserRole[]
  children?: ReactNode
}

export default function AuthGuard({ allowedRoles, children }: AuthGuardProps) {
  const token = localStorage.getItem('accessToken')
  const userStr = localStorage.getItem('user')
  let user: any = null
  try { user = userStr ? JSON.parse(userStr) : null } catch { user = null }
  const [trialCheckDone, setTrialCheckDone] = useState(false)
  const [trialExpired, setTrialExpired] = useState(false)

  useEffect(() => {
    const checkTrial = async () => {
      if (!token || !user?.organization_id) {
        setTrialCheckDone(true)
        return
      }
      try {
        const res = await api.get(`/organizations/${user.organization_id}/subscription`)
        const sub = res.data
        if (sub.subscriptionStatus === 'trial' && sub.daysRemaining === 0) {
          setTrialExpired(true)
        }
      } catch {
      } finally {
        setTrialCheckDone(true)
      }
    }
    checkTrial()
  }, [token, user?.organization_id])

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (!trialCheckDone) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (trialExpired) {
    return <Navigate to="/billing" replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return children ? <>{children}</> : <Outlet />
}
