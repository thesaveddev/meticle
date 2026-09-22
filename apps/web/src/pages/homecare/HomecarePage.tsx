import { useMemo, useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { ErrorOutline as ExceptionIcon, HomeWork as PackageIcon, ReceiptLong as PayrollIcon, Schedule as ScheduleIcon } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import PageContainer from '../../components/design/PageContainer'
import EmptyState from '../../components/design/EmptyState'
import api from '../../services/api'
import './homecare.css'

const money = (pence: unknown) => pence == null || pence === '' ? '—' : `£${(Number(pence) / 100).toFixed(2)}`
const localDate = (date = new Date()) => {
  const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
const dateLabel = (value: string) => new Date(value).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function HomecarePage() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState(0)
  const [packageSearch, setPackageSearch] = useState('')
  const [packageStatus, setPackageStatus] = useState('all')
  const [packagePage, setPackagePage] = useState(0)
  const [message, setMessage] = useState('')
  const [newPackage, setNewPackage] = useState<any>(null)
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
      <Box><Typography component="h1" className="homecare-title">Care operations</Typography><Typography className="homecare-intro">Plan client support, organise visits, and keep time, travel and exceptions under control.</Typography></Box>
      {isManager && <Stack direction="row" spacing={1} flexWrap="wrap"><Chip icon={<PackageIcon />} label={`${packages.length} care packages`} className="homecare-chip" /><Button size="small" variant="outlined" onClick={() => { window.location.href = '/mileage' }}>Travel & pay rules</Button><Button size="small" variant="outlined" onClick={() => { window.location.href = '/payroll-timesheets' }} startIcon={<PayrollIcon />}>Payroll & timesheets</Button><Button size="small" variant="contained" onClick={() => setNewPackage({ person_id: '', name: '', funding_type: 'private', start_date: localDate(), hourly_rate_pence: '', client_rate_pence: '', billing_profile_id: '', pay_profile_id: '' })}>New package</Button></Stack>}
    </header>
    {message && <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 2 }}>{message}</Alert>}
    <Tabs value={tab} onChange={(_, value) => setTab(value)} className="homecare-tabs" aria-label="Care operations sections">
      <Tab icon={<ScheduleIcon />} iconPosition="start" label={isManager ? 'Visit board' : 'My visits'} />
      {isManager && <Tab icon={<PackageIcon />} iconPosition="start" label="Care packages" />}
      {isManager && <Tab icon={<ExceptionIcon />} iconPosition="start" label={`Exceptions${exceptions.length ? ` · ${exceptions.length}` : ''}`} />}
    </Tabs>
    {tab === 0 && <VisitBoard visits={filteredVisits} loading={visitsLoading} />}
    {tab === 1 && isManager && <PackageBoard packages={visiblePackages} total={filteredPackages.length} search={packageSearch} status={packageStatus} page={packagePage} pages={packagePages} onSearch={(value: string) => { setPackageSearch(value); setPackagePage(0) }} onStatus={(value: string) => { setPackageStatus(value); setPackagePage(0) }} onPage={setPackagePage} onPattern={() => setMessage('Call patterns are managed from Call Scheduling.')} />}
    {tab === 2 && isManager && <ExceptionBoard exceptions={exceptions} />}
    <PackageDialog packageDraft={newPackage} people={people} billingProfiles={billingProfiles} payProfiles={payProfiles} onClose={() => setNewPackage(null)} onSaved={() => { setNewPackage(null); setMessage('Care package created.'); window.location.reload() }} />
  </Box></PageContainer>
}

function VisitBoard({ visits, loading }: { visits: any[]; loading: boolean }) {
  if (loading) return <Box className="homecare-loading"><CircularProgress /><Typography color="text.secondary">Loading visits…</Typography></Box>
  if (!visits.length) return <EmptyState title="No visits in this view" description="Assigned calls will appear here with their client, time and carer." />
  return <Stack spacing={1.5}>{visits.map((visit: any) => <Paper key={visit.id} className="homecare-visit"><Box><Typography className="homecare-visit__date">{dateLabel(visit.scheduled_start)}</Typography><Typography className="homecare-visit__name">{visit.label || visit.visit_type || 'Care visit'}</Typography></Box><Box className="homecare-visit__main"><Typography className="homecare-visit__person">{visit.person_name || 'Client'}</Typography><Typography className="homecare-visit__address">{visit.person_address || 'Address not recorded'}</Typography><Typography className="homecare-visit__carer">{visit.assigned_staff_name || 'Unassigned'}</Typography></Box><Chip label={String(visit.status || 'scheduled').replace(/_/g, ' ')} size="small" variant="outlined" /></Paper>)}</Stack>
}

