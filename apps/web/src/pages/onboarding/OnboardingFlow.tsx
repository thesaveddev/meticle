import { useEffect, useState } from 'react'
import { Box, Button, Typography, Stack, Chip, CircularProgress, Card, CardActionArea, CardContent, Checkbox } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { UserRole } from '@meticle/shared'
import api from '../../services/api'
import { P, CATEGORY_COLORS } from '../../styles/tokens'
import { usePageMeta } from '../../components/PageMeta'
import AuthLayout from '../../components/auth/AuthLayout'
import {
  AuthHeader, AuthField, AuthInput,
  AuthButton, AuthError,
} from '../../components/auth/AuthPrimitives'
import HomeWorkIcon from '@mui/icons-material/HomeWork'
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk'
import HotelIcon from '@mui/icons-material/Hotel'
import GroupIcon from '@mui/icons-material/Group'

const SERVICE_TYPES = [
  { id: 'domiciliary', label: 'Domiciliary Care', desc: 'Home visits, carer routes, mileage tracking, call patterns', icon: DirectionsWalkIcon, color: P.green },
  { id: 'supported_living', label: 'Supported Living', desc: 'Residential staff, rota planning, shift marketplace', icon: HomeWorkIcon, color: P.primary },
  { id: 'residential', label: 'Care Home', desc: 'Bed management, eMedication, daily notes, room checks', icon: HotelIcon, color: CATEGORY_COLORS.violet },
  { id: 'live_in', label: 'Live-in Care', desc: '24/7 carer schedules, sleep-in tracking, handover notes', icon: GroupIcon, color: P.amber },
]

const ONBOARDING_FEATURES = [
  { icon: 'notes' as const, title: 'Daily care notes', description: 'Capture and share care in real time.' },
  { icon: 'person' as const, title: 'Support plans', description: 'Keep support up to date.' },
  { icon: 'medication' as const, title: 'Medication', description: 'eMAR with audit trails.' },
  { icon: 'schedule' as const, title: 'Staff scheduling', description: 'Right people, at the right time.' },
]

const isValidEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e.trim())

const STEP_LABELS = ['Services', 'Organisation', 'Get started']

/** Small segmented stepper — the same language as the card it sits in. */
function OnboardingStepper({ step }: { step: number }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography sx={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--mc-text-secondary)', mb: 1.5 }}>
        Step {step} of 3 · {STEP_LABELS[step - 1]}
      </Typography>
      <Stack direction="row" spacing={1} aria-hidden>
        {[1, 2, 3].map(n => (
          <Box key={n} sx={{ height: 4, flex: 1, borderRadius: 9999, bgcolor: n <= step ? 'var(--mc-primary)' : 'var(--mc-border)' }} />
        ))}
      </Stack>
    </Box>
  )
}

