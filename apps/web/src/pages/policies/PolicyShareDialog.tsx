import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Check as CheckIcon } from '@mui/icons-material'
import api from '../../services/api'
import { useSnackbar } from '../../context/SnackbarContext'
import { HAIRLINE, INK, MUTED, NAVY, type Channel, type Policy } from './policyShared'

type ShareMode = 'email' | 'chat'

export default function PolicyShareDialog({ open, policy, onClose }: {
  open: boolean
  policy: Policy | null
  onClose: () => void
}) {
  const [mode, setMode] = useState<ShareMode>('email')
  const [to, setTo] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [channels, setChannels] = useState<Channel[]>([])
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [sharingChannelId, setSharingChannelId] = useState<string | null>(null)
  const { showSnackbar } = useSnackbar()

  useEffect(() => {
    if (!open) return
    setTo('')
    setMessage('')
    setError('')
    setSharingChannelId(null)
    if (mode === 'chat') {
      setLoadingChannels(true)
      api.get('/chat/channels')
        .then((response) => setChannels(response.data))
        .catch(() => setChannels([]))
        .finally(() => setLoadingChannels(false))
    }
  }, [open, mode])

  const personWord = (count: number) => (count === 1 ? 'person' : 'people')

  const handleSendEmail = async () => {
    if (!policy) return
    const emails = Array.from(new Set(to.split(',').map((address) => address.trim()).filter(Boolean)))
    if (emails.length === 0) {
      setError('Add at least one email address.')
      return
    }
    setSending(true)
    setError('')
    try {
      const response = await api.post(`/policies/${policy.id}/share`, {
        emails,
        message: message.trim() || undefined,
      })
      showSnackbar(
        `We've emailed a link to ${policy.title} to ${response.data.sent} ${personWord(response.data.sent)}.`,
        'success',
        'Policy shared',
      )
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'We could not send that email.')
    } finally {
      setSending(false)
    }
  }

  const handleShareToChannel = async (channel: Channel) => {
    if (!policy) return
    setSharingChannelId(channel.id)
    setError('')
    try {
      const shareUrl = `${window.location.origin}/policies/${policy.id}`
      const body = `${policy.title} (v${policy.version})\n\nRead the full policy: ${shareUrl}`
      await api.post(`/chat/channels/${channel.id}/messages`, { content: body })
      showSnackbar(
        `The team can open ${policy.title} from the chat.`,
        'success',
        `Posted to ${channel.name}`,
      )
      onClose()
    } catch {
      setError('The policy could not be shared. Try again.')
    } finally {
      setSharingChannelId(null)
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
              Share {policy?.title}
            </Typography>
            <Typography sx={{ color: MUTED, mt: 0.75 }}>
              {mode === 'email'
                ? 'Send a link to this policy. People need a MeticleCare login to open it.'
                : 'Post a link where the team will see it.'}
            </Typography>
          </Box>
          <Button onClick={onClose} sx={{ color: INK, textTransform: 'none', fontWeight: 600, flexShrink: 0 }}>
            Close
          </Button>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 2.5, mb: mode === 'email' ? 2.5 : 1 }}>
          {([{ value: 'email', label: 'Email' }, { value: 'chat', label: 'Org chat' }] as { value: ShareMode; label: string }[]).map((choice) => {
            const selected = mode === choice.value
            return (
              <Button
                key={choice.value}
                variant="text"
                startIcon={selected ? <CheckIcon /> : undefined}
                onClick={() => setMode(choice.value)}
                aria-pressed={selected}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  borderRadius: 999,
                  px: 2,
                  color: selected ? NAVY : MUTED,
                  bgcolor: selected ? 'notice.info.bg' : 'transparent',
                  '&:hover': { bgcolor: selected ? 'notice.info.bg' : 'notice.muted.bg' },
                }}
              >
                {choice.label}
              </Button>
            )
          })}
        </Stack>

        {mode === 'email' ? (
          <Stack spacing={2}>
            <TextField
              label="To"
              fullWidth
              multiline
              minRows={2}
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="amara@example.com, joseph@example.com"
              helperText="Separate addresses with commas — we'll send each of them a link."
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
        ) : (
          <Box>
            {loadingChannels ? (
              <Box sx={{ display: 'grid', placeItems: 'center', py: 5 }}><CircularProgress sx={{ color: NAVY }} /></Box>
            ) : channels.length === 0 ? (
              <Typography sx={{ color: MUTED, textAlign: 'center', py: 5 }}>No chat channels are available.</Typography>
            ) : (
              <Stack>
                {channels.map((channel) => (
                  <Button
                    key={channel.id}
                    variant="text"
                    onClick={() => handleShareToChannel(channel)}
                    disabled={sharingChannelId !== null}
                    sx={{ justifyContent: 'flex-start', py: 1.5, color: INK, textTransform: 'none', fontWeight: 600 }}
                  >
                    {sharingChannelId === channel.id ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
                    # {channel.name}{channel.type === 'dm' ? ' · Direct message' : ''}
                  </Button>
                ))}
              </Stack>
            )}
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>{error}</Alert>}
      </DialogContent>
      {mode === 'email' && (
        <>
          <Divider />
          <DialogActions sx={{ px: { xs: 3, md: 4 }, py: 2.5 }}>
            <Button variant="outlined" onClick={onClose} sx={{ borderColor: HAIRLINE, color: INK, textTransform: 'none', fontWeight: 600 }}>
              Cancel
            </Button>
            <Button variant="contained" onClick={handleSendEmail} disabled={sending} sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 600 }}>
              {sending ? 'Sending...' : 'Send email'}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  )
}
