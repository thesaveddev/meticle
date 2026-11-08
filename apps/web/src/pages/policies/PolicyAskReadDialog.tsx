import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Check as CheckIcon } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { useSnackbar } from '../../context/SnackbarContext'
import { HAIRLINE, INK, MUTED, NAVY, type Policy } from './policyShared'

type WhoChoice = 'all' | 'unsigned' | 'selected'

interface Member {
  id: string
  email: string
  role: string
  status: string
  first_name?: string
  last_name?: string
}

function memberName(member: Member): string {
  const full = `${member.first_name || ''} ${member.last_name || ''}`.trim()
  return full || member.email
}

export default function PolicyAskReadDialog({ open, policy, signedUserIds, onClose }: {
  open: boolean
  policy: Policy | null
  signedUserIds: string[]
  onClose: () => void
}) {
  const [who, setWho] = useState<WhoChoice>('all')
  const [selected, setSelected] = useState<string[]>([])
  const [readBy, setReadBy] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const { showSnackbar } = useSnackbar()

  const currentUserId: string | null = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}').id || null
    } catch {
      return null
    }
  }, [])

  // Shared with the policy library under the same key: one request serves all.
  const { data: membersData } = useQuery({
    queryKey: ['org-members'],
    queryFn: async () => (await api.get('/staff/org-members')).data,
    staleTime: 60_000,
    enabled: open,
  })

  const audience: Member[] = useMemo(() => {
    if (!membersData) return []
    const admins: Member[] = membersData?.admins?.length ? membersData.admins : (membersData?.admin ? [membersData.admin] : [])
    return [...admins, ...(membersData?.staff || [])].filter(
      (member) => member.status === 'active' && member.id !== currentUserId,
    )
  }, [membersData, currentUserId])

  const signed = useMemo(() => new Set(signedUserIds), [signedUserIds])
  const unsignedCount = audience.filter((member) => !signed.has(member.id)).length

  useEffect(() => {
    if (!open) return
    setWho('all')
    setSelected([])
    setMessage('')
    setError('')
    setReadBy(new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10))
  }, [open])

  const personWord = (count: number) => (count === 1 ? 'person' : 'people')

  const toggleSelected = (userId: string) => {
    setSelected((current) => (current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]))
  }

  const handleSend = async () => {
    if (!policy) return
    if (who === 'selected' && selected.length === 0) {
      setError('Choose at least one person to ask.')
      return
    }
    setSending(true)
    setError('')
    try {
      const response = await api.post(`/policies/${policy.id}/read-requests`, {
        mode: who,
        user_ids: who === 'selected' ? selected : undefined,
        read_by: readBy || null,
        message: message.trim() || undefined,
      })
      const count = response.data.requested as number
      showSnackbar(
        `${count} ${personWord(count)} have been asked to read ${policy.title}.`,
        'success',
        'Read requests sent',
      )
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'We could not send those requests.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '28px', maxWidth: 640 } }}>
      <DialogContent sx={{ p: { xs: 3, md: 4 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
          <Box>
            <Typography sx={{ color: NAVY, fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.13em', textTransform: 'uppercase', mb: 1 }}>
              Policies
            </Typography>
            <Typography variant="h5" sx={{ color: INK, fontWeight: 600, letterSpacing: '-0.02em' }}>
              Ask staff to read
            </Typography>
            <Typography sx={{ color: MUTED, mt: 0.75 }}>
              They'll get a message and a task, and sign when they've read it.
            </Typography>
          </Box>
          <Button onClick={onClose} sx={{ color: INK, textTransform: 'none', fontWeight: 600, flexShrink: 0 }}>
            Close
          </Button>
        </Stack>

        <Typography sx={{ color: INK, fontWeight: 600, fontSize: '0.9rem', mt: 2.5, mb: 1 }}>Who should read it?</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {([
            { value: 'all', label: `All staff (${audience.length})` },
            { value: 'unsigned', label: `Only those who haven't signed (${unsignedCount})` },
            { value: 'selected', label: 'Choose people' },
          ] as { value: WhoChoice; label: string }[]).map((choice) => {
            const isSelected = who === choice.value
            return (
              <Button
                key={choice.value}
                variant="text"
                startIcon={isSelected ? <CheckIcon /> : undefined}
                onClick={() => setWho(choice.value)}
                aria-pressed={isSelected}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  borderRadius: 999,
                  px: 2,
                  color: isSelected ? NAVY : MUTED,
                  bgcolor: isSelected ? 'notice.info.bg' : 'transparent',
                  '&:hover': { bgcolor: isSelected ? 'notice.info.bg' : 'notice.muted.bg' },
                }}
              >
                {choice.label}
              </Button>
            )
          })}
        </Stack>

        {who === 'selected' && (
          <List dense sx={{ mt: 1, maxHeight: 220, overflow: 'auto', border: `1px solid ${HAIRLINE}`, borderRadius: 2 }}>
            {audience.map((member) => (
              <ListItem key={member.id} disablePadding>
                <ListItemButton onClick={() => toggleSelected(member.id)}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Checkbox edge="start" checked={selected.includes(member.id)} tabIndex={-1} disableRipple />
                  </ListItemIcon>
                  <ListItemText
                    primary={memberName(member)}
                    secondary={signed.has(member.id) ? 'Signed' : member.email}
                    primaryTypographyProps={{ sx: { color: INK, fontWeight: 600, fontSize: '0.88rem' } }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
            {audience.length === 0 && (
              <Typography sx={{ color: MUTED, p: 2, fontSize: '0.85rem' }}>No other active staff found.</Typography>
            )}
          </List>
        )}

        <Stack spacing={2} sx={{ mt: 2.5 }}>
          <TextField
            label="Read by"
            type="date"
            fullWidth
            value={readBy}
            onChange={(event) => setReadBy(event.target.value)}
            InputLabelProps={{ shrink: true }}
            helperText="We’ll send one gentle reminder two days before."
          />
          <TextField
            label="Message"
            fullWidth
            multiline
            minRows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Why this one matters this week. Optional."
          />
        </Stack>

        {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>{error}</Alert>}
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: { xs: 3, md: 4 }, py: 2.5 }}>
        <Button variant="outlined" onClick={onClose} sx={{ borderColor: HAIRLINE, color: INK, textTransform: 'none', fontWeight: 600 }}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSend} disabled={sending} sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 600 }}>
          {sending ? <CircularProgress size={20} sx={{ color: '#FFFFFF' }} /> : 'Send requests'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
