import { useState } from 'react'
import { Box, Typography, Paper, Button, Stack, Grid, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Card, CardContent, TablePagination, CircularProgress, Tabs, Tab, IconButton, Alert, FormControl, InputLabel, Select, MenuItem, OutlinedInput, Checkbox, ListItemText } from '@mui/material'
import { Add as AddIcon, ArrowBack as ArrowBackIcon, Group as GroupIcon, Edit as EditIcon, Delete as DeleteIcon, Send as SendIcon, RemoveCircleOutline as RemoveIcon } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

export default function StaffEngagementPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage] = useState(10)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [templateEdit, setTemplateEdit] = useState<any>(null)
  const [sendOpen, setSendOpen] = useState(false)
  const [sendRoles, setSendRoles] = useState<string[]>([])
  const [templateSearch, setTemplateSearch] = useState('')
  const [templateForm, setTemplateForm] = useState({ name: '', questions: [{ key: 'q1', label: '' }] as { key: string; label: string }[] })
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [responseFilter, setResponseFilter] = useState('')

  const { data: surveys, isLoading } = useQuery({
    queryKey: ['engagement-surveys', responseFilter],
    queryFn: async () => {
      const params = responseFilter ? `?template_id=${responseFilter}` : ''
      const res = await api.get(`/surveys/engagement${params}`)
      return res.data as any[]
    }
  })

  const { data: aggregate } = useQuery({
    queryKey: ['engagement-aggregate'],
    queryFn: async () => {
      const res = await api.get('/surveys/engagement/aggregate')
      return res.data as any
    }
  })

  const { data: templates } = useQuery({
    queryKey: ['engagement-templates', templateSearch],
    queryFn: async () => {
      const q = templateSearch ? `?search=${encodeURIComponent(templateSearch)}` : ''
      const res = await api.get(`/surveys/engagement/templates${q}`)
      return res.data as any[]
    }
  })

  const templateSaveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (data.id) return api.put(`/surveys/engagement/templates/${data.id}`, data)
      return api.post('/surveys/engagement/templates', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engagement-templates'] })
      setTemplateOpen(false)
      setTemplateEdit(null)
      setTemplateForm({ name: '', questions: [{ key: 'q1', label: '' }] })
      setFeedback({ type: 'success', message: 'Template saved' })
    },
  })

  const templateDeleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/surveys/engagement/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engagement-templates'] })
      setFeedback({ type: 'success', message: 'Template deleted' })
    },
  })

  const sendMutation = useMutation({
    mutationFn: async (payload: { templateId: string; roles?: string[] }) =>
      api.post('/surveys/engagement/send', { template_id: payload.templateId, roles: payload.roles?.length ? payload.roles : undefined }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['engagement-templates'] })
      setSendOpen(false)
      setFeedback({ type: 'success', message: `Survey sent to ${res.data?.sent_count || 'all'} staff members` })
    },
  })

  const handleTemplateSave = () => {
    const questions = templateForm.questions.filter(q => q.label.trim())
    templateSaveMutation.mutate({ id: templateEdit?.id, name: templateForm.name, questions })
  }

  const openTemplateEdit = (t: any) => {
    setTemplateEdit(t)
    const qs = (t.questions || []).length > 0 ? t.questions : [{ key: 'q1', label: '' }]
    setTemplateForm({ name: t.name || '', questions: qs })
    setTemplateOpen(true)
  }

  const avgAll = aggregate?.average_scores
    ? Object.values(aggregate.average_scores).reduce((a: number, b: unknown) => a + (b as number), 0) / Math.max(Object.keys(aggregate.average_scores).length, 1)
    : 0

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><CircularProgress /></Box>

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/compliance')} sx={{ mb: 2, color: '#0F4C81', fontWeight: 600 }}>
        Back to Compliance Dashboard
      </Button>
      {feedback && <Alert severity={feedback.type} onClose={() => setFeedback(null)} sx={{ mb: 2 }}>{feedback.message}</Alert>}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">Staff Engagement Surveys</Typography>
        <Stack direction="row" spacing={1}>
          {templates && templates.length > 0 && (
            <Button variant="outlined" startIcon={<SendIcon />} onClick={() => setSendOpen(true)}>Send Survey to All Staff</Button>
          )}
          
        </Stack>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Dashboard" />
        <Tab label="Templates" />
        <Tab label="All Responses" />
      </Tabs>

      {tab === 0 && (
        <>
          {aggregate && aggregate.total > 0 && (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <Card sx={{ bgcolor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <CardContent sx={{ textAlign: 'center', py: 3 }}>
                    <GroupIcon sx={{ fontSize: 32, color: '#16A34A', mb: 1 }} />
                    <Typography variant="h4" fontWeight={800}>{aggregate.total}</Typography>
                    <Typography variant="body2" color="text.secondary">Responses</Typography>
                    <Typography variant="caption" color="text.secondary">{aggregate.anonymous_count} anon · {aggregate.named_count} named</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card sx={{ bgcolor: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                  <CardContent sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="h4" fontWeight={800} color="#0284C7">{avgAll > 0 ? avgAll.toFixed(1) : '—'}</Typography>
                    <Typography variant="body2" color="text.secondary">Avg Score / 5</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card sx={{ bgcolor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <CardContent sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="h4" fontWeight={800} color="#0F4C81">
                      {aggregate.total > 0 ? Math.round((avgAll / 5) * 100) : '—'}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">Engagement Score</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {aggregate?.average_scores && Object.keys(aggregate.average_scores).length > 0 && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Avg Scores by Question</Typography>
              <Grid container spacing={2}>
                {Object.entries(aggregate.average_scores).map(([key, val]: [string, any]) => {
                  return (
                    <Grid item xs={12} sm={6} md={4} key={key}>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>{key}</Typography>
                        <Typography variant="h5" fontWeight={700} color={val >= 4 ? '#16A34A' : val >= 3 ? '#F59E0B' : '#DC2626'}>
                          {val.toFixed(1)}
                        </Typography>
                      </Paper>
                    </Grid>
                  )
                })}
              </Grid>
            </Paper>
          )}

          {(!aggregate || aggregate.total === 0) && (
            <Paper sx={{ p: 4, mb: 3, textAlign: 'center', bgcolor: '#F8FAFC' }}>
              <Typography color="text.secondary">No responses yet. Staff can take the anonymous survey or admins can send a survey to everyone.</Typography>
            </Paper>
          )}
        </>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">Survey Templates</Typography>
            <Stack direction="row" spacing={1}>
              <TextField size="small" placeholder="Search templates..." value={templateSearch} onChange={e => setTemplateSearch(e.target.value)} sx={{ width: 200 }} />
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => { setTemplateEdit(null); setTemplateForm({ name: '', questions: [{ key: 'q1', label: '' }] }); setTemplateOpen(true) }}>New Template</Button>
            </Stack>
          </Stack>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Questions</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Active</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(templates || []).map((t: any) => (
                  <TableRow key={t.id} hover>
                    <TableCell><Typography fontWeight={600}>{t.name}</Typography></TableCell>
                    <TableCell>{Array.isArray(t.questions) ? t.questions.length : 0}</TableCell>
                    <TableCell><Chip label={t.is_active ? 'Active' : 'Inactive'} size="small" color={t.is_active ? 'success' : 'default'} /></TableCell>
                    <TableCell>{new Date(t.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => openTemplateEdit(t)} aria-label={`Edit ${t.name} template`}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => { if (confirm('Delete this template?')) templateDeleteMutation.mutate(t.id) }} aria-label={`Delete ${t.name} template`}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {(!templates || templates.length === 0) && (
                  <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 2 }}>No templates created. Create one to send surveys to staff.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {tab === 2 && (
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">All Responses</Typography>
            <TextField select size="small" label="Filter by Template" value={responseFilter} onChange={e => { setResponseFilter(e.target.value); setPage(0) }}
              sx={{ minWidth: 220 }}>
              <MenuItem value="">All Templates</MenuItem>
              {(templates || []).map((t: any) => (
                <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
              ))}
            </TextField>
          </Stack>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Template</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Respondent</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Anonymous</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Avg Rating</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Comments</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(surveys || []).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((s: any) => {
                  const ratings = s.ratings || {}
                  const vals = Object.values(ratings) as number[]
                  const avg = vals.length > 0 ? (vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(1) : '—'
                  return (
                    <TableRow key={s.id} hover>
                      <TableCell><Chip label={s.template_name || '—'} size="small" variant="outlined" /></TableCell>
                      <TableCell>{s.is_anonymous ? '—' : s.respondent_email || '—'}</TableCell>
                      <TableCell><Chip label={s.is_anonymous ? 'Yes' : 'No'} size="small" color={s.is_anonymous ? 'default' : 'primary'} variant="outlined" /></TableCell>
                      <TableCell><Typography fontWeight={600}>{avg}</Typography></TableCell>
                      <TableCell sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.comments || '—'}</TableCell>
                      <TableCell>{new Date(s.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  )
                })}
                {(!surveys || surveys.length === 0) && (
                  <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 2 }}>No responses yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {surveys && surveys.length > rowsPerPage && (
            <TablePagination component="div" count={surveys.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} rowsPerPageOptions={[10]} />
          )}
        </Paper>
      )}

      {/* Template Dialog */}
      <Dialog open={templateOpen} onClose={() => setTemplateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{templateEdit ? 'Edit Template' : 'New Template'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField label="Template Name" value={templateForm.name} onChange={e => setTemplateForm(p => ({ ...p, name: e.target.value }))} fullWidth size="small" required />
            <Typography variant="subtitle2" sx={{ mt: 1 }}>Questions</Typography>
            {templateForm.questions.map((q, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" sx={{ minWidth: 28, fontWeight: 600 }}>{i + 1}.</Typography>
                <TextField
                  fullWidth size="small" placeholder="Enter question text..."
                  value={q.label}
                  onChange={e => {
                    const copy = [...templateForm.questions]
                    copy[i] = { ...copy[i], label: e.target.value }
                    setTemplateForm(p => ({ ...p, questions: copy }))
                  }}
                />
                {templateForm.questions.length > 1 && (
                  <IconButton size="small" color="error" onClick={() => setTemplateForm(p => ({ ...p, questions: p.questions.filter((_, j) => j !== i) }))} aria-label={`Remove question ${i + 1}`}>
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>
            ))}
            <Button
              variant="outlined" size="small"
              startIcon={<AddIcon />}
              onClick={() => setTemplateForm(p => ({ ...p, questions: [...p.questions, { key: `q${p.questions.length + 1}`, label: '' }] }))}
              sx={{ alignSelf: 'flex-start' }}
            >
              Add Question
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleTemplateSave} disabled={!templateForm.name || templateSaveMutation.isPending}>
            {templateSaveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Send Survey Dialog */}
      <Dialog open={sendOpen} onClose={() => setSendOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Survey to Staff</DialogTitle>
        <DialogContent>
          {sendMutation.error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => sendMutation.reset()}>
              {(sendMutation.error as any)?.response?.data?.error?.message || (sendMutation.error as any)?.message || 'Failed to send survey'}
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select a template to send. Each staff member will receive an email + in-app notification with a link to complete the survey.
          </Typography>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Filter by Role (optional)</InputLabel>
            <Select
              multiple value={sendRoles} label="Filter by Role (optional)"
              onChange={e => setSendRoles(e.target.value as string[])}
              input={<OutlinedInput label="Filter by Role (optional)" />}
              renderValue={(selected) => selected.length === 0 ? 'All roles' : selected.join(', ')}
            >
              {['CARE_WORKER', 'MANAGER', 'ORG_ADMIN'].map(r => (
                <MenuItem key={r} value={r}>
                  <Checkbox checked={sendRoles.includes(r)} />
                  <ListItemText primary={r.replace('_', ' ')} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Stack spacing={2}>
            {(templates || []).filter(t => t.is_active).map((t: any) => (
              <Paper key={t.id} variant="outlined" sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography fontWeight={600}>{t.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{Array.isArray(t.questions) ? t.questions.length : 0} questions</Typography>
                </Box>
                <Button variant="contained" size="small" onClick={() => sendMutation.mutate({ templateId: t.id, roles: sendRoles })} disabled={sendMutation.isPending}>
                  {sendMutation.isPending ? 'Sending...' : 'Send'}
                </Button>
              </Paper>
            ))}
            {(!templates || templates.filter(t => t.is_active).length === 0) && (
              <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>No active templates. Create one first.</Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSendOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
