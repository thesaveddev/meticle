import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { CheckCircle as CheckCircleIcon, DirectionsCar as DirectionsCarIcon, Download as DownloadIcon, ErrorOutline as ErrorOutlineIcon, HomeWork as HomeWorkIcon, Schedule as ScheduleIcon } from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { enqueueHomecareAction, flushHomecareOfflineQueue, getHomecareOfflineQueue, type HomecareOfflineAction } from '../../services/homecare-offline'
import './homecare.css'

const money = (pence: number | null | undefined) => pence == null ? '—' : `£${(Number(pence) / 100).toFixed(2)}`
const dateLabel = (value: string) => new Date(value).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const statusLabel = (status: string) => status.replace(/_/g, ' ')

export default function HomecarePage() {
  const [tab, setTab] = useState(0)
  const [message, setMessage] = useState('')
  const [syncState, setSyncState] = useState<'online' | 'syncing' | 'offline' | 'failed'>(navigator.onLine ? 'online' : 'offline')
  const [queuedActions, setQueuedActions] = useState<HomecareOfflineAction[]>(getHomecareOfflineQueue())
  const [packageDialogOpen, setPackageDialogOpen] = useState(false)
  const [payrollFrom, setPayrollFrom] = useState(new Date().toISOString().slice(0, 8) + '01')
  const [payrollTo, setPayrollTo] = useState(new Date().toISOString().slice(0, 10))
  const [packageForm, setPackageForm] = useState({ person_id: '', name: '', start_date: new Date().toISOString().slice(0, 10), funding_type: 'private', hourly_rate_pence: '', travel_time_paid: true, mileage_rate_pence: '' })
  const qc = useQueryClient()
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } }, [])
  const isManager = user.role === 'ORG_ADMIN' || user.role === 'MANAGER'
  const from = new Date(); from.setHours(0, 0, 0, 0)
  const to = new Date(from); to.setDate(to.getDate() + 2)

  const { data: visits = [], isLoading: visitsLoading } = useQuery({
    queryKey: ['homecare-visits', from.toISOString().slice(0, 10), isManager],
    queryFn: () => api.get(isManager ? '/homecare/visits' : '/homecare/my-visits', { params: { from: from.toISOString(), to: to.toISOString() } }).then(r => Array.isArray(r.data) ? r.data : []),
  })
  const { data: people = [] } = useQuery({
    queryKey: ['homecare-people'],
    queryFn: () => api.get('/people?status=active').then(r => Array.isArray(r.data) ? r.data : (r.data?.people || [])),
    enabled: isManager,
  })
  const { data: packages = [] } = useQuery({
    queryKey: ['homecare-packages'],
    queryFn: () => api.get('/homecare/packages').then(r => Array.isArray(r.data) ? r.data : []),
  })
  const { data: timesheets = [] } = useQuery({
    queryKey: ['homecare-timesheets'],
    queryFn: () => api.get('/homecare/timesheets').then(r => Array.isArray(r.data) ? r.data : []),
    enabled: isManager,
  })
  const { data: exceptions = [] } = useQuery({
    queryKey: ['homecare-exceptions'],
    queryFn: () => api.get('/homecare/exceptions').then(r => Array.isArray(r.data) ? r.data : []),
    enabled: isManager,
  })
  const getLocation = () => new Promise<{ latitude: number; longitude: number; accuracy_meters?: number }>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not available on this device.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy_meters: position.coords.accuracy }),
      () => reject(new Error('Location permission is required to record this visit.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  })
  const syncQueue = async () => {
    if (!navigator.onLine) { setSyncState('offline'); return }
    setSyncState('syncing')
    const result = await flushHomecareOfflineQueue()
    const next = getHomecareOfflineQueue()
    setQueuedActions(next)
    setSyncState(result.failed ? 'failed' : 'online')
    if (result.processed) qc.invalidateQueries({ queryKey: ['homecare-visits'] })
    if (result.failed) setMessage(`${result.failed} offline visit action${result.failed === 1 ? '' : 's'} needs review.`)
  }
  useEffect(() => {
    const online = () => { setSyncState('online'); void syncQueue() }
    const offline = () => setSyncState('offline')
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    void syncQueue()
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline) }
  }, [])
  const execute = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'check-in' | 'check-out' }) => {
      const location = await getLocation()
      if (!navigator.onLine) return { queued: enqueueHomecareAction(id, action, location) }
      return api.post(`/homecare/visits/${id}/${action}`, location)
    },
    onSuccess: (result: any, variables) => { if (result?.queued) { setQueuedActions(getHomecareOfflineQueue()); setSyncState('offline'); setMessage('No connection. Visit action saved on this device and will sync when you are online.') } else { qc.invalidateQueries({ queryKey: ['homecare-visits'] }); setMessage(variables.action === 'check-in' ? 'Visit checked in.' : 'Visit completed and timesheet prepared.') } },
    onError: (e: any) => setMessage(e.response?.data?.message || e.message || 'Could not update this visit.'),
  })
  const createPackage = useMutation({
    mutationFn: (data: any) => api.post('/homecare/packages', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['homecare-packages'] }); setPackageDialogOpen(false); setMessage('Care package created.') },
    onError: (e: any) => setMessage(e.response?.data?.message || 'Could not create the care package.'),
  })
  const approve = useMutation({
    mutationFn: (id: string) => api.patch(`/homecare/timesheets/${id}`, { status: 'approved' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['homecare-timesheets'] }); setMessage('Timesheet approved.') },
    onError: (e: any) => setMessage(e.response?.data?.message || 'Could not approve the timesheet.'),
  })
  const resolveException = useMutation({
    mutationFn: ({ id, exceptionType, note }: { id: string; exceptionType: string; note: string }) => api.post(`/homecare/visits/${id}/resolve-exception`, { exception_type: exceptionType, resolution_note: note || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['homecare-exceptions'] }); setMessage('Exception resolved and retained in the audit trail.') },
    onError: (e: any) => setMessage(e.response?.data?.message || 'Could not resolve the exception.'),
  })
  const exportPayroll = async () => {
    try {
      const response = await api.get('/homecare/payroll/export.csv', { params: { from: payrollFrom, to: payrollTo, provider: 'generic' }, responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `homecare-payroll-${payrollFrom}-${payrollTo}.csv`
      anchor.click()
      URL.revokeObjectURL(url)
      setMessage('Approved payroll inputs downloaded.')
    } catch (e: any) {
      setMessage(e.response?.data?.message || 'Could not export payroll inputs.')
    }
  }

  const todayVisits = visits.filter((v: any) => new Date(v.scheduled_start).toDateString() === new Date().toDateString())
  const pendingTimesheets = timesheets.filter((t: any) => t.status === 'submitted')
  const canCreatePackage = isManager && people.length > 0

  return <Box className="homecare-page">
    <header className="homecare-header">
      <Box><Typography component="h1" className="homecare-title">Domiciliary care</Typography><Typography className="homecare-intro">The next visit, the right carer, and a clean record of time and travel.</Typography></Box>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap"><Chip icon={<HomeWorkIcon />} label={isManager ? `${packages.length} care packages` : `${todayVisits.length} visits today`} className="homecare-chip" />{isManager && <Button size="small" variant="contained" className="homecare-action" onClick={() => setPackageDialogOpen(true)} disabled={!canCreatePackage}>New package</Button>}</Stack>
    </header>
    {message && <Alert severity={message.includes('Could not') || message.includes('needs review') ? 'error' : 'success'} onClose={() => setMessage('')} sx={{ mb: 2 }}>{message}</Alert>}
    <Paper className="homecare-sync" role="status"><Typography variant="body2"><strong>{syncState === 'syncing' ? 'Syncing visit actions…' : syncState === 'offline' ? 'Offline mode' : syncState === 'failed' ? 'Sync needs review' : 'Online'}</strong>{queuedActions.length ? ` · ${queuedActions.length} action${queuedActions.length === 1 ? '' : 's'} queued` : ''}</Typography>{(syncState === 'offline' || syncState === 'failed') && <Button size="small" onClick={() => void syncQueue()} disabled={!navigator.onLine}>Try sync</Button>}</Paper>
    <Tabs value={tab} onChange={(_, value) => setTab(value)} className="homecare-tabs" aria-label="Domiciliary care sections">
      <Tab icon={<ScheduleIcon />} iconPosition="start" label={isManager ? 'Visit board' : 'My visits'} />
      {isManager && <Tab icon={<HomeWorkIcon />} iconPosition="start" label="Care packages" />}
      {isManager && <Tab icon={<CheckCircleIcon />} iconPosition="start" label={`Timesheets${pendingTimesheets.length ? ` · ${pendingTimesheets.length}` : ''}`} />}
      {isManager && <Tab icon={<ErrorOutlineIcon />} iconPosition="start" label={`Exceptions${exceptions.length ? ` · ${exceptions.length}` : ''}`} />}
    </Tabs>
    {tab === 0 && <VisitList visits={visits} loading={visitsLoading} execute={execute} />}
    {tab === 1 && isManager && <PackageList packages={packages} onMessage={setMessage} />}
    {tab === 2 && isManager && <Box><TimesheetList timesheets={timesheets} approve={approve} /><Paper className="homecare-export"><Typography variant="subtitle1">Export approved payroll inputs</Typography><Typography variant="body2" color="text.secondary">Only manager-approved rows are included. This file is an input for payroll review, not a payslip or statutory payroll calculation.</Typography><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mt: 1.5 }}><TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={payrollFrom} onChange={e => setPayrollFrom(e.target.value)} /><TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={payrollTo} onChange={e => setPayrollTo(e.target.value)} /><Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportPayroll} disabled={!payrollFrom || !payrollTo}>Download CSV</Button></Stack></Paper></Box>}
    {tab === 3 && isManager && <ExceptionList exceptions={exceptions} resolve={resolveException} />}
    {tab === 0 && isManager && <OperationsSummary />}
    <Dialog open={packageDialogOpen} onClose={() => setPackageDialogOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Create care package</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <TextField select required label="Client" value={packageForm.person_id} onChange={e => setPackageForm(f => ({ ...f, person_id: e.target.value }))} helperText={!people.length ? 'Add an active client before creating a package.' : undefined}><MenuItem value="">Select client</MenuItem>{people.map((person: any) => <MenuItem key={person.id} value={person.id}>{person.first_name} {person.last_name}</MenuItem>)}</TextField>
        <TextField required label="Package name" value={packageForm.name} onChange={e => setPackageForm(f => ({ ...f, name: e.target.value }))} placeholder="Example: Morning and evening support" />
        <TextField select label="Funding type" value={packageForm.funding_type} onChange={e => setPackageForm(f => ({ ...f, funding_type: e.target.value }))}><MenuItem value="private">Private</MenuItem><MenuItem value="local_authority">Local authority</MenuItem><MenuItem value="nhs">NHS</MenuItem><MenuItem value="other">Other</MenuItem></TextField>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField label="Start date" type="date" InputLabelProps={{ shrink: true }} value={packageForm.start_date} onChange={e => setPackageForm(f => ({ ...f, start_date: e.target.value }))} /><TextField label="Hourly rate (pence)" type="number" inputProps={{ min: 0 }} value={packageForm.hourly_rate_pence} onChange={e => setPackageForm(f => ({ ...f, hourly_rate_pence: e.target.value }))} /></Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField label="Mileage rate (pence/mile)" type="number" inputProps={{ min: 0 }} value={packageForm.mileage_rate_pence} onChange={e => setPackageForm(f => ({ ...f, mileage_rate_pence: e.target.value }))} /><TextField select label="Travel time" value={packageForm.travel_time_paid ? 'paid' : 'unpaid'} onChange={e => setPackageForm(f => ({ ...f, travel_time_paid: e.target.value === 'paid' }))}><MenuItem value="paid">Paid under policy</MenuItem><MenuItem value="unpaid">Not paid under policy</MenuItem></TextField></Stack>
        <Alert severity="info">Rates are organisation policy inputs. Payroll still requires manager review and a payroll-provider or qualified payroll process.</Alert>
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setPackageDialogOpen(false)}>Cancel</Button><Button variant="contained" disabled={!packageForm.person_id || !packageForm.name.trim() || createPackage.isPending} onClick={() => createPackage.mutate({ ...packageForm, hourly_rate_pence: packageForm.hourly_rate_pence === '' ? null : Number(packageForm.hourly_rate_pence), mileage_rate_pence: packageForm.mileage_rate_pence === '' ? null : Number(packageForm.mileage_rate_pence) })}>{createPackage.isPending ? <CircularProgress size={18} /> : 'Create package'}</Button></DialogActions>
    </Dialog>
  </Box>
}

