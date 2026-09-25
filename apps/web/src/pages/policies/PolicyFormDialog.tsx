import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material'
import api from '../../services/api'
import { CATEGORIES, NAVY, type Policy } from './policyShared'

const initialForm = {
  title: '',
  category: 'Health & Safety',
  content: '',
  version: '1.0',
  status: 'draft',
  review_due_at: '',
}

export default function PolicyFormDialog({ open, editing, onClose, onSaved }: {
  open: boolean
  editing?: Policy | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!open) return
    setSaveError('')
    setForm(editing
      ? {
          title: editing.title,
          category: editing.category,
          content: editing.content,
          version: editing.version,
          status: editing.status === 'active' ? 'published' : editing.status,
          review_due_at: editing.review_due_at?.slice(0, 10) || '',
        }
      : initialForm)
  }, [open, editing])

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const payload = { ...form, review_due_at: form.review_due_at || null }
      if (editing) {
        await api.patch(`/policies/${editing.id}`, payload)
      } else {
        await api.post('/policies', payload)
      }
      onSaved()
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || 'We could not save this policy.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 900 }}>{editing ? 'Edit policy' : 'Add policy'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Policy title" fullWidth value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl fullWidth><InputLabel>Category</InputLabel><Select value={form.category} label="Category" onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>{CATEGORIES.map((category) => <MenuItem key={category} value={category}>{category}</MenuItem>)}</Select></FormControl>
            <TextField label="Version" fullWidth value={form.version} onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))} />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl fullWidth><InputLabel>Status</InputLabel><Select value={form.status} label="Status" onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><MenuItem value="draft">Draft</MenuItem><MenuItem value="published">Published</MenuItem><MenuItem value="archived">Archived</MenuItem></Select></FormControl>
            <TextField label="Review due" type="date" fullWidth value={form.review_due_at} onChange={(event) => setForm((current) => ({ ...current, review_due_at: event.target.value }))} InputLabelProps={{ shrink: true }} />
          </Stack>
          <TextField label="Policy content" helperText="Use headings and clear responsibilities so the policy is easy to follow during an inspection." fullWidth multiline minRows={12} value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} />
          {saveError && <Alert severity="error" onClose={() => setSaveError('')}>{saveError}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.title.trim() || !form.content.trim()} sx={{ bgcolor: NAVY }}>{saving ? <CircularProgress size={20} /> : 'Save policy'}</Button>
      </DialogActions>
    </Dialog>
  )
}
