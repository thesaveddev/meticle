import { useState } from 'react'
import {
  Avatar, Box, Button, Dialog, DialogActions, DialogContent, Divider,
  Radio, Typography,
} from '@mui/material'
import { Description as DocIcon } from '@mui/icons-material'
import FigDialogHeader from '../../people/dialogHeader'

export interface SelectableReport {
  id: string
  name: string
  description: string
  updatedAt?: string
}

/** Figma 10.2 screen 5: pick one saved report to open in the builder. */
export default function SelectReportsDialog({ open, reports, onClose, onSelect }: {
  open: boolean
  reports: SelectableReport[]
  onClose: () => void
  onSelect: (id: string) => void
}) {
  const [selected, setSelected] = useState<string>(reports[0]?.id || '')

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <FigDialogHeader eyebrow="REPORTS" title="Select reports" onClose={onClose} />
      <DialogContent sx={{ pt: 1.5 }}>
        {reports.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No saved reports yet — build one and press Save report.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {reports.map(r => {
              const active = selected === r.id
              return (
                <Box key={r.id} onClick={() => setSelected(r.id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, p: 1, mx: -1, borderRadius: 2,
                    cursor: 'pointer', bgcolor: active ? 'action.hover' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}>
                  <Radio size="small" checked={active} onChange={() => setSelected(r.id)} />
                  <Avatar sx={{ width: 36, height: 36, bgcolor: 'notice.info.bg', color: 'notice.info.fg' }}>
                    <DocIcon fontSize="small" />
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.description || (r.updatedAt ? `Modified ${new Date(r.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Saved report')}
                    </Typography>
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button variant="contained" disabled={!selected} onClick={() => onSelect(selected)} sx={{ textTransform: 'none' }}>
          Select report
        </Button>
      </DialogActions>
    </Dialog>
  )
}
