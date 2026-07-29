import { useState } from 'react'
import { Box, Button, Container, Typography, TextField, Stack, Chip, Alert, CircularProgress } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { UserRole } from '@meticle/shared'
import api from '../../services/api'

const isValidEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e.trim())

export default function OnboardingFlow() {
  const navigate = useNavigate()
  const userStr = localStorage.getItem('user')
  let user: any = null
  try { user = userStr ? JSON.parse(userStr) : null } catch { user = null }
  const isOrg = user?.role === UserRole.ORG_ADMIN || user?.role === UserRole.SUPER_ADMIN
  const orgId = user?.organization_id || user?.organizationId

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [invites, setInvites] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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

  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    try {
      if (isOrg && orgId) {
        if (name) {
          await api.patch(`/organizations/${orgId}`, { name, onboarding_completed: true })
        }
        if (address) {
          await api.post(`/organizations/${orgId}/locations`, { name: name || 'Main Location', address })
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
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save. You can set this up later in Settings.')
    }
    setSaving(false)
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#020617', display: 'flex', alignItems: 'center' }}>
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 900, color: 'white', mb: 1 }}>Welcome to Meticle</Typography>
          <Typography sx={{ color: '#94a3b8' }}>Let's get you started in one step.</Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <Stack spacing={3} sx={{ bgcolor: '#1e293b', p: 4, borderRadius: 3 }}>
          {isOrg ? (
            <>
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

          <Button variant="contained" fullWidth size="large" onClick={handleSubmit} disabled={saving || (isOrg ? false : !name)}
            sx={{ bgcolor: '#10b981', py: 1.5, fontWeight: 700 }}>
            {saving ? <CircularProgress size={24} color="inherit" /> : 'Go to Dashboard'}
          </Button>
        </Stack>
      </Container>
    </Box>
  )
}
