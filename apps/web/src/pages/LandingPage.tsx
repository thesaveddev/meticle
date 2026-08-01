import { Box, Button, Container, Typography, Grid, Stack, Accordion, AccordionSummary, AccordionDetails, Paper, Chip, Divider, Card } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle as CheckIcon, ExpandMore as ExpandMoreIcon,
  Verified as VerifiedIcon,
  PhoneAndroid as PhoneIcon, Medication as MedicationIcon,
  Shield as ShieldIcon, Map as RegulatorIcon, Security as SecurityIcon,
  TrendingUp as TrendingUpIcon, Lock as LockIcon,
  Storefront as StorefrontIcon,
} from '@mui/icons-material'
import MarketingLayout from '../components/marketing/MarketingLayout'

const HERO_IMAGE = '/meticle_dashboard_hero.jpg'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <MarketingLayout>
      {/* HERO */}
      <Box sx={{ py: { xs: 8, md: 14 }, bgcolor: 'white' }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center">
            <Grid item xs={12} lg={6}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
                <RegulatorIcon sx={{ fontSize: 18, color: '#16A34A' }} />
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#16A34A', letterSpacing: 1, textTransform: 'uppercase' }}>
                  All Four UK Regulators Supported
                </Typography>
              </Stack>

              <Typography variant="h1" sx={{ mb: 3, fontSize: { xs: '2.2rem', md: '3.2rem' }, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-1.5px' }}>
                Compliance-First Care Management <span style={{ color: '#0F4C81' }}>Built for the UK</span>
              </Typography>

              <Typography sx={{ mb: 4, fontSize: '1.1rem', color: '#6B7280', lineHeight: 1.7 }}>
                The only supported living platform that scores all 5 CQC domains from <strong>real data</strong> across all 4 UK regulators — CQC, CIW, Care Inspectorate, and RQIA. One-click evidence packs. Zero paperwork stress.
              </Typography>

              {/* Certification Badges */}
              <Stack direction="row" spacing={1.5} sx={{ mb: 4, flexWrap: 'wrap', gap: 1 }}>
                <Chip icon={<ShieldIcon />} label="CQC Compliant" size="small" sx={{ fontWeight: 700, bgcolor: '#E7EEF4', color: '#0F4C81' }} />
                <Chip icon={<SecurityIcon />} label="GDPR & ICO Registered" size="small" sx={{ fontWeight: 700, bgcolor: '#E7EEF4', color: '#0F4C81' }} />
                <Chip icon={<LockIcon />} label="ISO 27001 Certified" size="small" sx={{ fontWeight: 700, bgcolor: '#E7EEF4', color: '#0F4C81' }} />
                <Chip icon={<VerifiedIcon />} label="UK Data Sovereignty" size="small" sx={{ fontWeight: 700, bgcolor: '#E7EEF4', color: '#0F4C81' }} />
                <Chip icon={<VerifiedIcon />} label="DSPT Management Built-In" size="small" sx={{ fontWeight: 700, bgcolor: '#E7EEF4', color: '#0F4C81' }} />
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button variant="contained" size="large" sx={{ bgcolor: '#0F4C81', py: 2, px: 5, fontSize: '1.1rem', fontWeight: 800 }} onClick={() => navigate('/register')}>
                  Start Free Trial
                </Button>
                <Button variant="outlined" size="large" sx={{ py: 2, px: 5, fontSize: '1.1rem', borderColor: '#E5E7EB', color: '#111827', fontWeight: 700 }} onClick={() => navigate('/features')}>
                  See Features
                </Button>
              </Stack>

              {/* Quick Stats */}
              <Grid container spacing={2} sx={{ mt: 5 }}>
                {[
                  { val: '4', lbl: 'UK Regulators' },
                  { val: '5', lbl: 'CQC Domains Scored' },
                  { val: 'Real', lbl: 'Data — Not Estimates' },
                ].map((m, i) => (
                  <Grid item xs={4} key={i}>
                    <Box sx={{ p: 1.5, bgcolor: '#F8FAFC', borderRadius: 2, border: '1px solid #E5E7EB', textAlign: 'center' }}>
                      <Typography variant="h6" sx={{ color: '#0F4C81', fontWeight: 800, fontSize: { xs: '1rem', md: '1.25rem' } }}>{m.val}</Typography>
                      <Typography variant="caption" sx={{ color: '#6B7280', fontWeight: 600 }}>{m.lbl}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Grid>

            <Grid item xs={12} lg={6}>
              <Box sx={{ position: 'relative' }}>
                <img src={HERO_IMAGE} alt="Meticle Dashboard" style={{ width: '100%', borderRadius: 12, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)', border: '1px solid #E5E7EB' }} />
                <Box sx={{ position: 'absolute', top: -12, right: -12, bgcolor: '#16A34A', color: 'white', px: 2, py: 0.5, borderRadius: 2, fontWeight: 800, fontSize: '0.8rem' }}>
                  Live Readiness Score
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* REGULATOR STRIP */}
      <Box sx={{ py: 5, bgcolor: '#F8FAFC', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}>
        <Container maxWidth="lg">
          <Stack direction="row" spacing={{ xs: 2, md: 6 }} justifyContent="center" alignItems="center" flexWrap="wrap" useFlexGap>
            {[
              { name: 'CQC', desc: 'England' },
              { name: 'CIW / RISCA', desc: 'Wales' },
              { name: 'Care Inspectorate', desc: 'Scotland' },
              { name: 'RQIA', desc: 'Northern Ireland' },
            ].map((r, i) => (
              <Stack key={i} direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ width: 36, height: 36, bgcolor: '#0F4C81', borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '0.7rem' }}>
                  {r.name.split('/')[0].trim()}
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#111827' }}>{r.name}</Typography>
                  <Typography variant="caption" sx={{ color: '#6B7280' }}>{r.desc}</Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* COMPREHENSIVE FEATURES MENU */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#F8FAFC' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography variant="overline" sx={{ color: '#0F4C81', fontWeight: 800, letterSpacing: 3 }}>Platform Features</Typography>
            <Typography variant="h2" sx={{ mt: 1, mb: 2 }}>Everything You Need to Run Your Service</Typography>
            <Typography sx={{ color: '#6B7280', fontSize: '1.1rem', maxWidth: 700, mx: 'auto' }}>
              From daily care to compliance reporting — one unified platform for supported living and domiciliary care.
            </Typography>
          </Box>

          {[
            {
              cat: 'Care Management',
              color: '#0F4C81',
              items: [
                { title: 'eMAR & Medication Management', desc: 'Digital medication rounds with full audit trails' },
                { title: 'Daily Care Notes', desc: 'Record and share daily care observations' },
                { title: 'Person-Centred Support Plans', desc: 'Build tailored, person-centred support plans' },
                { title: 'Body Mapping', desc: 'Visual injury and mark documentation' },
                { title: 'Appointments & Health Checks', desc: 'Track appointments and health reviews' },
                { title: 'Goals & Progress Tracking', desc: 'Set goals and measure outcomes' },
              ],
            },
            {
              cat: 'Staff & Operations',
              color: '#16A34A',
              items: [
                { title: 'Staff Rostering & Scheduling', desc: 'Create rotas and manage shift patterns' },
                { title: 'Staff Holiday & Absence Management', desc: 'Track annual leave, count holiday days, log absences' },
                { title: 'Incident & Safeguarding', desc: 'Report, track and escalate incidents' },
                { title: 'Task Management', desc: 'Assign and monitor team tasks' },
                { title: 'Secure Staff Messaging', desc: 'GDPR-compliant internal messaging' },
                { title: 'Expense Tracking', desc: 'Track petty cash, receipts and person spending', tag: 'Phase 2' },
                { title: 'Right to Work & DBS Reminders', desc: 'Automated alerts before documents expire' },
                { title: 'PBS Plans', desc: 'Positive Behaviour Support plans included in every subscription' },
              ],
            },
            {
              cat: 'Staff & Operations',
              color: '#16A34A',
              items: [
                { title: 'Staff Rostering & Scheduling', desc: 'Create rotas and manage shift patterns' },
                { title: 'Staff Holiday & Absence Management', desc: 'Track annual leave, count holiday days, log absences' },
                { title: 'Incident & Safeguarding', desc: 'Report, track and escalate incidents' },
                { title: 'Task Management', desc: 'Assign and monitor team tasks' },
                { title: 'Secure Staff Messaging', desc: 'GDPR-compliant internal messaging' },
                { title: 'Goals & Progress Tracking', desc: 'Set goals and measure outcomes' },
                { title: 'Expense Tracking', desc: 'Track petty cash, receipts and person spending', tag: 'Phase 2' },
                { title: 'Right to Work & DBS Reminders', desc: 'Automated alerts before documents expire' },
                { title: 'PBS Plans', desc: 'Positive Behaviour Support plans included in every subscription' },
              ],
            },
            {
              cat: 'Compliance & Reporting',
              color: '#7C3AED',
              items: [
                { title: 'Inspection Readiness Dashboard', desc: 'Stay prepared for regulatory inspections' },
                { title: 'Compliance Reminders', desc: 'Automated alerts for fire drills, PAT tests and more' },
                { title: 'Audit Reports', desc: 'Generate compliance and audit reports' },
                { title: 'Training Compliance Matrix', desc: 'CQC-mandated training tracking per role with gap-flagging' },
                { title: 'Satisfaction & Engagement Surveys', desc: 'Email-invited surveys feeding CQC Caring and Well-led domains' },
                { title: 'Room Checks', desc: 'Digital room inspection records' },
                { title: 'Data Backup & Restore', desc: 'Secure, GDPR-compliant data protection' },
                { title: 'Policy & Procedure Management', desc: 'Upload, version-control and share team policies' },
              ],
            },
          ].map((section, si) => (
            <Box key={si} sx={{ mb: si < 2 ? 6 : 0 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                <Box sx={{ width: 6, height: 28, bgcolor: section.color, borderRadius: 1 }} />
                <Typography variant="h5" sx={{ fontWeight: 800 }}>{section.cat}</Typography>
              </Stack>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr' },
                gap: 1,
              }}>
                {section.items.map((item, ii) => (
                  <Box key={ii} sx={{
                    py: 1.5,
                    px: 2,
                    borderRadius: 1.5,
                    borderLeft: `3px solid ${section.color}25`,
                    '&:hover': { bgcolor: 'white', borderLeftColor: section.color },
                    transition: 'all 0.15s',
                  }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.title}</Typography>
                      {item.tag && (
                        <Chip label={item.tag} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: '#FEF3C7', color: '#D97706' }} />
                      )}
                    </Stack>
                    <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '0.85rem', lineHeight: 1.4 }}>{item.desc}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Container>
      </Box>

      {/* MULTI-REGULATOR + READINESS */}
      <Box sx={{ py: { xs: 8, md: 14 }, bgcolor: '#0F4C81', color: 'white' }}>
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={6}>
              <Chip label="UNIQUE DIFFERENTIATOR" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'white', fontWeight: 800, mb: 3 }} />
              <Typography variant="h2" sx={{ mb: 3, fontSize: { xs: '1.8rem', md: '2.4rem' }, fontWeight: 900 }}>
                The Only Platform With All 4 UK Regulators Natively Supported
              </Typography>
              <Typography sx={{ opacity: 0.9, mb: 4, lineHeight: 1.7 }}>
                Most care software is CQC-only. A handful of competitors support multiple regulators — but we go further by <strong>scoring every domain from real data</strong>, not manual entry.
              </Typography>
              <Stack spacing={2} sx={{ mb: 5 }}>
                {[
                  'CQC (England) — Single Assessment Framework, 34 Quality Statements, real-data scoring',
                  'CIW / RISCA (Wales) — Regulation and Inspection of Social Care Act, framework-aware evidence packs',
                  'Care Inspectorate (Scotland) — Health and Social Care Standards, configurable quality themes',
                  'RQIA (Northern Ireland) — Quality Standards for Health and Social Care, full audit trail governance',
                ].map((item, i) => (
                  <Stack key={i} direction="row" spacing={1.5} alignItems="flex-start">
                    <CheckIcon sx={{ fontSize: 18, color: '#86EFAC', mt: 0.3, flexShrink: 0 }} />
                    <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{item}</Typography>
                  </Stack>
                ))}
              </Stack>
              <Button variant="contained" size="large" sx={{ bgcolor: 'white', color: '#0F4C81', fontWeight: 800, '&:hover': { bgcolor: '#F8FAFC' } }} onClick={() => navigate('/features')}>
                See How Scoring Works
              </Button>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 4, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.2)' }}>
                <Typography variant="h5" sx={{ mb: 3, fontWeight: 800 }}>Your Live Readiness Dashboard</Typography>
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 3 }}>Scores calculated from actual records — no manual entry, no proxies, no estimates.</Typography>
                <Stack spacing={2.5}>
                  {[
                    { domain: 'Safe', score: 84, source: 'Competency assessments + incident tracking', color: '#16A34A' },
                    { domain: 'Effective', score: 78, source: 'Training completion + compliance records', color: '#0284C7' },
                    { domain: 'Caring', score: 91, source: 'Satisfaction survey responses', color: '#7C3AED' },
                    { domain: 'Responsive', score: 69, source: 'Incident severity + escalation data', color: '#F59E0B' },
                    { domain: 'Well-led', score: 82, source: 'Staff engagement + audit trail quality', color: '#0F4C81' },
                  ].map(d => (
                    <Box key={d.domain}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{d.domain}</Typography>
                          <Typography variant="caption" sx={{ opacity: 0.6 }}>{d.source}</Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{d.score}%</Typography>
                      </Stack>
                      <Box sx={{ height: 8, bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 4, overflow: 'hidden' }}>
                        <Box sx={{ height: '100%', width: `${d.score}%`, bgcolor: d.color, borderRadius: 4, transition: 'width 1.5s ease' }} />
                      </Box>
                    </Box>
                  ))}
                </Stack>
                <Box sx={{ mt: 4, p: 2.5, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>Overall Readiness: <Typography component="span" variant="h5" sx={{ fontWeight: 900, ml: 1 }}>81% — Good</Typography></Typography>
                  <Typography variant="caption" sx={{ opacity: 0.6, display: 'block', mt: 0.5 }}>Last updated from live data • Updated automatically</Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* DOMICILIARY CARE */}
      <Box sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Chip label="COMING IN PHASE 2" size="small" sx={{ bgcolor: '#FEF3C7', color: '#D97706', fontWeight: 800, mb: 2 }} />
            <Typography variant="h2" sx={{ mb: 2 }}>Domiciliary Care Modules</Typography>
            <Typography sx={{ color: '#6B7280', maxWidth: 600, mx: 'auto' }}>
              Mobile-first tools purpose-built for community carers and medication management. Currently in development.
            </Typography>
          </Box>
          <Grid container spacing={4}>
            {[
              { icon: <PhoneIcon sx={{ fontSize: 36 }} />, title: 'Carer Mobile PWA', features: ['GPS check-in/out at visits', 'Biometric face verification', 'Offline roster with sync', 'Real-time shift alerts'], color: '#0F4C81' },
              { icon: <MedicationIcon sx={{ fontSize: 36 }} />, title: 'eMAR — Medication Records', features: ['31-day MAR chart with audit trail', 'Stock management & daily counts', 'Missed dose & PRN tracking', 'Print-ready MAR reports'], color: '#16A34A' },
              { icon: <StorefrontIcon sx={{ fontSize: 36 }} />, title: 'Shift Marketplace', features: ['Broadcast open shifts instantly', 'Staff claim via mobile app', 'Reduce agency dependency', 'Compliance-checked assignments'], color: '#0284C7' },
              { icon: <TrendingUpIcon sx={{ fontSize: 36 }} />, title: 'Daily Monitoring Charts', features: ['Fluid, food, bowel/urine charts', 'CQC-aligned medication tracking', 'Point-of-care recording', 'Inspection-ready exports'], color: '#7C3AED' },
            ].map((m, i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Paper elevation={0} sx={{ p: 4, height: '100%', border: '1px solid #E5E7EB', borderRadius: 3, bgcolor: '#F8FAFC' }}>
                  <Box sx={{ color: m.color, mb: 2 }}>{m.icon}</Box>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 800 }}>{m.title}</Typography>
                  <Stack spacing={1}>
                    {m.features.map((f, j) => (
                      <Stack key={j} direction="row" spacing={1} alignItems="center">
                        <CheckIcon sx={{ fontSize: 16, color: '#16A34A' }} />
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{f}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* TRUST + SECURITY */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#F8FAFC', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}>
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={5}>
              <Chip label="SECURITY & TRUST" size="small" sx={{ bgcolor: '#E7EEF4', color: '#0F4C81', fontWeight: 800, mb: 2 }} />
              <Typography variant="h3" sx={{ mb: 3, fontWeight: 900, fontSize: { xs: '1.8rem', md: '2.2rem' } }}>Enterprise-Grade Security, UK Data Sovereignty</Typography>
              <Typography sx={{ color: '#6B7280', mb: 5, lineHeight: 1.7 }}>
                Your data is protected by bank-level encryption, hosted in UK-based ISO 27001-certified data centres, and fully compliant with UK GDPR and the Data Protection Act 2018.
              </Typography>
              <Grid container spacing={2}>
                {[
                  { icon: <LockIcon />, title: 'AES-256 Encryption', desc: 'At rest and in transit' },
                  { icon: <VerifiedIcon />, title: 'ISO 27001', desc: 'UK data centres' },
                  { icon: <ShieldIcon />, title: 'Role-Based Access', desc: 'Granular permissions' },
                  { icon: <SecurityIcon />, title: 'Full Audit Trail', desc: 'Every action logged' },
                ].map((s, i) => (
                  <Grid item xs={6} key={i}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box sx={{ color: '#0F4C81' }}>{s.icon}</Box>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>{s.title}</Typography>
                        <Typography variant="caption" sx={{ color: '#6B7280' }}>{s.desc}</Typography>
                      </Box>
                    </Stack>
                  </Grid>
                ))}
              </Grid>
            </Grid>
            <Grid item xs={12} md={7}>
              <Box sx={{ p: 4, bgcolor: 'white', borderRadius: 4, border: '1px solid #E5E7EB' }}>
                <Typography variant="h5" sx={{ mb: 3, fontWeight: 800, textAlign: 'center' }}>Trusted by UK Care Providers</Typography>
                <Grid container spacing={4} sx={{ mb: 4 }}>
                  {[
                    { val: '4', lbl: 'UK regulators supported' },
                    { val: '100%', lbl: 'compliance visibility' },
                    { val: '50%', lbl: 'faster evidence packs' },
                  ].map((s, i) => (
                    <Grid item xs={4} key={i} sx={{ textAlign: 'center' }}>
                      <Typography variant="h3" sx={{ fontWeight: 900, color: '#0F4C81' }}>{s.val}</Typography>
                      <Typography variant="caption" sx={{ color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>{s.lbl}</Typography>
                    </Grid>
                  ))}
                </Grid>
                <Box sx={{ p: 3, bgcolor: '#F8FAFC', borderRadius: 2, border: '1px solid #E5E7EB' }}>
                  <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#4B5563', mb: 2, lineHeight: 1.6 }}>
                    "The multi-regulator support is a game-changer. We operate across England and Wales, and having both CQC and CIW frameworks in one platform saves us hours of duplicate evidence preparation."
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#111827' }}>— Registered Manager, Multi-site Supported Living</Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* PRICING PREVIEW */}
      <Box sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography variant="h2" sx={{ mb: 2 }}>Simple, Transparent Pricing</Typography>
            <Typography sx={{ color: '#6B7280' }}>No hidden fees. No per-user charges. No long contracts.</Typography>
          </Box>
          <Grid container spacing={4} alignItems="stretch">
            {[
              { t: 'Starter', p: '£99', s: 'Up to 25 staff', f: ['Compliance dashboard & scoring', 'Training compliance matrix', 'Competency assessments', 'Satisfaction surveys', 'Staff engagement surveys', 'Person-centred support plans', 'Daily care notes & health monitoring', 'Email support'], pop: false },
              { t: 'Professional', p: '£299', s: 'Up to 100 staff', f: ['Everything in Starter', 'CQC readiness scoring', 'KLOE evidence packs', 'Multi-site management', 'Rota planner with staffing rules', 'Incident management & action tracking', 'PBS Plans', 'Priority support & onboarding'], pop: true },
              { t: 'Enterprise', p: 'Custom', s: 'Unlimited staff', f: ['Full platform access', 'Dedicated account manager', 'Custom integrations & API', 'White-label evidence packs', 'SLA & priority support', 'Multi-regulator advanced', 'Custom compliance frameworks', 'Dedicated onboarding & training'], pop: false }
            ].map((plan, i) => (
              <Grid item xs={12} md={4} key={i}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', border: plan.pop ? '2px solid #0F4C81' : '1px solid #E5E7EB', borderRadius: 4, position: 'relative', overflow: 'visible' }}>
                  {plan.pop && <Box sx={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', bgcolor: '#0F4C81', color: 'white', px: 3, py: 0.5, borderRadius: 2, fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Most Popular</Box>}
                  <Box sx={{ p: 4, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="overline" sx={{ color: '#6B7280', fontWeight: 800, letterSpacing: 2 }}>{plan.t}</Typography>
                    <Typography variant="h3" sx={{ my: 1.5 }}>{plan.p}<span style={{ fontSize: '1rem', color: '#6B7280', fontWeight: 400 }}>/mo</span></Typography>
                    <Typography sx={{ color: '#0F4C81', fontWeight: 700, mb: 3, fontSize: '0.9rem' }}>{plan.s}</Typography>
                    <Divider sx={{ mb: 3 }} />
                    <Stack spacing={1.5} sx={{ flexGrow: 1, mb: 4 }}>
                      {plan.f.map(f => (
                        <Stack key={f} direction="row" spacing={1} alignItems="flex-start">
                          <CheckIcon sx={{ fontSize: 18, color: '#16A34A', mt: 0.2, flexShrink: 0 }} />
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{f}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                    <Button variant={plan.pop ? 'contained' : 'outlined'} fullWidth onClick={() => navigate('/register')} sx={{ py: 1.5, fontWeight: 800, bgcolor: plan.pop ? '#0F4C81' : 'transparent' }}>
                      {plan.t === 'Enterprise' ? 'Contact Sales' : 'Start Free Trial'}
                    </Button>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* ADD-ON MODULES */}
          <Box sx={{ mt: 8, textAlign: 'center' }}>
            <Typography variant="h5" sx={{ mb: 1, fontWeight: 800 }}>Optional Add-On Modules</Typography>
            <Typography sx={{ color: '#6B7280', mb: 4, maxWidth: 600, mx: 'auto' }}>
              Add advanced functionality to any plan. Mix and match to fit your service.
            </Typography>
            <Grid container spacing={2} justifyContent="center">
              {[
                { name: 'eMAR & Medication', price: 'Included' },
                { name: 'Carer Mobile PWA', price: '+£5/mo' },
                { name: 'Shift Marketplace', price: '+£5/mo' },
                { name: 'Expense Tracking', price: '+£5/mo' },
                { name: 'Room Checks', price: '+£5/mo' },
                { name: 'Task Management', price: '+£5/mo' },
              ].map((addon, i) => (
                <Grid item key={i}>
                  <Paper elevation={0} sx={{ px: 3, py: 2, border: '1px solid #E5E7EB', borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>{addon.name}</Typography>
                    <Typography variant="caption" sx={{ color: '#0F4C81', fontWeight: 800, fontSize: '0.9rem' }}>{addon.price}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
            <Typography variant="caption" sx={{ display: 'block', mt: 2, color: '#9CA3AF' }}>Available on all plans • No long-term commitment • Add or remove anytime</Typography>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Typography variant="body2" color="text.secondary">All plans include 14-day free trial. No credit card required. <Button variant="text" sx={{ fontWeight: 700, textTransform: 'none' }} onClick={() => navigate('/pricing')}>View full pricing details →</Button></Typography>
          </Box>
        </Container>
      </Box>

      {/* CTA */}
      <Box sx={{ py: 12, bgcolor: '#0F4C81', textAlign: 'center', color: 'white' }}>
        <Container maxWidth="md">
          <Typography variant="h2" sx={{ mb: 3, fontSize: { xs: '2rem', md: '2.8rem' }, fontWeight: 900 }}>Ready to Transform Your Compliance?</Typography>
          <Typography sx={{ mb: 6, fontSize: '1.15rem', opacity: 0.9 }}>Join UK care providers replacing spreadsheets and estimates with real-time regulatory compliance scoring across all four UK regulators.</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button variant="contained" size="large" onClick={() => navigate('/register')} sx={{ bgcolor: 'white', color: '#0F4C81', py: 2, px: 6, fontSize: '1.1rem', fontWeight: 800, '&:hover': { bgcolor: '#F8FAFC' } }}>
              Start Free Trial
            </Button>
            <Button variant="outlined" size="large" onClick={() => navigate('/features')} sx={{ borderColor: 'rgba(255,255,255,0.4)', color: 'white', py: 2, px: 6, fontSize: '1.1rem', fontWeight: 700, '&:hover': { borderColor: 'white' } }}>
              Speak to Sales
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* FAQ */}
      <Box sx={{ py: 10 }}>
        <Container maxWidth="md">
          <Typography variant="h2" align="center" sx={{ mb: 8 }}>Frequently Asked Questions</Typography>
          <Stack spacing={2}>
            {[
              { q: 'What regulators does Meticle support?', a: 'All four UK regulators: CQC (England), CIW/RISCA (Wales), Care Inspectorate (Scotland), and RQIA (Northern Ireland). Your compliance scoring and evidence packs automatically adjust based on your organisation\'s selected regulator.' },
              { q: 'How does compliance scoring work?', a: 'Each CQC domain is scored from real records — training completion feeds Effective, competency mapping feeds Safe, satisfaction surveys feed Caring, staff engagement feeds Well-led, and incidents feed Responsive. No manual entry, no proxies.' },
              { q: 'Is my data secure?', a: 'AES-256 encryption at rest, TLS 1.3 in transit. Hosted in UK-based ISO 27001-certified data centres. Role-based access controls, full audit logging, regular penetration testing. UK GDPR and DPA 2018 compliant. ICO registered.' },
              { q: 'Do you offer a free trial?', a: 'Yes. 14-day free trial with full platform access. No credit card required. Setup takes minutes.' },
              { q: 'Can I migrate from my existing system?', a: 'Yes. CSV/Excel templates for bulk import. Custom migration scripts available for larger datasets from other care management platforms.' },
              { q: 'Do you support eMAR and mobile working?', a: 'Yes. Our eMAR module provides a 31-day medication administration record with full audit trail, stock management, daily counts, and print-ready MAR reports. The carer mobile PWA includes GPS check-in, voice notes, and offline roster access.' },
              { q: 'What training and support is included?', a: 'All plans include knowledge base and video tutorials. Professional and Enterprise plans include dedicated onboarding sessions and priority support from our care operations team.' },
            ].map((faq, i) => (
              <Accordion key={i} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography sx={{ fontWeight: 700 }}>{faq.q}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography color="#6B7280">{faq.a}</Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
