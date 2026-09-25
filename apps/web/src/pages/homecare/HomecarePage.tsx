import { useMemo, useState } from 'react'
import { Alert, Box, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, Tab, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { ErrorOutline as ExceptionIcon, HomeWork as PackageIcon, ReceiptLong as PayrollIcon, Schedule as ScheduleIcon } from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import PageContainer from '../../components/design/PageContainer'
import EmptyState from '../../components/design/EmptyState'
import AppButton from '../../components/design/AppButton'
import api from '../../services/api'
import './homecare.css'

const money = (pence: unknown) => pence == null || pence === '' ? '—' : `£${(Number(pence) / 100).toFixed(2)}`
const localDate = (date = new Date()) => {
  const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
const dateLabel = (value: string) => new Date(value).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const WEEK_DAYS = [
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
  { value: 0, short: 'Sun', long: 'Sunday' },
]
const dayLabel = (days: unknown) => (Array.isArray(days) ? days : []).map((d: any) => WEEK_DAYS.find(w => w.value === Number(d))?.short || d).join(' · ') || '—'
const VISIT_TYPES = ['morning', 'breakfast', 'lunch', 'tea', 'evening', 'night', 'routine', 'medication', 'custom']
const VISIT_SIZE = 8

export default function HomecarePage() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState(0)
  const [packageSearch, setPackageSearch] = useState('')
  const [packageStatus, setPackageStatus] = useState('all')
  const [packagePage, setPackagePage] = useState(0)
  const [message, setMessage] = useState('')
  const [newPackage, setNewPackage] = useState<any>(null)
  const [patternPkg, setPatternPkg] = useState<any>(null)
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } }, [])
  const isManager = user.role === 'ORG_ADMIN' || user.role === 'MANAGER'
  const from = new Date(); from.setHours(0, 0, 0, 0)
  const to = new Date(from); to.setDate(to.getDate() + 2)

  const { data: visits = [], isLoading: visitsLoading } = useQuery({
    queryKey: ['homecare-visits', from.toISOString().slice(0, 10), isManager],
    queryFn: () => api.get(isManager ? '/homecare/visits' : '/homecare/my-visits', { params: { from: from.toISOString(), to: to.toISOString() } }).then(r => Array.isArray(r.data) ? r.data : []),
  })
  const { data: packages = [] } = useQuery({ queryKey: ['homecare-packages'], queryFn: () => api.get('/homecare/packages').then(r => Array.isArray(r.data) ? r.data : []) })
  const { data: people = [] } = useQuery({ queryKey: ['homecare-people'], queryFn: () => api.get('/people?status=active').then(r => Array.isArray(r.data) ? r.data : r.data?.people || []), enabled: isManager })
  const { data: billingProfiles = [] } = useQuery({ queryKey: ['homecare-billing-profiles'], queryFn: () => api.get('/homecare/billing-profiles').then(r => Array.isArray(r.data) ? r.data : []), enabled: isManager })
  const { data: payProfiles = [] } = useQuery({ queryKey: ['homecare-pay-profiles'], queryFn: () => api.get('/homecare/pay-profiles').then(r => Array.isArray(r.data) ? r.data : []), enabled: isManager })
  const { data: staff = [] } = useQuery({ queryKey: ['homecare-staff'], queryFn: () => api.get('/homecare/staff').then(r => Array.isArray(r.data) ? r.data : []), enabled: isManager })
  const { data: exceptions = [] } = useQuery({ queryKey: ['homecare-exceptions'], queryFn: () => api.get('/homecare/exceptions').then(r => Array.isArray(r.data) ? r.data : []), enabled: isManager })

  const filteredVisits = params.get('status') ? visits.filter((v: any) => v.status === params.get('status')) : visits
  const filteredPackages = packages.filter((pkg: any) => {
    const q = packageSearch.trim().toLowerCase()
    const matchesText = !q || `${pkg.name || ''} ${pkg.person_name || ''} ${pkg.funding_type || ''}`.toLowerCase().includes(q)
    return matchesText && (packageStatus === 'all' || pkg.status === packageStatus)
  })
  const packageSize = 8
  const packagePages = Math.max(1, Math.ceil(filteredPackages.length / packageSize))
  const visiblePackages = filteredPackages.slice(packagePage * packageSize, (packagePage + 1) * packageSize)

  return <PageContainer><Box className="homecare-page">
    <header className="homecare-header">
      <Box><Typography component="h1" className="homecare-title">Care operations</Typography><Typography className="homecare-intro">Plan client support, organise visits, and keep time, travel and missed calls under control.</Typography></Box>
      {isManager && <Stack direction="row" spacing={1} flexWrap="wrap"><Chip icon={<PackageIcon />} label={`${packages.length} care packages`} className="homecare-chip" /><AppButton variant="secondary" size="small" onClick={() => { window.location.href = '/mileage' }}>Travel &amp; pay rules</AppButton><AppButton variant="secondary" size="small" onClick={() => { window.location.href = '/payroll-timesheets' }} startIcon={<PayrollIcon />}>Payroll &amp; timesheets</AppButton><AppButton size="small" onClick={() => setNewPackage({ person_id: '', name: '', funding_type: 'private', start_date: localDate(), hourly_rate_pence: '', client_rate_pence: '', billing_profile_id: '', pay_profile_id: '' })}>New package</AppButton></Stack>}
    </header>
    {message && <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 2 }}>{message}</Alert>}
    <Tabs value={tab} onChange={(_, value) => setTab(value)} className="homecare-tabs" aria-label="Care operations sections">
      <Tab icon={<ScheduleIcon />} iconPosition="start" label={isManager ? 'Visit board' : 'My visits'} />
      {isManager && <Tab icon={<PackageIcon />} iconPosition="start" label="Care packages" />}
      {isManager && <Tab icon={<ExceptionIcon />} iconPosition="start" label={`Missed calls${exceptions.length ? ` · ${exceptions.length}` : ''}`} />}
    </Tabs>
    {tab === 0 && <VisitBoard visits={filteredVisits} loading={visitsLoading} />}
    {tab === 1 && isManager && <PackageBoard packages={visiblePackages} total={filteredPackages.length} search={packageSearch} status={packageStatus} page={packagePage} pages={packagePages} onSearch={(value: string) => { setPackageSearch(value); setPackagePage(0) }} onStatus={(value: string) => { setPackageStatus(value); setPackagePage(0) }} onPage={setPackagePage} onPattern={(pkg: any) => setPatternPkg(pkg)} />}
    {tab === 2 && isManager && <ExceptionBoard exceptions={exceptions} />}
    <PackageDialog packageDraft={newPackage} people={people} billingProfiles={billingProfiles} payProfiles={payProfiles} onClose={() => setNewPackage(null)} onSaved={() => { setNewPackage(null); setMessage('Care package created.'); window.location.reload() }} />
    <CallPatternDialog pkg={patternPkg} staff={staff} onClose={() => setPatternPkg(null)} />
  </Box></PageContainer>
}

