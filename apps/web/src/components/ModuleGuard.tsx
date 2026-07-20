import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import api from '../services/api'

export default function ModuleGuard({ module, children }: { module: string; children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    const check = async () => {
      try {
        const userStr = localStorage.getItem('user')
        if (!userStr) { setAllowed(false); return }
        const user = JSON.parse(userStr)
        const res = await api.get(`/permissions/${user.id}`)
        const perm = res.data.permissions.find((p: any) => p.module === module)
        setAllowed(perm ? perm.permission_level !== 'none' : true)
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
