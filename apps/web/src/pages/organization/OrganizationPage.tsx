import { useState } from 'react'
import { Box, Typography, Paper, TextField, Button, Stack, List, ListItem, ListItemText, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab, Chip } from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon, Group as GroupIcon, Security as ShieldIcon } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

function getOrgId(): string {
  const userStr = localStorage.getItem('user')
  let user: any = null
  try { user = userStr ? JSON.parse(userStr) : null } catch { user = null }
  return user?.organizationId || ''
}

export default function OrganizationPage() {
  const [tab, setTab] = useState(0)
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 4 }}>Organization</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Details" />
        <Tab label="Locations & Departments" />
        <Tab label="Teams" />
        <Tab label="Branding" />
      </Tabs>
      {tab === 0 && <DetailsView />}
      {tab === 1 && <LocationsView />}
      {tab === 2 && <TeamsView />}
      {tab === 3 && <BrandingView />}
    </Box>
  )
}

function DetailsView() {
  const navigate = useNavigate()
  const orgId = getOrgId()
  const { data: org } = useQuery({
    queryKey: ['organization', orgId],
    queryFn: async () => {
      const response = await api.get(`/organizations/${orgId}`)
      return response.data
    },
    enabled: !!orgId
  })
  const { data: dspt } = useQuery({
    queryKey: ['dspt-status-org'],
    queryFn: async () => {
      const r = await api.get('/dspt/status')
      return r.data
    },
  })
  const DSPT_LABELS: Record<string, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    submitted: 'Submitted',
    standards_met: 'Standards Met',
    standards_exceeded: 'Standards Exceeded',
  }
  const DSPT_COLORS: Record<string, string> = {
    not_started: '#9CA3AF',
    in_progress: '#F59E0B',
    submitted: '#6366F1',
    standards_met: '#16A34A',
    standards_exceeded: '#7C3AED',
  }
  const ds = dspt?.status || 'not_started'
  return (
    <Paper sx={{ p: 4 }}>
      <Typography variant="h6" sx={{ mb: 3 }}>Organization Details</Typography>
      <Stack spacing={3} maxWidth={500}>
        <TextField label="Organization Name" value={org?.name || ''} InputProps={{ readOnly: true }} />
        <TextField label="Status" value={org?.status || ''} InputProps={{ readOnly: true }} />
        <TextField label="Plan" value={org?.plan || ''} InputProps={{ readOnly: true }} />
        <TextField label="Created" value={org?.created_at ? new Date(org.created_at).toLocaleDateString() : ''} InputProps={{ readOnly: true }} />
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>NHS DSPT Certification</Typography>
          <Chip icon={<ShieldIcon />} label={DSPT_LABELS[ds] || 'Not Started'}
            onClick={() => navigate('/compliance/dspt')}
            sx={{ color: DSPT_COLORS[ds] || '#9CA3AF', bgcolor: `${DSPT_COLORS[ds] || '#9CA3AF'}15`, fontWeight: 700, cursor: 'pointer' }} />
        </Box>
      </Stack>
    </Paper>
  )
}

