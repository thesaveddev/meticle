import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Check as CheckIcon,
  FormatBold as BoldIcon,
  FormatListBulleted as ListIcon,
  InsertLink as LinkIcon,
  Title as HeadingIcon,
} from '@mui/icons-material'
import api from '../../services/api'
import { useSnackbar } from '../../context/SnackbarContext'
import { HAIRLINE, INK, MUTED, NAVY, bumpVersion, reminderForReviewDate, type Policy } from './policyShared'
import { CATEGORIES } from './policyShared'

const initialForm = {
  title: '',
  category: 'Health & Safety',
  content: '',
  version: '1.0',
  status: 'draft',
  review_due_at: '',
}

type StatusChoice = 'draft' | 'published' | 'archived'

const STATUS_CHOICES: { value: StatusChoice; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
]

export default function PolicyFormDialog({ open, editing, onClose, onSaved }: {
  open: boolean
  editing?: Policy | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(initialForm)
  const [whatChanged, setWhatChanged] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const { showSnackbar } = useSnackbar()

  useEffect(() => {
    if (!open) return
    setSaveError('')
    setAttempted(false)
    setWhatChanged('')
    setForm(editing
      ? {
          title: editing.title,
          category: editing.category,
          content: editing.content,
          version: bumpVersion(editing.version),
          status: editing.status === 'active' ? 'published' : editing.status,
          review_due_at: editing.review_due_at?.slice(0, 10) || '',
        }
      : initialForm)
  }, [open, editing])

  const missingTitle = !form.title.trim()
  const missingContent = !form.content.trim()
  const problemCount = (missingTitle ? 1 : 0) + (missingContent ? 1 : 0)
  const attentionLine = missingTitle && missingContent
    ? 'Add a title and some policy content. Everything else is still here.'
    : missingTitle
      ? 'Add a title. Everything else is still here.'
      : 'Add some policy content. Everything else is still here.'

  /** The toolbar writes the same small subset the detail page reads back. */
  const surroundSelection = (before: string, after: string, placeholder: string) => {
    const el = contentRef.current
    if (!el) return
    const { selectionStart: start, selectionEnd: end, value } = el
    const selected = value.slice(start, end) || placeholder
    const next = value.slice(0, start) + before + selected + after + value.slice(end)
    setForm((current) => ({ ...current, content: next }))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
  }

  const prefixSelectionLines = (prefix: string) => {
    const el = contentRef.current
    if (!el) return
    const { selectionStart: start, selectionEnd: end, value } = el
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const lineEnd = value.indexOf('\n', end)
    const blockEnd = lineEnd === -1 ? value.length : lineEnd
    const block = value.slice(lineStart, blockEnd)
    const prefixed = block.split('\n').map((line) => (line.startsWith(prefix) ? line : `${prefix}${line}`)).join('\n')
    const next = value.slice(0, lineStart) + prefixed + value.slice(blockEnd)
    setForm((current) => ({ ...current, content: next }))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(lineStart, lineStart + prefixed.length)
    })
  }

  const handleSave = async () => {
    setAttempted(true)
    if (missingTitle || missingContent) return
    setAttempted(false)
    setSaving(true)
    setSaveError('')
    try {
      const payload = { ...form, review_due_at: form.review_due_at || null }
      const savedTitle = form.title.trim()
      if (editing) {
        const response = await api.patch(`/policies/${editing.id}`, { ...payload, what_changed: whatChanged.trim() || undefined })
        if (response.data?.readRequestsSent > 0) {
          showSnackbar(`${savedTitle} is updated. Staff will be asked to read it again.`, 'success', `Version ${form.version} published`)
        } else {
          showSnackbar(`${savedTitle} is updated.`, 'success', 'Policy saved')
        }
      } else {
        await api.post('/policies', payload)
        if (form.status === 'draft') {
          showSnackbar(`${savedTitle} is saved as a draft. Staff can't see it until you publish.`, 'success', 'Draft saved')
        } else if (form.status === 'published') {
          showSnackbar(`${savedTitle} is now visible to staff.`, 'success', 'Policy published')
        } else {
          showSnackbar(`${savedTitle} is in Archived, with its history kept.`, 'success', 'Policy archived')
        }
      }
      onSaved()
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || 'We could not save this policy.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '28px', maxWidth: 720 } }}>
      <DialogContent sx={{ p: { xs: 3, md: 4 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
          <Box>
            <Typography sx={{ color: NAVY, fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.13em', textTransform: 'uppercase', mb: 1 }}>
              Policies
            </Typography>
            <Typography variant="h5" sx={{ color: INK, fontWeight: 600, letterSpacing: '-0.02em' }}>
              {editing ? `Edit ${editing.title}` : 'Add policy'}
            </Typography>
            <Typography sx={{ color: MUTED, mt: 0.75 }}>
              {editing
                ? `${editing.category} · saving creates version ${form.version}`
                : 'Draft it first, then publish when it’s ready for staff.'}
            </Typography>
          </Box>
          <Button onClick={onClose} sx={{ color: INK, textTransform: 'none', fontWeight: 600, flexShrink: 0 }}>
            Close
          </Button>
        </Stack>

        {attempted && problemCount > 0 && (
          <Alert severity="error" sx={{ mt: 2.5, borderRadius: 2 }}>
            <Typography sx={{ fontWeight: 700 }}>{problemCount} {problemCount === 1 ? 'thing needs' : 'things need'} your attention</Typography>
            <Typography>{attentionLine}</Typography>
          </Alert>
        )}

        <Stack spacing={2.5} sx={{ mt: 3 }}>
          <TextField
            label="Policy title"
            fullWidth
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            error={attempted && missingTitle}
            helperText={attempted && missingTitle ? 'Give the policy a title.' : undefined}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select value={form.category} label="Category" onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                {CATEGORIES.map((category) => <MenuItem key={category} value={category}>{category}</MenuItem>)}
              </Select>
            </FormControl>
            {editing ? (
              <TextField
                label="Version"
                fullWidth
                value={form.version}
                onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))}
                helperText={`Was ${editing.version}. A new version is created when you save.`}
              />
            ) : (
              <TextField
                label="Version"
                fullWidth
                value={form.version}
                onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))}
              />
            )}
          </Stack>

          <Box>
            <Typography sx={{ color: INK, fontWeight: 600, fontSize: '0.9rem', mb: 1 }}>Status</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {STATUS_CHOICES.map((choice) => {
                const selected = form.status === choice.value
                return (
                  <Button
                    key={choice.value}
                    variant="text"
                    startIcon={selected ? <CheckIcon /> : undefined}
                    onClick={() => setForm((current) => ({ ...current, status: choice.value }))}
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
          </Box>

          <TextField
            label="Review due date"
            type="date"
            fullWidth
            value={form.review_due_at}
            onChange={(event) => setForm((current) => ({ ...current, review_due_at: event.target.value }))}
            InputLabelProps={{ shrink: true }}
            helperText={form.review_due_at
              ? `We'll remind you on ${reminderForReviewDate(form.review_due_at)}, a month before.`
              : 'We’ll remind you a month before.'}
          />

          <Box>
            <Stack direction="row" spacing={0.5} sx={{ mb: 1 }}>
              <Tooltip title="Heading"><IconButton size="small" onClick={() => prefixSelectionLines('### ')} aria-label="Add heading"><HeadingIcon /></IconButton></Tooltip>
              <Tooltip title="Bold"><IconButton size="small" onClick={() => surroundSelection('**', '**', 'text')} aria-label="Bold"><BoldIcon /></IconButton></Tooltip>
              <Tooltip title="List"><IconButton size="small" onClick={() => prefixSelectionLines('- ')} aria-label="Add list"><ListIcon /></IconButton></Tooltip>
              <Tooltip title="Link"><IconButton size="small" onClick={() => surroundSelection('[', '](https://)', 'link text')} aria-label="Add link"><LinkIcon /></IconButton></Tooltip>
            </Stack>
            <TextField
              label="Policy content"
              fullWidth
              multiline
              minRows={10}
              value={form.content}
              inputRef={contentRef}
              onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
              error={attempted && missingContent}
              helperText={attempted && missingContent
                ? 'Add some policy content.'
                : 'Use headings and clear responsibilities so the policy is easy to follow during an inspection.'}
            />
          </Box>

          {editing && (
            <TextField
              label="What changed"
              fullWidth
              multiline
              minRows={3}
              value={whatChanged}
              onChange={(event) => setWhatChanged(event.target.value)}
              helperText="Shown in the version history and to staff when they're asked to read it again."
            />
          )}

          {saveError && <Alert severity="error" onClose={() => setSaveError('')}>{saveError}</Alert>}
        </Stack>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: { xs: 3, md: 4 }, py: 2.5, justifyContent: 'space-between' }}>
        <Typography sx={{ color: MUTED, fontSize: '0.85rem' }}>{saving ? 'Please keep this window open' : ''}</Typography>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" onClick={onClose} disabled={saving} sx={{ borderColor: HAIRLINE, color: INK, textTransform: 'none', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 600 }}>
            {saving ? 'Saving...' : editing && form.status === 'published' ? `Publish version ${form.version}` : 'Save policy'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}
