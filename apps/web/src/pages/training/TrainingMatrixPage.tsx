import { useMemo, useState } from 'react'
import { Box, Typography, Tabs, Tab, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Stack, TablePagination, IconButton, CircularProgress, Alert, Grid, LinearProgress, FormControl, InputLabel, Select, OutlinedInput, Checkbox, ListItemText, Tooltip } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, AutoFixHigh as AutoAssignIcon, Groups as GroupsIcon, Layers as LayersIcon, Assessment as CompletionIcon, ArrowBack as BackIcon, Security as SecurityIcon, VerifiedUser as VerifiedUserIcon, WarningAmber as WarningIcon, FavoriteBorder as HeartIcon, Link as LinkIcon, School as CourseIcon } from '@mui/icons-material'
import api from '../../services/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import EmptyState from '../../components/EmptyState'
import PageContainer from '../../components/design/PageContainer'
import { BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import { localToday } from '../../utils/dateFormat'
import { useSnackbar } from '../../context/SnackbarContext'
import { P } from '../../styles/tokens'

const NAVY = P.primary
const INK = P.navy
const MUTED = P.slate
const HAIRLINE = P.hairline

const CATEGORIES = ['Mandatory', 'Clinical', 'Safeguarding', 'Health & Safety', 'Fire Safety', 'Infection Control', 'Manual Handling', 'Food Hygiene', 'Medication', 'First Aid', 'Dementia', 'Autism', 'Mental Health', 'Other']

function courseIcon(module: any) {
  const haystack = `${module?.name || ''} ${module?.category || ''}`.toLowerCase()
  if (haystack.includes('fire')) return <WarningIcon />
  if (haystack.includes('dbs') || haystack.includes('background')) return <SecurityIcon />
  if (haystack.includes('safeguard')) return <VerifiedUserIcon />
  if (haystack.includes('epilepsy') || haystack.includes('buccal') || haystack.includes('link')) return <LinkIcon />
  if (haystack.includes('behaviour') || haystack.includes('behavior') || haystack.includes('positive')) return <HeartIcon />
  if (haystack.includes('autism')) return <GroupsIcon />
  return <CourseIcon />
}

function staffName(staffById: Map<string, any>, staffId: string) {
  const person = staffById.get(staffId)
  return person ? `${person.first_name} ${person.last_name}` : 'Former staff'
}

export default function TrainingMatrixPage() {
  const [tab, setTab] = useState(0)
  const [view, setView] = useState<'courses' | 'records'>('courses')
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignModuleId, setAssignModuleId] = useState<string | null>(null)
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false)
  const [editModule, setEditModule] = useState<any>(null)
  const [error, setError] = useState('')
  const [recordsTab, setRecordsTab] = useState(0)

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}')
    } catch {
      return {}
    }
  }, [])
  const canManage = currentUser.role === 'ORG_ADMIN' || currentUser.role === 'MANAGER'

  const { data: matrix } = useQuery({
    queryKey: ['training-matrix'],
    queryFn: async () => {
      const res = await api.get('/training/matrix')
      return res.data
    }
  })

  const { data: modules } = useQuery({
    queryKey: ['training-modules'],
    queryFn: async () => {
      const res = await api.get('/training/modules')
      return res.data
    }
  })

  const modulesList: any[] = modules || matrix?.modules || []
  const staffList: any[] = matrix?.staff || []
  const records: any[] = matrix?.records || []
  const moduleById = useMemo(() => new Map(modulesList.map((m: any) => [m.id, m])), [modulesList])
  const staffById = useMemo(() => new Map(staffList.map((s: any) => [s.id, s])), [staffList])
  const mandatoryModules = useMemo(() => modulesList.filter((m: any) => m.is_mandatory), [modulesList])
  const optionalModules = useMemo(() => modulesList.filter((m: any) => !m.is_mandatory), [modulesList])

  const recordFor = (staffId: string, moduleId: string) =>
    records.find((r: any) => r.staff_id === staffId && r.module_id === moduleId)

  const assignedRecords = useMemo(() => records.filter((r: any) => r.status !== 'completed'), [records])
  const completedRecords = useMemo(() => records.filter((r: any) => r.status === 'completed'), [records])

  const places = useMemo(() => {
    const total = mandatoryModules.length * staffList.length
    const activeIds = new Set(staffList.map((s: any) => s.id))
    const mandatoryIds = new Set(mandatoryModules.map((m: any) => m.id))
    const done = records.filter((r: any) => r.status === 'completed' && mandatoryIds.has(r.module_id) && activeIds.has(r.staff_id)).length
    return { total, done, percentage: total > 0 ? Math.round((done / total) * 100) : 0 }
  }, [mandatoryModules, staffList, records])

  if (view === 'records') {
    return (
      <PageContainer>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
          <Button startIcon={<BackIcon />} onClick={() => setView('courses')} sx={{ color: NAVY, textTransform: 'none' }}>
            Back to courses
          </Button>
        </Stack>
        <Typography sx={{ color: NAVY, fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.13em', textTransform: 'uppercase', mb: 1 }}>
          Learn / Training records
        </Typography>
        <Typography variant="h4" sx={{ color: INK, fontWeight: 600, letterSpacing: '-0.03em', mb: 0.75 }}>
          Training records
        </Typography>
        <Typography sx={{ color: MUTED, mb: 4, maxWidth: 660 }}>
          The compliance grid, expiry watch and completion analytics behind the course cards.
        </Typography>
        {/* Figma 5.11: the records workspace is tabbed — Dashboard, the staff ×
            module compliance grid, a per-module completion table, and the
            expiry watch — instead of one long stacked page. */}
        <Tabs value={recordsTab} onChange={(_, v) => setRecordsTab(v)} sx={{ mb: 3, borderBottom: `1px solid ${HAIRLINE}` }}>
          <Tab label="Dashboard" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab label="Compliance grid" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab label="Modules" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab label="Expiring soon" sx={{ textTransform: 'none', fontWeight: 600 }} />
        </Tabs>
        {recordsTab === 0 && <DashboardView />}
        {recordsTab === 1 && <GridView />}
        {recordsTab === 2 && (
          <ModulesTableView
            modules={modulesList}
            records={records}
            staffCount={staffList.length}
            canManage={canManage}
            onAdd={() => { setEditModule(null); setModuleDialogOpen(true) }}
          />
        )}
        {recordsTab === 3 && <ExpiringView />}
        <AssignTrainingDialog
          open={assignOpen}
          modules={modulesList}
          staff={staffList}
          presetModuleId={assignModuleId}
          onClose={() => { setAssignOpen(false); setAssignModuleId(null) }}
          onError={(message: string) => setError(message)}
        />
        <ModuleDialog
          open={moduleDialogOpen}
          editing={editModule}
          onClose={() => { setModuleDialogOpen(false); setEditModule(null) }}
          onError={(message: string) => setError(message)}
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={2} sx={{ mb: 3 }}>
        <Box>
          <Typography sx={{ color: NAVY, fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.13em', textTransform: 'uppercase', mb: 1 }}>
            Learn
          </Typography>
          <Typography variant="h4" sx={{ color: INK, fontWeight: 600, letterSpacing: '-0.03em', mb: 0.75 }}>
            Learn
          </Typography>
          <Typography sx={{ color: MUTED, maxWidth: 660 }}>
            Training courses for your team. Mandatory courses also count towards Compliance.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
          <Button variant="outlined" onClick={() => setView('records')} sx={{ borderColor: NAVY, color: NAVY, textTransform: 'none', fontWeight: 600 }}>
            Training records
          </Button>
          {canManage && <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setAssignModuleId(null); setAssignOpen(true) }} sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 600 }}>
            Assign training
          </Button>}
        </Stack>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Tab
          label={<Stack direction="row" spacing={1} alignItems="center"><span>Courses</span><Chip label={modulesList.length} size="small" sx={{ bgcolor: tab === 0 ? 'notice.info.bg' : 'notice.muted.bg', color: tab === 0 ? 'notice.info.fg' : MUTED, fontWeight: 700, height: 22 }} /></Stack>}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        />
        <Tab
          label={<Stack direction="row" spacing={1} alignItems="center"><span>Assigned</span><Chip label={assignedRecords.length} size="small" sx={{ bgcolor: tab === 1 ? 'notice.info.bg' : 'notice.muted.bg', color: tab === 1 ? 'notice.info.fg' : MUTED, fontWeight: 700, height: 22 }} /></Stack>}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        />
        <Tab
          label={<Stack direction="row" spacing={1} alignItems="center"><span>Completed</span><Chip label={completedRecords.length} size="small" sx={{ bgcolor: tab === 2 ? 'notice.info.bg' : 'notice.muted.bg', color: tab === 2 ? 'notice.info.fg' : MUTED, fontWeight: 700, height: 22 }} /></Stack>}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        />
      </Tabs>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={4} md={4}>
          <Paper variant="outlined" sx={{ p: 2, borderColor: HAIRLINE, borderRadius: 2, position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', color: NAVY, bgcolor: 'notice.info.bg' }}>
              <LayersIcon />
            </Box>
            <Typography sx={{ color: MUTED, fontSize: '0.78rem', fontWeight: 600 }}>Mandatory courses</Typography>
            <Typography sx={{ color: INK, fontSize: '1.7rem', lineHeight: 1.2, fontWeight: 700 }}>{mandatoryModules.length}</Typography>
            <Typography sx={{ color: MUTED, fontSize: '0.78rem' }}>Required for every role</Typography>
          </Paper>
        </Grid>
        <Grid item xs={4} md={4}>
          <Paper variant="outlined" sx={{ p: 2, borderColor: HAIRLINE, borderRadius: 2, position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', color: NAVY, bgcolor: 'notice.info.bg' }}>
              <GroupsIcon />
            </Box>
            <Typography sx={{ color: MUTED, fontSize: '0.78rem', fontWeight: 600 }}>Staff to train</Typography>
            <Typography sx={{ color: INK, fontSize: '1.7rem', lineHeight: 1.2, fontWeight: 700 }}>{staffList.length}</Typography>
            <Typography sx={{ color: MUTED, fontSize: '0.78rem' }}>Active staff</Typography>
          </Paper>
        </Grid>
        <Grid item xs={4} md={4}>
          <Paper variant="outlined" sx={{ p: 2, borderColor: HAIRLINE, borderRadius: 2, position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', color: places.percentage >= 80 ? NAVY : 'notice.error.fg', bgcolor: places.percentage >= 80 ? 'notice.info.bg' : 'notice.error.bg' }}>
              <CompletionIcon />
            </Box>
            <Typography sx={{ color: MUTED, fontSize: '0.78rem', fontWeight: 600 }}>Completion</Typography>
            <Typography sx={{ color: places.percentage >= 80 ? INK : 'notice.error.fg', fontSize: '1.7rem', lineHeight: 1.2, fontWeight: 700 }}>{places.percentage}%</Typography>
            <Typography sx={{ color: MUTED, fontSize: '0.78rem' }}>{places.done} of {places.total} course places</Typography>
          </Paper>
        </Grid>
      </Grid>

      {tab === 0 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Typography sx={{ color: INK, fontWeight: 700, fontSize: '1.05rem' }}>Mandatory courses</Typography>
              <Typography sx={{ color: MUTED, fontSize: '0.82rem' }}>Assign a course to a person, a role or a whole location</Typography>
            </Box>
            {canManage && <Button variant="outlined" startIcon={<AddIcon />} onClick={() => { setEditModule(null); setModuleDialogOpen(true) }} sx={{ borderColor: NAVY, color: NAVY, textTransform: 'none', fontWeight: 600, flexShrink: 0 }}>
              Add course
            </Button>}
          </Stack>
          {modulesList.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 4, borderColor: HAIRLINE, borderRadius: 2 }}>
              <EmptyState message="No training courses yet" description={canManage ? 'Add your first course to start assigning training.' : 'Courses will appear here once added.'} />
            </Paper>
          ) : (
            <>
              <Grid container spacing={2}>
                {mandatoryModules.map((module: any) => (
                  <Grid item xs={12} sm={6} md={4} key={module.id}>
                    <CourseCard
                      module={module}
                      staffCount={staffList.length}
                      recordForStaff={(staffId: string) => recordFor(staffId, module.id)}
                      staffIds={staffList.map((s: any) => s.id)}
                      canManage={canManage}
                      onAssign={() => { setAssignModuleId(module.id); setAssignOpen(true) }}
                      onEdit={() => { setEditModule(module); setModuleDialogOpen(true) }}
                    />
                  </Grid>
                ))}
              </Grid>
              {optionalModules.length > 0 && (
                <Box sx={{ mt: 4 }}>
                  <Typography sx={{ color: INK, fontWeight: 700, fontSize: '1.05rem', mb: 0.5 }}>Other courses</Typography>
                  <Typography sx={{ color: MUTED, fontSize: '0.82rem', mb: 2 }}>Additional training that is not mandatory for every role</Typography>
                  <Grid container spacing={2}>
                    {optionalModules.map((module: any) => (
                      <Grid item xs={12} sm={6} md={4} key={module.id}>
                        <CourseCard
                          module={module}
                          staffCount={staffList.length}
                          recordForStaff={(staffId: string) => recordFor(staffId, module.id)}
                          staffIds={staffList.map((s: any) => s.id)}
                          canManage={canManage}
                          onAssign={() => { setAssignModuleId(module.id); setAssignOpen(true) }}
                          onEdit={() => { setEditModule(module); setModuleDialogOpen(true) }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
              <Box sx={{ display: { xs: 'block', md: 'none' }, mt: 2 }}>
                <Paper variant="outlined" sx={{ borderColor: HAIRLINE, borderRadius: 2, overflow: 'hidden' }}>
                  {modulesList.filter((m: any) => m.is_mandatory).map((module: any, index: number, arr: any[]) => {
                    const done = staffList.filter((s: any) => recordFor(s.id, module.id)?.status === 'completed').length
                    const pct = staffList.length > 0 ? Math.round((done / staffList.length) * 100) : 0
                    return (
                      <Box key={module.id} sx={{ p: 2, borderBottom: index < arr.length - 1 ? `1px solid ${HAIRLINE}` : 0, display: 'flex', gap: 1.5, alignItems: 'center' }}>
                        <Box sx={{ width: 40, height: 40, borderRadius: 1.5, display: 'grid', placeItems: 'center', color: NAVY, bgcolor: 'notice.info.bg', flexShrink: 0 }}>
                          {courseIcon(module)}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ color: INK, fontWeight: 700 }}>{module.name}</Typography>
                          <Typography sx={{ color: MUTED, fontSize: '0.78rem' }}>{done} of {staffList.length} staff completed</Typography>
                        </Box>
                        <Typography sx={{ color: pct === 100 ? 'notice.success.fg' : 'notice.error.fg', fontWeight: 700 }}>{pct}%</Typography>
                      </Box>
                    )
                  })}
                </Paper>
              </Box>
            </>
          )}
        </Box>
      )}

      {tab === 1 && (
        <RecordsTable
          title="Assigned training"
          subtitle="Records waiting to be completed"
          records={assignedRecords}
          staffById={staffById}
          moduleById={moduleById}
          canManage={canManage}
          emptyMessage="Nothing assigned"
          emptyDescription="Assigned courses will appear here until they are completed."
        />
      )}

      {tab === 2 && (
        <RecordsTable
          title="Completed training"
          subtitle="Finished courses with completion and expiry dates"
          records={completedRecords}
          staffById={staffById}
          moduleById={moduleById}
          canManage={canManage}
          emptyMessage="Nothing completed yet"
          emptyDescription="Completed courses will appear here with their expiry dates."
          showCompleted
        />
      )}

      <AssignTrainingDialog
        open={assignOpen}
        modules={modulesList}
        staff={staffList}
        presetModuleId={assignModuleId}
        onClose={() => { setAssignOpen(false); setAssignModuleId(null) }}
        onError={(message: string) => setError(message)}
      />
      <ModuleDialog
        open={moduleDialogOpen}
        editing={editModule}
        onClose={() => { setModuleDialogOpen(false); setEditModule(null) }}
        onError={(message: string) => setError(message)}
      />
    </PageContainer>
  )
}

function CourseCard({ module, staffCount, recordForStaff, staffIds, canManage, onAssign, onEdit }: {
  module: any; staffCount: number; recordForStaff: (staffId: string) => any; staffIds: string[];
  canManage: boolean; onAssign: () => void; onEdit: () => void;
}) {
  const done = staffIds.filter((id) => recordForStaff(id)?.status === 'completed').length
  const pct = staffCount > 0 ? Math.round((done / staffCount) * 100) : 0

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderColor: HAIRLINE, borderRadius: 2, height: '100%', display: { xs: 'none', md: 'flex' }, flexDirection: 'column', position: 'relative' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        {module.is_mandatory ? (
          <Chip label="Mandatory" size="small" sx={{ bgcolor: 'notice.info.bg', color: 'notice.info.fg', fontWeight: 600, fontSize: '0.68rem' }} />
        ) : <Box />}
        <Stack direction="row" spacing={0.5} alignItems="center">
          {canManage && (
            <>
              <IconButton size="small" onClick={onEdit} sx={{ color: MUTED }}><EditIcon fontSize="small" /></IconButton>
              <DeleteModuleButton moduleId={module.id} />
            </>
          )}
          <Box sx={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', color: NAVY, bgcolor: 'notice.info.bg', ml: 0.5 }}>
            {courseIcon(module)}
          </Box>
        </Stack>
      </Stack>
      <Typography sx={{ color: INK, fontWeight: 700, fontSize: '1.02rem', mb: 0.5 }}>{module.name}</Typography>
      <Typography sx={{ color: MUTED, fontSize: '0.84rem', lineHeight: 1.5, mb: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 40 }}>
        {module.description || 'No description yet.'}
      </Typography>
      <Box sx={{ mt: 'auto' }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.75 }}>
          <LinearProgress variant="determinate" value={pct} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
          <Typography sx={{ color: pct === 100 ? 'notice.success.fg' : 'notice.error.fg', fontWeight: 700, fontSize: '0.82rem', minWidth: 38, textAlign: 'right' }}>
            {pct}%
          </Typography>
        </Stack>
        <Typography sx={{ color: MUTED, fontSize: '0.78rem', mb: 1.25 }}>{done} of {staffCount} staff completed</Typography>
        {canManage && (
          <Button onClick={onAssign} sx={{ color: NAVY, textTransform: 'none', fontWeight: 600, p: 0, minWidth: 0, fontSize: '0.85rem' }}>
            Assign to staff →
          </Button>
        )}
      </Box>
    </Paper>
  )
}

function DeleteModuleButton({ moduleId }: { moduleId: string }) {
  const queryClient = useQueryClient()
  const [deleteError, setDeleteError] = useState('')
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/training/modules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-modules'] })
      queryClient.invalidateQueries({ queryKey: ['training-matrix'] })
    },
    onError: (err: any) => setDeleteError(err.response?.data?.message || 'Failed to delete module')
  })
  return (
    <>
      <IconButton size="small" color="error" onClick={() => { if (confirm('Delete this course? Training records for it are kept.')) deleteMutation.mutate(moduleId) }}><DeleteIcon fontSize="small" /></IconButton>
      {deleteError && <Alert severity="error" sx={{ mt: 1 }} onClose={() => setDeleteError('')}>{deleteError}</Alert>}
    </>
  )
}

function RecordsTable({ title, subtitle, records, staffById, moduleById, canManage, emptyMessage, emptyDescription, showCompleted }: {
  title: string; subtitle: string; records: any[]; staffById: Map<string, any>; moduleById: Map<string, any>;
  canManage: boolean; emptyMessage: string; emptyDescription: string; showCompleted?: boolean;
}) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [rowsPerPage] = useState(10)

  const completeMutation = useMutation({
    mutationFn: async ({ module_id, staff_id }: { module_id: string; staff_id: string }) =>
      api.post('/training/records', { module_id, staff_id, status: 'completed', completed_at: localToday() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-matrix'] })
      queryClient.invalidateQueries({ queryKey: ['training-dashboard'] })
    }
  })

  return (
    <Paper variant="outlined" sx={{ borderColor: HAIRLINE, borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ p: { xs: 2, md: 2.5 }, pb: 1 }}>
        <Typography sx={{ color: INK, fontWeight: 700, fontSize: '1.05rem' }}>{title}</Typography>
        <Typography sx={{ color: MUTED, fontSize: '0.82rem' }}>{subtitle}</Typography>
      </Box>
      {records.length === 0 ? (
        <Box sx={{ p: { xs: 5, md: 6 }, textAlign: 'center' }}>
          <Typography sx={{ color: INK, fontWeight: 600, mb: 0.75 }}>{emptyMessage}</Typography>
          <Typography sx={{ color: MUTED }}>{emptyDescription}</Typography>
        </Box>
      ) : (
        <>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {['Staff', 'Course', showCompleted ? 'Completed' : 'Assigned', 'Expires', 'Status', canManage && !showCompleted ? 'Action' : ''].filter(Boolean).map((heading) => (
                    <TableCell key={heading as string} sx={{ color: MUTED, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${HAIRLINE}` }}>
                      {heading}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {records.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((record: any) => (
                  <TableRow key={`${record.staff_id}-${record.module_id}`} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                    <TableCell sx={{ color: INK, fontWeight: 600, borderBottom: `1px solid ${HAIRLINE}` }}>
                      {staffName(staffById, record.staff_id)}
                    </TableCell>
                    <TableCell sx={{ color: INK, borderBottom: `1px solid ${HAIRLINE}` }}>
                      {moduleById.get(record.module_id)?.name || 'Course'}
                    </TableCell>
                    <TableCell sx={{ color: MUTED, borderBottom: `1px solid ${HAIRLINE}` }}>
                      {record.completed_at ? new Date(record.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </TableCell>
                    <TableCell sx={{ color: MUTED, borderBottom: `1px solid ${HAIRLINE}` }}>
                      {record.expires_at ? new Date(record.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </TableCell>
                    <TableCell sx={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                      <Chip
                        label={record.status === 'completed' ? 'Completed' : record.status === 'expired' ? 'Expired' : 'Assigned'}
                        size="small"
                        color={record.status === 'completed' ? 'success' : record.status === 'expired' ? 'error' : 'warning'}
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    {canManage && !showCompleted && (
                      <TableCell sx={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => completeMutation.mutate({ module_id: record.module_id, staff_id: record.staff_id })}
                          disabled={completeMutation.isPending}
                          sx={{ borderColor: NAVY, color: NAVY, textTransform: 'none', fontWeight: 600 }}
                        >
                          Mark complete
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={records.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[10]}
          />
        </>
      )}
    </Paper>
  )
}

function ModulesTableView({ modules, records, staffCount, canManage, onAdd }: {
  modules: any[]; records: any[]; staffCount: number; canManage: boolean; onAdd: () => void;
}) {
  const [page, setPage] = useState(0)
  const [rowsPerPage] = useState(10)

  const doneFor = (moduleId: string) =>
    records.filter((r: any) => r.module_id === moduleId && r.status === 'completed').length
  const assignedFor = (moduleId: string) =>
    new Set(records.filter((r: any) => r.module_id === moduleId).map((r: any) => r.staff_id)).size
  const renewLabel = (module: any) => {
    const days = module.frequency_days
    if (!days) return '—'
    if (days % 365 === 0) {
      const years = days / 365
      return `${years} year${years === 1 ? '' : 's'}`
    }
    return `${days} days`
  }
  const totalDone = records.filter((r: any) => r.status === 'completed').length
  const totalPlaces = modules.length * staffCount

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ color: INK, fontWeight: 700, fontSize: '1.05rem' }}>Modules</Typography>
          <Typography sx={{ color: MUTED, fontSize: '0.82rem' }}>
            {modules.length} modules · {totalDone} of {totalPlaces} records complete
          </Typography>
        </Box>
        {canManage && <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd} sx={{ bgcolor: NAVY, textTransform: 'none', fontWeight: 600, flexShrink: 0 }}>Add module</Button>}
      </Stack>
      {modules.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, borderColor: HAIRLINE, borderRadius: 2 }}>
          <EmptyState message="No training courses yet" description={canManage ? 'Add your first course to start assigning training.' : 'Courses will appear here once added.'} />
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ borderColor: HAIRLINE, borderRadius: 2, overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {['Module', 'Renew every', 'Completed', 'Assigned to'].map((heading) => (
                    <TableCell key={heading} sx={{ color: MUTED, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${HAIRLINE}` }}>
                      {heading}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {modules.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((module: any) => {
                  const done = doneFor(module.id)
                  const pct = staffCount > 0 ? Math.round((done / staffCount) * 100) : 0
                  return (
                    <TableRow key={module.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell sx={{ color: INK, fontWeight: 600, borderBottom: `1px solid ${HAIRLINE}` }}>
                        {module.name}
                      </TableCell>
                      <TableCell sx={{ color: MUTED, borderBottom: `1px solid ${HAIRLINE}` }}>
                        {renewLabel(module)}
                      </TableCell>
                      <TableCell sx={{ borderBottom: `1px solid ${HAIRLINE}`, minWidth: 180 }}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <LinearProgress variant="determinate" value={pct} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
                          <Typography sx={{ color: pct === 100 ? 'notice.success.fg' : INK, fontWeight: 700, fontSize: '0.82rem', minWidth: 38, textAlign: 'right' }}>
                            {pct}%
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ color: MUTED, borderBottom: `1px solid ${HAIRLINE}` }}>
                        {assignedFor(module.id)} staff
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={modules.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[10]}
          />
        </Paper>
      )}
    </Box>
  )
}

function AssignTrainingDialog({ open, modules, staff, presetModuleId, onClose, onError }: {
  open: boolean; modules: any[]; staff: any[]; presetModuleId: string | null;
  onClose: () => void; onError: (message: string) => void;
}) {
  const queryClient = useQueryClient()
  const [staffId, setStaffId] = useState('')
  const [moduleIds, setModuleIds] = useState<string[]>([])

  const reset = () => { setStaffId(''); setModuleIds([]) }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['training-matrix'] })
    queryClient.invalidateQueries({ queryKey: ['training-dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['training-records'] })
  }

  const { showSnackbar } = useSnackbar()

  const assignMutation = useMutation({
    mutationFn: () => api.post('/training/bulk-assign', { staffId, moduleIds }),
    onSuccess: () => {
      invalidate()
      reset()
      onClose()
      // Figma 5.8 TOAST / Training recorded tone: what happened, then what happens next.
      showSnackbar('The staff member can now complete it from the matrix.', 'success', 'Training assigned')
    },
    onError: (err: any) => onError(err.response?.data?.message || 'Could not assign training.')
  })

  const autoAssignMutation = useMutation({
    mutationFn: () => api.post('/training/auto-assign'),
    onSuccess: () => invalidate(),
    onError: (err: any) => onError(err.response?.data?.message || 'Auto-assign failed.')
  })

  return (
    <Dialog open={open} onClose={() => { reset(); onClose() }} maxWidth="sm" fullWidth>
      <DialogTitle>Assign training</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Staff member</InputLabel>
            <Select value={staffId} label="Staff member" onChange={(e) => setStaffId(e.target.value)}>
              {staff.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Courses</InputLabel>
            <Select
              multiple
              value={presetModuleId ? [presetModuleId, ...moduleIds.filter((id) => id !== presetModuleId)] : moduleIds}
              onChange={(e) => setModuleIds(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
              input={<OutlinedInput label="Courses" />}
              renderValue={(selected) => (selected as string[]).map((id) => modules.find((m: any) => m.id === id)?.name).filter(Boolean).join(', ')}
            >
              {modules.map((m: any) => (
                <MenuItem key={m.id} value={m.id} disabled={m.id === presetModuleId}>
                  <Checkbox checked={m.id === presetModuleId || moduleIds.includes(m.id)} />
                  <ListItemText primary={m.name} secondary={m.is_mandatory ? 'Mandatory' : undefined} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {autoAssignMutation.data && (
            <Alert severity="success">{(autoAssignMutation.data as any).data?.message || 'Auto-assign complete.'}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
        <Button
          startIcon={<AutoAssignIcon />}
          onClick={() => autoAssignMutation.mutate()}
          disabled={autoAssignMutation.isPending}
          sx={{ textTransform: 'none', color: NAVY }}
        >
          {autoAssignMutation.isPending ? 'Assigning...' : 'Auto-assign by role'}
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={() => { reset(); onClose() }} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => assignMutation.mutate()}
            disabled={!staffId || ((presetModuleId ? 1 : 0) + moduleIds.filter((id) => id !== presetModuleId).length) === 0 || assignMutation.isPending}
            sx={{ bgcolor: NAVY, textTransform: 'none' }}
          >
            {assignMutation.isPending ? <CircularProgress size={20} /> : 'Assign'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}

function ModuleDialog({ open, editing, onClose, onError }: {
  open: boolean; editing: any; onClose: () => void; onError: (message: string) => void;
}) {
  const queryClient = useQueryClient()
  const ROLE_OPTIONS = ['CARE_WORKER', 'MANAGER', 'COMPLIANCE_OFFICER', 'NURSE', 'SUPPORT_WORKER']
  const [form, setForm] = useState({ name: '', category: '', description: '', frequency_days: '', is_mandatory: true, requires_competency: false, cqc_mandated: false, cqc_mandated_for_roles: [] as string[] })

  const openFor = (module: any) => {
    setForm(module
      ? { name: module.name, category: module.category || '', description: module.description || '', frequency_days: module.frequency_days?.toString() || '', is_mandatory: module.is_mandatory, requires_competency: module.requires_competency, cqc_mandated: module.cqc_mandated, cqc_mandated_for_roles: module.cqc_mandated_for_roles || [] }
      : { name: '', category: '', description: '', frequency_days: '', is_mandatory: true, requires_competency: false, cqc_mandated: false, cqc_mandated_for_roles: [] })
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, frequency_days: form.frequency_days ? parseInt(form.frequency_days) : undefined }
      if (editing) {
        return api.put(`/training/modules/${editing.id}`, payload)
      }
      return api.post('/training/modules', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-modules'] })
      queryClient.invalidateQueries({ queryKey: ['training-matrix'] })
      onClose()
    },
    onError: (err: any) => onError(err.response?.data?.message || 'Could not save the course.')
  })

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth TransitionProps={{ onEnter: () => openFor(editing) }}>
      <DialogTitle>{editing ? 'Edit course' : 'Add course'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Course name" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          <TextField label="Category" select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
            <MenuItem value="">None</MenuItem>
            {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField label="Description" multiline rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          <TextField label="Renewal frequency (days)" type="number" value={form.frequency_days} onChange={e => setForm(p => ({ ...p, frequency_days: e.target.value }))} helperText="How often this training needs renewal (e.g. 365 for annual)" />
          <TextField label="Mandatory" select value={form.is_mandatory ? 'yes' : 'no'} onChange={e => setForm(p => ({ ...p, is_mandatory: e.target.value === 'yes' }))}>
            <MenuItem value="yes">Yes</MenuItem>
            <MenuItem value="no">No</MenuItem>
          </TextField>
          <TextField label="Requires competency assessment" select value={form.requires_competency ? 'yes' : 'no'} onChange={e => setForm(p => ({ ...p, requires_competency: e.target.value === 'yes' }))}>
            <MenuItem value="yes">Yes</MenuItem>
            <MenuItem value="no">No</MenuItem>
          </TextField>
          <TextField label="CQC mandated" select value={form.cqc_mandated ? 'yes' : 'no'} onChange={e => setForm(p => ({ ...p, cqc_mandated: e.target.value === 'yes' }))}>
            <MenuItem value="yes">Yes</MenuItem>
            <MenuItem value="no">No</MenuItem>
          </TextField>
          {form.cqc_mandated && (
            <TextField label="Required for roles" select value={form.cqc_mandated_for_roles} onChange={e => setForm(p => ({ ...p, cqc_mandated_for_roles: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value }))} SelectProps={{ multiple: true }} fullWidth>
              {ROLE_OPTIONS.map(r => <MenuItem key={r} value={r}>{r.replace(/_/g, ' ')}</MenuItem>)}
            </TextField>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending}>
          {saveMutation.isPending ? <CircularProgress size={20} /> : editing ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function GridView() {
  const queryClient = useQueryClient()
  const [gridPage, setGridPage] = useState(0)
  const [gridRowsPerPage] = useState(10)

  const { data, isLoading } = useQuery({
    queryKey: ['training-matrix'],
    queryFn: async () => {
      const res = await api.get('/training/matrix')
      return res.data
    }
  })

  const getRecord = (staffId: string, moduleId: string) =>
    data?.records?.find((r: any) => r.staff_id === staffId && r.module_id === moduleId)

  const completeMutation = useMutation({
    mutationFn: async ({ module_id, staff_id }: { module_id: string; staff_id: string }) =>
      api.post('/training/records', { module_id, staff_id, status: 'completed', completed_at: localToday() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['training-matrix'] })
  })

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success'
      case 'expired': return 'error'
      default: return 'warning'
    }
  }

  if (isLoading) return <Typography>Loading...</Typography>

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>Compliance grid</Typography>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {data?.staff?.length || 0} staff × {data?.modules?.length || 0} training modules
        </Typography>
      </Stack>
      <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 2 }}>Staff</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Profile</TableCell>
              {data?.modules?.map((m: any) => (
                <TableCell key={m.id} sx={{ fontWeight: 600, minWidth: 100, writingMode: 'vertical-rl', textAlign: 'center', p: 1 }}>
                  <Tooltip title={`${m.name}${m.cqc_mandated ? ' (CQC Mandated)' : ''}`}>
                    <span>{m.cqc_mandated ? '⚑ ' : ''}{m.name}</span>
                  </Tooltip>
                </TableCell>
              ))}
              <TableCell sx={{ fontWeight: 600 }}>%</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!data?.staff?.length ? (
              <TableRow><TableCell colSpan={data?.modules?.length ? data.modules.length + 2 : 3}><EmptyState message="No staff data" description="Assign staff profiles to view the compliance grid." /></TableCell></TableRow>
            ) : data?.staff?.slice(gridPage * gridRowsPerPage, gridPage * gridRowsPerPage + gridRowsPerPage).map((s: any) => {
              const total = data.modules.length
              const done = data.modules.filter((m: any) => {
                const r = getRecord(s.id, m.id)
                return r?.status === 'completed'
              }).length
              return (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ fontWeight: 600, position: 'sticky', left: 0, bgcolor: 'background.paper' }}>
                    {s.first_name} {s.last_name}
                  </TableCell>
                  <TableCell>
                    <Chip label={s.profile_name || 'None'} size="small" variant="outlined" />
                  </TableCell>
                  {data?.modules?.map((m: any) => {
                    const r = getRecord(s.id, m.id)
                    return (
                      <TableCell key={m.id} sx={{ textAlign: 'center', p: 0.5 }}>
                        <Tooltip title={r ? `${r.status}${r.expires_at ? ` - Expires: ${r.expires_at}` : ''}` : 'Not assigned'}>
                          <Chip
                            size="small"
                            label={r?.status === 'completed' ? '✓' : r?.status === 'expired' ? '!' : '—'}
                            color={r ? statusColor(r.status) as any : 'default'}
                            variant={r ? 'filled' : 'outlined'}
                            sx={{ minWidth: 28, cursor: 'pointer' }}
                            onClick={() => {
                              if (r?.status !== 'completed') {
                                completeMutation.mutate({ module_id: m.id, staff_id: s.id })
                              }
                            }}
                          />
                        </Tooltip>
                      </TableCell>
                    )
                  })}
                  <TableCell>
                    <Chip label={`${total > 0 ? Math.round(done / total * 100) : 0}%`} size="small" color={done === total ? 'success' : 'warning'} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination component="div" count={data?.staff?.length || 0} page={gridPage} onPageChange={(_, p) => setGridPage(p)} rowsPerPage={gridRowsPerPage} rowsPerPageOptions={[10]} sx={{ bgcolor: 'background.paper' }} />
    </Box>
  )
}

function ExpiringView() {
  const [days, setDays] = useState(30)
  const [page, setPage] = useState(0)
  const [rowsPerPage] = useState(10)

  const { data, isLoading } = useQuery({
    queryKey: ['training-expiring', days],
    queryFn: async () => {
      const res = await api.get(`/training/expiring?days=${days}`)
      return res.data
    }
  })

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6">Expiring & expired training</Typography>
        <TextField label="Look ahead (days)" type="number" size="small" value={days}
          onChange={e => setDays(parseInt(e.target.value) || 30)} sx={{ width: 150 }} />
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Staff</TableCell>
              <TableCell>Module</TableCell>
              <TableCell>Completed</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5}>Loading...</TableCell></TableRow>
            ) : data?.length === 0 ? (
              <TableRow><TableCell colSpan={5}>No expiring training found.</TableCell></TableRow>
            ) : data?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((r: any) => {
              const daysLeft = r.expires_at ? Math.ceil((new Date(r.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
              return (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{r.first_name} {r.last_name}</TableCell>
                  <TableCell>{r.module_name}</TableCell>
                  <TableCell>{r.completed_at ? new Date(r.completed_at).toLocaleDateString() : '—'}</TableCell>
                  <TableCell>{r.expires_at ? new Date(r.expires_at).toLocaleDateString() : '—'}</TableCell>
                  <TableCell>
                    {daysLeft !== null ? (
                      <Chip
                        label={daysLeft <= 0 ? 'Expired' : `${daysLeft} days left`}
                        color={daysLeft <= 0 ? 'error' : daysLeft <= 7 ? 'warning' : 'success'}
                        size="small"
                      />
                    ) : '—'}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={data?.length || 0}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10]}
        />
      </TableContainer>
    </Box>
  )
}

function DashboardView() {
  const { data, isLoading } = useQuery({
    queryKey: ['training-dashboard'],
    queryFn: async () => {
      const res = await api.get('/training/dashboard')
      return res.data
    }
  })

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>

  const chartColors = ['#0164C8', '#03C6B1', '#10B981', '#F59E0B', '#EF4444', '#8B7CF6', '#6B8AFD', '#5D6E85']

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4" fontWeight={600} color="primary">{data.overall?.percentage || 0}%</Typography>
            <Typography variant="caption" color="text.secondary">Overall Completion</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4" fontWeight={600} color="primary">{data.totalStaff || 0}</Typography>
            <Typography variant="caption" color="text.secondary">Active Staff</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4" fontWeight={600} color="primary">{data.totalModules || 0}</Typography>
            <Typography variant="caption" color="text.secondary">Training Modules</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4" fontWeight={600} color={data.overall?.completed === data.overall?.total ? 'success.main' : 'warning.main'}>
              {data.overall?.completed || 0}/{data.overall?.total || 0}
            </Typography>
            <Typography variant="caption" color="text.secondary">Completed Records</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Completion by Role</Typography>
            {data.byRole?.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.byRole} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <XAxis dataKey="role" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <ReTooltip formatter={(v: any) => `${v}%`} />
                  <Bar dataKey="percentage" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    {data.byRole.map((_: any, i: number) => (
                      <Cell key={i} fill={chartColors[i % chartColors.length]} />
                    ))}
                    <LabelList dataKey="percentage" position="top" formatter={(v: any) => `${v}%`} style={{ fontSize: 11, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No training records found by role.</Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Completion by Module</Typography>
            {data.byModule?.length > 0 ? (
              <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Module</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                      <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Completed</TableCell>
                      <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.byModule.map((m: any) => (
                      <TableRow key={m.id} hover>
                        <TableCell sx={{ fontSize: 13 }}>{m.name}</TableCell>
                        <TableCell><Chip label={m.category || 'General'} size="small" variant="outlined" /></TableCell>
                        <TableCell sx={{ textAlign: 'right' }}>{m.completed}/{m.total}</TableCell>
                        <TableCell sx={{ textAlign: 'right' }}>
                          <Chip
                            label={`${m.percentage}%`}
                            size="small"
                            color={m.percentage >= 80 ? 'success' : m.percentage >= 50 ? 'warning' : 'error'}
                            sx={{ fontWeight: 600 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No training modules configured.</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
