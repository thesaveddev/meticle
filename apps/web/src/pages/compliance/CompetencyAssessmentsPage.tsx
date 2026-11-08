import { useMemo, useState } from 'react'
import { Box, Typography, Tabs, Tab, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Stack, TablePagination, IconButton, CircularProgress, Autocomplete, Accordion, AccordionSummary, AccordionDetails, Alert, Tooltip, Divider, Rating, Grid } from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, ExpandMore as ExpandMoreIcon, Checklist as RubricIcon, CheckCircle as CheckCircleIcon, UploadFile as UploadFileIcon, Schedule as ScheduleIcon, Description as TemplateIcon, Layers as RecordsIcon, PendingActions as PendingIcon, TrackChanges as TargetIcon } from '@mui/icons-material'
import { useTheme } from '@mui/material/styles'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { useSnackbar } from '../../context/SnackbarContext'
import { EmptyState } from '../../components/design/EmptyState'
import PageContainer from '../../components/design/PageContainer'
import { PremiumCard } from '../../components/design/PremiumCard'
import { localToday } from '../../utils/dateFormat'

const CATEGORIES = ['Medication', 'Manual Handling', 'Clinical Procedures', 'Safeguarding', 'Emergency Response', 'Communication', 'Dementia Care', 'End of Life', 'Other']

const CQC_STATEMENTS = [
  { id: 'S4', label: 'S4 — Involving people to manage risks' },
  { id: 'S8', label: 'S8 — Medicines optimisation' },
  { id: 'E2', label: 'E2 — Evidence-based care and treatment' },
  { id: 'E5', label: 'E5 — Monitoring and improving outcomes' },
  { id: 'C1', label: 'C1 — Kindness, compassion and dignity' },
  { id: 'C2', label: 'C2 — Treating people as individuals' },
  { id: 'R1', label: 'R1 — Person-centred care' },
  { id: 'R4', label: 'R4 — Listening to and involving people' },
]

