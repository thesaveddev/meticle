import { Box, Button, Container, Grid, Stack, Typography, TextField, MenuItem } from '@mui/material'
import { ArrowForward, Email, Phone, LocationOn, AccessTime } from '@mui/icons-material'
import { useState } from 'react'
import { M } from '../../styles/marketing-tokens'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: M.r.full, bgcolor: M.teal }} />
      <Typography sx={{ color: M.tealDeep, fontSize: M.caption.fontSize, fontWeight: M.caption.fontWeight, letterSpacing: M.caption.letterSpacing, textTransform: 'uppercase' }}>{children}</Typography>
    </Stack>
  )
}

export default function ContactPageNew() {
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <MarketingLayout>
      <PageMeta title="Book a demo" description="Book a demo to see how MeticleCare can support your domiciliary or supported living care operation." canonicalPath="/contact" />

      <Box sx={{ py: { xs: 10, md: 16 }, bgcolor: M.paper }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="flex-start">
            <Grid item xs={12} md={5}>
              <Eyebrow>Get in touch</Eyebrow>
              <Typography sx={{ fontSize: M.display.fontSize, lineHeight: M.display.lineHeight, fontWeight: M.display.fontWeight, letterSpacing: M.display.letterSpacing, mb: 3 }}>
                Book a demo.
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: M.bodyLg.lineHeight, mb: 5 }}>
                See how MeticleCare connects care delivery, scheduling, medication, risk, compliance and reporting in one platform. Talk to the team about your service.
              </Typography>

              <Stack spacing={3}>
                {[
                  { icon: Email, label: 'Email', value: 'hello@meticlecare.com' },
                  { icon: Phone, label: 'Phone', value: 'Contact us for details' },
                  { icon: LocationOn, label: 'Based in', value: 'United Kingdom' },
                  { icon: AccessTime, label: 'Response time', value: 'Within 1 business day' },
                ].map((item) => (
                  <Stack key={item.label} direction="row" spacing={2} alignItems="flex-start">
                    <Box sx={{ width: 40, height: 40, borderRadius: M.r.sm, bgcolor: M.tealSoft, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <item.icon sx={{ color: M.tealDeep, fontSize: 20 }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: M.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</Typography>
                      <Typography sx={{ fontWeight: 600, mt: 0.25 }}>{item.value}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Grid>

            <Grid item xs={12} md={7}>
              <Box sx={{
                p: { xs: 3, md: 4.5 }, bgcolor: M.card, borderRadius: M.r.xl,
                border: `1px solid ${M.faint}`, boxShadow: M.shadow.md,
              }}>
                {submitted ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Box sx={{ width: 64, height: 64, borderRadius: M.r.full, bgcolor: M.tealSoft, display: 'grid', placeItems: 'center', mx: 'auto', mb: 3 }}>
                      <Typography sx={{ fontSize: '2rem' }}>✓</Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.2rem', mb: 1 }}>Thank you</Typography>
                    <Typography sx={{ color: M.slate }}>We will be in touch within 1 business day.</Typography>
                  </Box>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <Stack spacing={2.5}>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField fullWidth label="Your name" required size="small" />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField fullWidth label="Organisation" required size="small" />
                        </Grid>
                      </Grid>
                      <TextField fullWidth label="Email address" required type="email" size="small" />
                      <TextField fullWidth label="Role" size="small" select>
                        <MenuItem value="">Select your role</MenuItem>
                        <MenuItem value="owner">Owner / Director</MenuItem>
                        <MenuItem value="registered-manager">Registered Manager</MenuItem>
                        <MenuItem value="operations">Operations Director</MenuItem>
                        <MenuItem value="compliance">Compliance Manager</MenuItem>
                        <MenuItem value="coordinator">Care Coordinator</MenuItem>
                        <MenuItem value="other">Other</MenuItem>
                      </TextField>
                      <TextField fullWidth label="Care type" size="small" select>
                        <MenuItem value="">Select your service type</MenuItem>
                        <MenuItem value="domiciliary">Domiciliary care</MenuItem>
                        <MenuItem value="supported-living">Supported living</MenuItem>
                        <MenuItem value="both">Both</MenuItem>
                        <MenuItem value="other">Other</MenuItem>
                      </TextField>
                      <TextField fullWidth label="How can we help?" multiline rows={3} size="small" />
                      <Button type="submit" variant="contained" endIcon={<ArrowForward />} sx={{ bgcolor: M.teal, color: M.navy, fontWeight: 700, py: 1.5, borderRadius: M.r.md, textTransform: 'none', '&:hover': { bgcolor: M.tealDark } }}>
                        Book a demo
                      </Button>
                      <Typography sx={{ color: M.muted, fontSize: '0.78rem' }}>
                        No spam. No sales pressure. Just a focused conversation about your care operation.
                      </Typography>
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
