import { useState } from 'react'
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, Divider,
  FormControlLabel, Radio, RadioGroup, Switch, TextField, Typography,
} from '@mui/material'
import FigDialogHeader from '../../people/dialogHeader'

export type ReportVisibility = 'managers' | 'team' | 'me'

export interface SaveReportValues {
  name: string
  visibility: ReportVisibility
  pin: boolean
}

const VISIBILITY_OPTIONS: { value: ReportVisibility; title: string; hint: string }[] = [
  { value: 'managers', title: 'All managers', hint: 'Anyone with reporting access can open it.' },
  { value: 'team', title: 'My team', hint: 'Managers in my department, plus me.' },
  { value: 'me', title: 'Only me', hint: 'Admins can still see it.' },
]

/** Figma 10.2 screens 3–4: name the report, choose who can view, pin it home. */
export default function SaveReportDialog({ open, initialName, saving, onClose, onSave }: {
  open: boolean
  initialName: string
  saving: boolean
  onClose: () => void
  onSave: (values: SaveReportValues) => void
}) {
  const [name, setName] = useState(initialName)
  const [visibility, setVisibility] = useState<ReportVisibility>('managers')
  const [pin, setPin] = useState(true)
  const [error, setError] = useState('')

  const submit = () => {
    if (!name.trim()) {
      setError('Give the report a name first.')
      return
    }
    onSave({ name: name.trim(), visibility, pin })
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <FigDialogHeader eyebrow="REPORTS" title="Save report" onClose={onClose} />
      <DialogContent sx={{ pt: 1.5 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>REPORT NAME</Typography>
            <TextField fullWidth size="small" sx={{ mt: 1 }} value={name} placeholder="e.g. Active staff by location"
              onChange={e => { setName(e.target.value); setError('') }} inputProps={{ maxLength: 120 }}
              error={!!error} helperText={error} />
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>WHO CAN VIEW</Typography>
            <RadioGroup value={visibility} onChange={e => setVisibility(e.target.value as ReportVisibility)} sx={{ mt: 0.5 }}>
              {VISIBILITY_OPTIONS.map(o => (
                <FormControlLabel key={o.value} value={o.value} control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>{o.title}</Typography>
                      <Typography variant="caption" color="text.secondary">{o.hint}</Typography>
                    </Box>
                  }
                  sx={{ alignItems: 'flex-start', mx: 0, my: 0.25, '& .MuiRadio-root': { pt: 0.25 } }} />
              ))}
            </RadioGroup>
          </Box>

          <FormControlLabel
            control={<Switch checked={pin} onChange={e => setPin(e.target.checked)} />}
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>Pin to Reports home</Typography>
                <Typography variant="caption" color="text.secondary">Pinned reports sit at the top of the Reports page.</Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', mx: 0, '& .MuiSwitch-root': { mt: 0.25 } }}
          />
        </Box>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving} sx={{ textTransform: 'none' }}>
          {saving ? <CircularProgress size={18} color="inherit" /> : 'Save report'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