export default function CompetencyAssessmentsPage() {
  const theme = useTheme()
  const [tab, setTab] = useState(0)
  const [locationId, setLocationId] = useState<string>('all')

  const { data: pendingData } = useQuery({
    queryKey: ['competency-pending'],
    queryFn: async () => (await api.get('/competency/pending')).data,
  })
  const { data: templatesData } = useQuery({
    queryKey: ['competency-templates'],
    queryFn: async () => (await api.get('/competency/templates')).data,
  })
  const { data: assessmentsData } = useQuery({
    queryKey: ['competency-assessments'],
    queryFn: async () => (await api.get('/competency/assessments')).data,
  })
  const { data: locationsData } = useQuery({
    queryKey: ['settings-locations'],
    queryFn: async () => (await api.get('/settings/locations')).data,
  })
  const { data: membersData } = useQuery({
    queryKey: ['org-members'],
    queryFn: async () => (await api.get('/staff/org-members')).data,
  })
  const locations: any[] = Array.isArray(locationsData) ? locationsData : []
  const staffLocation = useMemo(() => {
    const map = new Map<string, string>()
    const all = [
      ...(membersData?.admins?.length ? membersData.admins : (membersData?.admin ? [membersData.admin] : [])),
      ...(membersData?.staff || []),
    ]
    for (const m of all) {
      if (m.staff_id && m.location_id) map.set(String(m.staff_id), String(m.location_id))
      if (m.id && m.location_id) map.set(String(m.id), String(m.location_id))
    }
    return map
  }, [membersData])

  const inLocation = (staffId: string) =>
    locationId === 'all' || !staffId || staffLocation.get(String(staffId)) === String(locationId) || !staffLocation.has(String(staffId))

  const pendingList: any[] = Array.isArray(pendingData) ? pendingData.filter((p: any) => inLocation(p.staff_id)) : []
  const pendingStaff = new Set(pendingList.map((p: any) => p.staff_id).filter(Boolean)).size
  const templatesList: any[] = Array.isArray(templatesData) ? templatesData : []
  const recordsList: any[] = Array.isArray(assessmentsData) ? assessmentsData : []
  const passedCount = recordsList.filter((a: any) => a.passed).length
  const passRate = recordsList.length > 0 ? Math.round((passedCount / recordsList.length) * 100) : 0

  const cards = [
    { title: 'Pass rate', value: `${passRate}%`, valueColor: recordsList.length === 0 ? '#EF4444' : passRate >= 80 ? undefined : '#F59E0B', subtitle: recordsList.length === 0 ? 'No assessments yet · target 80%' : `${passedCount} of ${recordsList.length} passed · target 80%`, icon: <TargetIcon sx={{ fontSize: 20 }} />, iconColor: '#EF4444' },
    { title: 'Pending', value: pendingList.length, valueColor: undefined, subtitle: `Across ${pendingStaff} staff`, icon: <PendingIcon sx={{ fontSize: 20 }} />, iconColor: '#0164C8' },
    { title: 'Templates', value: templatesList.length, valueColor: undefined, subtitle: 'Ready to use', icon: <TemplateIcon sx={{ fontSize: 20 }} />, iconColor: '#0164C8' },
  ]

  return (
    <PageContainer>
      {/* ── Breadcrumb + header (Figma 5.6) ── */}
      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 700, letterSpacing: '0.08em' }}>
        COMPLIANCE &amp; SAFETY / COMPLIANCE / COMPETENCY
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mt: 0.5, mb: 2, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Competency assessments</Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
            Observed checks that show staff can do the job safely.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <TextField
            select
            size="small"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            aria-label="Filter by location"
            sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          >
            <MenuItem value="all">All locations</MenuItem>
            {locations.map((l: any) => (
              <MenuItem key={l.id} value={String(l.id)}>{l.name}</MenuItem>
            ))}
          </TextField>
          <Button variant="outlined" size="small" onClick={() => setTab(1)}
            sx={{ textTransform: 'none', fontWeight: 600 }}>
            New template
          </Button>
          <Button variant="contained" size="small" startIcon={<ScheduleIcon />} onClick={() => setTab(0)}
            sx={{ textTransform: 'none', fontWeight: 600 }}>
            Schedule assessment
          </Button>
        </Stack>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab icon={<PendingIcon fontSize="small" />} iconPosition="start" label={`Pending assessments · ${pendingList.length}`} sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab icon={<TemplateIcon fontSize="small" />} iconPosition="start" label={`Assessment templates · ${templatesList.length}`} sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab icon={<RecordsIcon fontSize="small" />} iconPosition="start" label={`All records · ${recordsList.length}`} sx={{ textTransform: 'none', fontWeight: 600 }} />
      </Tabs>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {cards.map((c) => (
          <Grid item xs={12} sm={4} key={c.title}>
            <PremiumCard noBorder sx={{ p: 2.5, height: '100%' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 500, fontSize: '0.85rem' }}>
                  {c.title}
                </Typography>
                <Box sx={{
                  width: 32, height: 32, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(1,100,200,0.16)' : `${c.iconColor}14`, color: c.iconColor,
                }}>
                  {c.icon}
                </Box>
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 700, color: c.valueColor || theme.palette.text.primary, letterSpacing: '-0.03em', fontSize: '1.75rem' }}>
                {c.value}
              </Typography>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mt: 0.5, fontSize: '0.78rem' }}>
                {c.subtitle}
              </Typography>
            </PremiumCard>
          </Grid>
        ))}
      </Grid>

      {tab === 0 && <PendingView locationId={locationId} onBrowseTemplates={() => setTab(1)} />}
      {tab === 1 && <TemplatesView />}
      {tab === 2 && <RecordsView onBrowseTemplates={() => setTab(1)} />}
      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mt: 2 }}>
        Live: {pendingList.length} pending, {recordsList.length} records. The readiness score lists this as a high-priority gap.
      </Typography>
    </PageContainer>
  )
}