function PackageBoard({ packages, total, search, status, page, pages, onSearch, onStatus, onPage, onPattern }: any) {
  return <><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}><TextField size="small" placeholder="Search client, package or funding" value={search} onChange={e => onSearch(e.target.value)} sx={{ flex: 1 }} /><TextField select size="small" label="Status" value={status} onChange={e => onStatus(e.target.value)} sx={{ minWidth: 160 }}><MenuItem value="all">All statuses</MenuItem>{['draft', 'active', 'paused', 'ended'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField></Stack><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>{total} package{total === 1 ? '' : 's'} · rates can use profiles with package and call-level overrides</Typography><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>{packages.map((pkg: any) => <Paper key={pkg.id} className="homecare-package"><Stack direction="row" justifyContent="space-between" gap={2}><Box><Typography className="homecare-package__name">{pkg.name || 'Care package'}</Typography><Typography color="text.secondary">{pkg.person_name || 'Client not linked'} · {String(pkg.funding_type || 'private').replace('_', ' ')}</Typography></Box><Chip label={pkg.status || 'draft'} size="small" variant="outlined" /></Stack><Box className="homecare-package__numbers"><span>Carer rate<strong>{money(pkg.hourly_rate_pence)}/hr</strong></span><span>Client rate<strong>{money(pkg.client_rate_pence)}/hr</strong></span><span>Starts<strong>{pkg.start_date || '—'}</strong></span></Box><Typography variant="caption" color="text.secondary">Billing: {pkg.billing_profile_name || 'package charge'} · Pay: {pkg.pay_profile_name || 'carer/call override'}</Typography><Button size="small" variant="outlined" onClick={onPattern}>Set up call pattern</Button></Paper>)}</Box>{pages > 1 && <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}><Typography variant="caption" color="text.secondary">Showing {page * 8 + 1}–{Math.min((page + 1) * 8, total)} of {total}</Typography><Stack direction="row" spacing={1}><Button size="small" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</Button><Typography variant="body2">Page {page + 1} of {pages}</Typography><Button size="small" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Next</Button></Stack></Stack>}</>
}

function ExceptionBoard({ exceptions }: { exceptions: any[] }) {
  if (!exceptions.length) return <EmptyState title="No open exceptions" description="Late, missed and cancelled calls will appear here for manager follow-up." />
  return <Stack spacing={1.5}>{exceptions.map((item: any) => <Paper key={item.id} className="homecare-exception"><Box><Typography className="homecare-package__name">{item.label || 'Visit exception'}</Typography><Typography color="text.secondary">{item.person_name || 'Client'} · {dateLabel(item.scheduled_start)}</Typography><Typography className="homecare-exception__detail">{String(item.exception_type || item.status || 'Review').replace(/_/g, ' ')}</Typography></Box><Button size="small" variant="outlined">Review</Button></Paper>)}</Stack>
}

function PackageDialog({ packageDraft, people, billingProfiles, payProfiles, onClose, onSaved }: any) {
  const [draft, setDraft] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  if (packageDraft && !draft) setDraft(packageDraft)
  const save = async () => { if (!draft?.person_id || !draft.name.trim()) return; setSaving(true); try { await api.post('/homecare/packages', { ...draft, billing_profile_id: draft.billing_profile_id || null, pay_profile_id: draft.pay_profile_id || null, hourly_rate_pence: draft.hourly_rate_pence === '' ? null : Number(draft.hourly_rate_pence), client_rate_pence: draft.client_rate_pence === '' ? null : Number(draft.client_rate_pence) }); onSaved() } finally { setSaving(false) } }
  return <Dialog open={Boolean(packageDraft)} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>New care package</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField select required label="Client" value={draft?.person_id || ''} onChange={e => setDraft((v: any) => ({ ...v, person_id: e.target.value }))}><MenuItem value="">Select client</MenuItem>{people.map((p: any) => <MenuItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</MenuItem>)}</TextField><TextField required label="Package name" value={draft?.name || ''} onChange={e => setDraft((v: any) => ({ ...v, name: e.target.value }))} /><TextField select label="Funding type" value={draft?.funding_type || 'private'} onChange={e => setDraft((v: any) => ({ ...v, funding_type: e.target.value }))}><MenuItem value="private">Private</MenuItem><MenuItem value="local_authority">Local authority</MenuItem><MenuItem value="nhs">NHS</MenuItem><MenuItem value="other">Other</MenuItem></TextField><TextField type="date" label="Start date" InputLabelProps={{ shrink: true }} value={draft?.start_date || ''} onChange={e => setDraft((v: any) => ({ ...v, start_date: e.target.value }))} /><TextField select label="Billing profile" value={draft?.billing_profile_id || ''} onChange={e => setDraft((v: any) => ({ ...v, billing_profile_id: e.target.value }))}><MenuItem value="">No billing profile</MenuItem>{billingProfiles.map((p: any) => <MenuItem key={p.id} value={p.id}>{p.name} · {money(p.client_rate_pence)}/hr</MenuItem>)}</TextField><TextField label="Custom client charge (pence/hr)" type="number" value={draft?.client_rate_pence || ''} onChange={e => setDraft((v: any) => ({ ...v, client_rate_pence: e.target.value }))} helperText="Optional package override." /><TextField select label="Carer pay profile" value={draft?.pay_profile_id || ''} onChange={e => setDraft((v: any) => ({ ...v, pay_profile_id: e.target.value }))}><MenuItem value="">No pay profile</MenuItem>{payProfiles.map((p: any) => <MenuItem key={p.id} value={p.id}>{p.name} · {money(p.hourly_rate_pence)}/hr</MenuItem>)}</TextField><TextField label="Package carer rate (pence/hr)" type="number" value={draft?.hourly_rate_pence || ''} onChange={e => setDraft((v: any) => ({ ...v, hourly_rate_pence: e.target.value }))} helperText="A call-level pay rate can override this." /></Stack></DialogContent><DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={save} disabled={saving || !draft?.person_id || !draft?.name?.trim()}>{saving ? <CircularProgress size={18} /> : 'Create package'}</Button></DialogActions></Dialog>
}
