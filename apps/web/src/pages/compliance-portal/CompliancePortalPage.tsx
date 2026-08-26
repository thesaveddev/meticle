import { useState, useEffect } from 'react'
import {
  Box, Typography, Paper, Stack, Chip, Button, Grid, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Collapse, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem,
  FormControl, InputLabel,
} from '@mui/material'
import {
  Shield as ShieldIcon, People as PeopleIcon, Warning as WarningIcon,
  Medication as MedicIcon, Restaurant as FoodIcon, School as TrainIcon,
  Assignment as CompIcon,
  ExpandMore as ExpandIcon, ExpandLess as CollapseIcon,
  Visibility as ViewIcon, Close as CloseIcon, Logout as LogoutIcon,
  Link as LinkIcon, ContentCopy as CopyIcon,
  CheckCircle as CheckIcon, Cancel as CancelIcon, AccessTime as ClockIcon,
  LocalDrink as WaterIcon,
} from '@mui/icons-material'
import api from '../../services/api'



const SEVERITY_COLORS: Record<string, string> = {
  critical: '#DC2626', high: '#F97316', medium: '#EAB308', low: '#22C55E',
}

const STATUS_COLORS: Record<string, string> = {
  complete: '#16A34A', incomplete: '#EF4444', expired: '#9CA3AF',
  pending_review: '#F59E0B', active: '#16A34A', draft: '#6B7280',
  published: '#059669', archived: '#9CA3AF',
}

// ── Portal Login Page ──
export function PortalLoginPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!token) {
      setError('No access token provided. Please request a valid portal link from the care provider.')
      setLoading(false)
      return
    }
    localStorage.setItem('portal_token', token)
    api.get('/compliance-portal/portal/verify')
      .then(() => {
        window.location.href = '/portal/dashboard'
      })
      .catch(err => {
        setError(err.response?.data?.message || 'Invalid or expired access link')
        setLoading(false)
      })
  }, [])

  if (loading) return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F8FAFC' }}>
      <CircularProgress />
    </Box>
  )

  if (error) return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F8FAFC' }}>
      <Paper sx={{ p: 4, maxWidth: 480, textAlign: 'center', borderRadius: 3 }}>
        <WarningIcon sx={{ fontSize: 48, color: '#EF4444', mb: 2 }} />
        <Typography variant="h6" fontWeight={700} gutterBottom>Access Issue</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>{error}</Typography>
        <Button variant="outlined" href="/login">Go to Login</Button>
      </Paper>
    </Box>
  )

  return null
}

// ── Admin: Generate Portal Link ──
export function PortalAccessManager({ orgId: _orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [locations, setLocations] = useState<any[]>([])
  const [form, setForm] = useState({ location_id: '', officer_name: '', email: '', expires_hours: 72 })

  useEffect(() => {
    api.get('/settings/locations').then(r => setLocations(r.data)).catch(() => {})
  }, [])

  const handleCreate = async () => {
    if (!form.location_id || !form.officer_name || !form.email) return
    setLoading(true)
    try {
      const res = await api.post('/compliance-portal/access', form)
      setResult(res.data)
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to create access')
    }
    setLoading(false)
  }

  const copyLink = () => {
    if (result?.portalUrl) {
      navigator.clipboard.writeText(result.portalUrl)
    }
  }

  return (
    <>
      <Button variant="outlined" startIcon={<LinkIcon />} onClick={() => setOpen(true)} sx={{ borderRadius: 2 }}>
        Generate Portal Link
      </Button>

      <Dialog open={open} onClose={() => { setOpen(false); setResult(null) }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinkIcon /> Generate Compliance Portal Access
        </DialogTitle>
        <DialogContent>
          {result ? (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <CheckIcon sx={{ fontSize: 48, color: '#16A34A', mb: 2 }} />
              <Typography variant="h6" fontWeight={700} gutterBottom>Access Link Created</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Share this link with {result.officerName} for access to {result.locationName}.
                <br />Access expires: {new Date(result.expiresAt).toLocaleString('en-GB')}
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, mb: 2, wordBreak: 'break-all', bgcolor: '#F0F9FF' }}>
                <Typography variant="body2" fontFamily="monospace">{result.portalUrl}</Typography>
              </Paper>
              <Button startIcon={<CopyIcon />} variant="contained" onClick={copyLink} sx={{ bgcolor: '#0F4C81' }}>
                Copy Link
              </Button>
            </Box>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <FormControl fullWidth>
                <InputLabel>Location</InputLabel>
                <Select value={form.location_id} label="Location" onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))}>
                  {locations.map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField label="Auditor / Compliance Officer Name" fullWidth value={form.officer_name} onChange={e => setForm(f => ({ ...f, officer_name: e.target.value }))} />
              <TextField label="Auditor Email" fullWidth value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              <FormControl fullWidth>
                <InputLabel>Access Duration</InputLabel>
                <Select value={form.expires_hours} label="Access Duration" onChange={e => setForm(f => ({ ...f, expires_hours: Number(e.target.value) }))}>
                  <MenuItem value={8}>8 hours (1 day)</MenuItem>
                  <MenuItem value={24}>24 hours</MenuItem>
                  <MenuItem value={72}>3 days</MenuItem>
                  <MenuItem value={168}>1 week</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary">
                The auditor will have read-only access to compliance, incidents, medications, people, and nutrition data for the selected location only. They cannot edit any records.
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => { setOpen(false); setResult(null) }}>{result ? 'Done' : 'Cancel'}</Button>
          {!result && <Button variant="contained" onClick={handleCreate} disabled={loading || !form.location_id || !form.officer_name || !form.email} sx={{ bgcolor: '#0F4C81' }}>
            {loading ? <CircularProgress size={20} /> : 'Generate Link'}
          </Button>}
        </DialogActions>
      </Dialog>
    </>
  )
}