function PendingView({ locationId, onBrowseTemplates }: { locationId?: string; onBrowseTemplates?: () => void }) {
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()
  const [assessOpen, setAssessOpen] = useState(false)
  const [selectedPending, setSelectedPending] = useState<any>(null)
  const [form, setForm] = useState({ passed: true, assessed_at: localToday(), reassessment_date: '', assessor_id: '', involved_parties: '', notes: '' })
  const [rubricScores, setRubricScores] = useState<Record<number, number>>({})
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | false>(false)

  const { data, isLoading } = useQuery({
    queryKey: ['competency-pending'],
    queryFn: async () => {
      const res = await api.get('/competency/pending')
      return res.data
    }
  })

  const { data: membersData } = useQuery({
    queryKey: ['org-members'],
    queryFn: async () => {
      const res = await api.get('/staff/org-members')
      return res.data as any
    }
  })
  const members: any[] = [
    ...(membersData?.admins?.length ? membersData.admins : (membersData?.admin ? [membersData.admin] : [])),
    ...(membersData?.staff || [])
  ].filter((m: any) => m.status === 'active')

  const staffLocation = new Map<string, string>()
  for (const m of members) {
    if (m.staff_id && m.location_id) staffLocation.set(String(m.staff_id), String(m.location_id))
    if (m.id && m.location_id) staffLocation.set(String(m.id), String(m.location_id))
  }
  const grouped: Record<string, { staff_name: string; staff_id: string; items: any[] }> = {}
  const filtered = (data || []).filter((p: any) => {
    if (locationId && locationId !== 'all' && p.staff_id) {
      const loc = staffLocation.get(String(p.staff_id))
      if (loc && loc !== String(locationId)) return false
    }
    return !search || `${p.first_name} ${p.last_name} ${p.template_name} ${p.category || ''}`.toLowerCase().includes(search.toLowerCase())
  })
  filtered.forEach((p: any) => {
    const key = p.staff_id
    if (!grouped[key]) grouped[key] = { staff_name: `${p.first_name} ${p.last_name}`, staff_id: p.staff_id, items: [] }
    grouped[key].items.push(p)
  })

  const [assessError, setAssessError] = useState('')

  const assessMutation = useMutation({
    mutationFn: async () => {
      const rubric = selectedPending?.rubric_definition
      const payload: any = {
        template_id: selectedPending.template_id,
        staff_id: selectedPending.staff_id,
        passed: form.passed,
        assessed_at: form.assessed_at,
        reassessment_date: form.reassessment_date || undefined,
        assessor_id: form.assessor_id || undefined,
        involved_parties: form.involved_parties || undefined,
        notes: form.notes
      }
      if (rubric && rubric.length > 0) {
        const responses = rubric.map((r: any, i: number) => ({
          criterion: r.criterion,
          score: rubricScores[i] ?? 0,
          max_score: r.max_score || 5
        }))
        const totalScore = responses.reduce((s: number, r: any) => s + r.score, 0)
        const maxScore = responses.reduce((s: number, r: any) => s + r.max_score, 0)
        payload.score = totalScore
        payload.max_score = maxScore
        payload.rubric_responses = responses
      }
      if (evidenceFile) {
        const fd = new FormData()
        fd.append('file', evidenceFile)
        const uploadRes = await api.post('/settings/upload', fd)
        payload.evidence_url = uploadRes.data.url
      }
      await api.post('/competency/assessments', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competency-pending'] })
      queryClient.invalidateQueries({ queryKey: ['competency-assessments'] })
      showSnackbar('The result is recorded and the pending list is up to date.', 'success', 'Assessment recorded')
      setAssessOpen(false)
      setSelectedPending(null)
      setRubricScores({})
      setEvidenceFile(null)
      setForm({ passed: true, assessed_at: localToday(), reassessment_date: '', assessor_id: '', involved_parties: '', notes: '' })
      setAssessError('')
    },
    onError: (err: any) => {
      setAssessError(err.response?.data?.message || err.message || 'Failed to save assessment')
    }
  })

  const totalPending = filtered.length
  const rubric = selectedPending?.rubric_definition

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {totalPending} pending {totalPending === 1 ? 'assessment' : 'assessments'} across {Object.keys(grouped).length} staff
        </Typography>
        <TextField id="competency-pending-search" size="small" placeholder="Search staff or assessment..." value={search} onChange={e => setSearch(e.target.value)} sx={{ width: 280 }} />
      </Stack>

      {isLoading ? (
        <Typography>Loading...</Typography>
      ) : Object.entries(grouped).length === 0 ? (
        <Paper sx={{ p: { xs: 4, sm: 6 }, textAlign: 'center', borderRadius: 3 }}>
          <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: '#EAF3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
            <CheckCircleIcon sx={{ color: '#0164C8', fontSize: 28 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>No assessments are waiting</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            Nobody has been assessed yet, so nothing is pending. Schedule a first round so every staff member is observed at least once.
          </Typography>
          <Stack direction="row" spacing={1.5} justifyContent="center">
            <Button variant="outlined" onClick={() => onBrowseTemplates?.()} sx={{ textTransform: 'none', fontWeight: 600 }}>
              View templates
            </Button>
            <Button variant="contained" startIcon={<ScheduleIcon />} sx={{ textTransform: 'none', fontWeight: 600 }}
              onClick={() => document.getElementById('competency-pending-search')?.focus()}>
              Schedule assessment
            </Button>
          </Stack>
        </Paper>
      ) : (
        Object.entries(grouped).map(([staffId, group]) => (
          <Accordion key={staffId} expanded={expanded === staffId} onChange={(_, isExp) => setExpanded(isExp ? staffId : false)} sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography fontWeight={600}>{group.staff_name}</Typography>
                <Chip label={`${group.items.length} pending`} size="small" color="warning" />
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Assessment</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Last Assessed</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Last Result</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Rubric</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {group.items.map((p: any) => {
                      const hasRubric = p.rubric_definition && p.rubric_definition.length > 0
                      return (
                        <TableRow key={`${p.staff_id}-${p.template_id}`} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{p.template_name}</TableCell>
                          <TableCell><Chip label={p.category || '—'} size="small" variant="outlined" /></TableCell>
                          <TableCell>{p.assessed_at ? new Date(p.assessed_at).toLocaleDateString() : 'Never'}</TableCell>
                          <TableCell>
                            {p.assessed_at ? (
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <Chip label={p.passed ? 'Passed' : 'Failed'} color={p.passed ? 'success' : 'error'} size="small" />
                                {p.score != null && <Typography variant="caption" color="text.secondary">({p.score}/{p.max_score})</Typography>}
                              </Stack>
                            ) : (
                              <Chip label="Not assessed" size="small" variant="outlined" />
                            )}
                          </TableCell>
                          <TableCell>{hasRubric ? <Chip icon={<RubricIcon />} label={`${p.rubric_definition.length} criteria`} size="small" color="info" variant="outlined" /> : '—'}</TableCell>
                          <TableCell>
                            <Button size="small" variant="contained" onClick={() => { setSelectedPending(p); setRubricScores({}); setAssessOpen(true) }}>
                              Assess Now
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        ))
      )}

      <Dialog open={assessOpen} onClose={() => { setAssessOpen(false); setAssessError('') }} maxWidth="md" fullWidth>
        <DialogTitle>Record Assessment Result</DialogTitle>
        <DialogContent>
          {assessError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setAssessError('')}>{assessError}</Alert>}
          {selectedPending && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2">
                <strong>Staff:</strong> {selectedPending.first_name} {selectedPending.last_name}<br />
                <strong>Assessment:</strong> {selectedPending.template_name}
              </Typography>

              {rubric && rubric.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'notice.subtle.bg' }}>
                  <Typography variant="subtitle2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <RubricIcon fontSize="small" /> Observation Scoring Rubric
                  </Typography>
                  {rubric.map((r: any, i: number) => (
                    <Box key={i} sx={{ mb: 1.5 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" fontWeight={600}>{r.criterion}</Typography>
                        <Typography variant="caption" color="text.secondary">{rubricScores[i] ?? 0}/{r.max_score || 5}</Typography>
                      </Stack>
                      <Rating
                        value={rubricScores[i] ?? 0}
                        onChange={(_, v) => {
                          const newScores = { ...rubricScores, [i]: v ?? 0 }
                          setRubricScores(newScores)
                          const scores = rubric.map((_: any, ii: number) => newScores[ii] ?? 0)
                          const total = scores.reduce((a: number, b: number) => a + b, 0)
                          const maxTotal = rubric.reduce((a: number, rr: any) => a + (rr.max_score || 5), 0)
                          setForm(p => ({ ...p, passed: total >= maxTotal * 0.6 }))
                        }}
                        max={r.max_score || 5}
                        precision={1}
                        sx={{ mt: 0.5 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {rubricScores[i] >= (r.max_score || 5) * 0.8 ? 'Exceeds expectations' : rubricScores[i] >= (r.max_score || 5) * 0.6 ? 'Meets expectations' : rubricScores[i] > 0 ? 'Needs improvement' : 'Not demonstrated'}
                      </Typography>
                      {i < rubric.length - 1 && <Divider sx={{ mt: 1 }} />}
                    </Box>
                  ))}
                  <Box sx={{ mt: 1, p: 1.5, bgcolor: 'notice.info.bg', borderRadius: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight={600}>Total Score</Typography>
                      <Typography variant="body1" fontWeight={600}>
                        {rubric.reduce((s: number, _: any, i: number) => s + (rubricScores[i] ?? 0), 0)} / {rubric.reduce((s: number, r: any) => s + (r.max_score || 5), 0)}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">Pass threshold: 60% — {form.passed ? <strong style={{ color: 'notice.info.fg' }}>PASS</strong> : <strong style={{ color: 'notice.info.fg' }}>FAIL</strong>}</Typography>
                  </Box>
                </Paper>
              )}

              <TextField label="Result" select value={form.passed ? 'pass' : 'fail'}
                onChange={e => setForm(p => ({ ...p, passed: e.target.value === 'pass' }))}>
                <MenuItem value="pass">Pass</MenuItem>
                <MenuItem value="fail">Fail</MenuItem>
              </TextField>
              <TextField label="Assessment Date" type="date" required value={form.assessed_at}
                InputLabelProps={{ shrink: true }}
                onChange={e => setForm(p => ({ ...p, assessed_at: e.target.value }))} />
              <Autocomplete
                options={members}
                getOptionLabel={(o: any) => `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.email}
                value={members.find((m: any) => m.id === form.assessor_id || m.staff_id === form.assessor_id) || null}
                onChange={(_, v) => setForm(p => ({ ...p, assessor_id: v?.id || '' }))}
                renderInput={(params) => <TextField {...params} label="Assessor (who carried out assessment)" />}
              />
              <TextField label="Others Involved" placeholder="Names of other staff/assessors present"
                value={form.involved_parties}
                onChange={e => setForm(p => ({ ...p, involved_parties: e.target.value }))} />
              <TextField label="Reassessment Date" type="date" value={form.reassessment_date}
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: localToday() }}
                onChange={e => setForm(p => ({ ...p, reassessment_date: e.target.value }))} />
              <TextField label="Notes" multiline rows={3} value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              <Box>
                <input type="file" hidden id="evidence-upload" accept="image/*,.pdf"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setEvidenceFile(f); e.target.value = '' }} />
                <Button variant="outlined" size="small" component="label" htmlFor="evidence-upload"
                  startIcon={evidenceFile ? <CheckCircleIcon fontSize="small" color="success" /> : <UploadFileIcon />}
                  sx={{ textTransform: 'none' }}>
                  {evidenceFile ? evidenceFile.name : 'Attach Evidence (optional)'}
                </Button>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssessOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => assessMutation.mutate()} disabled={assessMutation.isPending || !form.assessed_at}>
            {assessMutation.isPending ? <CircularProgress size={20} /> : 'Save Result'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function TemplatesView() {
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()
  const [open, setOpen] = useState(false)
  const [editTemplate, setEditTemplate] = useState<any>(null)
  const [form, setForm] = useState({ name: '', category: '', description: '', criteria: '', requires_reassessment_days: '365', cqc_statement_id: '', required_for_roles: [] as string[] })
  const [rubricItems, setRubricItems] = useState<{ criterion: string; max_score: number; weight: number }[]>([])
  const [page, setPage] = useState(0)
  const [rowsPerPage] = useState(10)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['competency-templates'],
    queryFn: async () => {
      const res = await api.get('/competency/templates')
      return res.data
    }
  })

  const filtered = (data || []).filter((t: any) =>
    !search || `${t.name} ${t.category || ''} ${t.description || ''}`.toLowerCase().includes(search.toLowerCase())
  )

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form, requires_reassessment_days: parseInt(form.requires_reassessment_days), cqc_statement_id: form.cqc_statement_id || undefined }
      if (rubricItems.length > 0) payload.rubric_definition = rubricItems
      if (editTemplate) return api.put(`/competency/templates/${editTemplate.id}`, payload)
      return api.post('/competency/templates', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competency-templates'] })
      // Figma 5.12: saving a template confirms it by name — it is ready to use.
      showSnackbar(`${editTemplate?.name || form.name} is ready to use.`, 'success', 'Template saved')
      setOpen(false); setEditTemplate(null)
      setForm({ name: '', category: '', description: '', criteria: '', requires_reassessment_days: '365', cqc_statement_id: '', required_for_roles: [] })
      setRubricItems([])
    }
  })

  const [deleteError, setDeleteError] = useState('')

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/competency/templates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['competency-templates'] }),
    onError: (err: any) => {
      setDeleteError(err.response?.data?.message || err.message || 'Failed to delete template')
    }
  })

  const openEdit = (t: any) => {
    setEditTemplate(t)
    setForm({ name: t.name, category: t.category || '', description: t.description || '', criteria: t.criteria || '', requires_reassessment_days: t.requires_reassessment_days?.toString() || '365', cqc_statement_id: t.cqc_statement_id || '', required_for_roles: t.required_for_roles || [] })
    setRubricItems(t.rubric_definition || [])
    setOpen(true)
  }

  return (
    <Box>
      {deleteError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDeleteError('')}>{deleteError}</Alert>}
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h6">Templates ({filtered.length})</Typography>
        <Stack direction="row" spacing={2}>
          <TextField size="small" placeholder="Search templates..." value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} sx={{ width: 220 }} />
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditTemplate(null); setForm({ name: '', category: '', description: '', criteria: '', requires_reassessment_days: '365', cqc_statement_id: '', required_for_roles: [] }); setRubricItems([]); setOpen(true) }}>
            Add Template
          </Button>
        </Stack>
      </Stack>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Reassessment</TableCell>
              <TableCell>CQC Statement</TableCell>
              <TableCell>Rubric</TableCell>
              <TableCell>Passed/Total</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7}>Loading...</TableCell></TableRow>
              ) : filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((t: any) => {
                const rubric = t.rubric_definition || []
                return (
                  <TableRow key={t.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{t.name}</TableCell>
                    <TableCell><Chip label={t.category || '—'} size="small" variant="outlined" /></TableCell>
                    <TableCell>{t.requires_reassessment_days ? `Every ${t.requires_reassessment_days} days` : '—'}</TableCell>
                    <TableCell>{t.cqc_statement_id ? <Chip label={t.cqc_statement_id} size="small" color="primary" variant="outlined" /> : '—'}</TableCell>
                    <TableCell>{rubric.length > 0 ? <Chip icon={<RubricIcon />} label={`${rubric.length} criteria`} size="small" color="info" variant="outlined" /> : '—'}</TableCell>
                    <TableCell>{t.passed_count || 0}/{t.total_count || 0}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEdit(t)} aria-label={`Edit ${t.name} template`}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => { if (confirm('Delete this template?')) deleteMutation.mutate(t.id) }} aria-label={`Delete ${t.name} template`}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>
        <TablePagination component="div" count={filtered.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} rowsPerPageOptions={[10]} />
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editTemplate ? 'Edit Template' : 'Add Assessment Template'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            <TextField label="Category" select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              <MenuItem value="">None</MenuItem>
              {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <TextField label="Description" multiline rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            <TextField label="Assessment Criteria" multiline rows={3} value={form.criteria} onChange={e => setForm(p => ({ ...p, criteria: e.target.value }))} />
            <TextField label="Reassessment Interval (days)" type="number" value={form.requires_reassessment_days} onChange={e => setForm(p => ({ ...p, requires_reassessment_days: e.target.value }))} />
            <TextField label="CQC Quality Statement (optional)" select value={form.cqc_statement_id} onChange={e => setForm(p => ({ ...p, cqc_statement_id: e.target.value }))}>
              <MenuItem value="">— Not mapped —</MenuItem>
              {CQC_STATEMENTS.map(s => <MenuItem key={s.id} value={s.id}>{s.label}</MenuItem>)}
            </TextField>

            <TextField label="Required for Roles" select SelectProps={{ multiple: true }}
              value={form.required_for_roles || []}
              onChange={e => setForm(p => ({ ...p, required_for_roles: e.target.value as any }))}>
              {['CARE_WORKER','MANAGER','NURSE','SUPPORT_WORKER','COMPLIANCE_OFFICER'].map(r => (
                <MenuItem key={r} value={r}>{r.replace(/_/g, ' ')}</MenuItem>
              ))}
            </TextField>
            <Typography variant="caption" color="#51637A">Limit this assessment to specific staff roles (leave empty for all roles)</Typography>

            <Divider />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><RubricIcon fontSize="small" /> Observation Rubric</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={() => setRubricItems(p => [...p, { criterion: '', max_score: 5, weight: 1 }])}>Add Criterion</Button>
            </Stack>
            {rubricItems.length === 0 && <Typography variant="caption" color="text.secondary">No rubric criteria defined. Assessment will use simple Pass/Fail.</Typography>}
            {rubricItems.map((item, i) => (
              <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField size="small" label="Criterion" value={item.criterion} onChange={e => {
                      const next = [...rubricItems]; next[i] = { ...next[i], criterion: e.target.value }; setRubricItems(next)
                    }} sx={{ flex: 1 }} />
                    <TextField size="small" label="Max Score" type="number" value={item.max_score} onChange={e => {
                      const next = [...rubricItems]; next[i] = { ...next[i], max_score: parseInt(e.target.value) || 1 }; setRubricItems(next)
                    }} sx={{ width: 100 }} />
                    <IconButton size="small" color="error" onClick={() => setRubricItems(p => p.filter((_, j) => j !== i))}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending}>
            {saveMutation.isPending ? <CircularProgress size={20} /> : editTemplate ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function RecordsView({ onBrowseTemplates }: { onBrowseTemplates?: () => void }) {
  const [page, setPage] = useState(0)
  const [rowsPerPage] = useState(10)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['competency-assessments'],
    queryFn: async () => {
      const res = await api.get('/competency/assessments')
      return res.data
    }
  })

  const filtered = (data || []).filter((a: any) =>
    !search || `${a.first_name} ${a.last_name} ${a.template_name} ${a.assessor_first_name || ''} ${a.assessor_last_name || ''}`.toLowerCase().includes(search.toLowerCase())
  )

  // Figma 5.11: the All records tab reads as a card with its own header, and
  // the empty state explains where records come from with a way back to
  // templates — the live tab was an empty table with generic copy.
  if (!isLoading && filtered.length === 0 && !search) {
    return (
      <Paper variant="outlined" sx={{ borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ px: 3, pt: 2.5, pb: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>All records</Typography>
        </Box>
        <Box sx={{ px: 3, pb: 5, pt: 2, textAlign: 'center' }}>
          <Box sx={{ width: 48, height: 48, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'notice.info.bg', mb: 2 }}>
            <CheckCircleIcon sx={{ color: 'notice.info.fg', fontSize: 26 }} />
          </Box>
          <Typography sx={{ fontWeight: 700, mb: 0.75 }}>No competency records yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480, mx: 'auto', mb: 2.5 }}>
            When a manager observes someone and signs them off, the record is kept here with the date and the result.
          </Typography>
          {onBrowseTemplates && (
            <Button variant="outlined" onClick={onBrowseTemplates} sx={{ textTransform: 'none', fontWeight: 600 }}>
              View templates
            </Button>
          )}
        </Box>
      </Paper>
    )
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
        <TextField size="small" placeholder="Search staff or assessment..." value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} sx={{ width: 280 }} />
      </Stack>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Staff</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Assessment</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Assessor</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Score</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Result</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Involved</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Notes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8}>Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} sx={{ borderBottom: 'none' }}><EmptyState title="No assessment records" description="Completed assessments will appear here" variant="default" /></TableCell></TableRow>
            ) : filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((a: any) => (
              <TableRow key={a.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{a.first_name} {a.last_name}</TableCell>
                <TableCell>{a.template_name}</TableCell>
                <TableCell>{a.assessor_first_name} {a.assessor_last_name}</TableCell>
                <TableCell>{new Date(a.assessed_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  {a.score != null ? (
                    <Tooltip title={`${a.score}/${a.max_score} (${a.max_score ? Math.round(a.score / a.max_score * 100) : 0}%)`}>
                      <Chip label={`${a.score}/${a.max_score}`} size="small" color={a.max_score && a.score / a.max_score >= 0.6 ? 'success' : 'warning'} variant="outlined" />
                    </Tooltip>
                  ) : (
                    <Typography variant="caption" color="text.secondary">—</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip label={a.passed ? 'Passed' : 'Failed'} color={a.passed ? 'success' : 'error'} size="small" />
                </TableCell>
                <TableCell>{a.involved_parties || '—'}</TableCell>
                <TableCell>{a.notes || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination component="div" count={filtered.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} rowsPerPageOptions={[10]} />
      </TableContainer>
    </Box>
  )
}