function OperationsSummary() {
  const [availability, setAvailability] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [selectedStaff, setSelectedStaff] = useState('')
  const [day, setDay] = useState('1')
  const [start, setStart] = useState('08:00')
  const [end, setEnd] = useState('18:00')
  const [disruptions, setDisruptions] = useState<any[]>([])
  const [policies, setPolicies] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const load = async () => { const [a, s, d, p] = await Promise.all([api.get('/homecare/availability'), api.get('/homecare/staff'), api.get('/homecare/disruptions?openOnly=true'), api.get('/homecare/mileage-policies')]); setAvailability(a.data || []); setStaff(s.data || []); setDisruptions(d.data || []); setPolicies(p.data || []) }
  useEffect(() => { void load() }, [])
  const saveAvailability = async () => { if (!selectedStaff) return; setSaving(true); try { await api.post('/homecare/availability', { staff_id: selectedStaff, day_of_week: Number(day), start_time: start, end_time: end }); await load() } finally { setSaving(false) } }
  return <Paper className="homecare-ops"><Typography variant="h6">Operations controls</Typography><Typography variant="body2" color="text.secondary">Availability and travel exceptions are manager-owned records. Mileage rates are stored by tax year, vehicle and fuel category; confirm the current approved rate before use.</Typography><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}><TextField select size="small" label="Carer" value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}><MenuItem value="">Select carer</MenuItem>{staff.map(member => <MenuItem key={member.id} value={member.id}>{member.first_name} {member.last_name}</MenuItem>)}</TextField><TextField select size="small" label="Day" value={day} onChange={e => setDay(e.target.value)}>{['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((label, index) => <MenuItem key={label} value={index}>{label}</MenuItem>)}</TextField><TextField size="small" type="time" label="From" InputLabelProps={{ shrink: true }} value={start} onChange={e => setStart(e.target.value)} /><TextField size="small" type="time" label="To" InputLabelProps={{ shrink: true }} value={end} onChange={e => setEnd(e.target.value)} /><Button variant="outlined" onClick={saveAvailability} disabled={saving || !selectedStaff}>Save availability</Button></Stack><Typography variant="subtitle2" sx={{ mt: 2 }}>Recorded availability: {availability.length}</Typography><Typography variant="subtitle2">Open travel disruptions: {disruptions.length}</Typography><Typography variant="subtitle2">Mileage policy rows: {policies.length}</Typography></Paper>
}

function VisitList({ visits, loading, execute }: any) {
  const [disruptionVisit, setDisruptionVisit] = useState<any>(null)
  const [disruption, setDisruption] = useState({ disruption_type: 'traffic', severity: 'medium', delay_minutes: 15, description: '' })
  const [saving, setSaving] = useState(false)
  const reportDisruption = async () => {
    if (!disruptionVisit || !disruption.description.trim()) return
    setSaving(true)
    try {
      await api.post(`/homecare/visits/${disruptionVisit.id}/disruptions`, { ...disruption, delay_minutes: Number(disruption.delay_minutes) })
      setDisruptionVisit(null)
      setDisruption({ disruption_type: 'traffic', severity: 'medium', delay_minutes: 15, description: '' })
    } catch { /* surfaced through the next visit refresh in the shell */ }
    finally { setSaving(false) }
  }
  if (loading) return <Box className="homecare-loading"><CircularProgress /><Typography>Loading your visit plan…</Typography></Box>
  if (!visits.length) return <Paper className="homecare-empty"><Typography variant="h6">No visits assigned in the next two days</Typography><Typography color="text.secondary">When a manager assigns a call, it will appear here with time to travel.</Typography></Paper>
  return <>
    <Stack spacing={1.5}>{visits.map((visit: any) => {
      const open = ['scheduled', 'en_route', 'checked_in'].includes(visit.status)
      const checkedIn = visit.status === 'checked_in'
      return <Paper key={visit.id} className={`homecare-visit homecare-visit--${visit.status}`}>
        <Box className="homecare-visit__time"><Typography className="homecare-visit__date">{dateLabel(visit.scheduled_start)}</Typography><Chip size="small" label={statusLabel(visit.status)} variant="outlined" /></Box>
        <Box className="homecare-visit__main"><Typography className="homecare-visit__name">{visit.label}</Typography><Typography className="homecare-visit__person">{visit.person_name}</Typography><Typography className="homecare-visit__address">{visit.person_address || 'Address recorded in the person profile'}</Typography></Box>
        <Box className="homecare-visit__meta"><Typography><strong>{Math.max(0, Math.round((new Date(visit.scheduled_end).getTime() - new Date(visit.scheduled_start).getTime()) / 60000))} min</strong> scheduled</Typography><Typography><DirectionsCarIcon fontSize="inherit" /> Allow travel before arrival</Typography></Box>
        {open && <Stack spacing={1}><Button className="homecare-action" variant="contained" onClick={() => execute.mutate({ id: visit.id, action: checkedIn ? 'check-out' : 'check-in' })} disabled={execute.isPending}>{execute.isPending ? <CircularProgress size={18} color="inherit" /> : checkedIn ? 'Check out' : 'Check in'}</Button><Button size="small" variant="text" onClick={() => setDisruptionVisit(visit)}>Report travel issue</Button></Stack>}
      </Paper>
    })}</Stack>
    <Dialog open={Boolean(disruptionVisit)} onClose={() => !saving && setDisruptionVisit(null)} fullWidth maxWidth="sm">
      <DialogTitle>Report a travel or safety issue</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <TextField select label="Issue" value={disruption.disruption_type} onChange={e => setDisruption(d => ({ ...d, disruption_type: e.target.value }))}>{['traffic','public_transport','weather','vehicle','client_unavailable','unsafe','other'].map(type => <MenuItem key={type} value={type}>{type.replace('_', ' ')}</MenuItem>)}</TextField>
        <TextField select label="Severity" value={disruption.severity} onChange={e => setDisruption(d => ({ ...d, severity: e.target.value }))}><MenuItem value="low">Low</MenuItem><MenuItem value="medium">Medium</MenuItem><MenuItem value="high">High — contact the office now</MenuItem></TextField>
        <TextField label="Expected delay (minutes)" type="number" inputProps={{ min: 0 }} value={disruption.delay_minutes} onChange={e => setDisruption(d => ({ ...d, delay_minutes: Number(e.target.value) }))} />
        <TextField label="What happened?" multiline minRows={3} required value={disruption.description} onChange={e => setDisruption(d => ({ ...d, description: e.target.value }))} helperText="Use factual details. Do not include unnecessary clinical information." />
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setDisruptionVisit(null)} disabled={saving}>Cancel</Button><Button variant="contained" onClick={reportDisruption} disabled={saving || !disruption.description.trim()}>{saving ? <CircularProgress size={18} /> : 'Report issue'}</Button></DialogActions>
    </Dialog>
  </>
}

