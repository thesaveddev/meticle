import { useState } from 'react'
import { Box, Typography, Paper, Button, Stack, Grid, TextField, MenuItem, Rating, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Card, CardContent, TablePagination, CircularProgress, Alert, FormControl, InputLabel, Select } from '@mui/material'
import { Add as AddIcon, ArrowBack as ArrowBackIcon, Favorite as HeartIcon, Send as SendIcon } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

const RELATIONSHIPS = ['Family Member', 'Friend', 'Carer', 'Advocate', 'Professional', 'Other']

export default function SatisfactionSurveysPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [rowsPerPage] = useState(10)
  const [open, setOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [form, setForm] = useState({ person_id: '', respondent_name: '', relationship: '', rating: 5, comments: '' })
  const [inviteForm, setInviteForm] = useState({ email: '', recipient_type: 'email', staff_id: '', person_id: '', person_name: '' })
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [viewSurvey, setViewSurvey] = useState<any>(null)
  const [managerNote, setManagerNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const queryParams = new URLSearchParams()
  if (search) queryParams.set('search', search)
  if (startDate) queryParams.set('startDate', startDate)
  if (endDate) queryParams.set('endDate', endDate)

  const { data: surveys, isLoading } = useQuery({
    queryKey: ['satisfaction-surveys', search, startDate, endDate],
    queryFn: async () => {
      const q = queryParams.toString()
      const res = await api.get(`/surveys/satisfaction${q ? '?' + q : ''}`)
      return res.data as any[]
    }
  })

  const { data: aggregate } = useQuery({
    queryKey: ['satisfaction-aggregate'],
    queryFn: async () => {
      const res = await api.get('/surveys/satisfaction/aggregate')
      return res.data as any
    }
  })

  const { data: people } = useQuery({
    queryKey: ['people-survey'],
    queryFn: async () => {
      const res = await api.get('/people?status=active')
      return res.data as any[]
    }
  })

  const { data: staffList } = useQuery({
    queryKey: ['staff-list-survey-invite'],
    queryFn: async () => {
      const res = await api.get('/staff/org-members')
      return res.data as any
    }
  })
  const allStaff: any[] = [
    ...(staffList?.admins?.length ? staffList.admins : (staffList?.admin ? [staffList.admin] : [])),
    ...(staffList?.staff || [])
  ].filter((m: any) => m.status === 'active')

  const submitMutation = useMutation({
    mutationFn: async (data: any) => api.post('/surveys/satisfaction', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['satisfaction-surveys'] })
      queryClient.invalidateQueries({ queryKey: ['satisfaction-aggregate'] })
      setOpen(false)
      setForm({ person_id: '', respondent_name: '', relationship: '', rating: 5, comments: '' })
      setFeedback({ type: 'success', message: 'Feedback recorded successfully' })
    },
    onError: () => setFeedback({ type: 'error', message: 'Failed to record feedback' }),
  })

  const inviteMutation = useMutation({
    mutationFn: async (data: any) => api.post('/surveys/satisfaction/invite', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['satisfaction-surveys'] })
      setInviteOpen(false)
      setInviteForm({ email: '', recipient_type: 'email', staff_id: '', person_id: '', person_name: '' })
      setFeedback({ type: 'success', message: 'Survey invitation sent!' })
    },
    onError: () => setFeedback({ type: 'error', message: 'Failed to send invitation' }),
  })

  const handleSubmit = () => submitMutation.mutate({
      person_id: form.person_id || undefined,
    respondent_name: form.respondent_name || undefined,
    relationship: form.relationship || undefined,
    rating: form.rating,
    comments: form.comments || undefined,
  })

  const handleInvite = () => {
    const email = inviteForm.recipient_type === 'staff'
      ? allStaff.find((s: any) => (s.staff_id || s.id) === inviteForm.staff_id)?.email || ''
      : inviteForm.email
    inviteMutation.mutate({
      email,
      person_id: inviteForm.person_id || undefined,
      person_name: inviteForm.person_name || undefined,
    })
  }

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><CircularProgress /></Box>

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/compliance')} sx={{ mb: 2, color: '#0F4C81', fontWeight: 600 }}>
        Back to Compliance Dashboard
      </Button>
      {feedback && <Alert severity={feedback.type} onClose={() => setFeedback(null)} sx={{ mb: 2 }}>{feedback.message}</Alert>}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">Satisfaction Feedback</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<SendIcon />} onClick={() => setInviteOpen(true)}>Email Feedback Request</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Record Feedback</Button>
        </Stack>
      </Stack>

      {aggregate && aggregate.total > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={3}>
            <Card sx={{ bgcolor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <HeartIcon sx={{ fontSize: 32, color: '#16A34A', mb: 1 }} />
                <Typography variant="h4" fontWeight={800}>{aggregate.average_rating?.toFixed(1) || '—'}</Typography>
                <Typography variant="body2" color="text.secondary">Average / 5</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card sx={{ bgcolor: '#F0F9FF', border: '1px solid #BAE6FD' }}>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="h4" fontWeight={800} color="#0284C7">{aggregate.total}</Typography>
                <Typography variant="body2" color="text.secondary">Responses</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card sx={{ bgcolor: '#FFF7ED', border: '1px solid #FED7AA' }}>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="h4" fontWeight={800} color="#EA580C">{aggregate.positive_count}</Typography>
                <Typography variant="body2" color="text.secondary">Positive (4-5★)</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card sx={{ bgcolor: '#FEF2F2', border: '1px solid #FECACA' }}>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="h4" fontWeight={800} color="#DC2626">{aggregate.negative_count}</Typography>
                <Typography variant="body2" color="text.secondary">Negative (1-2★)</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {(!aggregate || aggregate.total === 0) && (
        <Paper sx={{ p: 4, mb: 3, textAlign: 'center', bgcolor: '#F8FAFC' }}>
          <Typography color="text.secondary">No feedback yet. Record manually or email a survey link to get genuine feedback from carers and families.</Typography>
        </Paper>
      )}

      <Paper sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
          <Typography variant="h6" sx={{ flex: 1 }}>All Feedback</Typography>
          <TextField size="small" placeholder="Search name or comments..." value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} sx={{ width: 220 }} />
          <TextField size="small" type="date" label="From" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(0) }} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
          <TextField size="small" type="date" label="To" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(0) }} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Staff</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Respondent</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Relationship</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Rating</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Comments</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Source</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(surveys || []).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((s: any) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : '—'}</TableCell>
                  <TableCell>{s.respondent_name || '—'}</TableCell>
                  <TableCell><Chip label={s.relationship || '—'} size="small" variant="outlined" /></TableCell>
                  <TableCell><Rating value={s.rating} readOnly size="small" /></TableCell>
                  <TableCell>
                    {s.comments ? (
                      <Button size="small" variant="text" sx={{ textTransform: 'none', color: '#0F4C81', p: 0, minWidth: 0, fontSize: '0.8rem', fontWeight: 600 }}
                        onClick={(e) => { e.stopPropagation(); setViewSurvey(s); setManagerNote(s.manager_notes || '') }}>
                        View Feedback
                      </Button>
                    ) : '—'}
                  </TableCell>
                  <TableCell><Chip label={s.invitation_token ? 'Email' : 'Manual'} size="small" color={s.invitation_token ? 'info' : 'default'} /></TableCell>
                  <TableCell>{new Date(s.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {(!surveys || surveys.length === 0) && (
                <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 2 }}>No feedback recorded yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {surveys && surveys.length > rowsPerPage && (
          <TablePagination component="div" count={surveys.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} rowsPerPageOptions={[10]} />
        )}
      </Paper>

      {/* Record Feedback Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Satisfaction Feedback</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField select label="Person (optional)" value={form.person_id} onChange={e => setForm(p => ({ ...p, person_id: e.target.value }))} fullWidth size="small">
              <MenuItem value="">— Not specific to a person —</MenuItem>
              {(people || []).map((su: any) => (
                <MenuItem key={su.id} value={su.id}>{su.first_name} {su.last_name}</MenuItem>
              ))}
            </TextField>
            <TextField label="Respondent Name (optional)" value={form.respondent_name} onChange={e => setForm(p => ({ ...p, respondent_name: e.target.value }))} fullWidth size="small" />
            <TextField select label="Relationship" value={form.relationship} onChange={e => setForm(p => ({ ...p, relationship: e.target.value }))} fullWidth size="small">
              {RELATIONSHIPS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </TextField>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>Rating</Typography>
              <Rating value={form.rating} onChange={(_, v) => setForm(p => ({ ...p, rating: v || 5 }))} size="large" />
            </Box>
            <TextField label="Comments (optional)" value={form.comments} onChange={e => setForm(p => ({ ...p, comments: e.target.value }))} fullWidth multiline rows={3} size="small" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={submitMutation.isPending}>
            {submitMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Email Invitation Dialog */}
      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Email Feedback Request</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Send a survey link to a carer or family member about the quality of care provided. Their feedback is submitted directly, no staff intervention needed.
          </Typography>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Recipient Type</InputLabel>
              <Select value={inviteForm.recipient_type} label="Recipient Type" onChange={e => setInviteForm(p => ({ ...p, recipient_type: e.target.value, staff_id: '', email: '' }))}>
                <MenuItem value="email">Enter email address</MenuItem>
                <MenuItem value="staff">Select a staff member</MenuItem>
              </Select>
            </FormControl>
            {inviteForm.recipient_type === 'email' ? (
              <TextField label="Recipient Email" type="email" value={inviteForm.email} onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))} fullWidth size="small" required />
            ) : (
              <TextField select label="Select Staff Member" value={inviteForm.staff_id} onChange={e => {
                const sel = allStaff.find((s: any) => (s.staff_id || s.id) === e.target.value)
                setInviteForm(p => ({ ...p, staff_id: e.target.value, email: sel?.email || '' }))
              }} fullWidth size="small">
                <MenuItem value="">— Select —</MenuItem>
                {allStaff.map((s: any) => (
                  <MenuItem key={s.staff_id || s.id} value={s.staff_id || s.id}>{s.first_name} {s.last_name} ({s.email})</MenuItem>
                ))}
              </TextField>
            )}
            <TextField select label="Regarding Person (optional)" value={inviteForm.person_id} onChange={e => {
              const sel = (people || []).find((su: any) => su.id === e.target.value)
              setInviteForm(p => ({ ...p, person_id: e.target.value, person_name: sel ? `${sel.first_name} ${sel.last_name}` : '' }))
            }} fullWidth size="small">
              <MenuItem value="">— Not specific to a person —</MenuItem>
              {(people || []).map((su: any) => (
                <MenuItem key={su.id} value={su.id}>{su.first_name} {su.last_name}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleInvite} disabled={!inviteForm.email || inviteMutation.isPending}>
            {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Feedback Dialog */}
      <Dialog open={!!viewSurvey} onClose={() => setViewSurvey(null)} maxWidth="sm" fullWidth>
        {viewSurvey && (
          <>
            <DialogTitle sx={{ fontWeight: 800 }}>Feedback Details</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="#6B7280">Respondent</Typography>
                  <Typography variant="body2" fontWeight={600}>{viewSurvey.respondent_name || 'Anonymous'}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="#6B7280">Relationship</Typography>
                  <Typography variant="body2" fontWeight={600}>{viewSurvey.relationship || '—'}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="#6B7280">Rating</Typography>
                  <Rating value={viewSurvey.rating} readOnly />
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="#6B7280">Person</Typography>
                  <Typography variant="body2" fontWeight={600}>{viewSurvey.first_name && viewSurvey.last_name ? `${viewSurvey.first_name} ${viewSurvey.last_name}` : '—'}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="#6B7280">Source</Typography>
                  <Chip label={viewSurvey.invitation_token ? 'Email' : 'Manual'} size="small" color={viewSurvey.invitation_token ? 'info' : 'default'} />
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="#6B7280">Date</Typography>
                  <Typography variant="body2" fontWeight={600}>{new Date(viewSurvey.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</Typography>
                </Stack>
                {viewSurvey.comments && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: '#F9FAFB', borderRadius: 1, border: '1px solid #E5E7EB' }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Comments</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{viewSurvey.comments}</Typography>
                  </Box>
                )}
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Manager Notes</Typography>
                  <TextField multiline rows={3} fullWidth size="small" placeholder="Add internal notes about this feedback..."
                    value={managerNote} onChange={e => setManagerNote(e.target.value)} />
                  <Button size="small" variant="outlined" disabled={savingNote} onClick={async () => {
                    setSavingNote(true)
                    try {
                      await api.patch(`/surveys/satisfaction/${viewSurvey.id}/notes`, { manager_notes: managerNote })
                      viewSurvey.manager_notes = managerNote
                    } catch { /* ignore */ }
                    finally { setSavingNote(false) }
                  }} sx={{ mt: 1, textTransform: 'none' }}>
                    {savingNote ? 'Saving...' : managerNote ? 'Update Notes' : 'Save Notes'}
                  </Button>
                </Box>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setViewSurvey(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  )
}
