import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { LinearProgress } from '@mui/material'

export default function RouteLoadingIndicator() {
  const location = useLocation()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(() => setLoading(false), 150)
    return () => clearTimeout(timer)
  }, [location.pathname])

  if (!loading) return null

  return (
    <LinearProgress
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        height: 3,
      }}
    />
  )
}
