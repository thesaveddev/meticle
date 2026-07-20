import { useState, useEffect } from 'react'
import { Alert } from '@mui/material'
import WifiOffIcon from '@mui/icons-material/WifiOff'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline = () => setOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <Alert severity="warning" icon={<WifiOffIcon />} sx={{ borderRadius: 0, position: 'sticky', top: 0, zIndex: 9999 }}>
      You are offline. Some features may be unavailable.
    </Alert>
  )
}
