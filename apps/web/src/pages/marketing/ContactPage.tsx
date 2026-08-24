import { useState } from 'react'
import {
  Container, Typography, Grid, Box, Stack, Button, TextField, Paper,
  Alert, CircularProgress,
} from '@mui/material'
import { Email, Phone, AccessTime } from '@mui/icons-material'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import api from '../../services/api'
import PageMeta from '../../components/PageMeta'

// Brand tokens — shared with the rest of the marketing site.
const INK = '#1B2430'
const INK_DARK = '#141C24'
const NAVY = '#0F4C81'
const NAVY_DEEP = '#0A3A63'
const EMERALD = '#10B981'
const EMERALD_DEEP = '#047857'
const BONE = '#F7F4EE'
const MIST = '#5B6672'
const HAIRLINE = '#E7E1D6'

const contactMethods = [
  {
    icon: <Email sx={{ color: NAVY, fontSize: 22 }} />,
    title: 'Email',
    detail: 'hello@meticlecare.com',
    sub: 'Replies within 4 business hours, Mon-Fri.',
  },
  {
    icon: <Phone sx={{ color: NAVY, fontSize: 22 }} />,
    title: 'Phone',
    detail: '07586 215 433',
    sub: 'Mon-Fri, 9:00am-5:30pm GMT.',
  },
  {
    icon: <AccessTime sx={{ color: NAVY, fontSize: 22 }} />,
    title: 'Support hours',
    detail: '8:00am - 6:00pm GMT',
    sub: '24/7 emergency support for Multi-Site plans.',
  },
]

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      await api.post('/contact', form)
      setSent(true)
      setForm({ name: '', email: '', company: '', message: '' })
    } catch {
      setError('Failed to send message. Please try again or email us directly.')
    } finally {
      setSending(false)
    }
  }

  return (
    <MarketingLayout>
      <PageMeta
        title="Contact MeticleCare | MeticleCare"
        description="Get in touch with the MeticleCare team. Ask about our care management platform for UK supported living providers."
        canonicalPath="/contact"
      />

      {/* HERO */}
      <Box component="section" sx={{ pt: { xs: 8, md: 11 }, pb: { xs: 6, md: 8 }, bgcolor: BONE, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', maxWidth: 760, mx: 'auto' }}>
            <Box
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 1.25,
                bgcolor: '#FFFFFF', border: `1px solid ${HAIRLINE}`, borderRadius: 999,
                px: 2, py: 0.75, mb: 3,
              }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: EMERALD }} />
              <Typography sx={{ fontWeight: 800, color: NAVY, fontSize: '0.75rem', letterSpacing: '0.1em' }}>
                GET IN TOUCH · UK BUSINESS HOURS
              </Typography>
            </Box>
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '2.4rem', md: '3.2rem' },
                fontWeight: 900, lineHeight: 1.06, letterSpacing: '-0.03em', color: INK, mb: 3,
              }}
            >
              Let's talk about your service.
            </Typography>
            <Typography sx={{ color: MIST, fontSize: { xs: '1rem', md: '1.12rem' }, lineHeight: 1.7 }}>
              Picking a care platform is a 5+ year decision. Send us a few details and a regional account manager will come back within four business hours — no generic sales pitch, just a real conversation with someone who has run care services before.
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* BODY — contact methods + working form */}
      <Box component="section" sx={{ py: { xs: 8, md: 11 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 5, md: 7 }}>
            <Grid item xs={12} md={5}>
              <Stack spacing={3} sx={{ position: { md: 'sticky' }, top: 96 }}>
                <Box>
                  <Typography
                    variant="h2"
                    sx={{ fontSize: { xs: '1.6rem', md: '1.9rem' }, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em', color: INK, mb: 2 }}
                  >
                    Three ways to reach us.
                  </Typography>
                  <Typography sx={{ color: MIST, fontSize: '0.95rem', lineHeight: 1.7 }}>
                    The fastest is usually email for a non-urgent query. Phone for things you need an answer on today. For something a callback would help with, use the form on the right.
                  </Typography>
                </Box>
                <Stack spacing={2.5}>
                  {contactMethods.map((m) => (
                    <Stack
                      key={m.title}
                      direction="row"
                      spacing={2}
                      alignItems="flex-start"
                      sx={{
                        p: 2.25,
                        bgcolor: BONE, borderRadius: 2.5,
                        borderLeft: `3px solid ${EMERALD}`,
                      }}
                    >
                      <Box sx={{ flexShrink: 0, mt: 0.25, display: 'flex' }}>{m.icon}</Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 800, color: INK, fontSize: '0.95rem', lineHeight: 1.2 }}>
                          {m.title}
                        </Typography>
                        <Typography sx={{ color: NAVY, fontWeight: 800, fontSize: '0.92rem', mt: 0.5, lineHeight: 1.4 }}>
                          {m.detail}
                        </Typography>
                        <Typography sx={{ color: MIST, fontSize: '0.78rem', lineHeight: 1.5, mt: 0.5 }}>
                          {m.sub}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </Grid>

            <Grid item xs={12} md={7}>
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 3.5, md: 5 },
                  border: `1px solid ${HAIRLINE}`,
                  borderRadius: 3,
                  bgcolor: '#FFFFFF',
                  boxShadow: '0 24px 60px -32px rgba(20,32,45,0.18)',
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: EMERALD }} />
                  <Typography sx={{ fontWeight: 800, color: NAVY, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    SEND US A NOTE
                  </Typography>
                </Stack>
                <Typography variant="h3" sx={{ fontWeight: 900, color: INK, fontSize: { xs: '1.4rem', md: '1.6rem' }, lineHeight: 1.2, mb: 1.25 }}>
                  Tell us about your service.
                </Typography>
                <Typography sx={{ color: MIST, fontSize: '0.92rem', lineHeight: 1.6, mb: 3.5 }}>
                  We won't share your details with anyone. We may use them to send you a monthly update about CQC and care-sector regulation — you can unsubscribe anytime.
                </Typography>

                {sent && (
                  <Alert
                    severity="success"
                    sx={{ mb: 3, borderRadius: 2, '& .MuiAlert-icon': { color: EMERALD_DEEP } }}
                  >
                    Thank you — we'll get back to you within 4 business hours.
                  </Alert>
                )}
                {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

                <Grid container component="form" onSubmit={handleSubmit} spacing={2.5}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Your name"
                      required
                      fullWidth
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Work email"
                      required
                      type="email"
                      fullWidth
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Company / organisation"
                      fullWidth
                      value={form.company}
                      onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Your message"
                      required
                      multiline
                      rows={5}
                      fullWidth
                      placeholder="A couple of sentences about your service and what you'd like to know about MeticleCare…"
                      value={form.message}
                      onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      fullWidth
                      disabled={sending}
                      sx={{
                        bgcolor: NAVY, '&:hover': { bgcolor: NAVY_DEEP },
                        fontWeight: 800, py: 1.65, fontSize: '1rem',
                      }}
                    >
                      {sending ? <CircularProgress size={24} sx={{ color: 'white' }} /> : 'Send message'}
                    </Button>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ENTERPRISE BAND — split card row for multi-site + tender buyers */}
      <Box component="section" sx={{ py: { xs: 9, md: 11 }, bgcolor: BONE, borderTop: `1px solid ${HAIRLINE}`, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 3, md: 4 }}>
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  height: '100%',
                  p: { xs: 3, md: 4 },
                  bgcolor: '#FFFFFF',
                  border: `1px solid ${HAIRLINE}`,
                  borderRadius: 3,
                  borderLeft: `3px solid ${EMERALD}`,
                }}
              >
                <Typography sx={{ fontWeight: 900, color: NAVY, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', mb: 1 }}>
                  ENTERPRISE · 100+ STAFF
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, color: INK, fontSize: '1.4rem', lineHeight: 1.25, mb: 1.5 }}>
                  For groups, franchises and local authorities.
                </Typography>
                <Typography sx={{ color: MIST, fontSize: '0.92rem', lineHeight: 1.65, mb: 2 }}>
                  Multi-site rollouts, custom SSO and API integrations, named CSM, on-site training and quarterly review. Page through the questionnaire and we'll arrange a procurement conversation.
                </Typography>
                <Typography sx={{ fontWeight: 800 }}>
                  <Box component="span" sx={{ color: MIST, fontSize: '0.78rem', mr: 1 }}>EMAIL</Box>
                  <Box component="span" sx={{ color: NAVY, fontSize: '0.95rem' }}>enterprise@meticlecare.com</Box>
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  height: '100%',
                  p: { xs: 3, md: 4 },
                  bgcolor: '#FFFFFF',
                  border: `1px solid ${HAIRLINE}`,
                  borderRadius: 3,
                  borderLeft: `3px solid ${EMERALD}`,
                }}
              >
                <Typography sx={{ fontWeight: 900, color: NAVY, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', mb: 1 }}>
                  PROCUREMENT & TENDER
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, color: INK, fontSize: '1.4rem', lineHeight: 1.25, mb: 1.5 }}>
                  For NHS, councils and Section 1(1) bodies.
                </Typography>
                <Typography sx={{ color: MIST, fontSize: '0.92rem', lineHeight: 1.65, mb: 2 }}>
                  UK GDPR / DPA 2018 data-processing agreement, NHS DSPT-aligned controls, accessible procurement documentation. We hold a 15% off-list price for these organisations — get in touch for a tender submission.
                </Typography>
                <Typography sx={{ fontWeight: 800 }}>
                  <Box component="span" sx={{ color: MIST, fontSize: '0.78rem', mr: 1 }}>EMAIL</Box>
                  <Box component="span" sx={{ color: NAVY, fontSize: '0.95rem' }}>procurement@meticlecare.com</Box>
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* TRUST STRIP — same as the rest of the marketing site */}
      <Box component="section" aria-label="Standards MeticleCare is built for" sx={{ bgcolor: '#FFFFFF', borderBottom: `1px solid ${HAIRLINE}`, py: { xs: 5, md: 6 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 3, md: 4 }} alignItems="center">
            <Grid item xs={12} md={3}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: NAVY, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Built for the UK's care sector
              </Typography>
            </Grid>
            <Grid item xs={12} md={9}>
              <Grid container spacing={{ xs: 2, md: 2.5 }}>
                {[
                  { mark: 'CQC', label: 'Care Quality Commission', detail: 'England · 5 KLOEs' },
                  { mark: 'CIW', label: 'Care Inspectorate Wales', detail: 'CIW framework' },
                  { mark: 'CIS', label: 'Care Inspectorate Scotland', detail: 'Health & social care' },
                  { mark: 'RQIA', label: 'NI Quality & Improvement', detail: 'Northern Ireland' },
                  { mark: 'GDPR', label: 'UK GDPR · DPA 2018', detail: 'DSPT self-assessment' },
                ].map((t) => (
                  <Grid item xs={6} sm={4} md key={t.mark}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box
                        sx={{
                          width: 36, height: 36, borderRadius: 1.5,
                          bgcolor: t.mark === 'CIW' || t.mark === 'GDPR' ? EMERALD : NAVY,
                          color: '#FFFFFF', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontWeight: 900, fontSize: '0.7rem',
                          flexShrink: 0,
                        }}
                      >
                        {t.mark}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 800, color: INK, fontSize: '0.82rem', lineHeight: 1.25 }} noWrap>{t.label}</Typography>
                        <Typography sx={{ color: MIST, fontSize: '0.74rem', lineHeight: 1.3 }} noWrap>{t.detail}</Typography>
                      </Box>
                    </Stack>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* FINAL CTA — matches the rest of the marketing site */}
      <Box component="section" sx={{ py: { xs: 11, md: 15 }, bgcolor: INK_DARK, color: '#FFFFFF', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography
            variant="h2"
            sx={{ fontSize: { xs: '2.1rem', md: '3rem' }, fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.03em', mb: 3, color: '#FFFFFF' }}
          >
            Or skip the form and start your free trial.
          </Typography>
          <Typography sx={{ opacity: 0.92, fontSize: '1.12rem', lineHeight: 1.7, mb: 5, maxWidth: 560, mx: 'auto' }}>
            14 days of full Care Service functionality, no credit card required. We pull migration data from your existing system for free in the first 30 days.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              size="large"
              onClick={() => { window.location.href = '/register' }}
              sx={{
                bgcolor: EMERALD_DEEP, '&:hover': { bgcolor: '#065F46' },
                fontWeight: 800, px: { xs: 5, sm: 7 }, py: 1.9, fontSize: '1.05rem',
              }}
            >
              Start your free trial
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => { window.location.href = '/pricing' }}
              sx={{
                borderColor: 'rgba(255,255,255,0.4)', color: '#FFFFFF',
                '&:hover': { borderColor: '#FFFFFF', bgcolor: 'rgba(255,255,255,0.06)' },
                fontWeight: 700, px: { xs: 5, sm: 6 }, py: 1.9, fontSize: '1.05rem',
              }}
            >
              See pricing first
            </Button>
          </Stack>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
