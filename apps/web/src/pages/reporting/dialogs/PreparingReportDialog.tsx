import { useEffect, useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, Divider, LinearProgress, Typography } from '@mui/material'
import FigDialogHeader from '../../people/dialogHeader'

/** Figma 10.2 screens 6–7: the export progress modal. The bar climbs toward
 *  90% while the request is in flight and the parent unmounts it on
 *  completion; Cancel aborts the request itself. */
export default function PreparingReportDialog({ open, title, subtitle, cancelLabel, onCancel }: {
  open: boolean
  title: string
  subtitle: string
  cancelLabel: string
  onCancel: () => void
}) {
  const [progress, setProgress] = useState(4)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!open) return
    setProgress(4)
    setElapsed(0)
    const started = Date.now()
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000))
      setProgress(p => Math.min(90, p + Math.max(1, (90 - p) * 0.08)))
    }, 300)
    return () => clearInterval(timer)
  }, [open ])

  return (
    <Dialog open={open} onClose={(_e, reason) => { if (reason !== 'backdropClick' && reason !== 'escapeKeyDown') onCancel() }} fullWidth maxWidth="xs">
      <FigDialogHeader eyebrow="REPORTS" title="Preparing your report" onClose={onCancel} />
      <DialogContent sx={{ pt: 1.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{title}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>{subtitle}</Typography>
        <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4 }} />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {elapsed < 3 ? 'Gathering the latest rows…' : `Still working — ${elapsed}s so far. This usually takes a few seconds…`}
        </Typography>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'flex-end' }}>
        <Button onClick={onCancel} sx={{ textTransform: 'none' }}>{cancelLabel}</Button>
      </DialogActions>
    </Dialog>
  )
}
