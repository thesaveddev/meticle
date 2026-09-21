import { Box, Button, Container, Grid, Stack, Typography, TextField, MenuItem, Alert, Checkbox, FormControlLabel, Link } from '@mui/material'
import { ArrowForward, Email, LocationOn, AccessTime } from '@mui/icons-material'
import { useState } from 'react'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'
import api from '../../services/api'

function SectionLabel({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <Box sx={{ mb: 1, textAlign: center ? 'center' : 'left' }}>
      <Typography component="span" sx={{ fontSize: '0.75rem', lineHeight: 1.3, fontWeight: 700, letterSpacing: '0.08em', color: M.tealDeep, borderBottom: `2px solid ${M.teal}`, pb: 0.5, textTransform: 'uppercase' }}>{children}</Typography>
    </Box>
  )
}

type FormState = { name: string; company: string; email: string; role: string; careType: string; message: string; website: string; privacyConsent: boolean; marketingConsent: boolean }
const initialForm: FormState = { name: '', company: '', email: '', role: '', careType: '', message: '', website: '', privacyConsent: false, marketingConsent: false }

export default function ContactPageNew() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const update = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm(current => ({ ...current, [field]: event.target.value }))
  }

  const updateConsent = (field: 'privacyConsent' | 'marketingConsent') => (_event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    setForm(current => ({ ...current, [field]: checked }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const params = new URLSearchParams(window.location.search)
      await api.post('/contact', {
        name: form.name,
        company: form.company,
        email: form.email,
        role: form.role || undefined,
        careType: form.careType || undefined,
        message: form.message,
        website: form.website,
        source: 'website-contact',
        utmSource: params.get('utm_source') || undefined,
        utmMedium: params.get('utm_medium') || undefined,
        utmCampaign: params.get('utm_campaign') || undefined,
        referrer: document.referrer || undefined,
        privacyConsent: form.privacyConsent,
        marketingConsent: form.marketingConsent,
        privacyPolicyVersion: '2026-09-20',
      })
      setSubmitted(true)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'We could not send your enquiry. Please try again or email hello@meticlecare.com.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <MarketingLayout>
      <PageMeta title="Book a demo" description="Book a demo to see how MeticleCare can support your domiciliary or supported living care operation." canonicalPath="/contact" />
      <Box sx={{ py: { xs: 10, md: 16 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="flex-start">
            <Grid item xs={12} md={5}>
              <SectionLabel>Get in touch</SectionLabel>
              <Typography sx={{ fontSize: M.display.fontSize, lineHeight: M.display.lineHeight, fontWeight: M.display.fontWeight, letterSpacing: M.display.letterSpacing, mb: 3 }}>Book a demo.</Typography>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: M.bodyLg.lineHeight, mb: 5 }}>
                See how MeticleCare connects care delivery, scheduling, medication, risk, compliance and reporting in one platform. We will shape the conversation around your service.
              </Typography>
              <Stack spacing={3}>
                {[
                  { icon: Email, label: 'Email', value: 'hello@meticlecare.com' },
                  { icon: LocationOn, label: 'Based in', value: 'United Kingdom' },
                  { icon: AccessTime, label: 'Response time', value: 'Within one business day' },
                ].map((item) => (
                  <Stack key={item.label} direction="row" spacing={2} alignItems="flex-start">
                    <Box sx={{ width: 40, height: 40, borderRadius: M.r.sm, bgcolor: M.tealSoft, display: 'grid', placeItems: 'center', flexShrink: 0 }}><item.icon sx={{ color: M.tealDeep, fontSize: 20 }} /></Box>
                    <Box><Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: M.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</Typography><Typography sx={{ fontWeight: 600, mt: 0.25 }}>{item.value}</Typography></Box>
                  </Stack>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} md={7}>
              <Box sx={{ p: { xs: 3, md: 4.5 }, bgcolor: M.card, borderRadius: M.r.xl, border: `1px solid ${M.faint}`, boxShadow: M.shadow.md }}>
                {submitted ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Box sx={{ width: 64, height: 64, borderRadius: M.r.full, bgcolor: M.tealSoft, display: 'grid', placeItems: 'center', mx: 'auto', mb: 3 }}><Typography sx={{ fontSize: '2rem' }}>✓</Typography></Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.2rem', mb: 1 }}>Thanks — your enquiry is with us.</Typography>
                    <Typography sx={{ color: M.slate }}>A member of the MeticleCare team will reply within one business day.</Typography>
                  </Box>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <Stack spacing={2.5}>
                      {error && <Alert severity="error">{error}</Alert>}
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}><TextField fullWidth label="Your name" required size="small" value={form.name} onChange={update('name')} /></Grid>
                        <Grid item xs={12} sm={6}><TextField fullWidth label="Organisation" required size="small" value={form.company} onChange={update('company')} /></Grid>
                      </Grid>
                      <TextField fullWidth label="Email address" required type="email" size="small" value={form.email} onChange={update('email')} />
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}><TextField fullWidth label="Role" size="small" select value={form.role} onChange={update('role')}><MenuItem value="">Select your role</MenuItem><MenuItem value="owner">Owner / Director</MenuItem><MenuItem value="registered-manager">Registered Manager</MenuItem><MenuItem value="operations">Operations Director</MenuItem><MenuItem value="compliance">Compliance Manager</MenuItem><MenuItem value="coordinator">Care Coordinator</MenuItem><MenuItem value="other">Other</MenuItem></TextField></Grid>
                        <Grid item xs={12} sm={6}><TextField fullWidth label="Care type" size="small" select value={form.careType} onChange={update('careType')}><MenuItem value="">Select service type</MenuItem><MenuItem value="domiciliary">Domiciliary care</MenuItem><MenuItem value="supported-living">Supported living</MenuItem><MenuItem value="both">Both</MenuItem><MenuItem value="other">Other</MenuItem></TextField></Grid>
                      </Grid>
                      <TextField fullWidth label="How can we help?" required multiline rows={3} size="small" value={form.message} onChange={update('message')} />
                      <TextField value={form.website} onChange={update('website')} tabIndex={-1} autoComplete="off" aria-hidden="true" sx={{ display: 'none' }} />
                      <FormControlLabel control={<Checkbox checked={form.privacyConsent} onChange={updateConsent('privacyConsent')} required />} label={<Typography variant="body2">I agree to the <Link href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</Link>.</Typography>} />
                      <FormControlLabel control={<Checkbox checked={form.marketingConsent} onChange={updateConsent('marketingConsent')} />} label={<Typography variant="body2">Send me occasional product updates and care-technology guidance.</Typography>} />
                      <Button type="submit" disabled={submitting} variant="contained" endIcon={<ArrowForward />} sx={{ bgcolor: M.teal, color: M.navy, fontWeight: 700, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.tealDark } }}>{submitting ? 'Sending…' : 'Book a demo'}</Button>
                      <Typography sx={{ color: M.muted, fontSize: '0.78rem' }}>We use your details to respond to this enquiry. Optional updates are sent only if you opt in. You can unsubscribe at any time.</Typography>
                    </Stack>
                  </form>
                )}
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