// ── Portal Dashboard (location-scoped, read-only) ──
export default function CompliancePortalPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedPerson, setSelectedPerson] = useState<any>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>('overview')
  useEffect(() => {
    const token = localStorage.getItem('portal_token')
    if (!token) {
      window.location.href = '/portal/login'
      return
    }
    api.get('/compliance-portal/portal/dashboard')
      .then(res => {
        setData(res.data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.response?.data?.message || 'Access denied')
        setLoading(false)
      })
  }, [])

  const viewPerson = async (personId: string) => {
    const res = await api.get(`/compliance-portal/portal/person/${personId}`)
    setSelectedPerson(res.data)
  }

  const logout = () => {
    localStorage.removeItem('portal_token')
    window.location.href = '/portal/login'
  }

  if (loading) return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F8FAFC' }}>
      <CircularProgress />
    </Box>
  )

  if (error) return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F8FAFC' }}>
      <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
        <WarningIcon sx={{ fontSize: 48, color: '#EF4444', mb: 2 }} />
        <Typography variant="h6" fontWeight={700}>{error}</Typography>
        <Button onClick={logout} sx={{ mt: 2 }}>Return to Login</Button>
      </Paper>
    </Box>
  )

  const { overallScore, staffCompliance, expiringTraining, openIncidents, people, recordsByStatus, policies, location, nutrition, recentMar } = data || {}
  const totalRecords = (recordsByStatus || []).reduce((s: number, r: any) => s + r.count, 0)
  const completeRecords = (recordsByStatus || []).find((r: any) => r.status === 'complete')?.count || 0

  const toggleSection = (s: string) => setExpandedSection(prev => prev === s ? null : s)

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F8FAFC' }}>
      {/* Header */}
      <Paper elevation={0} sx={{ borderRadius: 0, borderBottom: '1px solid #E5E7EB', bgcolor: '#0F4C81', color: 'white', px: 4, py: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={2} alignItems="center">
            <ShieldIcon sx={{ fontSize: 28 }} />
            <Box>
              <Typography variant="h6" fontWeight={800}>Compliance Portal</Typography>
              {location && <Typography variant="body2" sx={{ opacity: 0.85 }}>{location.name} — Read-Only Audit View</Typography>}
            </Box>
          </Stack>
          <Button color="inherit" startIcon={<LogoutIcon />} onClick={logout} sx={{ textTransform: 'none' }}>
            Exit
          </Button>
        </Stack>
      </Paper>

      <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
        {/* Overview Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2.5, borderRadius: 2, borderLeft: 4, borderLeftColor: overallScore >= 80 ? '#16A34A' : overallScore >= 60 ? '#F59E0B' : '#EF4444' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <CompIcon sx={{ fontSize: 20, color: '#0F4C81' }} />
                <Typography variant="caption" fontWeight={600} color="text.secondary">COMPLIANCE</Typography>
              </Stack>
              <Typography variant="h3" fontWeight={800} sx={{ color: overallScore >= 80 ? '#16A34A' : '#F59E0B' }}>{overallScore}%</Typography>
              <Typography variant="caption" color="text.secondary">{completeRecords} of {totalRecords} records complete</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2.5, borderRadius: 2, borderLeft: 4, borderLeftColor: openIncidents?.length > 0 ? '#EF4444' : '#16A34A' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <WarningIcon sx={{ fontSize: 20, color: '#EF4444' }} />
                <Typography variant="caption" fontWeight={600} color="text.secondary">OPEN INCIDENTS</Typography>
              </Stack>
              <Typography variant="h3" fontWeight={800} sx={{ color: openIncidents?.length > 0 ? '#EF4444' : '#16A34A' }}>
                {openIncidents?.length || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">{people?.length || 0} people at location</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2.5, borderRadius: 2, borderLeft: 4, borderLeftColor: '#F59E0B' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <TrainIcon sx={{ fontSize: 20, color: '#F59E0B' }} />
                <Typography variant="caption" fontWeight={600} color="text.secondary">TRAINING EXPIRING</Typography>
              </Stack>
              <Typography variant="h3" fontWeight={800} color="#F59E0B">{expiringTraining?.length || 0}</Typography>
              <Typography variant="caption" color="text.secondary">within 30 days</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2.5, borderRadius: 2, borderLeft: 4, borderLeftColor: '#3B82F6' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <FoodIcon sx={{ fontSize: 20, color: '#3B82F6' }} />
                <Typography variant="caption" fontWeight={600} color="text.secondary">NUTRITION TODAY</Typography>
              </Stack>
              <Typography variant="h3" fontWeight={800} color="#3B82F6">
                {nutrition?.filter((n: any) => n.meals_today > 0).length || 0}/{nutrition?.length || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">people fed today</Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Location Details */}
        {location && (
          <Paper sx={{ p: 2, mb: 3, borderRadius: 2, border: '1px solid #E5E7EB' }}>
            <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
              <Typography variant="subtitle2" fontWeight={700}>{location.name}</Typography>
              {location.address && <Typography variant="body2" color="text.secondary">{location.address}</Typography>}
              {location.cqc_rating && <Chip label={`CQC: ${location.cqc_rating}`} size="small" sx={{ bgcolor: location.cqc_rating === 'good' ? '#DCFCE7' : '#FEF3C7', color: location.cqc_rating === 'good' ? '#166534' : '#92400E' }} />}
              {location.food_hygiene_rating != null && <Chip label={`FHRS: ${location.food_hygiene_rating}`} size="small" variant="outlined" />}
              {location.service_type && <Chip label={location.service_type.replace(/_/g, ' ')} size="small" variant="outlined" />}
            </Stack>
          </Paper>
        )}

        {/* Collapsible Sections */}
        {[
          { key: 'staff', label: 'Staff Compliance', icon: <CompIcon />, count: staffCompliance?.length },
          { key: 'incidents', label: 'Incidents', icon: <WarningIcon />, count: openIncidents?.length },
          { key: 'training', label: 'Training & Certification', icon: <TrainIcon />, count: expiringTraining?.length },
          { key: 'medication', label: 'Medication (MAR)', icon: <MedicIcon />, count: recentMar?.length },
          { key: 'nutrition', label: 'Nutrition & Dietary', icon: <FoodIcon />, count: nutrition?.length },
          { key: 'people', label: 'People', icon: <PeopleIcon />, count: people?.length },
          { key: 'policies', label: 'Policies', icon: <CompIcon />, count: policies?.length },
        ].map(section => (
          <Paper key={section.key} sx={{ mb: 2, borderRadius: 2, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
            <Box
              onClick={() => toggleSection(section.key)}
              sx={{ p: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', '&:hover': { bgcolor: '#F9FAFB' } }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ color: '#0F4C81' }}>{section.icon}</Box>
                <Typography fontWeight={700}>{section.label}</Typography>
                {section.count != null && <Chip label={section.count} size="small" />}
              </Stack>
              {expandedSection === section.key ? <CollapseIcon /> : <ExpandIcon />}
            </Box>
            <Collapse in={expandedSection === section.key}>
              <Box sx={{ p: 2, borderTop: '1px solid #E5E7EB' }}>
                {section.key === 'staff' && <StaffComplianceTable data={staffCompliance} />}
                {section.key === 'incidents' && <IncidentsList data={openIncidents} />}
                {section.key === 'training' && <TrainingTable data={expiringTraining} />}
                {section.key === 'medication' && <MedicationTable data={recentMar} onView={viewPerson} />}
                {section.key === 'nutrition' && <NutritionAuditTable data={nutrition} />}
                {section.key === 'people' && <PeopleList data={people} onView={viewPerson} />}
                {section.key === 'policies' && <PoliciesTable data={policies} />}
              </Box>
            </Collapse>
          </Paper>
        ))}
      </Box>

      {/* Person Detail Dialog */}
      <PersonDetailDialog person={selectedPerson} onClose={() => setSelectedPerson(null)} />
    </Box>
  )
}

// ── Sub-components ──

function StaffComplianceTable({ data }: { data: any[] }) {
  if (!data?.length) return <Typography color="text.secondary">No staff at this location</Typography>
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Staff Member</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Score</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Complete</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Incomplete</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Expiring (30d)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((s: any) => (
            <TableRow key={s.user_id} hover>
              <TableCell sx={{ fontWeight: 600 }}>{s.name}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 60, height: 6, bgcolor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                    <Box sx={{ width: `${s.score}%`, height: 6, bgcolor: s.score >= 80 ? '#16A34A' : s.score >= 50 ? '#F59E0B' : '#EF4444', borderRadius: 3 }} />
                  </Box>
                  <Typography variant="body2" fontWeight={600}>{s.score}%</Typography>
                </Stack>
              </TableCell>
              <TableCell><Chip label={s.completed} size="small" color="success" variant="outlined" /></TableCell>
              <TableCell><Chip label={s.incomplete} size="small" color={s.incomplete > 0 ? 'error' : 'default'} variant="outlined" /></TableCell>
              <TableCell><Chip label={s.expiring_soon} size="small" color={s.expiring_soon > 0 ? 'warning' : 'default'} variant="outlined" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function IncidentsList({ data }: { data: any[] }) {
  if (!data?.length) return <Typography color="text.secondary" sx={{ py: 2 }}>No open incidents at this location</Typography>
  return (
    <Stack spacing={1}>
      {data.map((i: any) => (
        <Paper key={i.id} variant="outlined" sx={{ p: 1.5, borderLeft: 3, borderLeftColor: SEVERITY_COLORS[i.severity] || '#6B7280' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography fontWeight={600}>{i.title}</Typography>
                <Chip label={i.severity} size="small" sx={{ bgcolor: SEVERITY_COLORS[i.severity] + '20', color: SEVERITY_COLORS[i.severity] }} />
                <Chip label={i.status} size="small" variant="outlined" />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {i.incident_date ? new Date(i.incident_date).toLocaleDateString('en-GB') : ''} {i.reported_by ? `— reported by ${i.reported_by}` : ''}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      ))}
    </Stack>
  )
}

function TrainingTable({ data }: { data: any[] }) {
  if (!data?.length) return <Typography color="text.secondary">No training records expiring soon</Typography>
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Staff</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Module</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Expires</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Days Left</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((t: any) => {
            const daysLeft = Math.ceil((new Date(t.expires_at).getTime() - Date.now()) / 86400000)
            return (
              <TableRow key={t.id} hover>
                <TableCell>{t.staff_name}</TableCell>
                <TableCell>{t.module_name}</TableCell>
                <TableCell>{new Date(t.expires_at).toLocaleDateString('en-GB')}</TableCell>
                <TableCell>
                  <Chip
                    label={`${daysLeft} days`}
                    size="small"
                    color={daysLeft <= 7 ? 'error' : daysLeft <= 14 ? 'warning' : 'info'}
                    icon={daysLeft <= 7 ? <WarningIcon /> : <ClockIcon />}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function MedicationTable({ data, onView }: { data: any[]; onView: (id: string) => void }) {
  if (!data?.length) return <Typography color="text.secondary">No recent MAR records</Typography>
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Person</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Medication</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Scheduled</TableCell>
            <TableCell sx={{ fontWeight: 700 }}></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((m: any) => (
            <TableRow key={m.id} hover>
              <TableCell>{m.person_name}</TableCell>
              <TableCell>{m.medication_name} {m.dosage}{m.unit}</TableCell>
              <TableCell>
                <Chip
                  label={m.status}
                  size="small"
                  color={m.status === 'given' ? 'success' : m.status === 'missed' ? 'error' : m.status === 'refused' ? 'warning' : 'default'}
                />
              </TableCell>
              <TableCell>{new Date(m.scheduled_time).toLocaleString('en-GB')}</TableCell>
              <TableCell>
                <IconButton size="small" onClick={() => onView(m.person_id)}><ViewIcon fontSize="small" /></IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function NutritionAuditTable({ data }: { data: any[] }) {
  if (!data?.length) return <Typography color="text.secondary">No people at this location</Typography>
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Person</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Dietary Type</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Texture</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Meals Today</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Refused</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Fluid</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Appetite</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((p: any) => (
            <TableRow key={p.id} hover>
              <TableCell sx={{ fontWeight: 600 }}>{p.person_name}</TableCell>
              <TableCell>{p.dietary_type || <span style={{ color: '#9CA3AF' }}>—</span>}</TableCell>
              <TableCell>{p.texture_modified || <span style={{ color: '#9CA3AF' }}>—</span>}</TableCell>
              <TableCell><Chip label={p.meals_today} size="small" color={p.meals_today > 0 ? 'success' : 'error'} /></TableCell>
              <TableCell>{p.refused_today > 0 && <Chip label={p.refused_today} size="small" color="error" icon={<CancelIcon />} />}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <WaterIcon sx={{ fontSize: 14, color: '#0284C7' }} />
                  <Typography variant="body2">{p.fluid_today}ml</Typography>
                  {p.fluid_daily_target_ml > 0 && p.fluid_today < p.fluid_daily_target_ml * 0.75 && (
                    <Chip label="Low" size="small" color="warning" sx={{ height: 18 }} />
                  )}
                </Stack>
              </TableCell>
              <TableCell>{p.appetite_level || <span style={{ color: '#9CA3AF' }}>—</span>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function PeopleList({ data, onView }: { data: any[]; onView: (id: string) => void }) {
  if (!data?.length) return <Typography color="text.secondary">No people at this location</Typography>
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Room</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Care Plans</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Active MAR</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Open Incidents</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Dietary</TableCell>
            <TableCell sx={{ fontWeight: 700 }}></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((p: any) => (
            <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => onView(p.id)}>
              <TableCell sx={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</TableCell>
              <TableCell>{p.room_number || '—'}</TableCell>
              <TableCell><Chip label={p.active_care_plans} size="small" variant="outlined" /></TableCell>
              <TableCell><Chip label={p.active_mar} size="small" color={p.active_mar > 0 ? 'success' : 'default'} variant="outlined" /></TableCell>
              <TableCell>
                {p.open_incidents > 0 ? <Chip label={p.open_incidents} size="small" color="error" /> : <Chip label="0" size="small" variant="outlined" />}
              </TableCell>
              <TableCell>
                {p.allergies?.length > 0 && <Chip icon={<WarningIcon sx={{ fontSize: 12 }} />} label={`${p.allergies.length} allergies`} size="small" color="error" variant="outlined" />}
                {p.dietary_requirements && <Chip label={p.dietary_requirements} size="small" variant="outlined" sx={{ ml: p.allergies?.length > 0 ? 0.5 : 0 }} />}
                {!p.dietary_requirements && (!p.allergies || p.allergies.length === 0) && <span style={{ color: '#9CA3AF' }}>—</span>}
              </TableCell>
              <TableCell><IconButton size="small"><ViewIcon fontSize="small" /></IconButton></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function PoliciesTable({ data }: { data: any[] }) {
  if (!data?.length) return <Typography color="text.secondary">No policies found</Typography>
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Policy</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Version</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Review Due</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((p: any) => {
            const isOverdue = p.review_due_at && new Date(p.review_due_at) < new Date()
            return (
              <TableRow key={p.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{p.title}</TableCell>
                <TableCell><Chip label={p.category || 'General'} size="small" variant="outlined" /></TableCell>
                <TableCell>
                  <Chip
                    label={p.status}
                    size="small"
                    sx={{ bgcolor: (STATUS_COLORS[p.status] || '#6B7280') + '20', color: STATUS_COLORS[p.status] || '#6B7280' }}
                  />
                </TableCell>
                <TableCell>{p.version || '—'}</TableCell>
                <TableCell>
                  {p.review_due_at ? (
                    <Chip
                      label={new Date(p.review_due_at).toLocaleDateString('en-GB')}
                      size="small"
                      color={isOverdue ? 'error' : 'default'}
                      variant={isOverdue ? 'filled' : 'outlined'}
                    />
                  ) : '—'}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function PersonDetailDialog({ person, onClose }: { person: any; onClose: () => void }) {
  if (!person) return null
  const { person: p, meals, dietaryProfile, incidents } = person

  return (
    <Dialog open={!!person} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center' }}>
        {p ? `${p.first_name} ${p.last_name}` : 'Person Details'}
        {p?.room_number && <Chip label={`Room ${p.room_number}`} size="small" sx={{ ml: 1 }} />}
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent>
        {p && (
          <Stack spacing={3}>
            {/* Dietary & Nutrition */}
            {dietaryProfile && (
              <Paper variant="outlined" sx={{ p: 2, borderLeft: 3, borderLeftColor: '#059669' }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Dietary Profile</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {dietaryProfile.dietary_type && <Chip label={dietaryProfile.dietary_type} size="small" sx={{ bgcolor: '#ECFDF5', color: '#065F46' }} />}
                  {dietaryProfile.texture_modified && <Chip label={`Texture: ${dietaryProfile.texture_modified}`} size="small" />}
                  {dietaryProfile.vegetarian && <Chip label="Vegetarian" size="small" color="success" variant="outlined" />}
                  {dietaryProfile.vegan && <Chip label="Vegan" size="small" color="success" variant="outlined" />}
                  {dietaryProfile.nut_allergy && <Chip icon={<WarningIcon sx={{ fontSize: 12 }} />} label="Nut Allergy" size="small" color="error" />}
                  {dietaryProfile.appetite_level && <Chip label={`Appetite: ${dietaryProfile.appetite_level}`} size="small" />}
                </Stack>
                {dietaryProfile.food_preferences && <Typography variant="body2" sx={{ mt: 1 }}><strong>Likes:</strong> {dietaryProfile.food_preferences}</Typography>}
                {dietaryProfile.food_dislikes && <Typography variant="body2"><strong>Dislikes:</strong> {dietaryProfile.food_dislikes}</Typography>}
              </Paper>
            )}

            {/* Allergies */}
            {p.allergies?.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2, borderLeft: 3, borderLeftColor: '#DC2626', bgcolor: '#FEF2F2' }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#DC2626', mb: 1 }}>Allergies</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {p.allergies.map((a: string, i: number) => <Chip key={i} label={a} size="small" color="error" />)}
                </Stack>
              </Paper>
            )}

            {/* Recent Meals */}
            {meals?.length > 0 && (
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Recent Meals</Typography>
                <Stack spacing={1}>
                  {meals.slice(0, 10).map((m: any) => (
                    <Paper key={m.id} variant="outlined" sx={{ p: 1.5 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" fontWeight={600}>{m.meal_type}</Typography>
                          {m.meal_time && <Typography variant="caption" color="text.secondary">{m.meal_time.slice(0, 5)}</Typography>}
                          {m.consumed_percent != null && <Chip label={`${m.consumed_percent}%`} size="small" color={m.consumed_percent >= 75 ? 'success' : m.consumed_percent >= 50 ? 'warning' : 'error'} />}
                          {m.refused && <Chip label="Refused" size="small" color="error" />}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">{new Date(m.meal_date).toLocaleDateString('en-GB')}</Typography>
                      </Stack>
                      {m.items?.length > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          {m.items.map((i: any) => i.food_name).join(', ')}
                        </Typography>
                      )}
                    </Paper>
                  ))}
                </Stack>
              </Box>
            )}

            {/* Recent Incidents */}
            {incidents?.length > 0 && (
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Incidents</Typography>
                <Stack spacing={1}>
                  {incidents.map((i: any) => (
                    <Paper key={i.id} variant="outlined" sx={{ p: 1.5, borderLeft: 3, borderLeftColor: SEVERITY_COLORS[i.severity] || '#6B7280' }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" fontWeight={600}>{i.title}</Typography>
                        <Chip label={i.severity} size="small" />
                        <Chip label={i.status} size="small" variant="outlined" />
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  )
}
