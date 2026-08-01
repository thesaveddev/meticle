import { Container, Typography, Grid, Box, Stack, Paper, Button, Chip } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { Schedule as DateIcon, Person as AuthorIcon } from '@mui/icons-material'
import MarketingLayout from '../../components/marketing/MarketingLayout'

const blogPosts = [
  {
    title: 'CQC Single Assessment Framework: What It Means for Supported Living Providers in 2026',
    excerpt: 'The CQC\'s Single Assessment Framework replaced the old KLOE system with 34 Quality Statements across 5 domains. Here\'s what supported living providers need to know to stay ahead.',
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
    excerpt: 'CQC\'s Well-led domain requires evidence of staff feedback and engagement. Here\'s how to build a survey programme that generates real evidence for your next inspection.',
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
  const featured = blogPosts.find(p => p.featured)
  const others = blogPosts.filter(p => !p.featured)

  return (
    <MarketingLayout>
      {/* Header */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#F8FAFC', borderBottom: '1px solid #E5E7EB' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', maxWidth: 700, mx: 'auto' }}>
            <Typography variant="h2" sx={{ mb: 3, fontSize: { xs: '2rem', md: '2.8rem' } }}>
              Compliance Blog & Guides
            </Typography>
            <Typography sx={{ color: '#6B7280', fontSize: '1.15rem' }}>
              Expert guides and insights on CQC compliance, care management, and supported living best practices across all four UK regulators.
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* Featured Post */}
      {featured && (
        <Box sx={{ py: 8, bgcolor: '#F8FAFC' }}>
          <Container maxWidth="lg">
            <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, border: '1px solid #E5E7EB', borderRadius: 4, bgcolor: 'white', cursor: 'pointer', '&:hover': { boxShadow: '0 8px 30px rgba(0,0,0,0.06)' } }}>
              <Grid container spacing={4} alignItems="center">
                <Grid item xs={12} md={8}>
                  <Chip label="Featured" size="small" sx={{ bgcolor: '#0F4C81', color: 'white', fontWeight: 700, mb: 2 }} />
                  <Typography variant="h4" sx={{ fontWeight: 900, mb: 2 }}>{featured.title}</Typography>
                  <Typography sx={{ color: '#6B7280', lineHeight: 1.7, mb: 3 }}>{featured.excerpt}</Typography>
                  <Stack direction="row" spacing={3} alignItems="center" sx={{ mb: 2 }}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <DateIcon sx={{ fontSize: 16, color: '#9CA3AF' }} />
                      <Typography variant="caption" color="#9CA3AF">{featured.date}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <AuthorIcon sx={{ fontSize: 16, color: '#9CA3AF' }} />
                      <Typography variant="caption" color="#9CA3AF">{featured.author}</Typography>
                    </Stack>
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    {featured.tags.map(t => <Chip key={t} label={t} size="small" variant="outlined" sx={{ fontWeight: 600 }} />)}
                  </Stack>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 4, bgcolor: '#0F4C81', borderRadius: 3, color: 'white', textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>Read More →</Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Container>
        </Box>
      )}

      {/* Post Grid */}
      <Box sx={{ py: 8 }}>
        <Container maxWidth="lg">
          <Typography variant="h4" sx={{ mb: 6, fontWeight: 900 }}>Latest Guides</Typography>
          <Grid container spacing={4}>
            {others.map((post, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Paper elevation={0} sx={{ p: 3, border: '1px solid #E5E7EB', borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column', cursor: 'pointer', '&:hover': { boxShadow: '0 8px 30px rgba(0,0,0,0.06)', borderColor: '#0F4C81' } }}>
                  <Chip label={post.category} size="small" sx={{ bgcolor: '#E7EEF4', color: '#0F4C81', fontWeight: 700, mb: 2, alignSelf: 'flex-start' }} />
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5, flex: 1 }}>{post.title}</Typography>
                  <Typography variant="body2" sx={{ color: '#6B7280', mb: 3, lineHeight: 1.6 }}>{post.excerpt}</Typography>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <DateIcon sx={{ fontSize: 14, color: '#9CA3AF' }} />
                      <Typography variant="caption" color="#9CA3AF">{post.date}</Typography>
                    </Stack>
                  </Stack>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {post.tags.map(t => <Chip key={t} label={t} size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />)}
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA */}
      <Box sx={{ py: 10, bgcolor: '#0F4C81', textAlign: 'center', color: 'white' }}>
        <Container maxWidth="md">
          <Typography variant="h4" sx={{ mb: 2, fontWeight: 900 }}>Want to See It in Action?</Typography>
          <Typography sx={{ mb: 5, opacity: 0.9 }}>Start your free trial and see how Meticle transforms compliance across all four UK regulators.</Typography>
          <Button variant="contained" size="large" onClick={() => navigate('/register')} sx={{ bgcolor: 'white', color: '#0F4C81', py: 2, px: 6, fontWeight: 800, '&:hover': { bgcolor: '#F8FAFC' } }}>
            Start Free Trial
          </Button>
        </Container>
      </Box>
    </MarketingLayout>
  )
}
