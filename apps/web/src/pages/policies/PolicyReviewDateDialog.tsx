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
import {
  HAIRLINE,
  INK,
  MUTED,
  NAVY,
  formatDate,
  reminderForReviewDate,
  todayPlusMonths,
  type Policy,
} from './policyShared'

type Preset = 6 | 12 | 24 | 'custom'

export default function PolicyReviewDateDialog({ open, policy, onClose, onSaved }: {
  open: boolean
  policy: Policy | null
  onClose: () => void
  onSaved: () => void
}) {
  const [preset, setPreset] = useState<Preset>(12)
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { showSnackbar } = useSnackbar()

  useEffect(() => {
    if (!open || !policy) return
    setError('')
    if (policy.review_due_at) {
      setPreset('custom')
      setDate(policy.review_due_at.slice(0, 10))
    } else {
      setPreset(12)
      setDate(todayPlusMonths(12))
    }
  }, [open, policy])

  const choosePreset = (value: Preset) => {
    setPreset(value)
    if (value !== 'custom') setDate(todayPlusMonths(value))
  }

  const handleSave = async () => {
    if (!policy || !date) {
      setError('Choose a review date first.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.patch(`/policies/${policy.id}`, { review_due_at: date })
      showSnackbar(
        `${policy.title} is due for review on ${formatDate(date)}.`,
        'success',
        'Review date saved',
      )
      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'We could not save that date.')
    } finally {
      setSaving(false)
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
              Set review date
            </Typography>
            <Typography sx={{ color: MUTED, mt: 0.75 }}>
              Inspections look for a review date on every policy.
            </Typography>
          </Box>
          <Button onClick={onClose} sx={{ color: INK, textTransform: 'none', fontWeight: 600, flexShrink: 0 }}>
            Close
          </Button>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2.5, mb: 2.5 }}>
          {([
            { value: 6, label: '6 months' },
            { value: 12, label: '1 year' },
            { value: 24, label: '2 years' },
            { value: 'custom', label: 'Custom date' },
          ] as { value: Preset; label: string }[]).map((choice) => {
            const isSelected = preset === choice.value
            return (
              <Button
                key={choice.label}
                variant="text"
                startIcon={isSelected ? <CheckIcon /> : undefined}
                onClick={() => choosePreset(choice.value)}
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

        <TextField
          label="Review due date"
          type="date"
          fullWidth
          value={date}
          onChange={(event) => { setDate(event.target.value); setPreset('custom') }}
          InputLabelProps={{ shrink: true }}
          helperText={date ? `We’ll remind you on ${reminderForReviewDate(date)}, a month before.` : 'Pick the date this policy should be reviewed by.'}
        />

        {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>{error}</Alert>}
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: { xs: 3, md: 4 }, py: 2.5 }}>
        <Button variant="outlined" onClick={onClose} sx={{ borderColor: HAIRLINE, color: INK, textTransform: 'none', fontWeight: 600 }}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 600 }}>
          {saving ? <CircularProgress size={20} sx={{ color: '#FFFFFF' }} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
