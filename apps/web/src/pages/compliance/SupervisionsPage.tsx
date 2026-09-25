import { useState } from 'react'
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  FormControl, Grid, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography,
} from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon, RateReview } from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import AppButton from '../../components/design/AppButton'
import PageContainer from '../../components/design/PageContainer'
import api from '../../services/api'
import { formatDateOnly } from '../../utils/dateFormat'

interface Supervision {
  id: string
  staff_user_id: string
  supervisor_user_id: string
  supervised_at: string
  supervision_type: SupervisionType
  agenda?: string
  notes?: string
  actions?: string
  next_due_date?: string
  staff_name?: string
  supervisor_name?: string
}

type SupervisionType = 'individual' | 'group' | 'remote' | 'appraisal'

interface Summary {
  total: number
  done: number
  sessions: number
  rate: number
}

interface OrgMember {
  id: string
  first_name?: string
  last_name?: string
  email: string
}

const TYPE_LABELS: Record<SupervisionType, string> = {
  individual: 'Individual',
  group: 'Group',
  remote: 'Remote',
  appraisal: 'Appraisal',
}

const OVERDUE = '#DC2626'
const DUE = '#F59E0B'
const OK = '#16A34A'

const today = () => new Date().toISOString().slice(0, 10)

export default function SupervisionsPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    staff_user_id: '',
    supervisor_user_id: '',
    supervised_at: today(),
    supervision_type: 'individual' as SupervisionType,
    agenda: '',
    notes: '',
    actions: '',
    next_due_date: '',
  })
  const [saveError, setSaveError] = useState('')

  const summary = useQuery({
    queryKey: ['supervisions', 'summary'],
    queryFn: async () => (await api.get('/supervisions/summary')).data as Summary,
  })

  const records = useQuery({
    queryKey: ['supervisions'],
    queryFn: async () => (await api.get('/supervisions')).data as Supervision[],
  })

  const members = useQuery({
    queryKey: ['supervisions', 'members'],
    queryFn: async () => (await api.get('/staff/org-members')).data as OrgMember[],
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['supervisions'] })
  }

  const create = useMutation({
    mutationFn: async (values: typeof form) => (await api.post('/supervisions', {
      ...values,
      agenda: values.agenda || null,
      notes: values.notes || null,
      actions: values.actions || null,
      next_due_date: values.next_due_date || null,
    })).data,
    onSuccess: () => {
      refresh()
      setForm(current => ({ ...current, agenda: '', notes: '', actions: '', next_due_date: '', supervised_at: today() }))
      setSaveError('')
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/supervisions/${id}`) },
    onSuccess: refresh,
  })

  const handleSave = async () => {
    if (!form.staff_user_id) { setSaveError('Choose who was supervised'); return }
    if (!form.supervisor_user_id) { setSaveError('Choose who supervised them'); return }
    setSaveError('')
    try {
      await create.mutateAsync(form)
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || 'We could not save this supervision.')
    }
  }

  // A person cannot supervise themselves, so the current user is only offered
  // as a supervisor once someone else has been picked as the staff member.
  const options = (members.data || [])
    .filter(m => m.id !== form.staff_user_id)
    .map(m => ({
      value: m.id,
      label: `${(m.first_name || '').trim()} ${(m.last_name || '').trim()}`.trim() || m.email,
    }))

  const s = summary.data
  const rate = s?.rate ?? 0
  const rateColor = rate >= 90 ? OK : rate >= 70 ? DUE : OVERDUE
  const records_ = records.data || []

  return (
    <PageContainer>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Supervisions</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            A record of every supervision. CQC expects each member of staff to be supervised at least once in six months.
          </Typography>
        </Box>
        <AppButton variant="secondary" onClick={() => { summary.refetch(); records.refetch() }} loading={summary.isFetching}>
          Refresh
        </AppButton>
      </Stack>

      <Card sx={{ mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'grey.50' }}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ sm: 'center' }}>
            <Box sx={{ textAlign: 'center', minWidth: 160 }}>
              <Typography sx={{ fontSize: 40, fontWeight: 800, lineHeight: 1, color: rateColor }}>
                {summary.isLoading ? '—' : `${rate}%`}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Supervised in the last 6 months</Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
            <Grid container spacing={2} sx={{ flex: 1 }}>
              <Grid item xs={4}>
                <Typography sx={{ fontWeight: 800, fontSize: 22 }}>{s?.done ?? '—'}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Staff supervised</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography sx={{ fontWeight: 800, fontSize: 22 }}>{s?.total ?? '—'}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Active staff</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography sx={{ fontWeight: 800, fontSize: 22 }}>{s?.sessions ?? '—'}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Sessions recorded</Typography>
              </Grid>
            </Grid>
          </Stack>
          {s && s.total > s.done && (
            <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
              {s.total - s.done} member{s.total - s.done === 1 ? '' : 's'} of staff still need a recorded supervision this cycle.
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Record a supervision</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Who was supervised, by whom, and what was agreed. This is the evidence an inspector asks for.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Staff member</InputLabel>
                <Select
                  label="Staff member"
                  value={form.staff_user_id}
                  onChange={e => setForm(c => ({ ...c, staff_user_id: e.target.value, supervisor_user_id: '' }))}
                >
                  {options.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Supervised by</InputLabel>
                <Select
                  label="Supervised by"
                  value={form.supervisor_user_id}
                  onChange={e => setForm(c => ({ ...c, supervisor_user_id: e.target.value }))}
                >
                  {options.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Date of supervision" type="date" fullWidth InputLabelProps={{ shrink: true }}
                value={form.supervised_at}
                onChange={e => setForm(c => ({ ...c, supervised_at: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  label="Type"
                  value={form.supervision_type}
                  onChange={e => setForm(c => ({ ...c, supervision_type: e.target.value as SupervisionType }))}
                >
                  {(Object.keys(TYPE_LABELS) as SupervisionType[]).map(t => (
                    <MenuItem key={t} value={t}>{TYPE_LABELS[t]}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Next supervision due" type="date" fullWidth InputLabelProps={{ shrink: true }}
                value={form.next_due_date}
                onChange={e => setForm(c => ({ ...c, next_due_date: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Agenda" fullWidth multiline minRows={2}
                value={form.agenda}
                onChange={e => setForm(c => ({ ...c, agenda: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notes" fullWidth multiline minRows={4}
                helperText="Practice discussed, concerns raised, and how they were handled."
                value={form.notes}
                onChange={e => setForm(c => ({ ...c, notes: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Agreed actions" fullWidth multiline minRows={2}
                value={form.actions}
                onChange={e => setForm(c => ({ ...c, actions: e.target.value }))}
              />
            </Grid>
          </Grid>
          {saveError && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setSaveError('')}>{saveError}</Alert>}
          <AppButton variant="primary" startIcon={<AddIcon />} onClick={handleSave} loading={create.isPending} sx={{ mt: 3 }}>
            Save supervision
          </AppButton>
        </CardContent>
      </Card>

      <Card sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Supervision log</Typography>
          {records.isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={22} /></Box>}
          {!records.isLoading && records_.length === 0 && (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderStyle: 'dashed' }}>
              <RateReview sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
              <Typography sx={{ fontWeight: 700 }}>No supervisions recorded yet</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                Record the first one above and the six-month coverage starts building from today.
              </Typography>
            </Paper>
          )}
          <Stack spacing={1.5}>
            {records_.map(r => {
              const overdue = !!r.next_due_date && new Date(r.next_due_date) < new Date()
              return (
                <Paper key={r.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5, flexWrap: 'wrap', rowGap: 0.5 }}>
                        <Typography sx={{ fontWeight: 700 }}>{r.staff_name || 'Staff member'}</Typography>
                        <Chip size="small" label={TYPE_LABELS[r.supervision_type] || r.supervision_type} />
                        {overdue && <Chip size="small" color="warning" label="Next supervision overdue" />}
                      </Stack>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {formatDateOnly(r.supervised_at)}{r.supervisor_name ? ` · supervised by ${r.supervisor_name}` : ''}
                      </Typography>
                      {r.agenda && <Typography variant="body2" sx={{ mt: 1 }}><strong>Agenda:</strong> {r.agenda}</Typography>}
                      {r.notes && <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>{r.notes}</Typography>}
                      {r.actions && <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}><strong>Actions:</strong> {r.actions}</Typography>}
                      {r.next_due_date && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>Next due {formatDateOnly(r.next_due_date)}</Typography>
                      )}
                    </Box>
                    <Button size="small" color="error" startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
                      onClick={() => remove.mutate(r.id)} sx={{ textTransform: 'none', flexShrink: 0 }}>
                      Remove
                    </Button>
                  </Stack>
                </Paper>
              )
            })}
          </Stack>
        </CardContent>
      </Card>
    </PageContainer>
  )
}