function GuideSection({ eyebrow, color, intro, items }: {
  eyebrow: string
  color: string
  intro: string
  items: { num: number; title: string; desc: string }[]
}) {
  return (
    <Box>
      <Typography sx={{ color, fontWeight: 600, fontSize: 13, mb: 0.5 }}>{eyebrow}</Typography>
      <Typography sx={{ color: 'var(--mc-text-secondary)', fontSize: 14, lineHeight: 1.6, mb: 2 }}>
        {intro}
      </Typography>
      <Stack spacing={1.75}>
        {items.map(item => (
          <Box key={item.num} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: '1px' }}>
              <Typography sx={{ color: '#FFFFFF', fontWeight: 700, fontSize: 13 }}>{item.num}</Typography>
            </Box>
            <Box>
              <Typography sx={{ color: 'var(--mc-text-primary)', fontWeight: 600, fontSize: 14 }}>{item.title}</Typography>
              <Typography sx={{ color: 'var(--mc-text-secondary)', fontSize: 13, lineHeight: 1.5 }}>{item.desc}</Typography>
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}

export default function OnboardingFlow() {
  const navigate = useNavigate()
  const userStr = localStorage.getItem('user')
  let user: any = null
  try { user = userStr ? JSON.parse(userStr) : null } catch { user = null }
  const isOrg = user?.role === UserRole.ORG_ADMIN || user?.role === UserRole.SUPER_ADMIN
  const orgId = user?.organization_id || user?.organizationId

  const [step, setStep] = useState(1)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [hydrating, setHydrating] = useState(true)
  const [completed, setCompleted] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [invites, setInvites] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  usePageMeta({ title: 'Onboarding', description: 'Set up your MeticleCare organisation.', noindex: true })

  useEffect(() => {
    if (!isOrg || !orgId) {
      setHydrating(false)
      return
    }

    let mounted = true
    api.get(`/organizations/${orgId}`)
      .then(({ data }) => {
        if (!mounted) return
        const existingTypes = Array.isArray(data.service_types) ? data.service_types : []
        setSelectedTypes(existingTypes)
        setName(data.name || '')
        setCompleted(data.onboarding_completed === true)
        if (data.onboarding_completed === true) setStep(3)
        else if (existingTypes.length > 0) setStep(Math.max(1, Math.min(3, Number(data.onboarding_step || 1))))
      })
      .catch(() => {
        if (mounted) setError('We could not load your saved onboarding progress. Please refresh and try again.')
      })
      .finally(() => { if (mounted) setHydrating(false) })

    return () => { mounted = false }
  }, [isOrg, orgId])

  const toggleType = (id: string) => {
    setSelectedTypes(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  const handleServiceContinue = async () => {
    if (selectedTypes.length === 0) {
      setError('Select at least one service type to continue')
      return
    }
    setError('')
    if (isOrg && orgId) {
      setSaving(true)
      try {
        await api.patch(`/organizations/${orgId}`, {
          service_types: selectedTypes,
          primary_service_type: selectedTypes[0],
          onboarding_step: 1,
        })
        setStep(2)
      } catch (err: any) {
        setError(err.response?.data?.message || 'We could not save your service types. Please try again.')
      } finally {
        setSaving(false)
      }
      return
    }
    setStep(2)
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
    if (isOrg && selectedTypes.length === 0) {
      setError('Select at least one service type to continue')
      setStep(1)
      return
    }
    if (isOrg && !name.trim()) {
      setError('Organisation name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (isOrg && orgId) {
        await api.patch(`/organizations/${orgId}`, {
          name: name.trim(),
          service_types: selectedTypes,
          primary_service_type: selectedTypes[0],
          onboarding_step: 2,
        })
        if (address.trim()) {
          const locationsResponse = await api.get('/settings/locations')
          const locations = Array.isArray(locationsResponse.data) ? locationsResponse.data : []
          const primaryLocation = locations[0]
          if (primaryLocation?.id) {
            await api.put(`/settings/locations/${primaryLocation.id}`, {
              name: primaryLocation.name || name.trim(),
              address: address.trim(),
              service_type: selectedTypes[0],
            })
          } else {
            await api.post('/settings/locations', {
              name: name.trim() || 'Main Location',
              address: address.trim(),
              service_type: selectedTypes[0],
            })
          }
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
          await api.patch(`/organizations/${orgId}`, { onboarding_completed: true, onboarding_step: 3 })
        }
        navigate('/dashboard')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save. You can set this up later in Settings.')
    }
    setSaving(false)
  }

  const handleStep3Submit = async () => {
    if (isOrg && !orgId) {
      setError('Your organisation could not be identified. Please sign out and sign in again.')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (isOrg && orgId) {
        await api.patch(`/organizations/${orgId}`, { onboarding_completed: true, onboarding_step: 3 })
        setCompleted(true)
      }
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.message || 'We could not finish setup. Your progress is saved; please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (hydrating) {
    return (
      <Box role="status" aria-live="polite" sx={{ minHeight: '100dvh', bgcolor: 'var(--mc-background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  const stepTitle = step === 1
    ? 'What kind of care do you provide?'
    : step === 2
      ? 'Tell us about your organisation'
      : completed ? 'Your setup is ready' : 'Set up your first record'
  const stepSupporting = step === 1
    ? "Select all that apply. We'll tailor your experience."
    : step === 2
      ? 'Almost done — set your organisation details.'
      : completed ? 'You can revisit setup from Settings at any time.' : 'Optional: create your first record now, or skip and do it later.'

  return (
    <AuthLayout
      heading={<>Set up your<br />care service.</>}
      supporting="Tell us what kind of care you provide and we'll configure the right modules, permissions and guides."
      features={ONBOARDING_FEATURES}
    >
      <Box component="main" aria-label="Organisation setup">
      <OnboardingStepper step={step} />
      <AuthHeader title={stepTitle} supporting={stepSupporting} />

      {error && <AuthError message={error} onClose={() => setError('')} />}

      {step === 1 ? (
        /* Step 1: Service type selection */
        <Stack spacing={1.5}>
          {SERVICE_TYPES.map((type) => {
            const Icon = type.icon
            const selected = selectedTypes.includes(type.id)
            return (
              <Card key={type.id} sx={{
                bgcolor: selected ? `color-mix(in srgb, ${type.color} 7%, var(--mc-surface))` : 'var(--mc-surface)',
                border: `2px solid ${selected ? type.color : 'var(--mc-border)'}`,
                borderRadius: '14px',
                boxShadow: 'none',
                transition: 'border-color 150ms ease, background-color 150ms ease',
              }}>
                <CardActionArea onClick={() => toggleType(type.id)} aria-pressed={selected} sx={{ p: 2, borderRadius: '12px' }}>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: '0 !important' }}>
                    <Box sx={{
                      width: 44, height: 44, borderRadius: '12px', flexShrink: 0,
                      bgcolor: `color-mix(in srgb, ${type.color} 14%, var(--mc-surface))`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon sx={{ color: type.color, fontSize: 22 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: 15, color: 'var(--mc-text-primary)' }}>{type.label}</Typography>
                      <Typography variant="body2" sx={{ color: 'var(--mc-text-secondary)', fontSize: 13.5 }}>{type.desc}</Typography>
                    </Box>
                    <Checkbox checked={selected} tabIndex={-1} disableRipple sx={{ color: 'var(--mc-text-muted)', '&.Mui-checked': { color: type.color } }} />
                  </CardContent>
                </CardActionArea>
              </Card>
            )
          })}

          <Box sx={{ pt: 0.5 }}>
            <AuthButton type="button" onClick={handleServiceContinue} disabled={saving || selectedTypes.length === 0} loading={saving} loadingLabel="Saving…">
              Continue
            </AuthButton>
          </Box>

          <Typography variant="caption" sx={{ color: 'var(--mc-text-muted)', textAlign: 'center', display: 'block' }}>
            You can change your service types later in Settings. At least one is required to configure the right modules and permissions.
          </Typography>
        </Stack>
      ) : step === 2 ? (
        /* Step 2: Org details */
        <Stack spacing={2.5}>
          {isOrg ? (
            <>
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'var(--mc-text-primary)', mb: 1 }}>Selected services</Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {selectedTypes.map(id => {
                    const type = SERVICE_TYPES.find(t => t.id === id)
                    return type ? <Chip key={id} label={type.label} size="small" variant="outlined" sx={{ color: type.color, borderColor: type.color, fontWeight: 600 }} /> : null
                  })}
                </Stack>
              </Box>
              <AuthField label="Organization Name" htmlFor="org-name">
                <AuthInput id="org-name" value={name} onChange={setName} placeholder="e.g. Orbis House" autoComplete="organization" />
              </AuthField>
              <AuthField label="Address (optional)" htmlFor="org-address">
                <AuthInput id="org-address" value={address} onChange={setAddress} placeholder="Street, town, postcode" autoComplete="street-address" required={false} multiline rows={2} />
              </AuthField>
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'var(--mc-text-primary)', mb: 1 }}>Invite team members (optional)</Typography>
                <Stack direction="row" spacing={1} alignItems="stretch">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <AuthInput id="invite-email" value={emailInput} onChange={setEmailInput} placeholder="email@example.com" required={false} autoComplete="email"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail() } }} />
                  </Box>
                  <Button variant="outlined" onClick={addEmail} sx={{
                    borderRadius: '12px', borderColor: 'var(--mc-border)', color: 'var(--mc-primary)',
                    fontWeight: 600, textTransform: 'none', px: 3, flexShrink: 0,
                    '&:hover': { borderColor: 'var(--mc-primary)', bgcolor: 'transparent' },
                  }}>Add</Button>
                </Stack>
                {invites.length > 0 && (
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
                    {invites.map(email => (
                      <Chip key={email} label={email} size="small" variant="outlined" onDelete={() => setInvites(invites.filter(e => e !== email))} />
                    ))}
                  </Stack>
                )}
              </Box>
            </>
          ) : (
            <AuthField label="Your Name" htmlFor="staff-name">
              <AuthInput id="staff-name" value={name} onChange={setName} placeholder="Your full name" autoComplete="name" />
            </AuthField>
          )}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button variant="text" onClick={() => setStep(1)} sx={{ color: 'var(--mc-text-secondary)', fontWeight: 600, textTransform: 'none' }}>Back</Button>
            <Box sx={{ flex: 1 }}>
              <AuthButton type="button" onClick={handleStep2Submit} disabled={saving || (isOrg ? !name.trim() || selectedTypes.length === 0 : !name.trim())} loading={saving} loadingLabel="Saving…">
                Continue
              </AuthButton>
            </Box>
          </Stack>
        </Stack>
      ) : step === 3 ? (
        /* Step 3: Type-specific welcome guide */
        <Stack spacing={3}>
          {/* --- Domiciliary guide --- */}
          {selectedTypes.includes('domiciliary') && (
            <GuideSection
              eyebrow="Domiciliary Care — What to do next"
              color={SERVICE_TYPES[0].color}
              intro="Your dashboard is configured for home visits, carer routes, mileage tracking and payroll. Here is the recommended setup order:"
              items={[
                { num: 1, title: 'Add your first client', desc: 'Go to People → Add Person. Fill in name, address, GP details and emergency contacts. This creates the person record that care packages link to.' },
                { num: 2, title: 'Create a care package', desc: 'Go to Visits & Packages → Add Package. Set the hourly rate, funding type (private / local authority / NHS), travel time policy, and mileage rate.' },
                { num: 3, title: 'Add visit plans', desc: 'Inside the package, create visit plans — morning call, lunch call, evening call, etc. Set the days of week and time window for each visit type.' },
                { num: 4, title: 'Assign care staff', desc: 'Go to Staff Directory and invite your carers. Once they accept, assign them to the care package so visits appear on their mobile app.' },
                { num: 5, title: 'Set your mileage policy', desc: 'Go to Settings → Billing and configure your HMRC mileage rate, travel time payment rules, and whether you pay for inter-client travel.' },
                { num: 6, title: 'Review the dashboard', desc: 'Once visits are scheduled, the dashboard shows daily route, carer locations, and exceptions. Payroll summaries live on Payroll & Timesheets under Carer totals.' },
              ]}
            />
          )}
          {/* --- Supported Living guide --- */}
          {selectedTypes.includes('supported_living') && (
            <GuideSection
              eyebrow="Supported Living — What to do next"
              color={SERVICE_TYPES[1].color}
              intro="Your dashboard is configured for staff scheduling, shift marketplace, compliance tracking and daily notes. Here is the recommended setup order:"
              items={[
                { num: 1, title: 'Add your locations', desc: 'Go to Locations and add each supported living property. Set minimum staff levels for day, night and sleep-in shifts.' },
                { num: 2, title: 'Add the people you support', desc: 'Go to People → Add Person for each resident. Include support level, care plans, medication needs and GP details.' },
                { num: 3, title: 'Set up staff schedules', desc: 'Go to Rota Planner and create shift patterns. Use the Shift Marketplace to let staff pick up extra shifts.' },
                { num: 4, title: 'Configure compliance', desc: 'Go to Compliance → Training Matrix and set up required training modules. Upload DBS certificates and right-to-work documents.' },
                { num: 5, title: 'Invite your team', desc: 'Go to Staff Directory and invite managers and support workers. Assign roles and locations.' },
                { num: 6, title: 'Review the dashboard', desc: 'The dashboard shows staffing coverage, compliance scores, upcoming shifts, and incident alerts at a glance.' },
              ]}
            />
          )}
          {/* --- Care Home guide --- */}
          {selectedTypes.includes('residential') && (
            <GuideSection
              eyebrow="Care Home — What to do next"
              color={SERVICE_TYPES[2].color}
              intro="Your dashboard is configured for bed management, eMedication, daily notes and room checks. Here is the recommended setup order:"
              items={[
                { num: 1, title: 'Set up rooms and beds', desc: 'Go to Locations → Room Management and add each room with its bed capacity. Group rooms by wing or floor.' },
                { num: 2, title: 'Add residents', desc: 'Go to People → Add Person for each resident. Assign them to a room and set their support level and care needs.' },
                { num: 3, title: 'Create care plans', desc: 'Go to each resident profile and create care plans for medication, nutrition, mobility, and personal care.' },
                { num: 4, title: 'Configure eMedication', desc: 'Go to eMedication and set up MAR charts. Add medications, dosage schedules, and administration routes.' },
                { num: 5, title: 'Set up room checks', desc: 'Go to Room Checks and configure check schedules — hourly rounds, sleep checks, and fire drill rotations.' },
                { num: 6, title: 'Review the dashboard', desc: 'The dashboard shows bed occupancy, medication status, incident alerts and daily notes summary.' },
              ]}
            />
          )}
          {/* --- Live-in Care guide --- */}
          {selectedTypes.includes('live_in') && (
            <GuideSection
              eyebrow="Live-in Care — What to do next"
              color={SERVICE_TYPES[3].color}
              intro="Your dashboard is configured for 24/7 carer schedules, sleep-in tracking and handover notes. Here is the recommended setup order:"
              items={[
                { num: 1, title: 'Add the person receiving care', desc: 'Go to People → Add Person. Include full medical history, GP details, emergency contacts and daily routine preferences.' },
                { num: 2, title: 'Create a live-in care package', desc: 'Go to Visits & Packages → Add Package. Set weekly hours, sleep-in rules, and whether travel between clients is paid.' },
                { num: 3, title: 'Set up handover notes', desc: 'Configure the daily handover template — medication changes, mood observations, tasks completed, and tasks for the next carer.' },
                { num: 4, title: 'Assign rotating carers', desc: 'Go to Staff Directory and assign carers to the live-in rota. Set rotation schedules and sleep-in tracking.' },
                { num: 5, title: 'Configure mileage and travel', desc: 'Set mileage rates, travel time policies, and whether inter-client travel is compensated.' },
                { num: 6, title: 'Review the dashboard', desc: 'The dashboard shows the current carer, handover status, next rotation, and any exceptions or missed check-ins.' },
              ]}
            />
          )}
          <Box sx={{ bgcolor: 'var(--mc-info-soft)', border: '1px solid var(--mc-border)', borderRadius: '12px', px: 2, py: 1.5 }}>
            <Typography sx={{ fontSize: 13.5, color: 'var(--mc-text-secondary)', lineHeight: 1.55 }}>
              You can do all of this later from the dashboard. This guide is here to help you get started quickly.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button variant="text" onClick={() => setStep(2)} sx={{ color: 'var(--mc-text-secondary)', fontWeight: 600, textTransform: 'none' }}>Back</Button>
            <Box sx={{ flex: 1 }}>
              <AuthButton type="button" onClick={handleStep3Submit} disabled={saving} loading={saving} loadingLabel="Finishing…">
                Go to Dashboard
              </AuthButton>
            </Box>
          </Stack>
        </Stack>
      ) : null}
      </Box>
    </AuthLayout>
  )
}