function VisitBoard({ visits, loading }: { visits: any[]; loading: boolean }) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(visits.length / VISIT_SIZE))
  const pageSafe = Math.min(page, pages - 1)
  const visible = visits.slice(pageSafe * VISIT_SIZE, (pageSafe + 1) * VISIT_SIZE)
  if (loading) return <Box className="homecare-loading"><CircularProgress /><Typography color="text.secondary">Loading visits…</Typography></Box>
  if (!visits.length) return <EmptyState title="No visits in this view" description="Assigned calls will appear here with their client, time and carer." />
  return <><Stack spacing={1.5}>{visible.map((visit: any) => <Paper key={visit.id} className="homecare-visit"><Box><Typography className="homecare-visit__date">{dateLabel(visit.scheduled_start)}</Typography><Typography className="homecare-visit__name">{visit.label || visit.visit_type || 'Care visit'}</Typography></Box><Box className="homecare-visit__main"><Typography className="homecare-visit__person">{visit.person_name || 'Client'}</Typography><Typography className="homecare-visit__address">{visit.person_address || 'Address not recorded'}</Typography><Typography className="homecare-visit__carer">{visit.assigned_staff_name || 'Unassigned'}</Typography></Box><Chip label={String(visit.status || 'scheduled').replace(/_/g, ' ')} size="small" variant="outlined" /></Paper>)}</Stack>
    {visits.length > VISIT_SIZE && <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}><Typography variant="caption" color="text.secondary">Showing {pageSafe * VISIT_SIZE + 1}–{Math.min((pageSafe + 1) * VISIT_SIZE, visits.length)} of {visits.length}</Typography><Stack direction="row" spacing={1} alignItems="center"><AppButton variant="quiet" size="small" disabled={pageSafe === 0} onClick={() => setPage(pageSafe - 1)}>Previous</AppButton><Typography variant="body2">Page {pageSafe + 1} of {pages}</Typography><AppButton variant="quiet" size="small" disabled={pageSafe >= pages - 1} onClick={() => setPage(pageSafe + 1)}>Next</AppButton></Stack></Stack>}</>
}

