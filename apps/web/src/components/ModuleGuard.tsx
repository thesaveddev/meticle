import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import api from '../services/api'

/** Modules that are only available for specific org service types */
const MODULE_SERVICE_TYPES: Record<string, string[]> = {
  homecare: ['domiciliary', 'live_in'],
  rota_planner: ['supported_living', 'residential'],
  shift_marketplace: ['supported_living', 'residential'],
  room_checks: ['supported_living', 'residential'],
  emedication: ['residential'],
  bed_management: ['residential'],
  mileage_travel: ['domiciliary', 'live_in'],
  call_scheduling: ['domiciliary', 'live_in'],
  payroll_export: ['domiciliary', 'live_in'],
}

export default function ModuleGuard({ module, children }: { module: string; children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    const check = async () => {
      try {
        const userStr = localStorage.getItem('user')
        if (!userStr) { setAllowed(false); return }
        const user = JSON.parse(userStr)

        // Check role-based permissions
        const permRes = await api.get(`/permissions/${user.id}`)
        const perm = permRes.data.permissions.find((p: any) => p.module === module)
        if (perm && perm.permission_level === 'none') {
          setAllowed(false)
          return
        }

        // Check org service type availability
        const requiredTypes = MODULE_SERVICE_TYPES[module]
        if (requiredTypes) {
          const orgRes = await api.get('/settings/org')
          const serviceTypes: string[] = orgRes.data.service_types || []
          const hasRequiredType = serviceTypes.some(t => requiredTypes.includes(t))
          setAllowed(hasRequiredType)
          return
        }

        setAllowed(true)
      } catch {
        setAllowed(true)
      }
    }
    check()
  }, [module])

  if (allowed === null) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  }

  if (!allowed) {
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}
