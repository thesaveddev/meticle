import { useState } from 'react'
import { Box, Button, Container, Typography, TextField, Stack, Chip, Alert, CircularProgress, Card, CardActionArea, CardContent, Checkbox } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { UserRole } from '@meticle/shared'
import api from '../../services/api'
import HomeWorkIcon from '@mui/icons-material/HomeWork'
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk'
import HotelIcon from '@mui/icons-material/Hotel'
import GroupIcon from '@mui/icons-material/Group'

const SERVICE_TYPES = [
  { id: 'domiciliary', label: 'Domiciliary Care', desc: 'Home visits, carer routes, mileage tracking, call patterns', icon: DirectionsWalkIcon, color: '#10b981' },
  { id: 'supported_living', label: 'Supported Living', desc: 'Residential staff, rota planning, shift marketplace', icon: HomeWorkIcon, color: '#3b82f6' },
  { id: 'residential', label: 'Care Home', desc: 'Bed management, eMedication, daily notes, room checks', icon: HotelIcon, color: '#8b5cf6' },
  { id: 'live_in', label: 'Live-in Care', desc: '24/7 carer schedules, sleep-in tracking, handover notes', icon: GroupIcon, color: '#f59e0b' },
]

const isValidEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e.trim())

export default function OnboardingFlow() {
  const navigate = useNavigate()
  const userStr = localStorage.getItem('user')
  let user: any = null
  try { user = userStr ? JSON.parse(userStr) : null } catch { user = null }
  const isOrg = user?.role === UserRole.ORG_ADMIN || user?.role === UserRole.SUPER_ADMIN
  const orgId = user?.organization_id || user?.organizationId

  const [step, setStep] = useState(1)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [invites, setInvites] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleType = (id: string) => {
    setSelectedTypes(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  const addEmail = () => {
    const trimmed = emailInput.trim()
    if (!trimmed) return
    if (isValidEmail(trimmed) && !invites.includes(trimmed)) {
      setInvites(prev => [...prev, trimmed])
    } else if (!isValidEmail(trimmed)) {
      setError('Invalid email address')
      return
    }
    setEmailInput('')
    setError('')
  }

  // Type-specific sub-step state
  const [packageName, setPackageName] = useState('')
  const [packageHourlyRate, setPackageHourlyRate] = useState('')
  const [roomName, setRoomName] = useState('')
  const [roomCapacity, setRoomCapacity] = useState('1')
  const [minDayStaff, setMinDayStaff] = useState('2')
  const [minNightStaff, setMinNightStaff] = useState('1')

  const handleStep2Submit = async () => {
    setSaving(true)
    setError('')
    try {
      if (isOrg && orgId) {
        await api.patch(`/organizations/${orgId}`, {
          name: name || undefined,
          service_types: selectedTypes,
          primary_service_type: selectedTypes[0] || 'supported_living',
        })
        if (address) {
          await api.post(`/organizations/${orgId}/locations`, {
            name: name || 'Main Location',
            address,
            service_type: selectedTypes[0] || 'supported_living',
          })
        }
        for (const email of invites) {
          await api.post('/organizations/invitation/invite', { email, role: 'CARE_WORKER' })
        }
      } else if (!isOrg && user?.id) {
        await api.post('/staff', {
          user_id: user.id,
          first_name: name.split(' ')[0] || name,
          last_name: name.split(' ').slice(1).join(' ') || name,
          employment_status: 'available',
        })
      }
      // Go to type-specific step if org admin, otherwise finish
      if (isOrg && selectedTypes.length > 0) {
        setStep(3)
      } else {
        if (isOrg && orgId) {
          await api.patch(`/organizations/${orgId}`, { onboarding_completed: true })
        }
        navigate('/dashboard')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save. You can set this up later in Settings.')
    }
    setSaving(false)
  }

  const handleStep3Submit = async () => {
    setSaving(true)
    setError('')
    try {
      if (isOrg && orgId) {
        // Type-specific setup
        if (selectedTypes.includes('domiciliary') && packageName) {
          await api.post('/homecare/packages', {
            name: packageName,
            hourly_rate_pence: packageHourlyRate ? Number(packageHourlyRate) * 100 : undefined,
            status: 'draft',
          }).catch(() => {}) // Non-critical
        }
        if (selectedTypes.includes('residential') && roomName) {
          // Room setup would go through settings API
        }
        if (selectedTypes.includes('supported_living')) {
          // Staffing ratios would go through settings API
        }
        await api.patch(`/organizations/${orgId}`, { onboarding_completed: true })
      }
      navigate('/dashboard')
    } catch (err: any) {
      // Non-critical — still navigate to dashboard
      if (isOrg && orgId) {
        await api.patch(`/organizations/${orgId}`, { onboarding_completed: true }).catch(() => {})
      }
      navigate('/dashboard')
    }
    setSaving(false)
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#020617', display: 'flex', alignItems: 'center' }}>
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 900, color: 'white', mb: 1 }}>
            {step === 1 ? 'What kind of care do you provide?' : step === 2 ? 'Tell us about your organisation' : 'Set up your first record'}
          </Typography>
          <Typography sx={{ color: '#94a3b8' }}>
            {step === 1 ? "Select all that apply. We'll tailor your experience." : step === 2 ? 'Almost done — set your organisation details.' : 'Optional: create your first record now, or skip and do it later.'}
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {step === 1 ? (
          /* Step 1: Service type selection */
          <Stack spacing={2}>
            {SERVICE_TYPES.map((type) => {
              const Icon = type.icon
              const selected = selectedTypes.includes(type.id)
              return (
                <Card key={type.id} sx={{ bgcolor: selected ? '#1e293b' : '#0f172a', border: `2px solid ${selected ? type.color : 'rgba(255,255,255,0.1)'}`, borderRadius: 2, transition: 'all 0.2s' }}>
                  <CardActionArea onClick={() => toggleType(type.id)} sx={{ p: 2 }}>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: '0 !important' }}>
                      <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: `${type.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon sx={{ color: type.color, fontSize: 28 }} />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 700, color: 'white' }}>{type.label}</Typography>
                        <Typography variant="body2" sx={{ color: '#94a3b8' }}>{type.desc}</Typography>
                      </Box>
                      <Checkbox checked={selected} sx={{ color: 'rgba(255,255,255,0.3)', '&.Mui-checked': { color: type.color } }} />
                    </CardContent>
                  </CardActionArea>
                </Card>
              )
            })}

            <Button variant="contained" fullWidth size="large" onClick={() => setStep(2)} disabled={selectedTypes.length === 0}
              sx={{ bgcolor: '#10b981', py: 1.5, fontWeight: 700, mt: 2 }}>
              Continue
            </Button>

            <Button variant="text" fullWidth onClick={() => { setSelectedTypes(['supported_living']); setStep(2) }}
              sx={{ color: '#64748b', textTransform: 'none' }}>
              Skip — I'll set this up later
            </Button>
          </Stack>
        ) : step === 2 ? (
          /* Step 2: Org details */
          <Stack spacing={3} sx={{ bgcolor: '#1e293b', p: 4, borderRadius: 3 }}>
            {isOrg ? (
              <>
                <Box>
                  <Typography variant="caption" sx={{ color: '#94a3b8', mb: 1, display: 'block' }}>Selected services</Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {selectedTypes.map(id => {
                      const type = SERVICE_TYPES.find(t => t.id === id)
                      return type ? <Chip key={id} label={type.label} size="small" sx={{ color: 'white', bgcolor: `${type.color}30`, border: `1px solid ${type.color}` }} /> : null
                    })}
                  </Stack>
                </Box>
                <TextField label="Organization Name" fullWidth value={name} onChange={e => setName(e.target.value)}
                  sx={{ '& .MuiInputLabel-root': { color: '#94a3b8' }, '& .MuiOutlinedInput-root': { bgcolor: '#0f172a', '& input': { color: 'white' } }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }} />
                <TextField label="Address (optional)" fullWidth multiline rows={2} value={address} onChange={e => setAddress(e.target.value)}
                  sx={{ '& .MuiInputLabel-root': { color: '#94a3b8' }, '& .MuiOutlinedInput-root': { bgcolor: '#0f172a', '& textarea': { color: 'white' } }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }} />
                <Box>
                  <Typography variant="caption" sx={{ color: '#94a3b8', mb: 1, display: 'block' }}>Invite team members (optional)</Typography>
                  <Stack direction="row" spacing={1}>
                    <TextField size="small" placeholder="email@example.com" fullWidth value={emailInput}
                      onChange={e => setEmailInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail() } }}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#0f172a', '& input': { color: 'white' } }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }} />
                    <Button variant="contained" onClick={addEmail} sx={{ bgcolor: '#10b981', whiteSpace: 'nowrap' }}>Add</Button>
                  </Stack>
                  {invites.length > 0 && (
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                      {invites.map(email => (
                        <Chip key={email} label={email} size="small" onDelete={() => setInvites(invites.filter(e => e !== email))}
                          sx={{ color: 'white', bgcolor: '#0f172a', '& .MuiChip-deleteIcon': { color: '#94a3b8' } }} />
                      ))}
                    </Stack>
                  )}
                </Box>
              </>
            ) : (
              <TextField label="Your Name" fullWidth value={name} onChange={e => setName(e.target.value)}
                sx={{ '& .MuiInputLabel-root': { color: '#94a3b8' }, '& .MuiOutlinedInput-root': { bgcolor: '#0f172a', '& input': { color: 'white' } }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }} />
            )}
            <Stack direction="row" spacing={2}>
              <Button variant="outlined" fullWidth onClick={() => setStep(1)} sx={{ color: '#94a3b8', borderColor: 'rgba(255,255,255,0.2)' }}>Back</Button>
              <Button variant="contained" fullWidth size="large" onClick={handleStep2Submit} disabled={saving || (isOrg ? false : !name)}
                sx={{ bgcolor: '#10b981', py: 1.5, fontWeight: 700 }}>
                {saving ? <CircularProgress size={24} color="inherit" /> : 'Continue'}
              </Button>
            </Stack>
          </Stack>
        ) : step === 3 ? (
          /* Step 3: Type-specific setup */
          <Stack spacing={3} sx={{ bgcolor: '#1e293b', p: 4, borderRadius: 3 }}>
            {selectedTypes.includes('domiciliary') && (
              <>
                <Typography variant="subtitle2" sx={{ color: '#10b981', fontWeight: 700 }}>Domiciliary Care Setup</Typography>
                <TextField label="First care package name" fullWidth value={packageName} onChange={e => setPackageName(e.target.value)}
                  placeholder="e.g. Morning support for Mrs Smith"
                  sx={{ '& .MuiInputLabel-root': { color: '#94a3b8' }, '& .MuiOutlinedInput-root': { bgcolor: '#0f172a', '& input': { color: 'white' } }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }} />
                <TextField label="Hourly rate (£)" type="number" fullWidth value={packageHourlyRate} onChange={e => setPackageHourlyRate(e.target.value)}
                  sx={{ '& .MuiInputLabel-root': { color: '#94a3b8' }, '& .MuiOutlinedInput-root': { bgcolor: '#0f172a', '& input': { color: 'white' } }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }} />
              </>
            )}
            {selectedTypes.includes('residential') && (
              <>
                <Typography variant="subtitle2" sx={{ color: '#8b5cf6', fontWeight: 700 }}>Care Home Setup</Typography>
                <TextField label="First room name" fullWidth value={roomName} onChange={e => setRoomName(e.target.value)}
                  placeholder="e.g. Room 1, Blue Wing"
                  sx={{ '& .MuiInputLabel-root': { color: '#94a3b8' }, '& .MuiOutlinedInput-root': { bgcolor: '#0f172a', '& input': { color: 'white' } }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }} />
                <TextField label="Bed capacity" type="number" fullWidth value={roomCapacity} onChange={e => setRoomCapacity(e.target.value)}
                  sx={{ '& .MuiInputLabel-root': { color: '#94a3b8' }, '& .MuiOutlinedInput-root': { bgcolor: '#0f172a', '& input': { color: 'white' } }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }} />
              </>
            )}
            {selectedTypes.includes('supported_living') && (
              <>
                <Typography variant="subtitle2" sx={{ color: '#3b82f6', fontWeight: 700 }}>Supported Living Setup</Typography>
                <Stack direction="row" spacing={2}>
                  <TextField label="Min day staff" type="number" fullWidth value={minDayStaff} onChange={e => setMinDayStaff(e.target.value)}
                    sx={{ '& .MuiInputLabel-root': { color: '#94a3b8' }, '& .MuiOutlinedInput-root': { bgcolor: '#0f172a', '& input': { color: 'white' } }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }} />
                  <TextField label="Min night staff" type="number" fullWidth value={minNightStaff} onChange={e => setMinNightStaff(e.target.value)}
                    sx={{ '& .MuiInputLabel-root': { color: '#94a3b8' }, '& .MuiOutlinedInput-root': { bgcolor: '#0f172a', '& input': { color: 'white' } }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }} />
                </Stack>
              </>
            )}
            <Alert severity="info" sx={{ bgcolor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
              You can always set these up later from the dashboard. This step is optional.
            </Alert>
            <Stack direction="row" spacing={2}>
              <Button variant="outlined" fullWidth onClick={() => setStep(2)} sx={{ color: '#94a3b8', borderColor: 'rgba(255,255,255,0.2)' }}>Back</Button>
              <Button variant="contained" fullWidth size="large" onClick={handleStep3Submit} disabled={saving}
                sx={{ bgcolor: '#10b981', py: 1.5, fontWeight: 700 }}>
                {saving ? <CircularProgress size={24} color="inherit" /> : 'Go to Dashboard'}
              </Button>
            </Stack>
          </Stack>
        ) : null}
      </Container>
    </Box>
  )
}
