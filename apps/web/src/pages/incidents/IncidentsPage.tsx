import { useEffect, useState } from 'react'
import { useTheme } from '@mui/material/styles'
import {
  Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, Grid, IconButton, InputLabel, MenuItem, Select, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography, Tooltip, TablePagination,
} from '@mui/material'
import {
  Warning as IncidentIcon,
  FilterList as FilterIcon,
  CheckCircle as ResolveIcon,
  Visibility as ViewIcon,
  Close as CloseIcon,
} from '@mui/icons-material'
import api from '../../services/api'
import { PremiumCard, StatCard, SectionHeader } from '../../components/design/PremiumCard'
import { EmptyState } from '../../components/design/EmptyState'

interface Incident {
  id: string
  title: string
  description: string | null
  severity: string
  status: string
  incident_date: string
  incident_time: string | null
  location: string | null
  category_name: string | null
  category_id: string | null
  reported_by_first: string | null
  reported_by_last: string | null
  is_cqc_reportable: boolean
  is_near_miss: boolean
  is_confidential: boolean
  open_actions: number
  root_cause: string | null
  investigation_notes: string | null
  lessons_learned: string | null
  involved?: { id: string; person_name: string }[]
  actions?: { id: string; title: string; completed_at: string | null; due_date: string | null }[]
}

interface IncidentStats {
  total: number
  open: number
  resolved: number
  high_severity: number
  near_misses: number
}

const severityConfig: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: 'Low', color: '#047857', bg: '#E9F7F0' },
  medium: { label: 'Medium', color: '#D97706', bg: '#FFF5D9' },
  high: { label: 'High', color: '#DC2626', bg: '#FDECEC' },
  critical: { label: 'Critical', color: '#B91C1C', bg: '#FEE2E2' },
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  reported: { label: 'Reported', color: '#6B7280', bg: '#F3F4F6' },
  investigating: { label: 'Investigating', color: '#0F4C81', bg: '#E0F2FE' },
  resolved: { label: 'Resolved', color: '#047857', bg: '#E9F7F0' },
  closed: { label: 'Closed', color: '#6B7280', bg: '#F3F4F6' },
}

