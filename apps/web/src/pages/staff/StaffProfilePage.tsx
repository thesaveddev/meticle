import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Paper, Stack, Chip, CircularProgress,
  Button, LinearProgress, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow,
  TextField, Grid, Avatar, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, TablePagination, Autocomplete,
  FormControl, Select, MenuItem, InputLabel, IconButton,
} from '@mui/material'
import { ArrowBack as ArrowBackIcon, Edit as EditIcon, Save as SaveIcon, UploadFile as UploadFileIcon, Link as LinkIcon, Close as CloseIcon, Add as AddIcon } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { fetchUserPermissions, updateUserPermissions, MODULE_LABELS, LEVEL_LABELS } from '../../utils/permissions'

const ROLE_LABEL: Record<string, string> = {
  ORG_ADMIN: 'Org Admin',
  MANAGER: 'Manager',
  CARE_WORKER: 'Care Worker',
  COMPLIANCE_OFFICER: 'Compliance',
}

const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'agency', label: 'Agency' },
  { value: 'bank', label: 'Bank' },
  { value: 'relief', label: 'Relief' },
]

export default function StaffProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)

  const userStr = localStorage.getItem('user')
  let currentUser: any = {}
  try { currentUser = userStr ? JSON.parse(userStr) : {} } catch { currentUser = {} }
  const canEdit = currentUser.role === 'ORG_ADMIN' || currentUser.role === 'MANAGER'

  const { data: memberData, isLoading: memberLoading } = useQuery({
    queryKey: ['org-member', userId],
    queryFn: async () => {
      const res = await api.get('/staff/org-members')
      const all = [res.data.admin, ...res.data.staff].filter(Boolean)
      return all.find((m: any) => m.id === userId)
    },
  })

  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useQuery({
    queryKey: ['staff-profile', userId],
    queryFn: async () => {
      const res = await api.get(`/staff/${userId}`)
      return res.data
    },
    enabled: !!userId,
  })

  const { data: complianceData, isLoading: complianceLoading } = useQuery({
    queryKey: ['staff-compliance', userId],
    queryFn: async () => {
      const res = await api.get(`/staff/${userId}/compliance`)
      return res.data
    },
    enabled: !!userId,
  })

  const { data: competencyRecords } = useQuery({
    queryKey: ['competency-staff', userId, memberData?.staff_id],
    queryFn: async () => {
      const staffId = memberData?.staff_id || userId
      const res = await api.get(`/competency/assessments?staffId=${staffId}`)
      return res.data
    },
    enabled: !!userId && !!memberData,
  })

  const { data: competencyTemplates } = useQuery({
    queryKey: ['competency-templates'],
    queryFn: async () => {
      const res = await api.get('/competency/templates')
      return res.data
    }
  })

  const [compPage, setCompPage] = useState(0)
  const [compRowsPerPage] = useState(10)
  const [assessOpen, setAssessOpen] = useState(false)
  const [assessForm, setAssessForm] = useState({ template_id: '', passed: true, assessed_at: new Date().toISOString().split('T')[0], reassessment_date: '', assessor_id: '', involved_parties: '', notes: '' })
  const [assessError, setAssessError] = useState('')

  const assessMutation = useMutation({
    mutationFn: async () => {
      const staffId = memberData?.staff_id || userId
      await api.post('/competency/assessments', {
        template_id: assessForm.template_id,
        staff_id: staffId,
        passed: assessForm.passed,
        assessed_at: assessForm.assessed_at,
        reassessment_date: assessForm.reassessment_date || undefined,
        assessor_id: assessForm.assessor_id || undefined,
        involved_parties: assessForm.involved_parties || undefined,
        notes: assessForm.notes
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competency-staff'] })
      queryClient.invalidateQueries({ queryKey: ['competency-pending'] })
      setAssessOpen(false)
      setAssessForm({ template_id: '', passed: true, assessed_at: new Date().toISOString().split('T')[0], reassessment_date: '', assessor_id: '', involved_parties: '', notes: '' })
      setAssessError('')
    },
    onError: (err: any) => {
      setAssessError(err.response?.data?.message || err.message || 'Failed to save assessment')
    }
  })

  const { data: orgMembers } = useQuery({
    queryKey: ['org-members-full'],
    queryFn: async () => {
      const res = await api.get('/staff/org-members')
      return res.data as any
    }
  })
  const members: any[] = [
    ...(orgMembers?.admins?.length ? orgMembers.admins : (orgMembers?.admin ? [orgMembers.admin] : [])),
    ...(orgMembers?.staff || [])
  ].filter((m: any) => m.status === 'active')

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await api.get('/leave/locations')
      return res.data
    },
    enabled: canEdit,
  })

  const [editFields, setEditFields] = useState<any>({})
  const [editError, setEditError] = useState('')
  const [editReqOpen, setEditReqOpen] = useState(false)
  const [editingRequirement, setEditingRequirement] = useState<any>(null)
  const [permData, setPermData] = useState<Array<{ module: string; permission_level: string }>>([])
  const permDataRef = useRef(permData)
  useEffect(() => { permDataRef.current = permData }, [permData])
  const [permDirty, setPermDirty] = useState(false)
  const [permSaved, setPermSaved] = useState(false)

  const { data: permissionsData, isLoading: permLoading } = useQuery({
    queryKey: ['user-permissions', userId],
    queryFn: () => fetchUserPermissions(userId!),
    enabled: !!userId && canEdit,
  })

  useEffect(() => {
    if (permissionsData) {
      setPermData(permissionsData.permissions)
    }
  }, [permissionsData])

  const permSaveMutation = useMutation({
    mutationFn: () => updateUserPermissions(userId!, permDataRef.current),
    onSuccess: () => {
      setPermDirty(false)
      setPermSaved(true)
      setTimeout(() => setPermSaved(false), 3000)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/staff/${userId}/profile`, data),
    onSuccess: () => {
      refetchProfile()
      setSaved(true)
      setEditError('')
      setTimeout(() => setSaved(false), 3000)
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to save profile.'
      setEditError(msg)
    },
  })

  const handleSave = () => {
    updateMutation.mutate(editFields)
    setEditing(false)
  }

  const startEditing = () => {
    setEditFields({
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      phone: profile?.phone || '',
      address: profile?.address || '',
      city: profile?.city || '',
      country: profile?.country || '',
      postal_code: profile?.postal_code || '',
      birth_date: profile?.birth_date || '',
      location_id: profile?.location_id || '',
      employment_type: profile?.employment_type || 'full_time',
      contracted_hours_weekly: profile?.contracted_hours_weekly || 37.5,
      max_hours_weekly: profile?.max_hours_weekly || '',
    })
    setEditing(true)
  }

  const loading = memberLoading || complianceLoading || profileLoading

  if (loading) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!memberData && !complianceData) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/staff')} sx={{ mb: 2 }}>Back to Staff Directory</Button>
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography color="#9CA3AF">Staff member not found.</Typography>
        </Paper>
      </Box>
    )
  }

  const m = memberData || {}
  const c = complianceData || { compliance_rate: 0, total_requirements: 0, completed: 0, requirements: [] }
  const complianceColor = c.compliance_rate >= 80 ? '#16A34A' : c.compliance_rate >= 50 ? '#D97706' : '#DC2626'

  const handleFieldChange = (field: string, value: string) => {
    setEditFields((prev: any) => ({ ...prev, [field]: value }))
  }

  const handleEditRequirement = (req: any) => {
    setEditingRequirement(req)
    setEditReqOpen(true)
  }

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/staff')} sx={{ mb: 3, color: '#0F4C81', fontWeight: 600 }}>
        Back to Staff Directory
      </Button>

      <Paper sx={{ p: 4, mb: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar
                src={profile?.profile_picture_url || ''}
                sx={{ width: 56, height: 56, bgcolor: '#0F4C81', fontSize: '1.5rem' }}
              >
                {(profile?.first_name?.[0] || m.email?.[0] || '?').toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
                  {profile?.first_name || m.first_name || ''} {profile?.last_name || m.last_name || ''}
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="body2" color="#6B7280">{m.email}</Typography>
                  <Chip
                    label={ROLE_LABEL[m.role] || m.role || '—'}
                    size="small"
                    color={m.role === 'ORG_ADMIN' ? 'primary' : 'default'}
                  />
                </Stack>
              </Box>
            </Stack>
          </Box>
          <Stack direction="row" spacing={3} alignItems="center">
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="h4" sx={{ fontWeight: 900, color: complianceColor, lineHeight: 1.2 }}>{c.compliance_rate}%</Typography>
              <Typography variant="caption" color="#6B7280">Compliance</Typography>
              <Box sx={{ width: 100, mt: 0.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={c.compliance_rate}
                  sx={{ height: 6, borderRadius: 3, bgcolor: '#F1F5F9', '& .MuiLinearProgress-bar': { bgcolor: complianceColor } }}
                />
              </Box>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="h4" sx={{ fontWeight: 900, color: '#0F4C81', lineHeight: 1.2 }}>{c.completed}/{c.total_requirements}</Typography>
              <Typography variant="caption" color="#6B7280">Requirements Met</Typography>
            </Box>
            {canEdit && !editing && (
              <Button variant="outlined" startIcon={<EditIcon />} onClick={startEditing}>
                Edit Profile
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {saved && <Alert severity="success" sx={{ mb: 2 }}>Profile updated successfully.</Alert>}
      {editError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setEditError('')}>{editError}</Alert>}

      {editing ? (
        <Paper sx={{ p: 4, mb: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>Edit Profile</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField label="First Name" fullWidth size="small" value={editFields.first_name} onChange={(e) => handleFieldChange('first_name', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Last Name" fullWidth size="small" value={editFields.last_name} onChange={(e) => handleFieldChange('last_name', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Phone" fullWidth size="small" value={editFields.phone} onChange={(e) => handleFieldChange('phone', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Date of Birth" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} value={editFields.birth_date || ''} onChange={(e) => handleFieldChange('birth_date', e.target.value)} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Address" fullWidth size="small" value={editFields.address} onChange={(e) => handleFieldChange('address', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="City" fullWidth size="small" value={editFields.city} onChange={(e) => handleFieldChange('city', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Country" fullWidth size="small" value={editFields.country} onChange={(e) => handleFieldChange('country', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Postal Code" fullWidth size="small" value={editFields.postal_code} onChange={(e) => handleFieldChange('postal_code', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Work Location</InputLabel>
                <Select value={editFields.location_id || ''} label="Work Location" onChange={(e) => handleFieldChange('location_id', e.target.value)}>
                  <MenuItem value=""><em>None</em></MenuItem>
                  {(locations || []).map((loc: any) => (
                    <MenuItem key={loc.id} value={loc.id}>{loc.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Employment Type</InputLabel>
                <Select value={editFields.employment_type || 'full_time'} label="Employment Type" onChange={(e) => handleFieldChange('employment_type', e.target.value)}>
                  {EMPLOYMENT_TYPES.map(et => (
                    <MenuItem key={et.value} value={et.value}>{et.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Weekly Contracted Hours" type="number" fullWidth size="small" value={editFields.contracted_hours_weekly} onChange={(e) => handleFieldChange('contracted_hours_weekly', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Weekly Max Hours (visa restriction)" type="number" fullWidth size="small" value={editFields.max_hours_weekly} onChange={(e) => handleFieldChange('max_hours_weekly', e.target.value)} helperText="Leave blank to use contracted hours" />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Button variant="contained" onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button variant="outlined" onClick={() => setEditing(false)}>Cancel</Button>
          </Stack>
        </Paper>
      ) : (
        profile && (
          <Paper sx={{ p: 4, mb: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>Profile Details</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="#6B7280">Phone</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{profile.phone || '—'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="#6B7280">Date of Birth</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{profile.birth_date ? new Date(profile.birth_date).toLocaleDateString() : '—'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="#6B7280">Address</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{[profile.address, profile.city, profile.country, profile.postal_code].filter(Boolean).join(', ') || '—'}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="#6B7280">Work Location</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{(locations || []).find((l: any) => l.id === profile.location_id)?.name || '—'}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="#6B7280">Employment Type</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{EMPLOYMENT_TYPES.find(et => et.value === profile.employment_type)?.label || profile.employment_type || '—'}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="#6B7280">Contracted Hours/Week</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{profile.contracted_hours_weekly ? `${profile.contracted_hours_weekly}h` : '—'}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="#6B7280">Weekly Max Hours</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{profile.max_hours_weekly ? `${profile.max_hours_weekly}h` : '—'}</Typography>
              </Grid>
            </Grid>
          </Paper>
        )
      )}

      {canEdit && (
        <Paper sx={{ p: 4, mb: 4, position: 'relative' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>Module Permissions</Typography>
          {permSaved && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setPermSaved(false)}>Permissions updated.</Alert>}
          {permLoading ? (
            <Box sx={{ textAlign: 'center', py: 2 }}><CircularProgress size={24} /></Box>
          ) : (
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#F8FAFC' }}>Module</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#F8FAFC' }}>Permission Level</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {permData.map((p) => (
                    <TableRow key={p.module}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{MODULE_LABELS[p.module] || p.module}</Typography>
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                          <Select
                            value={p.permission_level}
                            onChange={(e) => {
                              setPermData(prev => prev.map(x => x.module === p.module ? { ...x, permission_level: e.target.value } : x))
                              setPermDirty(true)
                            }}
                          >
                            {Object.entries(LEVEL_LABELS).map(([key, label]) => (
                              <MenuItem key={key} value={key}>{label}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {permDirty && (
            <Box sx={{ position: 'sticky', bottom: 0, bgcolor: 'white', pt: 2, borderTop: '1px solid #E5E7EB', mt: 2 }}>
              <Button variant="contained" startIcon={<SaveIcon />} onClick={() => permSaveMutation.mutate()} disabled={permSaveMutation.isPending} fullWidth
                sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>
                {permSaveMutation.isPending ? 'Saving...' : 'Save Permissions'}
              </Button>
            </Box>
          )}
        </Paper>
      )}

      <Paper>
        <Box sx={{ px: 3, py: 2, bgcolor: '#F8FAFC', borderBottom: '1px solid #E5E7EB' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Compliance Requirements</Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Requirement</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Last Checked</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {c.requirements?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} sx={{ textAlign: 'center', py: 4, color: '#9CA3AF' }}>
                    No compliance requirements configured yet.
                  </TableCell>
                </TableRow>
              ) : (
                c.requirements?.map((req: any) => (
                  <TableRow key={req.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{req.name}</Typography>
                      {req.description && (
                        <Typography variant="caption" color="#6B7280">{req.description}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={req.status === 'complete' ? 'Complete' : 'Incomplete'}
                        size="small"
                        color={req.status === 'complete' ? 'success' : 'warning'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="#6B7280">
                        {req.last_checked_at ? new Date(req.last_checked_at).toLocaleDateString() : 'Never'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Button size="small" variant="outlined" onClick={() => handleEditRequirement(req)}>
                        Update
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper sx={{ mt: 4 }}>
        <Box sx={{ px: 3, py: 2, bgcolor: '#F8FAFC', borderBottom: '1px solid #E5E7EB' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Competency Assessments</Typography>
            {canEdit && (
              <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAssessOpen(true)}>
                New Assessment
              </Button>
            )}
          </Stack>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Assessment</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Assessor</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Result</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(!competencyRecords || competencyRecords.length === 0) ? (
                <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 4, color: '#9CA3AF' }}>No competency assessments found.</TableCell></TableRow>
              ) : competencyRecords.slice(compPage * compRowsPerPage, compPage * compRowsPerPage + compRowsPerPage).map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{a.template_name}</Typography></TableCell>
                  <TableCell>{a.assessor_first_name} {a.assessor_last_name}</TableCell>
                  <TableCell>{new Date(a.assessed_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Chip label={a.passed ? 'Passed' : 'Failed'} color={a.passed ? 'success' : 'error'} size="small" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={competencyRecords?.length || 0}
          page={compPage}
          onPageChange={(_, p) => setCompPage(p)}
          rowsPerPage={compRowsPerPage}
          rowsPerPageOptions={[10]}
        />
      </Paper>

      <Dialog open={assessOpen} onClose={() => { setAssessOpen(false); setAssessError('') }} maxWidth="sm" fullWidth>
        <DialogTitle>New Competency Assessment</DialogTitle>
        <DialogContent>
          {assessError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setAssessError('')}>{assessError}</Alert>}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2">
              <strong>Staff:</strong> {profile?.first_name || memberData?.first_name || ''} {profile?.last_name || memberData?.last_name || ''}
            </Typography>
            <TextField label="Assessment Template" select required value={assessForm.template_id}
              onChange={e => setAssessForm(p => ({ ...p, template_id: e.target.value }))}>
              <MenuItem value="">Select template...</MenuItem>
              {(competencyTemplates || []).map((t: any) => (
                <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
              ))}
            </TextField>
            <TextField label="Result" select value={assessForm.passed ? 'pass' : 'fail'}
              onChange={e => setAssessForm(p => ({ ...p, passed: e.target.value === 'pass' }))}>
              <MenuItem value="pass">Pass</MenuItem>
              <MenuItem value="fail">Fail</MenuItem>
            </TextField>
            <TextField label="Assessment Date" type="date" required value={assessForm.assessed_at}
              InputLabelProps={{ shrink: true }}
              onChange={e => setAssessForm(p => ({ ...p, assessed_at: e.target.value }))} />
            <Autocomplete
              options={members}
              getOptionLabel={(o: any) => `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.email}
              value={members.find((m: any) => m.id === assessForm.assessor_id || m.staff_id === assessForm.assessor_id) || null}
              onChange={(_, v) => setAssessForm(p => ({ ...p, assessor_id: v?.id || '' }))}
              renderInput={(params) => <TextField {...params} label="Assessor (who carried out assessment)" />}
            />
            <TextField label="Others Involved" placeholder="Names of other staff/assessors present"
              value={assessForm.involved_parties}
              onChange={e => setAssessForm(p => ({ ...p, involved_parties: e.target.value }))} />
            <TextField label="Reassessment Date" type="date" value={assessForm.reassessment_date}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: new Date().toISOString().split('T')[0] }}
              onChange={e => setAssessForm(p => ({ ...p, reassessment_date: e.target.value }))} />
            <TextField label="Notes" multiline rows={3} value={assessForm.notes}
              onChange={e => setAssessForm(p => ({ ...p, notes: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAssessOpen(false); setAssessError('') }}>Cancel</Button>
          <Button variant="contained" onClick={() => assessMutation.mutate()} disabled={assessMutation.isPending || !assessForm.template_id || !assessForm.assessed_at}>
            {assessMutation.isPending ? <CircularProgress size={20} /> : 'Save Assessment'}
          </Button>
        </DialogActions>
      </Dialog>

      <EditRequirementDialog
        open={editReqOpen}
        requirement={editingRequirement}
        onClose={() => { setEditReqOpen(false); setEditingRequirement(null) }}
        onSaved={() => { refetchProfile(); queryClient.invalidateQueries({ queryKey: ['staff-compliance', userId] }) }}
      />
    </Box>
  )
}

