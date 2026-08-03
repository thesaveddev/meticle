import { useState } from 'react'
import { Container, Typography, Grid, Box, Stack, Button, TextField, Paper, Alert, CircularProgress } from '@mui/material'
import { Email, Phone, LocationOn, AccessTime } from '@mui/icons-material'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import api from '../../services/api'
import PageMeta from '../../components/PageMeta'

const contactMethods = [
  { icon: <Email sx={{ color: '#0F4C81' }} />, title: 'Email', detail: 'hello@meticlecare.com', sub: 'We reply within 4 hours' },
  { icon: <Phone sx={{ color: '#0F4C81' }} />, title: 'Phone', detail: '+44 20 1234 5678', sub: 'Mon-Fri, 9am-5:30pm' },
  { icon: <LocationOn sx={{ color: '#0F4C81' }} />, title: 'Office', detail: '71-75 Shelton Street, London, WC2H 9JQ', sub: 'By appointment only' },
  { icon: <AccessTime sx={{ color: '#0F4C81' }} />, title: 'Support Hours', detail: '8:00am - 6:00pm GMT', sub: '24/7 emergency support for Enterprise plans' },
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
    <>
      <PageMeta title="Contact MeticleCare | MeticleCare" description="Get in touch with the MeticleCare team. Ask about our care management platform for UK supported living, domiciliary care and care home providers." canonicalPath="/contact" />
    <MarketingLayout>
      <Box sx={{ py: 15, bgcolor: '#F8FAFC', borderBottom: '1px solid #E5E7EB' }}>
        <Container maxWidth="lg">
          <Grid container spacing={8}>
            <Grid item xs={12} md={5}>
              <Typography variant="overline" sx={{ fontWeight: 800, color: '#0F4C81' }}>GET IN TOUCH</Typography>
              <Typography variant="h2" sx={{ mt: 2, mb: 3 }}>Let's Talk About Your Care Operations</Typography>
              <Typography sx={{ color: '#6B7280', fontSize: '1.1rem', lineHeight: 1.8, mb: 6 }}>
                Whether you're evaluating platforms, need support, or want to discuss a custom enterprise deployment — we're here to help.
              </Typography>
              <Stack spacing={4}>
                {contactMethods.map((m, i) => (
                  <Stack key={i} direction="row" spacing={2} alignItems="flex-start">
                    <Box sx={{ p: 1.5, bgcolor: '#E7EEF4', borderRadius: 2, display: 'flex' }}>{m.icon}</Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{m.title}</Typography>
                      <Typography variant="body2" sx={{ color: '#0F4C81', fontWeight: 600 }}>{m.detail}</Typography>
                      <Typography variant="caption" color="text.secondary">{m.sub}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} md={7}>
              <Paper sx={{ p: 5, borderRadius: 3 }}>
                <Typography variant="h5" sx={{ mb: 4, fontWeight: 800 }}>Send Us a Message</Typography>
                {sent && <Alert severity="success" sx={{ mb: 3 }}>Thank you! We'll get back to you within 4 hours.</Alert>}
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
                <Stack component="form" onSubmit={handleSubmit} spacing={3}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <TextField label="Your Name" required fullWidth value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField label="Email" required type="email" fullWidth value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                    </Grid>
                  </Grid>
                  <TextField label="Company / Organisation" fullWidth value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} />
                  <TextField label="Message" required multiline rows={5} fullWidth value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} />
                  <Button type="submit" variant="contained" size="large" disabled={sending} sx={{ bgcolor: '#0F4C81', py: 1.8, fontWeight: 800, fontSize: '1rem' }}>
                    {sending ? <CircularProgress size={24} sx={{ color: 'white' }} /> : 'Send Message'}
                  </Button>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box sx={{ py: 10, bgcolor: 'white', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>Enterprise Sales</Typography>
          <Typography sx={{ color: '#6B7280', mb: 1 }}>For organisations with 100+ staff requiring custom deployment, dedicated support, or BAA agreements.</Typography>
          <Typography sx={{ color: '#0F4C81', fontWeight: 700 }}>enterprise@meticlecare.com</Typography>
        </Container>
      </Box>
    </MarketingLayout>
    </>
  )
}