function PackageList({ packages, onMessage }: any) {
  const [selectedPackage, setSelectedPackage] = useState<any>(null)
  const [plan, setPlan] = useState({ visit_type: 'routine', label: 'Routine call', days_of_week: [1, 2, 3, 4, 5], start_time: '09:00', duration_minutes: 30, travel_buffer_minutes: 15, default_staff_id: '' })
  const { data: staff = [] } = useQuery({ queryKey: ['homecare-staff'], queryFn: () => api.get('/homecare/staff').then(r => Array.isArray(r.data) ? r.data : []), enabled: true })
  const [range, setRange] = useState({ from: new Date().toISOString().slice(0, 10), to: new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10) })
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const createPlan = async () => {
    if (!selectedPackage || !plan.label.trim()) return
    setSaving(true)
    try {
      const created = await api.post(`/homecare/packages/${selectedPackage.id}/visit-plans`, { ...plan, duration_minutes: Number(plan.duration_minutes), travel_buffer_minutes: Number(plan.travel_buffer_minutes), default_staff_id: plan.default_staff_id || null })
      const generated = await api.post(`/homecare/visit-plans/${created.data.id}/generate`, range)
      onMessage(`Call pattern saved. ${generated.data.generated_count} visit${generated.data.generated_count === 1 ? '' : 's'} generated.`)
      setOpen(false)
    } catch (e: any) { onMessage(e.response?.data?.message || 'Could not create this call pattern.') }
    finally { setSaving(false) }
  }
  if (!packages.length) return <Paper className="homecare-empty"><Typography variant="h6">No care packages yet</Typography><Typography color="text.secondary">Create the first package from the manager workflow once funding, rates, and travel policy are agreed.</Typography></Paper>
  return <><Stack spacing={1.5}>{packages.map((pkg: any) => <Paper key={pkg.id} className="homecare-package"><Box><Typography className="homecare-package__name">{pkg.name}</Typography><Typography color="text.secondary">{pkg.person_name} · {pkg.funding_type.replace('_', ' ')}</Typography></Box><Stack direction="row" spacing={1} flexWrap="wrap"><Chip label={pkg.status} size="small" variant="outlined" /><Chip label={pkg.travel_time_paid ? 'Travel time paid' : 'Travel time policy: unpaid'} size="small" /></Stack><Box className="homecare-package__numbers"><span>Rate <strong>{money(pkg.hourly_rate_pence)}/hr</strong></span><span>Mileage <strong>{money(pkg.mileage_rate_pence)}/mile</strong></span><span>From <strong>{pkg.start_date}</strong></span></Box><Button size="small" variant="outlined" onClick={() => { setSelectedPackage(pkg); setOpen(true) }}>Set up call pattern</Button></Paper>)}</Stack><Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Set up recurring call</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField select label="Call type" value={plan.visit_type} onChange={e => setPlan(p => ({ ...p, visit_type: e.target.value }))}>{['morning','breakfast','lunch','tea','evening','night','routine','medication','custom'].map(type => <MenuItem key={type} value={type}>{type.replace('_', ' ')}</MenuItem>)}</TextField><TextField label="Call label" value={plan.label} onChange={e => setPlan(p => ({ ...p, label: e.target.value }))} /><TextField label="Days (0 Sunday · 6 Saturday)" value={plan.days_of_week.join(', ')} onChange={e => setPlan(p => ({ ...p, days_of_week: e.target.value.split(',').map(v => Number(v.trim())).filter(v => Number.isInteger(v) && v >= 0 && v <= 6) }))} helperText="Example: 1, 2, 3, 4, 5" /><TextField select label="Default carer (optional)" value={plan.default_staff_id} onChange={e => setPlan(p => ({ ...p, default_staff_id: e.target.value }))}><MenuItem value="">Leave unassigned</MenuItem>{staff.map((member: any) => <MenuItem key={member.id} value={member.id}>{member.first_name} {member.last_name}</MenuItem>)}</TextField><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField label="Start" type="time" InputLabelProps={{ shrink: true }} value={plan.start_time} onChange={e => setPlan(p => ({ ...p, start_time: e.target.value }))} /><TextField label="Duration (minutes)" type="number" value={plan.duration_minutes} onChange={e => setPlan(p => ({ ...p, duration_minutes: Number(e.target.value) }))} /><TextField label="Travel buffer" type="number" value={plan.travel_buffer_minutes} onChange={e => setPlan(p => ({ ...p, travel_buffer_minutes: Number(e.target.value) }))} /></Stack><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField label="Generate from" type="date" InputLabelProps={{ shrink: true }} value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} /><TextField label="Generate to" type="date" InputLabelProps={{ shrink: true }} value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} /></Stack><Alert severity="info">Generation is idempotent: running the same range again will not duplicate visits. A default carer must have availability recorded for every generated call.</Alert></Stack></DialogContent><DialogActions><Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button><Button variant="contained" onClick={createPlan} disabled={saving || !plan.label.trim() || !plan.days_of_week.length}>{saving ? <CircularProgress size={18} /> : 'Save and generate'}</Button></DialogActions></Dialog></>
}