function EditRequirementDialog({ open, requirement, onClose, onSaved }: {
  open: boolean; requirement: any; onClose: () => void; onSaved: () => void
}) {
  const [status, setStatus] = useState('incomplete')
  const [notes, setNotes] = useState('')
  const [issuedAt, setIssuedAt] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [error, setError] = useState('')
  const fileUploadRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (requirement) {
      setStatus(requirement.status || 'incomplete')
      setNotes(requirement.notes || '')
      setFileUrl(requirement.file_url || '')
      setIssuedAt(requirement.issued_at ? new Date(requirement.issued_at).toISOString().split('T')[0] : '')
      setExpiresAt(requirement.expires_at ? new Date(requirement.expires_at).toISOString().split('T')[0] : '')
      setError('')
    }
  }, [requirement])

  const handleSave = async () => {
    if (!requirement) return
    setSaving(true)
    setError('')
    try {
      await api.patch(`/settings/compliance-records/${requirement.id}`, {
        status,
        notes,
        issued_at: issuedAt || null,
        expires_at: expiresAt || null,
      })
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update requirement')
    } finally {
      setSaving(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !requirement) return
    setUploadingFile(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post(`/settings/compliance-records/${requirement.id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setFileUrl(res.data.file_url)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload file')
    } finally {
      setUploadingFile(false)
      if (fileUploadRef.current) fileUploadRef.current.value = ''
    }
  }

  const handleRemoveFile = async () => {
    if (!requirement) return
    setSaving(true)
    try {
      await api.patch(`/settings/compliance-records/${requirement.id}`, { file_url: null })
      setFileUrl('')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove file')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Update Compliance Requirement</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>{requirement?.name}</Typography>
        {requirement?.description && (
          <Typography variant="body2" color="#6B7280" sx={{ mb: 2 }}>{requirement.description}</Typography>
        )}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select value={status} label="Status" onChange={(e) => setStatus(e.target.value)}>
              <MenuItem value="incomplete">Incomplete</MenuItem>
              <MenuItem value="complete">Complete</MenuItem>
              <MenuItem value="expired">Expired</MenuItem>
              <MenuItem value="pending_review">Pending Review</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Issued Date" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }}
            value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
          <TextField label="Expiry Date" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }}
            inputProps={{ min: new Date().toISOString().split('T')[0] }}
            value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          <TextField label="Notes" multiline rows={3} fullWidth size="small" value={notes}
            onChange={(e) => setNotes(e.target.value)} />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>Uploaded Document</Typography>
            {fileUrl ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <LinkIcon fontSize="small" />
                <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0F4C81' }}>
                  {fileUrl.split('/').pop()}
                </a>
                <IconButton size="small" color="error" onClick={handleRemoveFile} disabled={saving}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
            ) : (
              <Typography variant="body2" color="#9CA3AF">No file uploaded</Typography>
            )}
            <Button component="label" variant="outlined" size="small" startIcon={<UploadFileIcon />} sx={{ mt: 1 }} disabled={uploadingFile}>
              {uploadingFile ? 'Uploading...' : 'Upload File'}
              <input type="file" hidden ref={fileUploadRef} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFileUpload} />
            </Button>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}
          sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
