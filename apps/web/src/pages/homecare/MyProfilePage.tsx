import { useState, useEffect, useRef } from 'react'
import {
  Box, Typography, Paper, TextField, Button, Avatar, Alert, Grid,
  CircularProgress,
} from '@mui/material'
import { Save as SaveIcon, PhotoCamera as PhotoIcon } from '@mui/icons-material'
import api from '../../services/api'

export default function MyProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [profilePhoto, setProfilePhoto] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get('/auth/me').then(res => {
      const u = res.data.user
      setFirstName(u.first_name || '')
      setLastName(u.last_name || '')
      return api.get(`/staff/${u.id}/profile`)
    }).then(res => {
      const p = res.data
      if (p.phone) setPhone(p.phone)
      if (p.address) setAddress(p.address)
      if (p.city) setCity(p.city)
      if (p.postal_code) setPostalCode(p.postal_code)
      if (p.profile_picture_url) setProfilePhoto(p.profile_picture_url)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/settings/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setProfilePhoto(res.data.url)
      setMessage('Photo updated')
    } catch {
      setError('Failed to upload photo')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!firstName.trim()) { setError('First name is required'); return }
    setSaving(true); setError(''); setMessage('')
    try {
      const me = await api.get('/auth/me')
      const userId = me.data.user.id
      await api.patch(`/staff/${userId}/profile`, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        postal_code: postalCode.trim() || null,
        profile_picture_url: profilePhoto || null,
      })
      setMessage('Profile saved successfully')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  const initials = (firstName[0] || 'U').toUpperCase()

  if (loading) return <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>

  return (
    <Box maxWidth={700} mx="auto" py={4} px={2}>
      <Typography variant="h4" fontWeight={700} mb={1}>My Profile</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>Manage your personal details and profile photo.</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}

      {/* Photo section */}
      <Paper sx={{ p: 3, mb: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
        <Avatar src={profilePhoto} sx={{ width: 96, height: 96, bgcolor: '#2D3A8C', fontSize: 36, fontWeight: 700 }}>
          {initials}
        </Avatar>
        <Box>
          <Typography fontWeight={600} mb={0.5}>Profile photo</Typography>
          <Typography variant="body2" color="text.secondary" mb={1}>JPG or PNG, max 5MB</Typography>
          <Button variant="outlined" size="small" startIcon={<PhotoIcon />} onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading...' : 'Change photo'}
          </Button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handlePhotoUpload} />
        </Box>
      </Paper>

      {/* Form */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography fontWeight={700} mb={2}>Personal details</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField label="First name" value={firstName} onChange={e => setFirstName(e.target.value)} fullWidth required />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Last name" value={lastName} onChange={e => setLastName(e.target.value)} fullWidth />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Email" value="" disabled fullWidth helperText="Contact your manager to change your email" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Phone" value={phone} onChange={e => setPhone(e.target.value)} fullWidth />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Address" value={address} onChange={e => setAddress(e.target.value)} fullWidth />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="City" value={city} onChange={e => setCity(e.target.value)} fullWidth />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Postcode" value={postalCode} onChange={e => setPostalCode(e.target.value)} fullWidth />
          </Grid>
        </Grid>
      </Paper>

      <Box display="flex" justifyContent="flex-end">
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving} sx={{ bgcolor: '#2D3A8C', '&:hover': { bgcolor: '#1E2A6B' } }}>
          {saving ? 'Saving...' : 'Save profile'}
        </Button>
      </Box>
    </Box>
  )
}
