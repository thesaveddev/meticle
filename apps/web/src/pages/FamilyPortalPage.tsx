import { useState } from 'react'
import {
  Box, Typography, Paper, Stack, Tabs, Tab, Chip, CircularProgress,
  Avatar, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const apiBase = '/api/family-portal'

function apiGet(path: string) {
  return axios.get(path).then(r => r.data)
}

function formatDate(d: string) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return d }
}

export default function FamilyPortalPage() {
  const { token } = useParams()
  const [portalTab, setPortalTab] = useState(0)

  const { data: info, isLoading: infoLoading, error: infoError } = useQuery({
    queryKey: ['family-portal', token],
    queryFn: () => apiGet(`${apiBase}/${token}`),
    enabled: !!token,
    retry: false,
  })

  const { data: careNotes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['family-portal', token, 'care-notes'],
    queryFn: () => apiGet(`${apiBase}/${token}/care-notes`),
    enabled: !!token && !!info,
  })

  const { data: carePlans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['family-portal', token, 'care-plans'],
    queryFn: () => apiGet(`${apiBase}/${token}/care-plans`),
    enabled: !!token && !!info,
  })

  const { data: goals = [], isLoading: goalsLoading } = useQuery({
    queryKey: ['family-portal', token, 'goals'],
    queryFn: () => apiGet(`${apiBase}/${token}/goals`),
    enabled: !!token && !!info,
  })

  const { data: observations = [], isLoading: obsLoading } = useQuery({
    queryKey: ['family-portal', token, 'observations'],
    queryFn: () => apiGet(`${apiBase}/${token}/observations`),
    enabled: !!token && !!info,
  })

  if (infoLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><CircularProgress /></Box>

  if (infoError || !info) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#F9FAFB', p: 4 }}>
      <Paper sx={{ p: 6, textAlign: 'center', maxWidth: 480, borderRadius: 3 }}>
        <Typography variant="h5" fontWeight={800} sx={{ mb: 1 }}>Link Expired or Invalid</Typography>
        <Typography color="#6B7280" sx={{ mb: 3 }}>This portal link is no longer valid. Please contact the care provider for a new invitation.</Typography>
      </Paper>
    </Box>
  )

  const su = info.service_user

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F9FAFB' }}>
      {/* Header */}
      <Box sx={{ bgcolor: '#0F4C81', color: 'white', p: 4, pb: 6 }}>
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
          <Stack direction="row" spacing={3} alignItems="center">
            <Avatar src={su.photo_url || undefined}
              sx={{ width: 72, height: 72, bgcolor: 'rgba(255,255,255,0.2)', fontSize: 28, border: '3px solid rgba(255,255,255,0.3)' }}>
              {su.first_name?.[0]}{su.last_name?.[0]}
            </Avatar>
            <Box>
              <Typography variant="h4" fontWeight={800}>{su.first_name} {su.last_name}</Typography>
              <Stack direction="row" spacing={2} sx={{ mt: 0.5, opacity: 0.85 }}>
                <Typography variant="body2">{info.organization.name}</Typography>
                {su.date_of_birth && <Typography variant="body2">DOB: {formatDate(su.date_of_birth)}</Typography>}
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Chip label="Family Portal" size="small" sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', bgcolor: 'rgba(255,255,255,0.1)' }} variant="outlined" />
                <Chip label={info.relationship} size="small" sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)' }} variant="outlined" />
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ maxWidth: 900, mx: 'auto', mt: -2, px: 2 }}>
        <Paper sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #E5E7EB' }}>
          <Tabs value={portalTab} onChange={(_, v) => setPortalTab(v)} sx={{ px: 2, pt: 1, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}>
            <Tab label="Care Notes" />
            <Tab label="Care Plans" />
            <Tab label="Goals" />
            <Tab label="Health Observations" />
          </Tabs>

          <Box sx={{ p: 3 }}>
            {/* Care Notes */}
            {portalTab === 0 && (
              notesLoading ? <CircularProgress /> :
              careNotes.length === 0 ? <Typography color="#9CA3AF" sx={{ textAlign: 'center', py: 4 }}>No care notes yet</Typography> :
              <TableContainer>
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Shift</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Content</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Staff</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {careNotes.map((n: any) => (
                      <TableRow key={n.id} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(n.note_date)}</TableCell>
                        <TableCell><Chip label={n.shift} size="small" color={n.shift === 'day' ? 'primary' : 'default'} /></TableCell>
                        <TableCell>{n.category}</TableCell>
                        <TableCell sx={{ maxWidth: 350, whiteSpace: 'pre-wrap' }}>{n.content}</TableCell>
                        <TableCell>{n.author_name || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Care Plans */}
            {portalTab === 1 && (
              plansLoading ? <CircularProgress /> :
              carePlans.length === 0 ? <Typography color="#9CA3AF" sx={{ textAlign: 'center', py: 4 }}>No care plans available</Typography> :
              <Stack spacing={2}>
                {carePlans.map((p: any) => (
                  <Paper key={p.id} sx={{ p: 2, borderRadius: 2, border: '1px solid #E5E7EB' }}>
                    <Typography fontWeight={700}>{p.title}</Typography>
                    <Chip label={p.category} size="small" sx={{ mt: 0.5 }} />
                    {p.description && <Typography variant="body2" color="#4B5563" sx={{ mt: 1 }}>{p.description}</Typography>}
                    {p.mobility_level && <Typography variant="caption" color="#6B7280" sx={{ display: 'block', mt: 0.5 }}>Mobility: {p.mobility_level}</Typography>}
                    {p.communication_needs && <Typography variant="caption" color="#6B7280" sx={{ display: 'block' }}>Communication: {p.communication_needs}</Typography>}
                    {p.likes_dislikes && <Typography variant="caption" color="#6B7280" sx={{ display: 'block' }}>Likes/Dislikes: {p.likes_dislikes}</Typography>}
                    {p.review_date && <Typography variant="caption" color="#9CA3AF" sx={{ display: 'block', mt: 0.5 }}>Review: {formatDate(p.review_date)}</Typography>}
                  </Paper>
                ))}
              </Stack>
            )}

            {/* Goals */}
            {portalTab === 2 && (
              goalsLoading ? <CircularProgress /> :
              goals.length === 0 ? <Typography color="#9CA3AF" sx={{ textAlign: 'center', py: 4 }}>No goals set yet</Typography> :
              <TableContainer>
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Goal</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Target Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Progress</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {goals.map((g: any) => (
                      <TableRow key={g.id} hover>
                        <TableCell sx={{ maxWidth: 300 }}>{g.title}</TableCell>
                        <TableCell>{g.target_date ? formatDate(g.target_date) : '—'}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 80, height: 6, bgcolor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                              <Box sx={{ width: `${g.progress || 0}%`, height: '100%', bgcolor: g.progress >= 100 ? '#16A34A' : '#0F4C81', borderRadius: 3 }} />
                            </Box>
                            <Typography variant="caption">{g.progress || 0}%</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell><Chip label={g.status} size="small" color={g.status === 'completed' ? 'success' : g.status === 'active' ? 'primary' : 'default'} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Health Observations */}
            {portalTab === 3 && (
              obsLoading ? <CircularProgress /> :
              observations.length === 0 ? <Typography color="#9CA3AF" sx={{ textAlign: 'center', py: 4 }}>No health observations recorded</Typography> :
              <TableContainer>
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Severity</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Notes</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {observations.map((o: any) => (
                      <TableRow key={o.id} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(o.observation_date)}</TableCell>
                        <TableCell><Chip label={o.category} size="small" /></TableCell>
                        <TableCell><Chip label={o.severity || 'normal'} size="small" color={o.severity === 'severe' ? 'error' : o.severity === 'moderate' ? 'warning' : 'default'} /></TableCell>
                        <TableCell sx={{ maxWidth: 350 }}>{o.notes || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Paper>
      </Box>

      {/* Footer */}
      <Box sx={{ textAlign: 'center', py: 4, color: '#9CA3AF' }}>
        <Typography variant="caption">Powered by CareDesk — Secure Family Portal</Typography>
      </Box>
    </Box>
  )
}
