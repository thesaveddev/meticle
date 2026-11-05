import { useEffect } from 'react'
import { Box, Snackbar, Typography } from '@mui/material'
import { CheckCircle as CheckIcon } from '@mui/icons-material'

export interface AppointmentToastData {
  title: string
  sub: string
}

interface Props {
  toast: AppointmentToastData | null
  onClose: () => void
}

// The Figma 7.6 toast: white pill, bottom-centre, green check, bold title +
// grey sub-line, blue Dismiss. Auto-dismisses after 4 s; Dismiss closes it now.
export default function AppointmentToast({ toast, onClose }: Props) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [toast, onClose])

  return (
    <Snackbar open={!!toast} onClose={onClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        bgcolor: 'background.paper', borderRadius: 999,
        border: '1px solid #E3E9F0', boxShadow: '0 8px 28px rgba(15,40,80,0.18)',
        pl: 1.25, pr: 2, py: 1, maxWidth: 'calc(100vw - 48px)',
      }}>
        <CheckIcon sx={{ color: '#087A55', fontSize: 26 }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={700} noWrap>{toast?.title}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{toast?.sub}</Typography>
        </Box>
        <Typography
          role="button" tabIndex={0}
          onClick={onClose}
          onKeyDown={e => { if (e.key === 'Enter') onClose() }}
          sx={{ fontSize: 13, fontWeight: 600, color: '#0164C8', cursor: 'pointer', ml: 1, flexShrink: 0 }}>
          Dismiss
        </Typography>
      </Box>
    </Snackbar>
  )
}
