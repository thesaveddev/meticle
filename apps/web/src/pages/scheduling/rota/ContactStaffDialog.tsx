import { useEffect, useState } from 'react'
import {
  Box, Button, CircularProgress, Dialog, DialogContent, Stack,
  TextField, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import { Call as CallIcon } from '@mui/icons-material'
import api from '../../../services/api'
import { useSnackbar } from '../../../context/SnackbarContext'

export interface ContactStaffTarget {
  userId: string
  firstName: string
  lastName: string
  onDuty: boolean
  clockedOnAt?: string | null
}

interface ContactStaffDialogProps {
  open: boolean
  onClose: () => void
  staff: ContactStaffTarget | null
  locationName: string
  shiftStart: string
  shiftEnd: string
  shiftType?: string
}

const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'

const initialsOf = (first?: string, last?: string) =>
  `${(first || '').trim().charAt(0)}${(last || '').trim().charAt(0)}`.toUpperCase() || '?'

/**
 * Figma 8 (Staffing tab): "Contact KO" — reach a rostered worker who has not
 * clocked in. A call card when the staff record holds a phone number, and a
 * prefilled Chat direct message otherwise or as well. Sending opens (or
 * reuses) the 1:1 channel and posts into it, so the message lands where the
 * worker already reads the rota — no SMS provider is involved.
 */
export default function ContactStaffDialog({
  open, onClose, staff, locationName, shiftStart, shiftEnd, shiftType,
}: ContactStaffDialogProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { showSnackbar } = useSnackbar()
  const [phone, setPhone] = useState<string | null>(null)
  const [phoneLoaded, setPhoneLoaded] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  const firstName = staff?.firstName?.trim() || 'them'
  const night = /night|sleep/i.test(shiftType || '')
  const roleLabel = night ? 'Night support' : 'Support worker'
  const clockLabel = !staff ? '' : staff.onDuty ? 'on duty now' : staff.clockedOnAt ? 'clocked off' : 'not clocked in'

  useEffect(() => {
    if (!open || !staff) return
    setError('')
    setPhone(null)
    setPhoneLoaded(false)
    setMessage(
      `Hi ${firstName}, you're due for the ${fmtTime(shiftStart)} shift at ${locationName} ` +
      `(${fmtTime(shiftStart)}–${fmtTime(shiftEnd)}). Are you on your way? Let us know if you need anything.`
    )
    let cancelled = false
    api.get(`/staff/${staff.userId}/profile`, { silentError: true })
      .then(res => { if (!cancelled) { setPhone((res.data?.phone || '').trim() || null); setPhoneLoaded(true) } })
      .catch(() => { if (!cancelled) setPhoneLoaded(true) })
    return () => { cancelled = true }
  }, [open, staff, firstName, locationName, shiftStart, shiftEnd])

  if (!staff) return null

  const send = async () => {
    if (!message.trim()) {
      setError('Write a message first — the worker sees exactly what you send.')
      return
    }
    setSending(true)
    setError('')
    try {
      const channel = (await api.post(`/chat/channels/dm/${staff.userId}`, {}, { silentError: true })).data
      await api.post(`/chat/channels/${channel.id}/messages`, { content: message.trim() }, { silentError: true })
      onClose()
      showSnackbar(`${firstName} will get it straight away in Chat.`, 'success', 'Message sent')
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not send the message. Your text is kept — try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogContent sx={{ p: 0 }}>
        <Stack spacing={2} sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" sx={{ color: '#0164C8', fontWeight: 700, letterSpacing: '0.08em' }}>
              ROTA
            </Typography>
            <Typography role="button" tabIndex={0} onClick={onClose}
              onKeyDown={e => { if (e.key === 'Enter') onClose() }}
              sx={{ fontSize: 13, fontWeight: 600, color: '#0164C8', cursor: 'pointer' }}>
              Close
            </Typography>
          </Stack>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Contact {initialsOf(staff.firstName, staff.lastName)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {roleLabel} · {locationName} · {fmtTime(shiftStart)}–{fmtTime(shiftEnd)} · {clockLabel}
            </Typography>
          </Box>

          {phoneLoaded && phone ? (
            <Box
              component="a"
              href={`tel:${phone.replace(/\s+/g, '')}`}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, p: 1.75,
                border: '1px solid', borderColor: 'divider', borderRadius: 2,
                textDecoration: 'none', color: 'inherit',
                '&:hover': { borderColor: 'primary.light' },
              }}
            >
              <Box sx={{
                width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center',
                flexShrink: 0, bgcolor: 'notice.info.bg', color: 'notice.info.fg',
              }}>
                <CallIcon sx={{ fontSize: 20 }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>Call</Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {roleLabel} · {phone}
                </Typography>
              </Box>
            </Box>
          ) : phoneLoaded ? (
            <Typography variant="body2" color="text.secondary">
              No phone number on their record — send a message below instead.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
              <CircularProgress size={20} />
            </Box>
          )}

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.75 }}>
              Send a message
            </Typography>
            <TextField
              fullWidth multiline minRows={3}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Write to them directly…"
            />
          </Box>

          {error && (
            <Typography variant="body2" sx={{ color: 'notice.error.fg', fontWeight: 600 }}>
              {error}
            </Typography>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
            <Button variant="outlined" onClick={onClose} disabled={sending} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button variant="contained" onClick={send} disabled={sending} sx={{ textTransform: 'none', fontWeight: 600 }}>
              {sending ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'Send message'}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}
