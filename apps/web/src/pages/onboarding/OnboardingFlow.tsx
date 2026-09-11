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
    try {
      if (isOrg && orgId) {
        await api.patch(`/organizations/${orgId}`, { onboarding_completed: true })
      }
      navigate('/dashboard')
    } catch {
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
          /* Step 3: Type-specific welcome guide */
          <Stack spacing={3} sx={{ bgcolor: '#1e293b', p: 4, borderRadius: 3 }}>
            {/* --- Domiciliary guide --- */}
            {selectedTypes.includes('domiciliary') && (
              <>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#10b981', fontWeight: 700, mb: 1 }}>Domiciliary Care — What to do next</Typography>
                  <Typography sx={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.6 }}>
                    Your dashboard is configured for home visits, carer routes, mileage tracking and payroll. Here is the recommended setup order:
                  </Typography>
                </Box>
                {[
                  { num: 1, title: 'Add your first client', desc: 'Go to People → Add Person. Fill in name, address, GP details and emergency contacts. This creates the person record that care packages link to.', link: '/people' },
                  { num: 2, title: 'Create a care package', desc: 'Go to Visits & Packages → Add Package. Set the hourly rate, funding type (private / local authority / NHS), travel time policy, and mileage rate.', link: '/homecare' },
                  { num: 3, title: 'Add visit plans', desc: 'Inside the package, create visit plans — morning call, lunch call, evening call, etc. Set the days of week and time window for each visit type.', link: '/homecare' },
                  { num: 4, title: 'Assign care staff', desc: 'Go to Staff Directory and invite your carers. Once they accept, assign them to the care package so visits appear on their mobile app.', link: '/staff' },
                  { num: 5, title: 'Set your mileage policy', desc: 'Go to Settings → Billing and configure your HMRC mileage rate, travel time payment rules, and whether you pay for inter-client travel.', link: '/settings' },
                  { num: 6, title: 'Review the dashboard', desc: 'Once visits are scheduled, the dashboard shows daily route, carer locations, and exceptions. Check Carer Totals for payroll summaries.', link: '/dashboard' },
                ].map(item => (
                  <Box key={item.num} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                    <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.5 }}>
                      <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{item.num}</Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ color: 'white', fontWeight: 600, fontSize: 14 }}>{item.title}</Typography>
                      <Typography sx={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>{item.desc}</Typography>
                    </Box>
                  </Box>
                ))}
              </>
            )}
            {/* --- Supported Living guide --- */}
            {selectedTypes.includes('supported_living') && (
              <>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#3b82f6', fontWeight: 700, mb: 1 }}>Supported Living — What to do next</Typography>
                  <Typography sx={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.6 }}>
                    Your dashboard is configured for staff scheduling, shift marketplace, compliance tracking and daily notes. Here is the recommended setup order:
                  </Typography>
                </Box>
                {[
                  { num: 1, title: 'Add your locations', desc: 'Go to Locations and add each supported living property. Set minimum staff levels for day, night and sleep-in shifts.', link: '/locations' },
                  { num: 2, title: 'Add the people you support', desc: 'Go to People → Add Person for each resident. Include support level, care plans, medication needs and GP details.', link: '/people' },
                  { num: 3, title: 'Set up staff schedules', desc: 'Go to Rota Planner and create shift patterns. Use the Shift Marketplace to let staff pick up extra shifts.', link: '/scheduling' },
                  { num: 4, title: 'Configure compliance', desc: 'Go to Compliance → Training Matrix and set up required training modules. Upload DBS checks and right-to-work documents.', link: '/compliance' },
                  { num: 5, title: 'Invite your team', desc: 'Go to Staff Directory and invite managers and support workers. Assign roles and locations.', link: '/staff' },
                  { num: 6, title: 'Review the dashboard', desc: 'The dashboard shows staffing coverage, compliance scores, upcoming shifts, and incident alerts at a glance.', link: '/dashboard' },
                ].map(item => (
                  <Box key={item.num} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                    <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.5 }}>
                      <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{item.num}</Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ color: 'white', fontWeight: 600, fontSize: 14 }}>{item.title}</Typography>
                      <Typography sx={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>{item.desc}</Typography>
                    </Box>
                  </Box>
                ))}
              </>
            )}
            {/* --- Care Home guide --- */}
            {selectedTypes.includes('residential') && (
              <>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#8b5cf6', fontWeight: 700, mb: 1 }}>Care Home — What to do next</Typography>
                  <Typography sx={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.6 }}>
                    Your dashboard is configured for bed management, eMedication, daily notes and room checks. Here is the recommended setup order:
                  </Typography>
                </Box>
                {[
                  { num: 1, title: 'Set up rooms and beds', desc: 'Go to Locations → Room Management and add each room with its bed capacity. Group rooms by wing or floor.', link: '/locations' },
                  { num: 2, title: 'Add residents', desc: 'Go to People → Add Person for each resident. Assign them to a room and set their support level and care needs.', link: '/people' },
                  { num: 3, title: 'Create care plans', desc: 'Go to each resident profile and create care plans for medication, nutrition, mobility, and personal care.', link: '/people' },
                  { num: 4, title: 'Configure eMedication', desc: 'Go to eMedication and set up MAR charts. Add medications, dosage schedules, and administration routes.', link: '/emedication' },
                  { num: 5, title: 'Set up room checks', desc: 'Go to Room Checks and configure check schedules — hourly rounds, sleep checks, and fire drill rotations.', link: '/room-checks' },
                  { num: 6, title: 'Review the dashboard', desc: 'The dashboard shows bed occupancy, medication status, incident alerts and daily notes summary.', link: '/dashboard' },
                ].map(item => (
                  <Box key={item.num} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                    <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.5 }}>
                      <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{item.num}</Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ color: 'white', fontWeight: 600, fontSize: 14 }}>{item.title}</Typography>
                      <Typography sx={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>{item.desc}</Typography>
                    </Box>
                  </Box>
                ))}
              </>
            )}
            {/* --- Live-in Care guide --- */}
            {selectedTypes.includes('live_in') && (
              <>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#f59e0b', fontWeight: 700, mb: 1 }}>Live-in Care — What to do next</Typography>
                  <Typography sx={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.6 }}>
                    Your dashboard is configured for 24/7 carer schedules, sleep-in tracking and handover notes. Here is the recommended setup order:
                  </Typography>
                </Box>
                {[
                  { num: 1, title: 'Add the person receiving care', desc: 'Go to People → Add Person. Include full medical history, GP details, emergency contacts and daily routine preferences.', link: '/people' },
                  { num: 2, title: 'Create a live-in care package', desc: 'Go to Visits & Packages → Add Package. Set weekly hours, sleep-in rules, and whether travel between clients is paid.', link: '/homecare' },
                  { num: 3, title: 'Set up handover notes', desc: 'Configure the daily handover template — medication changes, mood observations, tasks completed, and tasks for the next carer.', link: '/homecare' },
                  { num: 4, title: 'Assign rotating carers', desc: 'Go to Staff Directory and assign carers to the live-in rota. Set rotation schedules and sleep-in tracking.', link: '/staff' },
                  { num: 5, title: 'Configure mileage and travel', desc: 'Set mileage rates, travel time policies, and whether inter-client travel is compensated.', link: '/settings' },
                  { num: 6, title: 'Review the dashboard', desc: 'The dashboard shows the current carer, handover status, next rotation, and any exceptions or missed check-ins.', link: '/dashboard' },
                ].map(item => (
                  <Box key={item.num} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                    <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.5 }}>
                      <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{item.num}</Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ color: 'white', fontWeight: 600, fontSize: 14 }}>{item.title}</Typography>
                      <Typography sx={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>{item.desc}</Typography>
                    </Box>
                  </Box>
                ))}
              </>
            )}
            <Alert severity="info" sx={{ bgcolor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
              You can do all of this later from the dashboard. This guide is here to help you get started quickly.
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