function LocationsView() {
  const queryClient = useQueryClient()
  const orgId = getOrgId()
  const [locationOpen, setLocationOpen] = useState(false)
  const [deptOpen, setDeptOpen] = useState<string | null>(null)
  const { register, handleSubmit, reset } = useForm()

  const { data: locations } = useQuery({
    queryKey: ['locations', orgId],
    queryFn: async () => {
      const response = await api.get(`/organizations/${orgId}/locations`)
      return response.data
    },
    enabled: !!orgId
  })

  const addLocation = useMutation({
    mutationFn: async (data: any) => api.post(`/organizations/${orgId}/locations`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['locations', orgId] }); setLocationOpen(false); reset() }
  })

  const addDept = useMutation({
    mutationFn: async ({ locationId, name }: any) => api.post(`/organizations/${locationId}/departments`, { name }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departments'] }); setDeptOpen(null) }
  })

  const deleteDept = useMutation({
    mutationFn: async (id: string) => api.delete(`/organizations/departments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] })
  })

  const { data: departments } = useQuery({
    queryKey: ['departments', locations?.[0]?.id],
    queryFn: async () => {
      if (!locations?.[0]?.id) return []
      const response = await api.get(`/organizations/${locations[0].id}/departments`)
      return response.data
    },
    enabled: !!locations?.[0]?.id
  })

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h6">Locations</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setLocationOpen(true)}>Add Location</Button>
        </Stack>
        {locations?.length === 0 ? (
          <Typography color="text.secondary">No locations added yet.</Typography>
        ) : (
          <List>
            {locations?.map((loc: any) => (
              <ListItem key={loc.id}>
                <ListItemText primary={loc.name} secondary={loc.address || 'No address'} />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      <Paper sx={{ p: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h6">Departments</Typography>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setDeptOpen('new')}>Add Department</Button>
        </Stack>
        {departments?.length === 0 ? (
          <Typography color="text.secondary">No departments added yet.</Typography>
        ) : (
          <List>
            {departments?.map((dept: any) => (
              <ListItem key={dept.id} secondaryAction={
                <IconButton size="small" onClick={() => deleteDept.mutate(dept.id)}><DeleteIcon /></IconButton>
              }>
                <ListItemText primary={dept.name} />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      <Dialog open={locationOpen} onClose={() => setLocationOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Location</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField label="Location Name" fullWidth {...register('name', { required: true })} />
            <TextField label="Address" fullWidth multiline rows={3} {...register('address')} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLocationOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit((data) => addLocation.mutate(data))} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deptOpen === 'new'} onClose={() => setDeptOpen(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Department</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField label="Department Name" fullWidth {...register('deptName', { required: true })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeptOpen(null)}>Cancel</Button>
          <Button onClick={handleSubmit((data) => {
            const locId = locations?.[0]?.id
            if (locId) addDept.mutate({ locationId: locId, name: data.deptName })
          })} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

function TeamsView() {
  const queryClient = useQueryClient()
  const orgId = getOrgId()
  const [teamOpen, setTeamOpen] = useState(false)
  const [memberOpen, setMemberOpen] = useState<string | null>(null)
  const { register, handleSubmit, reset } = useForm()

  const { data: teams } = useQuery({
    queryKey: ['teams', orgId],
    queryFn: async () => {
      const response = await api.get(`/organizations/${orgId}/teams`)
      return response.data
    },
    enabled: !!orgId
  })

  const addTeam = useMutation({
    mutationFn: async (data: any) => api.post(`/organizations/${orgId}/teams`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['teams', orgId] }); setTeamOpen(false); reset() }
  })

  const deleteTeam = useMutation({
    mutationFn: async (id: string) => api.delete(`/organizations/teams/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams', orgId] })
  })

  const { data: members } = useQuery({
    queryKey: ['teamMembers', memberOpen],
    queryFn: async () => {
      if (!memberOpen) return []
      const response = await api.get(`/organizations/teams/${memberOpen}/members`)
      return response.data
    },
    enabled: !!memberOpen
  })

  const addMember = useMutation({
    mutationFn: async ({ userId }: any) => api.post(`/organizations/teams/${memberOpen}/members`, { userId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teamMembers', memberOpen] })
  })

  const removeMember = useMutation({
    mutationFn: async (userId: string) => api.delete(`/organizations/teams/${memberOpen}/members/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teamMembers', memberOpen] })
  })

  return (
    <Paper sx={{ p: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6">Teams</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setTeamOpen(true)}>Create Team</Button>
      </Stack>
      {teams?.length === 0 ? (
        <Typography color="text.secondary">No teams created yet.</Typography>
      ) : (
        <Stack spacing={2}>
          {teams?.map((team: any) => (
            <Paper key={team.id} variant="outlined" sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography fontWeight={700}>{team.name}</Typography>
                <Typography variant="body2" color="text.secondary">{team.description || 'No description'}</Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <IconButton size="small" onClick={() => setMemberOpen(team.id)}><GroupIcon /></IconButton>
                <IconButton size="small" onClick={() => deleteTeam.mutate(team.id)}><DeleteIcon /></IconButton>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog open={teamOpen} onClose={() => setTeamOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Team</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField label="Team Name" fullWidth {...register('name', { required: true })} />
            <TextField label="Description" fullWidth multiline rows={2} {...register('description')} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTeamOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit((data) => addTeam.mutate(data))} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!memberOpen && memberOpen !== 'new'} onClose={() => setMemberOpen(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Team Members</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            {members?.map((m: any) => (
              <Paper key={m.id} variant="outlined" sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography fontWeight={600}>{m.first_name || m.last_name ? `${m.first_name || ''} ${m.last_name || ''}`.trim() : m.email}</Typography>
                  <Typography variant="caption" color="text.secondary">{m.role}</Typography>
                </Box>
                <IconButton size="small" onClick={() => removeMember.mutate(m.user_id)}><DeleteIcon /></IconButton>
              </Paper>
            ))}
            {members?.length === 0 && <Typography color="text.secondary">No members yet.</Typography>}
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => {
              const userId = prompt('Enter user ID to add:')
              if (userId) addMember.mutate({ userId })
            }}>Add Member</Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMemberOpen(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}

function BrandingView() {
  const queryClient = useQueryClient()
  const orgId = getOrgId()
  const { register, handleSubmit } = useForm()

  const { data: org } = useQuery({
    queryKey: ['organization', orgId],
    queryFn: async () => {
      const response = await api.get(`/organizations/${orgId}`)
      return response.data
    },
    enabled: !!orgId
  })

  const updateBranding = useMutation({
    mutationFn: async (data: any) => api.patch(`/organizations/${orgId}/branding`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
    }
  })

  return (
    <Paper sx={{ p: 4 }}>
      <Typography variant="h6" sx={{ mb: 3 }}>Branding</Typography>
      <Stack spacing={3} maxWidth={500}>
        <TextField label="Logo URL" fullWidth defaultValue={org?.logo_url || ''} {...register('logo_url')} />
        <TextField label="Primary Color" fullWidth defaultValue={org?.primary_color || '#0F4C81'} {...register('primary_color')} />
        <TextField label="Secondary Color" fullWidth defaultValue={org?.secondary_color || '#6B7280'} {...register('secondary_color')} />
        <TextField label="Accent Color" fullWidth defaultValue={org?.accent_color || '#F8FAFC'} {...register('accent_color')} />
        <Box sx={{ display: 'flex', gap: 1 }}>
          {['primary_color', 'secondary_color', 'accent_color'].map(field => (
            <Box key={field} sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: org?.[field] || '#ccc' }} />
          ))}
        </Box>
        <Button variant="contained" onClick={handleSubmit((data) => updateBranding.mutate(data))}>Save Branding</Button>
      </Stack>
    </Paper>
  )
}