function ExceptionList({ exceptions, resolve }: any) {
  if (!exceptions.length) return <Paper className="homecare-empty"><Typography variant="h6">No open exceptions</Typography><Typography color="text.secondary">Late, missed and cancelled calls will appear here for manager follow-up.</Typography></Paper>
  return <Stack spacing={1.5}>{exceptions.map((visit: any) => <Paper key={visit.id} className="homecare-exception"><Box><Typography className="homecare-package__name">{visit.label}</Typography><Typography color="text.secondary">{visit.person_name} · {dateLabel(visit.scheduled_start)}</Typography><Typography className="homecare-exception__detail">{statusLabel(visit.exception_type || visit.status)}{visit.late_reason ? ` · ${visit.late_reason}` : ''}</Typography></Box><Button size="small" variant="outlined" onClick={() => { const note = window.prompt('Resolution note (required for the audit trail):', '') || ''; if (note.trim()) resolve.mutate({ id: visit.id, exceptionType: visit.exception_type || visit.status, note: note.trim() }) }}>Resolve exception</Button></Paper>)}</Stack>
}

function TimesheetList({ timesheets, approve }: any) {
  if (!timesheets.length) return <Paper className="homecare-empty"><Typography variant="h6">No timesheets prepared</Typography><Typography color="text.secondary">Completed visits will create a reviewable payroll input here.</Typography></Paper>
  return <Stack spacing={1.5}>{timesheets.map((sheet: any) => <Paper key={sheet.id} className="homecare-timesheet"><Box><Typography className="homecare-package__name">{sheet.staff_name}</Typography><Typography color="text.secondary">{sheet.person_name} · {sheet.label} · {dateLabel(sheet.scheduled_start)}</Typography></Box><Box className="homecare-timesheet__grid"><span>Work <strong>{sheet.work_minutes}m</strong></span><span>Travel <strong>{sheet.travel_minutes}m</strong></span><span>Paid travel <strong>{sheet.paid_travel_minutes}m</strong></span><span>Mileage <strong>{Number(sheet.mileage_miles || 0).toFixed(1)} mi</strong></span><span>Gross input <strong>{money(sheet.gross_pay_pence)}</strong></span></Box><Stack direction="row" justifyContent="space-between" alignItems="center"><Chip size="small" label={statusLabel(sheet.status)} color={sheet.status === 'approved' ? 'success' : sheet.status === 'submitted' ? 'warning' : 'default'} variant="outlined" />{sheet.status === 'submitted' && <Button size="small" variant="contained" onClick={() => approve.mutate(sheet.id)} disabled={approve.isPending}>Approve for payroll</Button>}</Stack></Paper>)}</Stack>
}
