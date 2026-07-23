import { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { UserRole } from '@caredesk/shared'

interface AuthGuardProps {
  allowedRoles?: UserRole[]
  children?: ReactNode
}

export default function AuthGuard({ allowedRoles, children }: AuthGuardProps) {
  const token = localStorage.getItem('accessToken')
  const userStr = localStorage.getItem('user')
  let user: any = null
  try { user = userStr ? JSON.parse(userStr) : null } catch { user = null }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && user && user.role !== UserRole.SUPER_ADMIN && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return children ? <>{children}</> : <Outlet />
}
