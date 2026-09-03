import { useState, useEffect, useCallback } from 'react'
import { UserRole } from '@meticle/shared'
import api from '../services/api'

export interface SubscriptionStatus {
  status: string
  isActive: boolean
  loading: boolean
}

const ACTIVE_STATUSES = ['active', 'trial', 'past_due']

export function useSubscriptionStatus(): SubscriptionStatus {
  const [status, setStatus] = useState<string>(() => {
    try {
      const cached = localStorage.getItem('organization')
      return cached ? JSON.parse(cached).subscription_status || '' : ''
    } catch {
      return ''
    }
  })
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
      const nextStatus = res.data.subscriptionStatus || ''
      setStatus(nextStatus)
      try {
        const cached = JSON.parse(localStorage.getItem('organization') || '{}')
        localStorage.setItem('organization', JSON.stringify({ ...cached, subscription_status: nextStatus }))
      } catch { /* cache is best effort */ }
    } catch (error: any) {
      // Keep the last known status during an infrastructure outage. Treating a
      // failed status request as inactive logs users out and hides their data.
      if (error?.response?.status !== 401 && error?.response?.status !== 403) {
        setStatus(previous => previous || 'active')
      }
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

  const isActive = ACTIVE_STATUSES.includes(status)

  return { status, isActive, loading }
}
