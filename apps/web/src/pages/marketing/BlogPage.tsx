import { Container, Typography, Grid, Box, Stack, Paper, Button, Chip } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import {
  Schedule as DateIcon,
  Person as AuthorIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'

// Shared brand tokens — match landing / pricing / features / about / how-it-works / case-studies / contact.
const INK = '#1B2430'
const INK_DARK = '#141C24'
const NAVY = '#0F4C81'
const EMERALD = '#10B981'
const EMERALD_DEEP = '#047857'
const BONE = '#F7F4EE'
const MIST = '#5B6672'
const HAIRLINE = '#E7E1D6'

const blogPosts = [
  {
    title: 'CQC Single Assessment Framework: What It Means for Supported Living Providers in 2026',
    excerpt: "The CQC's Single Assessment Framework replaced the old KLOE system with 34 Quality Statements across 5 domains. Here's what supported living providers need to know to stay ahead.",
    category: 'CQC Compliance',
    author: 'Meticle Team',
    date: 'July 2026',
    tags: ['CQC', 'SAF', 'Compliance'],
    featured: true,
  },
  {
    title: 'How to Evidence All 5 CQC Domains From Real Care Data',
    excerpt: 'Stop using proxies and estimates. Learn how training completion, competency assessments, satisfaction surveys, staff engagement, and incident tracking map to each CQC domain.',
    category: 'CQC Compliance',
    author: 'Meticle Team',
    date: 'June 2026',
    tags: ['CQC', 'Evidence', 'Scoring'],
  },
  {
    title: 'Multi-Regulator Compliance: Operating Across CQC, CIW, Care Inspectorate, and RQIA',
    excerpt: 'If your organisation operates across UK nations, you need a platform that speaks all four regulatory languages. Here\'s how multi-regulator support works in practice.',
    category: 'Multi-Regulator',
    author: 'Meticle Team',
    date: 'June 2026',
    tags: ['CQC', 'CIW', 'Care Inspectorate', 'RQIA'],
  },
  {
    title: 'Training Compliance Matrix: CQC-Mandated Training per Role Explained',
    excerpt: 'Which training modules does CQC mandate for care workers vs managers? How to track, tag, and evidence mandatory training with digital sign-off.',
    category: 'Training',
    author: 'Meticle Team',
    date: 'May 2026',
    tags: ['Training', 'CQC', 'Compliance'],
  },
  {
    title: 'Staff Engagement Surveys: The Missing Piece in Your Well-Led Evidence',
    excerpt: "CQC's Well-led domain requires evidence of staff feedback and engagement. Here's how to build a survey programme that generates real evidence for your next inspection.",
    category: 'Staff Engagement',
    author: 'Meticle Team',
    date: 'May 2026',
    tags: ['Engagement', 'Well-led', 'Surveys'],
  },
  {
    title: 'Competency Assessments With CQC Statement Mapping: A Practical Guide',
    excerpt: 'Every competency assessment should map to a CQC Quality Statement. Here\'s how to design assessments that generate evidence for the Safe domain while verifying staff competence.',
    category: 'Competency',
    author: 'Meticle Team',
    date: 'April 2026',
    tags: ['Competency', 'Safe', 'Assessments'],
  },
  {
    title: 'Satisfaction Surveys for CQC: Building Your Caring Domain Evidence',
    excerpt: 'The Caring domain requires evidence of person and family feedback. Learn how to implement an email-invited satisfaction survey programme with token-based access.',
    category: 'Surveys',
    author: 'Meticle Team',
    date: 'April 2026',
    tags: ['Satisfaction', 'Caring', 'Surveys'],
  },
  {
    title: 'Evidence Packs for CQC Inspection: A Step-by-Step Guide',
    excerpt: 'How to prepare inspection-ready evidence packs organised by CQC domain. From daily notes to KLOE-mapped exports, everything you need for inspection day.',
    category: 'Evidence',
    author: 'Meticle Team',
    date: 'March 2026',
    tags: ['Evidence', 'Inspection', 'CQC'],
  },
  {
    title: 'The 34 Quality Statements: A Complete Reference for Care Providers',
    excerpt: 'Every CQC Quality Statement explained with examples of what evidence looks like in practice. Your complete reference guide to the Single Assessment Framework.',
    category: 'CQC Compliance',
    author: 'Meticle Team',
    date: 'March 2026',
    tags: ['CQC', 'Quality Statements', 'SAF'],
  },
]

export default function BlogPage() {
  const navigate = useNavigate()
  const featured = blogPosts.find((p) => p.featured)
  const others = blogPosts.filter((p) => !p.featured)

  return (
    <MarketingLayout>
      <PageMeta
        title="Blog | MeticleCare"
        description="Insights on care management, compliance, rostering and digital care records for UK care providers. Read the MeticleCare blog."
        canonicalPath="/blog"
      />

      {/* HERO */}
      <Box component="section" sx={{ pt: { xs: 8, md: 11 }, pb: { xs: 8, md: 10 }, bgcolor: BONE, borderBottom: `1px solid ${HAIRLINE}` }}>
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
                UPDATES · SECTOR COMMENTARY · HOW-TO
              </Typography>
            </Box>
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '2.4rem', md: '3.2rem' },
                fontWeight: 900, lineHeight: 1.06, letterSpacing: '-0.03em', color: INK, mb: 3,
              }}
            >
              Compliance blog and guides.
            </Typography>
            <Typography sx={{ color: MIST, fontSize: { xs: '1rem', md: '1.12rem' }, lineHeight: 1.7 }}>
              Practical guides on CQC, CIW, Care Inspectorate Scotland and RQIA — what each regulator expects, how to evidence it from real care records, and the small operational changes that move your inspection rating.
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* TRUST STRIP — same slot as the rest of the marketing site */}
      <Box component="section" aria-label="Standards MeticleCare is built for" sx={{ bgcolor: '#FFFFFF', borderBottom: `1px solid ${HAIRLINE}`, py: { xs: 5, md: 6 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 3, md: 4 }} alignItems="center">
            <Grid item xs={12} md={3}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: NAVY, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Focused on the UK's four regulators
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

      {/* FEATURED POST */}
      {featured && (
        <Box component="section" sx={{ py: { xs: 8, md: 10 }, bgcolor: BONE, borderBottom: `1px solid ${HAIRLINE}` }}>
          <Container maxWidth="lg">
            <Paper
              elevation={0}
              sx={{
                p: { xs: 3, md: 5 },
                border: `1px solid ${HAIRLINE}`,
                borderRadius: 3,
                bgcolor: '#FFFFFF',
                boxShadow: '0 24px 60px -32px rgba(20,32,45,0.18)',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 28px 60px -28px rgba(15,76,129,0.32)' },
              }}
            >
              <Grid container spacing={{ xs: 4, md: 5 }} alignItems="center">
                <Grid item xs={12} md={8}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                    <Chip
                      label="Featured"
                      size="small"
                      sx={{
                        fontWeight: 800, fontSize: '0.7rem', letterSpacing: '0.06em',
                        bgcolor: EMERALD, color: '#FFFFFF', borderRadius: 999,
                      }}
                    />
                    <Chip
                      label={featured.category}
                      size="small"
                      sx={{
                        fontWeight: 800, fontSize: '0.7rem',
                        bgcolor: 'rgba(15,76,129,0.08)', color: NAVY,
                        border: 'none', borderRadius: 999, letterSpacing: '0.04em',
                      }}
                    />
                  </Stack>
                  <Typography
                    variant="h2"
                    sx={{
                      fontWeight: 900, color: INK,
                      fontSize: { xs: '1.6rem', md: '2.05rem' }, lineHeight: 1.15,
                      letterSpacing: '-0.02em', mb: 2,
                    }}
                  >
                    {featured.title}
                  </Typography>
                  <Typography sx={{ color: MIST, fontSize: '1.02rem', lineHeight: 1.7, mb: 2.5 }}>
                    {featured.excerpt}
                  </Typography>
                  <Stack direction="row" spacing={2.5} alignItems="center" sx={{ mb: 2 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <DateIcon sx={{ fontSize: 16, color: MIST }} />
                      <Typography sx={{ color: MIST, fontSize: '0.8rem', fontWeight: 600 }}>{featured.date}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <AuthorIcon sx={{ fontSize: 16, color: MIST }} />
                      <Typography sx={{ color: MIST, fontSize: '0.8rem', fontWeight: 600 }}>{featured.author}</Typography>
                    </Stack>
                  </Stack>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {featured.tags.map((t) => (
                      <Chip
                        key={t}
                        label={t}
                        size="small"
                        sx={{
                          fontWeight: 700, fontSize: '0.7rem',
                          bgcolor: BONE, color: NAVY,
                          border: `1px solid ${HAIRLINE}`, borderRadius: 999,
                        }}
                      />
                    ))}
                  </Stack>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box
                    sx={{
                      p: 4, bgcolor: NAVY, borderRadius: 3, color: '#FFFFFF',
                      textAlign: 'center',
                    }}
                  >
                    <Typography sx={{ fontWeight: 900, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', mb: 1.5, opacity: 0.78 }}>
                      READ THE FULL GUIDE
                    </Typography>
                    <Box
                      sx={{
                        width: 56, height: 56, mx: 'auto', my: 1.5, borderRadius: '50%',
                        bgcolor: '#FFFFFF', color: NAVY,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <ArrowForwardIcon sx={{ fontSize: 28 }} />
                    </Box>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.95rem' }}>
                      Opens the article →
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Container>
        </Box>
      )}

      {/* POST GRID */}
      <Box component="section" sx={{ py: { xs: 9, md: 11 }, bgcolor: '#FFFFFF' }}>
        <Container maxWidth="lg">
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            alignItems={{ xs: 'flex-start', md: 'baseline' }}
            sx={{ mb: 5 }}
          >
            <Typography
              variant="h2"
              sx={{ fontSize: { xs: '1.6rem', md: '2rem' }, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em', color: INK }}
            >
              Latest guides
            </Typography>
            <Typography sx={{ color: MIST, fontSize: '0.92rem', ml: { md: 'auto !important' } }}>
              {others.length} articles · sorted by date
            </Typography>
          </Stack>
          <Grid container spacing={{ xs: 3, md: 4 }}>
            {others.map((post, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 2.75, md: 3.25 },
                    border: `1px solid ${HAIRLINE}`,
                    borderRadius: 2.5,
                    bgcolor: '#FFFFFF',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
                    '&:hover': {
                      borderColor: NAVY,
                      transform: 'translateY(-2px)',
                      boxShadow: '0 12px 28px -16px rgba(15,76,129,0.3)',
                    },
                  }}
                >
                  <Chip
                    label={post.category}
                    size="small"
                    sx={{
                      fontWeight: 800, fontSize: '0.7rem', alignSelf: 'flex-start',
                      bgcolor: 'rgba(15,76,129,0.08)', color: NAVY,
                      border: 'none', borderRadius: 999, letterSpacing: '0.04em',
                      mb: 1.75,
                    }}
                  />
                  <Typography variant="h6" sx={{ fontWeight: 800, color: INK, fontSize: '1rem', mb: 1.25, lineHeight: 1.3, flex: 1 }}>
                    {post.title}
                  </Typography>
                  <Typography sx={{ color: MIST, fontSize: '0.86rem', lineHeight: 1.6, mb: 2.5 }}>
                    {post.excerpt}
                  </Typography>
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.5 }}>
                    <DateIcon sx={{ fontSize: 14, color: MIST }} />
                    <Typography sx={{ color: MIST, fontSize: '0.78rem', fontWeight: 600 }}>{post.date}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {post.tags.map((t) => (
                      <Chip
                        key={t}
                        label={t}
                        size="small"
                        sx={{
                          fontWeight: 700, fontSize: '0.68rem',
                          bgcolor: BONE, color: MIST,
                          border: `1px solid ${HAIRLINE}`, borderRadius: 999,
                        }}
                      />
                    ))}
                  </Stack>
                </Paper>
              </Grid>
            ))}
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
            See it on your service, not a demo dataset.
          </Typography>
          <Typography sx={{ opacity: 0.92, fontSize: '1.12rem', lineHeight: 1.7, mb: 5, maxWidth: 560, mx: 'auto' }}>
            14 days of full Care Service functionality, no credit card required. We pull migration data from your existing system for free in the first 30 days.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate('/register')}
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
              onClick={() => navigate('/contact')}
              sx={{
                borderColor: 'rgba(255,255,255,0.4)', color: '#FFFFFF',
                '&:hover': { borderColor: '#FFFFFF', bgcolor: 'rgba(255,255,255,0.06)' },
                fontWeight: 700, px: { xs: 5, sm: 6 }, py: 1.9, fontSize: '1.05rem',
              }}
            >
              Talk to our team
            </Button>
          </Stack>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