function dateLabel(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function IncidentsPage() {
  const theme = useTheme()
  const [loading, setLoading] = useState(true)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [stats, setStats] = useState<IncidentStats | null>(null)
  const [error, setError] = useState('')

  // Filters
  const [statusFilter, setStatusFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [nearMissFilter, setNearMissFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)

  // Detail dialog
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [updating, setUpdating] = useState(false)

  const loadIncidents = async () => {
    try {
      setLoading(true)
      const params: Record<string, string> = {}
      if (statusFilter) params.status = statusFilter
      if (severityFilter) params.severity = severityFilter
      if (nearMissFilter) params.is_near_miss = nearMissFilter
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      params.limit = '200'

      const [incidentsRes, statsRes] = await Promise.all([
        api.get('/incidents', { params }),
        api.get('/incidents/stats'),
      ])
      setIncidents(Array.isArray(incidentsRes.data) ? incidentsRes.data : [])
      setStats(statsRes.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load incidents')
    } finally { setLoading(false) }
  }

  useEffect(() => { loadIncidents() }, [statusFilter, severityFilter, nearMissFilter, dateFrom, dateTo])

  const openDetail = async (incident: Incident) => {
    setDetailLoading(true)
    setSelectedIncident(incident)
    try {
      const res = await api.get(`/incidents/${incident.id}`)
      setSelectedIncident(res.data)
    } catch { /* keep basic data */ }
    finally { setDetailLoading(false) }
  }

  const updateStatus = async (incidentId: string, newStatus: string) => {
    setUpdating(true)
    try {
      await api.patch(`/incidents/${incidentId}`, { status: newStatus })
      setIncidents(prev => prev.map(i => i.id === incidentId ? { ...i, status: newStatus } : i))
      if (selectedIncident?.id === incidentId) {
        setSelectedIncident(prev => prev ? { ...prev, status: newStatus } : null)
      }
      loadIncidents()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update')
    } finally { setUpdating(false) }
  }

  const paged = incidents.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  if (loading && incidents.length === 0) {
    return <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 0.5 }}>
          Incidents
        </Typography>
        <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
          View, investigate, and resolve reported incidents
        </Typography>
      </Box>

      {/* Stats */}
      {stats && (
        <Grid container spacing={2.5} sx={{ mb: 4 }}>
          <Grid item xs={6} sm={4} md={2.4}>
            <StatCard label="Total" value={stats.total} icon={<IncidentIcon />} color="#6B7280" />
          </Grid>
          <Grid item xs={6} sm={4} md={2.4}>
            <StatCard label="Open" value={stats.open} icon={<IncidentIcon />} color="#D97706" />
          </Grid>
          <Grid item xs={6} sm={4} md={2.4}>
            <StatCard label="Resolved" value={stats.resolved} icon={<ResolveIcon />} color="#10B981" />
          </Grid>
          <Grid item xs={6} sm={4} md={2.4}>
            <StatCard label="High Severity" value={stats.high_severity} icon={<IncidentIcon />} color="#DC2626" />
          </Grid>
          <Grid item xs={6} sm={4} md={2.4}>
            <StatCard label="Near Misses" value={stats.near_misses} icon={<IncidentIcon />} color="#7C3AED" />
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <PremiumCard noBorder sx={{ p: 3, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <FilterIcon sx={{ color: theme.palette.text.secondary, fontSize: 20 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Filters</Typography>
          </Stack>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} label="Status" onChange={e => { setStatusFilter(e.target.value); setPage(0) }}>
              <MenuItem value="">All</MenuItem>
              {Object.entries(statusConfig).map(([key, cfg]) => (
                <MenuItem key={key} value={key}>{cfg.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Severity</InputLabel>
            <Select value={severityFilter} label="Severity" onChange={e => { setSeverityFilter(e.target.value); setPage(0) }}>
              <MenuItem value="">All</MenuItem>
              {Object.entries(severityConfig).map(([key, cfg]) => (
                <MenuItem key={key} value={key}>{cfg.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Type</InputLabel>
            <Select value={nearMissFilter} label="Type" onChange={e => { setNearMissFilter(e.target.value); setPage(0) }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="false">Incidents</MenuItem>
              <MenuItem value="true">Near Misses</MenuItem>
            </Select>
          </FormControl>
          <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(0) }} sx={{ minWidth: 150 }} />
          <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(0) }} sx={{ minWidth: 150 }} />
          {(statusFilter || severityFilter || nearMissFilter || dateFrom || dateTo) && (
            <Button size="small" onClick={() => { setStatusFilter(''); setSeverityFilter(''); setNearMissFilter(''); setDateFrom(''); setDateTo(''); setPage(0) }}>
              Clear all
            </Button>
          )}
        </Stack>
      </PremiumCard>

      {/* Incidents table */}
      <PremiumCard noBorder sx={{ p: 0 }}>
        <SectionHeader title="All Incidents" subtitle={`${incidents.length} incident${incidents.length !== 1 ? 's' : ''}`} />
        {error ? (
          <Typography color="error" sx={{ p: 3 }}>{error}</Typography>
        ) : incidents.length === 0 ? (
          <EmptyState
            icon={<IncidentIcon />}
            title="No incidents reported"
            description="No incidents match your current filters, or none have been reported yet."
          />
        ) : (
          <>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Severity</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Reported by</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">View</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paged.map(inc => {
                    const sev = severityConfig[inc.severity] || severityConfig.medium
                    const stat = statusConfig[inc.status] || statusConfig.reported
                    return (
                      <TableRow key={inc.id} hover sx={{ cursor: 'pointer' }} onClick={() => openDetail(inc)}>
                        <TableCell>
                          <Stack direction="row" alignItems="center" gap={1}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{inc.title}</Typography>
                            {inc.is_confidential && <Chip label="Confidential" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#FEF3C7', color: '#92400E' }} />}
                            {inc.is_near_miss && <Chip label="Near miss" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#EDE9FE', color: '#6D28D9' }} />}
                            {inc.is_cqc_reportable && <Chip label="CQC" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#FEE2E2', color: '#DC2626' }} />}
                          </Stack>
                          {inc.description && (
                            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, maxWidth: 300 }} display="block" noWrap>
                              {inc.description}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{dateLabel(inc.incident_date)}</Typography>
                          {inc.incident_time && <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>{inc.incident_time}</Typography>}
                        </TableCell>
                        <TableCell>
                          <Chip label={sev.label} size="small" sx={{ bgcolor: sev.bg, color: sev.color, fontWeight: 600, borderRadius: '8px' }} />
                        </TableCell>
                        <TableCell>
                          <Chip label={stat.label} size="small" sx={{ bgcolor: stat.bg, color: stat.color, fontWeight: 600, borderRadius: '8px' }} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{inc.category_name || '—'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{inc.reported_by_first ? `${inc.reported_by_first} ${inc.reported_by_last || ''}` : '—'}</Typography>
                        </TableCell>
                        <TableCell>
                          {inc.open_actions > 0 ? (
                            <Chip label={`${inc.open_actions} open`} size="small" sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 600, borderRadius: '8px' }} />
                          ) : (
                            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>None</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="View details">
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); openDetail(inc) }}>
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Box>
            <TablePagination
              component="div"
              count={incidents.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(0) }}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </>
        )}
      </PremiumCard>

      {/* Detail dialog */}
      <Dialog open={!!selectedIncident} onClose={() => setSelectedIncident(null)} maxWidth="md" fullWidth>
        {selectedIncident && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Stack direction="row" alignItems="center" gap={1.5}>
                <IncidentIcon sx={{ color: severityConfig[selectedIncident.severity]?.color || '#6B7280' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{selectedIncident.title}</Typography>
              </Stack>
              <IconButton onClick={() => setSelectedIncident(null)} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent dividers>
              {detailLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
              ) : (
                <Stack spacing={3}>
                  {/* Meta row */}
                  <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                    <Chip label={severityConfig[selectedIncident.severity]?.label || selectedIncident.severity}
                      sx={{ bgcolor: severityConfig[selectedIncident.severity]?.bg, color: severityConfig[selectedIncident.severity]?.color, fontWeight: 600 }} />
                    <Chip label={statusConfig[selectedIncident.status]?.label || selectedIncident.status}
                      sx={{ bgcolor: statusConfig[selectedIncident.status]?.bg, color: statusConfig[selectedIncident.status]?.color, fontWeight: 600 }} />
                    {selectedIncident.is_near_miss && <Chip label="Near miss" sx={{ bgcolor: '#EDE9FE', color: '#6D28D9' }} />}
                    {selectedIncident.is_cqc_reportable && <Chip label="CQC reportable" sx={{ bgcolor: '#FEE2E2', color: '#DC2626' }} />}
                    {selectedIncident.is_confidential && <Chip label="Confidential" sx={{ bgcolor: '#FEF3C7', color: '#92400E' }} />}
                  </Stack>

                  {/* Info */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Details</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}><Typography variant="caption" color="text.secondary">Date</Typography><Typography variant="body2">{dateLabel(selectedIncident.incident_date)}{selectedIncident.incident_time ? ` at ${selectedIncident.incident_time}` : ''}</Typography></Grid>
                      <Grid item xs={6}><Typography variant="caption" color="text.secondary">Location</Typography><Typography variant="body2">{selectedIncident.location || '—'}</Typography></Grid>
                      <Grid item xs={6}><Typography variant="caption" color="text.secondary">Category</Typography><Typography variant="body2">{selectedIncident.category_name || '—'}</Typography></Grid>
                      <Grid item xs={6}><Typography variant="caption" color="text.secondary">Reported by</Typography><Typography variant="body2">{selectedIncident.reported_by_first ? `${selectedIncident.reported_by_first} ${selectedIncident.reported_by_last || ''}` : '—'}</Typography></Grid>
                    </Grid>
                  </Box>

                  {selectedIncident.description && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Description</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{selectedIncident.description}</Typography>
                    </Box>
                  )}

                  {selectedIncident.root_cause && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Root Cause</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{selectedIncident.root_cause}</Typography>
                    </Box>
                  )}

                  {selectedIncident.investigation_notes && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Investigation Notes</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{selectedIncident.investigation_notes}</Typography>
                    </Box>
                  )}

                  {selectedIncident.lessons_learned && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Lessons Learned</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{selectedIncident.lessons_learned}</Typography>
                    </Box>
                  )}

                  {/* Involved people */}
                  {selectedIncident.involved && selectedIncident.involved.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Involved People</Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {selectedIncident.involved.map((p: any) => (
                          <Chip key={p.id} label={p.person_name} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {/* Actions */}
                  {selectedIncident.actions && selectedIncident.actions.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Actions ({selectedIncident.actions.filter((a: any) => !a.completed_at).length} open)</Typography>
                      <Stack spacing={1}>
                        {selectedIncident.actions.map((action: any) => (
                          <Stack key={action.id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.5 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: action.completed_at ? '#10B981' : '#D97706', flexShrink: 0 }} />
                            <Typography variant="body2" sx={{ flex: 1, textDecoration: action.completed_at ? 'line-through' : 'none', color: action.completed_at ? 'text.secondary' : 'text.primary' }}>
                              {action.title}
                            </Typography>
                            {action.due_date && !action.completed_at && (
                              <Typography variant="caption" sx={{ color: '#D97706' }}>Due {dateLabel(action.due_date)}</Typography>
                            )}
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              {selectedIncident.status !== 'resolved' && selectedIncident.status !== 'closed' && (
                <>
                  {selectedIncident.status === 'reported' && (
                    <Button variant="outlined" onClick={() => updateStatus(selectedIncident.id, 'investigating')} disabled={updating}>
                      Start Investigation
                    </Button>
                  )}
                  <Button variant="contained" color="success" startIcon={<ResolveIcon />} onClick={() => updateStatus(selectedIncident.id, 'resolved')} disabled={updating}>
                    Resolve
                  </Button>
                  <Button variant="outlined" onClick={() => updateStatus(selectedIncident.id, 'closed')} disabled={updating}>
                    Close
                  </Button>
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  )
}