function PackageBoard({ packages, total, search, status, page, pages, onSearch, onStatus, onPage, onPattern }: any) {
  return <><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}><TextField size="small" placeholder="Search client, package or funding" value={search} onChange={e => onSearch(e.target.value)} sx={{ flex: 1 }} /><TextField select size="small" label="Status" value={status} onChange={e => onStatus(e.target.value)} sx={{ minWidth: 160 }}><MenuItem value="all">All statuses</MenuItem>{['draft', 'active', 'paused', 'ended'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField></Stack><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>{total} package{total === 1 ? '' : 's'} · rates can use profiles with package and call-level overrides</Typography><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>{packages.map((pkg: any) => <Paper key={pkg.id} className="homecare-package"><Stack direction="row" justifyContent="space-between" gap={2}><Box><Typography className="homecare-package__name">{pkg.name || 'Care package'}</Typography><Typography color="text.secondary">{pkg.person_name || 'Client not linked'} · {String(pkg.funding_type || 'private').replace('_', ' ')}</Typography></Box><Chip label={pkg.status || 'draft'} size="small" variant="outlined" /></Stack><Box className="homecare-package__numbers"><span>Carer rate<strong>{money(pkg.hourly_rate_pence)}/hr</strong></span><span>Client rate<strong>{money(pkg.client_rate_pence)}/hr</strong></span><span>Starts<strong>{pkg.start_date || '—'}</strong></span></Box><Typography variant="caption" color="text.secondary">Billing: {pkg.billing_profile_name || 'package charge'} · Pay: {pkg.pay_profile_name || 'carer/call override'}</Typography><AppButton variant="secondary" size="small" onClick={() => onPattern(pkg)}>Set up call pattern</AppButton></Paper>)}</Box>{pages > 1 && <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}><Typography variant="caption" color="text.secondary">Showing {page * 8 + 1}–{Math.min((page + 1) * 8, total)} of {total}</Typography><Stack direction="row" spacing={1}><AppButton variant="quiet" size="small" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</AppButton><Typography variant="body2">Page {page + 1} of {pages}</Typography><AppButton variant="quiet" size="small" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Next</AppButton></Stack></Stack>}</>
}

function ExceptionBoard({ exceptions }: { exceptions: any[] }) {
  if (!exceptions.length) return <EmptyState title="No missed calls" description="Missed, late and cancelled calls will appear here for manager follow-up." />
  return <Stack spacing={1.5}>{exceptions.map((item: any) => <Paper key={item.id} className="homecare-exception"><Box><Typography className="homecare-package__name">{item.label || 'Call follow-up'}</Typography><Typography color="text.secondary">{item.person_name || 'Client'} · {dateLabel(item.scheduled_start)}</Typography><Typography className="homecare-exception__detail">{String(item.exception_type || item.status || 'Review').replace(/_/g, ' ')}</Typography></Box><AppButton variant="secondary" size="small">Review</AppButton></Paper>)}</Stack>
}

