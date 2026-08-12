import { useState, useEffect, useCallback } from 'react'
import { UserRole } from '@meticle/shared'
import api from '../services/api'

export interface SubscriptionStatus {
  status: string
  isActive: boolean
  loading: boolean
}

const ACTIVE_STATUSES = ['active', 'trial']

export function useSubscriptionStatus(): SubscriptionStatus {
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const check = useCallback(async () => {
    const raw = localStorage.getItem('user')
    let user: any = null
    try { user = raw ? JSON.parse(raw) : null } catch { user = null }
    if (!user) { setLoading(false); return }
    // Platform admins bypass subscription checks
    if (user.role === UserRole.SUPER_ADMIN) { setLoading(false); setStatus('active'); return }
    if (!user.organization_id) { setLoading(false); return }
    try {
      const res = await api.get('/billing/subscription')
      setStatus(res.data.subscriptionStatus)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    check()
    const interval = setInterval(check, 30000)
    window.addEventListener('focus', check)
    const onSubUpdate = () => check()
    window.addEventListener('subscriptionUpdated', onSubUpdate)
    return () => { clearInterval(interval); window.removeEventListener('focus', check); window.removeEventListener('subscriptionUpdated', onSubUpdate) }
  }, [check])

  const isActive = ACTIVE_STATUSES.includes(status) && (status !== 'trial' || true)

  return { status, isActive, loading }
}