function CallPatternDialog({ pkg, staff, onClose }: { pkg: any; staff: any[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<any>({ label: '', visit_type: 'routine', days_of_week: [1, 2, 3, 4, 5], start_time: '09:00', duration_minutes: 30, default_staff_id: '' })
  const [genFrom, setGenFrom] = useState(localDate())
  const [genTo, setGenTo] = useState(localDate(new Date(Date.now() + 13 * 86400000)))
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['homecare-visit-plans', pkg?.id],
    queryFn: () => api.get(`/homecare/packages/${pkg.id}/visit-plans`).then(r => Array.isArray(r.data) ? r.data : []),
    enabled: Boolean(pkg),
  })
  const createPlan = useMutation({
    mutationFn: () => api.post(`/homecare/packages/${pkg.id}/visit-plans`, {
      visit_type: draft.visit_type,
      label: String(draft.label).trim(),
      days_of_week: draft.days_of_week.map(Number),
      start_time: draft.start_time,
      duration_minutes: Number(draft.duration_minutes),
      default_staff_id: draft.default_staff_id || null,
    }),
    onSuccess: () => {
      setDraft((d: any) => ({ ...d, label: '' }))
      setNotice({ type: 'success', text: 'Call pattern saved. Use “Create calls” to schedule it.' })
      qc.invalidateQueries({ queryKey: ['homecare-visit-plans', pkg.id] })
    },
    onError: (e: any) => setNotice({ type: 'error', text: e.response?.data?.message || 'Could not save the call pattern.' }),
  })
  const generatePlan = useMutation({
    mutationFn: (planId: string) => api.post(`/homecare/visit-plans/${planId}/generate`, { from: genFrom, to: genTo }),
    onSuccess: (res: any) => {
      const created = Number(res.data?.generated_count ?? 0)
      const skipped = Number(res.data?.skipped_existing ?? 0)
      setNotice({ type: 'success', text: `Created ${created} call${created === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} existing` : ''}.` })
      qc.invalidateQueries({ queryKey: ['homecare-visits'] })
    },
    onError: (e: any) => setNotice({ type: 'error', text: e.response?.data?.message || 'Could not create calls for this pattern.' }),
  })

  const genDays = (new Date(genTo).getTime() - new Date(genFrom).getTime()) / 86400000 + 1
  const rangeInvalid = !genFrom || !genTo || !Number.isFinite(genDays) || genDays < 1 || genDays > 31
  const draftValid = Boolean(String(draft.label).trim()) && draft.days_of_week.length > 0 && Number(draft.duration_minutes) >= 1 && Number(draft.duration_minutes) <= 720

  return <Dialog open={Boolean(pkg)} onClose={onClose} fullWidth maxWidth="md">
    <DialogTitle>Call pattern · {pkg?.name || 'care package'}</DialogTitle>
    <DialogContent>
      {notice && <Alert severity={notice.type} onClose={() => setNotice(null)} sx={{ mb: 2 }}>{notice.text}</Alert>}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>A call pattern is the repeating schedule behind this package: which days it runs, at what time, for how long, and who normally covers it. Save the pattern, then create the calls for a date range.</Typography>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField required label="Pattern name" value={draft.label} onChange={e => setDraft((d: any) => ({ ...d, label: e.target.value }))} sx={{ flex: 1 }} />
          <TextField select label="Call type" value={draft.visit_type} onChange={e => setDraft((d: any) => ({ ...d, visit_type: e.target.value }))} sx={{ minWidth: 160 }}>{VISIT_TYPES.map(v => <MenuItem key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</MenuItem>)}</TextField>
          <TextField type="time" label="Start time" InputLabelProps={{ shrink: true }} value={draft.start_time} onChange={e => setDraft((d: any) => ({ ...d, start_time: e.target.value }))} sx={{ minWidth: 130 }} />
          <TextField type="number" label="Duration (min)" InputLabelProps={{ shrink: true }} value={draft.duration_minutes} onChange={e => setDraft((d: any) => ({ ...d, duration_minutes: e.target.value }))} inputProps={{ min: 1, max: 720 }} sx={{ minWidth: 130 }} />
          <TextField select label="Default carer" value={draft.default_staff_id} onChange={e => setDraft((d: any) => ({ ...d, default_staff_id: e.target.value }))} sx={{ minWidth: 170 }}><MenuItem value="">No default carer</MenuItem>{staff.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</MenuItem>)}</TextField>
        </Stack>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>Repeats on</Typography>
          <ToggleButtonGroup size="small" value={draft.days_of_week} onChange={(_, value: number[]) => value.length > 0 && setDraft((d: any) => ({ ...d, days_of_week: value }))} aria-label="Days this call repeats on">
            {WEEK_DAYS.map(day => <ToggleButton key={day.value} value={day.value} aria-label={day.long}>{day.short}</ToggleButton>)}
          </ToggleButtonGroup>
        </Box>
        <Stack direction="row" justifyContent="flex-end"><AppButton disabled={!draftValid || createPlan.isPending} loading={createPlan.isPending} onClick={() => createPlan.mutate()}>Add pattern</AppButton></Stack>
      </Stack>

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 3, mb: 1 }}>Patterns for this package</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mb: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>Create calls from</Typography>
        <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={genFrom} onChange={e => setGenFrom(e.target.value)} sx={{ minWidth: 150 }} />
        <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={genTo} onChange={e => setGenTo(e.target.value)} sx={{ minWidth: 150 }} />
        <Typography variant="caption" color={rangeInvalid ? 'error.main' : 'text.secondary'}>{rangeInvalid ? 'Pick a range of 1–31 days.' : `${Math.round(genDays)} day${Math.round(genDays) === 1 ? '' : 's'} · up to 31`}</Typography>
      </Stack>
      {plansLoading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={22} /></Box>
        : !plans.length ? <Typography variant="body2" color="text.secondary">No call patterns yet. Add the first one above.</Typography>
        : <Stack spacing={1}>{plans.map((plan: any) => {
            const carer = staff.find((s: any) => s.id === plan.default_staff_id)
            return <Paper key={plan.id} variant="outlined" sx={{ p: 1.5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{plan.label}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {String(plan.visit_type || '').replace(/_/g, ' ')} · {dayLabel(plan.days_of_week)} · {String(plan.start_time).slice(0, 5)} · {plan.duration_minutes} min · {carer ? `${carer.first_name} ${carer.last_name}` : 'No default carer'}
                </Typography>
              </Box>
              <AppButton variant="secondary" size="small" disabled={rangeInvalid} loading={generatePlan.isPending && generatePlan.variables === plan.id} onClick={() => generatePlan.mutate(plan.id)}>Create calls</AppButton>
            </Paper>
          })}</Stack>}
    </DialogContent>
    <DialogActions><AppButton variant="quiet" onClick={onClose}>Close</AppButton></DialogActions>
  </Dialog>
}

function PackageDialog({ packageDraft, people, billingProfiles, payProfiles, onClose, onSaved }: any) {
  const [draft, setDraft] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  if (packageDraft && !draft) setDraft(packageDraft)
  const save = async () => { if (!draft?.person_id || !draft.name.trim()) return; setSaving(true); try { await api.post('/homecare/packages', { ...draft, billing_profile_id: draft.billing_profile_id || null, pay_profile_id: draft.pay_profile_id || null, hourly_rate_pence: draft.hourly_rate_pence === '' ? null : Number(draft.hourly_rate_pence), client_rate_pence: draft.client_rate_pence === '' ? null : Number(draft.client_rate_pence) }); onSaved() } finally { setSaving(false) } }
  return <Dialog open={Boolean(packageDraft)} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>New care package</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField select required label="Client" value={draft?.person_id || ''} onChange={e => setDraft((v: any) => ({ ...v, person_id: e.target.value }))}><MenuItem value="">Select client</MenuItem>{people.map((p: any) => <MenuItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</MenuItem>)}</TextField><TextField required label="Package name" value={draft?.name || ''} onChange={e => setDraft((v: any) => ({ ...v, name: e.target.value }))} /><TextField select label="Funding type" value={draft?.funding_type || 'private'} onChange={e => setDraft((v: any) => ({ ...v, funding_type: e.target.value }))}><MenuItem value="private">Private</MenuItem><MenuItem value="local_authority">Local authority</MenuItem><MenuItem value="nhs">NHS</MenuItem><MenuItem value="other">Other</MenuItem></TextField><TextField type="date" label="Start date" InputLabelProps={{ shrink: true }} value={draft?.start_date || ''} onChange={e => setDraft((v: any) => ({ ...v, start_date: e.target.value }))} /><TextField select label="Billing profile" value={draft?.billing_profile_id || ''} onChange={e => setDraft((v: any) => ({ ...v, billing_profile_id: e.target.value }))}><MenuItem value="">No billing profile</MenuItem>{billingProfiles.map((p: any) => <MenuItem key={p.id} value={p.id}>{p.name} · {money(p.client_rate_pence)}/hr</MenuItem>)}</TextField><TextField label="Custom client charge (pence/hr)" type="number" value={draft?.client_rate_pence || ''} onChange={e => setDraft((v: any) => ({ ...v, client_rate_pence: e.target.value }))} helperText="Optional package override." /><TextField select label="Carer pay profile" value={draft?.pay_profile_id || ''} onChange={e => setDraft((v: any) => ({ ...v, pay_profile_id: e.target.value }))}><MenuItem value="">No pay profile</MenuItem>{payProfiles.map((p: any) => <MenuItem key={p.id} value={p.id}>{p.name} · {money(p.hourly_rate_pence)}/hr</MenuItem>)}</TextField><TextField label="Package carer rate (pence/hr)" type="number" value={draft?.hourly_rate_pence || ''} onChange={e => setDraft((v: any) => ({ ...v, hourly_rate_pence: e.target.value }))} helperText="A call-level pay rate can override this." /></Stack></DialogContent><DialogActions><AppButton variant="quiet" onClick={onClose}>Cancel</AppButton><AppButton onClick={save} loading={saving} disabled={saving || !draft?.person_id || !draft?.name?.trim()}>Create package</AppButton></DialogActions></Dialog>
}
