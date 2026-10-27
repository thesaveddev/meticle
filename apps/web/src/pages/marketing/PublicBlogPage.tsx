import { useState } from 'react'
import { AccessTime, ArrowBack, ArrowForward, CalendarMonth, Check, ExpandMore, Groups, Share } from '@mui/icons-material'
import { Box, Button, Chip, Container, Divider, Grid, Menu, MenuItem, Stack, Typography } from '@mui/material'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import PageMeta from '../../components/PageMeta'
import { M } from '../../styles/marketing-tokens'
import { P } from '../../styles/tokens'
import { NOTICE_COLORS } from '../../theme/noticeTokens'

// Page-local names for the shared design tokens (styles/tokens.ts). `dark` is a
// dark section ground, so it reads the ramp's dark surface rather than ink.
// `emeraldDeep` is the success foreground from theme/noticeTokens.ts.
const C = { navy: P.primary, emerald: P.green, emeraldDeep: NOTICE_COLORS.success.fg, ink: P.navy, dark: P.navyMid, bone: P.warm, mist: P.slate, line: P.hairline, white: P.card }

type Article = { slug: string; title: string; category: string; date: string; readingTime: string; excerpt: string; img: string; body: Array<{ heading: string; paragraphs: string[] }> }

const articles: Article[] = [
  { slug: 'inspection-ready-care-records', title: 'What inspection-ready care records look like in practice', category: 'Compliance', date: '2026-09-01', readingTime: '6 min read', excerpt: 'Inspection readiness is easier to maintain when evidence is created as part of ordinary care work.', img: '/figma/cover-compliance.png', body: [
    { heading: 'Readiness is a working habit', paragraphs: ['Inspection preparation should not depend on rebuilding a service history from scattered documents. A stronger approach is to make everyday records clear, current and easy to trace.', 'That means connecting the person’s plan, the care delivered, the review, the action and the evidence behind it.'] },
    { heading: 'What to make visible', paragraphs: ['Teams should be able to find who recorded an event, when it happened, what was observed and what happened next. Managers also need a practical way to see overdue reviews, open actions and gaps in workforce evidence.', 'Digital tools can support this process, but they do not replace local policies, professional judgement or the requirements of the relevant regulator.'] },
    { heading: 'A useful test', paragraphs: ['Choose one recent care event and follow it through the system: from the plan, to the note, to any incident record, to review and follow-up. If the chain is easy to follow, your operation is building evidence continuously.'] },
  ] },
  { slug: 'domiciliary-care-scheduling', title: 'A practical approach to domiciliary care scheduling', category: 'Domiciliary care', date: '2026-08-20', readingTime: '5 min read', excerpt: 'Good scheduling balances client needs, carer availability, travel and the realities of the working day.', img: '/figma/cover-schedule.png', body: [
    { heading: 'Start with the visit, not the spreadsheet', paragraphs: ['A domiciliary schedule is more than a list of names and times. Each call has a client, a care requirement, a time window, a location and a person who needs a workable route.', 'The best planning view keeps those pieces together and makes exceptions visible before they become missed or late visits.'] },
    { heading: 'Make exceptions actionable', paragraphs: ['A missed or delayed call should not disappear into a status column. Managers need a clear follow-up path: record what happened, contact the right people, escalate where required and keep the resolution history with the visit.', 'Availability and leave should be considered before assignment, while changes remain subject to manager review.'] },
    { heading: 'Keep the field experience short', paragraphs: ['Carers need a focused mobile flow for the work in front of them: see the route, check in and out, record factual notes and report a disruption. The office view can carry the wider planning and governance context.'] },
  ] },
  { slug: 'responsible-ai-in-care', title: 'Using AI responsibly in care operations', category: 'AI & care', date: '2026-08-08', readingTime: '7 min read', excerpt: 'AI can reduce administration and surface patterns, but care teams must remain responsible for interpretation and action.', img: '/figma/cover-ai.png', body: [
    { heading: 'Assist, do not invent', paragraphs: ['An AI-assisted care workflow should preserve the original record, make the assistance visible and avoid adding facts that were not present in the source information.', 'A suggested summary is not a clinical conclusion. A possible signal is not a diagnosis. Those distinctions matter because care information is sensitive and decisions affect real people.'] },
    { heading: 'Trace every useful statement', paragraphs: ['Managers should be able to see which source records support an AI-generated statement, when those records were created and what uncertainty remains. This makes review practical rather than ceremonial.'] },
    { heading: 'Permissions come first', paragraphs: ['An AI assistant must work within the same organisation and role boundaries as the rest of the application. It must not receive records that the requesting user could not already access, and each meaningful action should be auditable.'] },
  ] },
  { slug: 'medication-safety-in-domiciliary-care', title: 'Medication safety in domiciliary care: what good looks like', category: 'Domiciliary care', date: '2026-09-10', readingTime: '6 min read', excerpt: 'Medication errors are among the most common incident types in home care. A structured approach to recording, prompting and auditing reduces risk without adding burden.', img: '/figma/cover-medication.png', body: [
    { heading: 'The challenge of medication outside clinical settings', paragraphs: ['In domiciliary care, medication administration happens in the person\'s own home, often without a nurse present. The carer may support self-administration, prompt for overdue doses or manage a pre-filled blister pack. Each scenario carries different risk and requires a different level of recording.', 'Unlike residential settings, there is no central pharmacy or shift handover to catch a missed dose. The system has to surface the right information at the right time — on the carer\'s phone, at the door.'] },
    { heading: 'What a safe medication workflow looks like', paragraphs: ['A well-designed electronic MAR (eMAR) should show the carer exactly what is due for this visit, flag anything that was missed in a previous visit, and record the outcome with a timestamp. It should also distinguish between administered, refused, missed and self-managed — because each has a different governance implication.', 'Stock control and controlled-drug workflows add another layer. When a service manages controlled substances, the system should support batch tracking, witness signatures and reconciliation on administration.'] },
    { heading: 'Audit without investigation burden', paragraphs: ['Managers need a clear view of medication adherence across all clients without having to open each MAR individually. A dashboard showing overdue doses, refusal patterns and exception rates makes proactive review possible.', 'When an incident does occur, the audit trail should already be in place: who administered what, when, and what was recorded. This is the difference between a governance gap and inspection-ready evidence.'] },
  ] },
]

const tabs = ['All', 'Compliance', 'Domiciliary care', 'AI & care'] as const
type Tab = typeof tabs[number]

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d} ${months[m - 1]} ${y}`
}

function TextLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Box
      component={Link}
      to={to}
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, color: M.navy, fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
    >
      {children}
      <ArrowForward sx={{ fontSize: 16 }} />
    </Box>
  )
}

export default function PublicBlogPage() {
  const { slug } = useParams<{ slug?: string }>()
  const article = slug ? articles.find((item) => item.slug === slug) : undefined
  return article ? <ArticlePage article={article} /> : <BlogIndex />
}

const audience = [
  { role: 'Registered Managers', desc: 'Overseeing supported living services' },
  { role: 'Care Coordinators', desc: 'Managing rotas and appointments' },
  { role: 'Compliance Officers', desc: 'Preparing for regulatory inspections' },
  { role: 'Care Workers', desc: 'Documenting daily notes and medication' },
  { role: 'Administrators', desc: 'Handling billing and staff onboarding' },
]

type Sort = 'newest' | 'oldest'

function BlogIndex() {
  const [tab, setTab] = useState<Tab>('All')
  const [sort, setSort] = useState<Sort>('newest')
  const [sortAnchor, setSortAnchor] = useState<null | HTMLElement>(null)
  const countFor = (t: Tab) => t === 'All' ? articles.length : articles.filter((a) => a.category === t).length
  // Newest article leads as the "Latest" feature in newest-first view; the
  // grid always excludes it there so no article appears twice. In oldest-first
  // view the feature is folded into the grid so the order stays truthful.
  const compare = (a: Article, b: Article) =>
    sort === 'newest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
  const featured = [...articles].sort((a, b) => b.date.localeCompare(a.date))[0]
  const showFeatured = sort === 'newest' && (tab === 'All' || featured.category === tab)
  const filtered = articles
    .filter((a) => (showFeatured ? a.slug !== featured.slug : true) && (tab === 'All' || a.category === tab))
    .sort(compare)

  return (
    <MarketingLayout>
      <PageMeta title="Resources" description="Clear, evidence-led reading for domiciliary and supported living providers. No invented credentials, endorsements or customer claims." canonicalPath="/blog" />

      {/* Hero */}
      <Box sx={{ background: `linear-gradient(180deg, ${M.heroTint} 0%, ${M.paper} 55%, ${M.card} 100%)` }}>
        <Container maxWidth="lg" sx={{ pt: { xs: 8, md: 14 } }}>
          <Grid container spacing={4} alignItems="end" sx={{ mb: { xs: 4, md: 6 } }}>
            <Grid item xs={12} md={8}>
              <Box
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 1, bgcolor: '#FFFFFF',
                  border: `1px solid ${M.faint}`, borderRadius: '999px', px: 2, py: 0.75, mb: 3,
                }}
              >
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: M.navy }} />
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: M.bodyText }}>Resources</Typography>
              </Box>
              <Typography sx={{ fontSize: M.display.fontSize, lineHeight: M.display.lineHeight, fontWeight: M.display.fontWeight, letterSpacing: M.display.letterSpacing, color: M.dark }}>
                Practical ideas for running better care operations.
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: 1.7, pb: 1 }}>
                Clear, evidence-led reading for domiciliary and supported living providers. No invented credentials, endorsements or customer claims.
              </Typography>
            </Grid>
          </Grid>

          {/* Tabs */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${M.faint}`, pb: 0 }}>
            <Stack direction="row" spacing={3.5}>
              {tabs.map((t) => {
                const active = tab === t
                return (
                  <Box
                    key={t}
                    component="button"
                    onClick={() => setTab(t)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.75, background: 'none', border: 'none', cursor: 'pointer',
                      py: 1.75, px: 0, borderBottom: `1px solid ${active ? M.dark : 'transparent'}`, mb: '-1px',
                    }}
                  >
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: active ? 600 : 500, color: active ? M.dark : M.slate }}>{t}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: active ? M.dark : M.slate }}>{countFor(t)}</Typography>
                  </Box>
                )
              })}
            </Stack>
            <Button
              onClick={(e) => setSortAnchor(e.currentTarget)}
              aria-haspopup="menu"
              aria-expanded={Boolean(sortAnchor)}
              aria-controls="blog-sort-menu"
              endIcon={<ExpandMore sx={{ fontSize: 16 }} />}
              sx={{ color: M.slate, fontSize: '0.8rem', fontWeight: 500, textTransform: 'none', p: 0, minWidth: 0, '&:hover': { bgcolor: 'transparent', color: M.dark } }}
            >
              Sorted by {sort === 'newest' ? 'newest' : 'oldest'}
            </Button>
            <Menu
              id="blog-sort-menu"
              anchorEl={sortAnchor}
              open={Boolean(sortAnchor)}
              onClose={() => setSortAnchor(null)}
              MenuListProps={{ 'aria-label': 'Sort articles' }}
            >
              {(['newest', 'oldest'] as Sort[]).map((option) => (
                <MenuItem
                  key={option}
                  selected={sort === option}
                  onClick={() => { setSort(option); setSortAnchor(null) }}
                  sx={{ fontSize: '0.85rem' }}
                >
                  {sort === option && <Check sx={{ fontSize: 16, mr: 1 }} />}
                  {option === 'newest' ? 'Newest first' : 'Oldest first'}
                </MenuItem>
              ))}
            </Menu>
          </Box>
        </Container>
      </Box>

      {/* Featured */}
      {showFeatured && (
        <Box sx={{ bgcolor: '#FFFFFF', py: { xs: 5, md: 7 } }}>
          <Container maxWidth="lg">
            <Grid container spacing={{ xs: 4, md: 7 }} alignItems="center">
              <Grid item xs={12} md={7}>
                <Box
                  component={Link}
                  to={`/blog/${featured.slug}`}
                  sx={{ display: 'block', borderRadius: '20px', overflow: 'hidden', textDecoration: 'none' }}
                >
                  <Box component="img" src={featured.img} alt="" sx={{ display: 'block', width: '100%', height: 'auto' }} />
                </Box>
              </Grid>
              <Grid item xs={12} md={5}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                  <Box component="span" sx={{ px: 1, py: '3px', borderRadius: '6px', bgcolor: M.dark, color: '#FFFFFF', fontSize: '0.68rem', fontWeight: 600 }}>
                    Latest
                  </Box>
                  <Typography sx={{ fontSize: '0.8rem', color: M.slate }}>{featured.category}</Typography>
                </Stack>
                <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, color: M.dark, mb: 2 }}>
                  {featured.title}
                </Typography>
                <Typography sx={{ color: M.slate, fontSize: '0.95rem', lineHeight: 1.7, mb: 2.5 }}>
                  {featured.excerpt}
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: M.slate, mb: 2 }}>
                  {prettyDate(featured.date)} · {featured.readingTime}
                </Typography>
                <TextLink to={`/blog/${featured.slug}`}>Read article</TextLink>
              </Grid>
            </Grid>
          </Container>
        </Box>
      )}

      {/* All articles */}
      <Box sx={{ bgcolor: '#FFFFFF', pb: { xs: 7, md: 13 } }}>
        <Container maxWidth="lg">
          <Box sx={{ borderTop: `1px solid ${M.faint}`, pt: 4, mb: 4 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: M.dark }}>More reading</Typography>
          </Box>
          <Grid container spacing={{ xs: 4, md: 4 }}>
            {filtered.map((a) => (
              <Grid item xs={12} md={4} key={a.slug}>
                <Box component={Link} to={`/blog/${a.slug}`} sx={{ display: 'block', textDecoration: 'none', height: '100%' }}>
                  <Box sx={{ borderRadius: '14px', overflow: 'hidden', mb: 2.5 }}>
                    <Box component="img" src={a.img} alt="" sx={{ display: 'block', width: '100%', height: 'auto' }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.8rem', color: M.slate, mb: 1 }}>{a.category}</Typography>
                  <Typography sx={{ fontSize: '1.15rem', fontWeight: 600, color: M.dark, lineHeight: 1.3, mb: 1 }}>
                    {a.title}
                  </Typography>
                  <Typography sx={{ fontSize: '0.9rem', color: M.slate, lineHeight: 1.65, mb: 1.5 }}>
                    {a.excerpt}
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: M.slate }}>
                    {prettyDate(a.date)} · {a.readingTime}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Learning Center */}
      <Box sx={{ bgcolor: M.paper, py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 5, md: 10 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.06em', color: M.navy, mb: 1.5 }}>
                Learning Center
              </Typography>
              <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, color: M.dark, mb: 2 }}>
                Already using MeticleCare?
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: '0.95rem', lineHeight: 1.7, mb: 3 }}>
                Step-by-step guides that walk you through every feature, button and workflow — from login and MFA to care plans, rotas and eMAR.
              </Typography>
              <TextLink to="/learn">Open the Learning Center</TextLink>
            </Grid>
            <Grid item xs={12} md={7}>
              <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '16px', border: `1px solid ${M.faint}`, overflow: 'hidden' }}>
                <Box sx={{ px: 3, py: 2 }}>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: M.dark }}>Who it’s for</Typography>
                </Box>
                {audience.map((r) => (
                  <Box
                    key={r.role}
                    sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
                      px: 3, py: 1.75, borderTop: `1px solid ${M.faint}`,
                    }}
                  >
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: M.dark }}>{r.role}</Typography>
                    <Typography sx={{ fontSize: '0.82rem', color: M.slate, textAlign: 'right' }}>{r.desc}</Typography>
                  </Box>
                ))}
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* CTA */}
      <Box sx={{ bgcolor: '#FFFFFF', borderTop: `1px solid ${M.faint}`, py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center">
            <Grid item xs={12} md={7}>
              <Typography sx={{ fontSize: M.h1.fontSize, lineHeight: M.h1.lineHeight, fontWeight: M.h1.fontWeight, letterSpacing: M.h1.letterSpacing, color: M.dark, mb: 1.5 }}>
                Run your care operation with more clarity.
              </Typography>
              <Typography sx={{ color: M.slate, fontSize: M.bodyLg.fontSize, lineHeight: 1.7 }}>
                See how MeticleCare connects care delivery, workforce, compliance and reporting.
              </Typography>
            </Grid>
            <Grid item xs={12} md={5}>
              <CtaButton />
              <Reassurance />
            </Grid>
          </Grid>
        </Container>
      </Box>
    </MarketingLayout>
  )
}

function CtaButton() {
  const nav = useNavigate()
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
      <Button
        variant="contained"
        endIcon={<ArrowForward />}
        onClick={() => nav('/contact')}
        sx={{ bgcolor: M.navy, color: '#FFFFFF', fontWeight: 600, px: 4, py: 1.75, borderRadius: '14px', textTransform: 'none', fontSize: '0.95rem', boxShadow: '0 10px 24px rgba(1,99,199,0.28), 0 2px 4px rgba(1,99,199,0.20)', '&:hover': { bgcolor: M.navyHover } }}
      >
        Book a demo
      </Button>
    </Stack>
  )
}

function Reassurance() {
  const items = [
    { icon: <AccessTime sx={{ fontSize: 16, color: M.tealDeep }} />, text: '30-minute scoping call' },
    { icon: <Check sx={{ fontSize: 16, color: M.tealDeep }} />, text: '14-day free trial' },
    { icon: <Groups sx={{ fontSize: 16, color: M.tealDeep }} />, text: 'Named point of contact' },
  ]
  return (
    <Stack direction="row" spacing={2.5} flexWrap="wrap" useFlexGap>
      {items.map((r) => (
        <Stack key={r.text} direction="row" alignItems="center" spacing={0.75}>
          {r.icon}
          <Typography sx={{ fontSize: '0.8rem', color: M.slate }}>{r.text}</Typography>
        </Stack>
      ))}
    </Stack>
  )
}

function ArticlePage({ article }: { article: Article }) {
  const navigate = useNavigate()
  const share = async () => { const url = window.location.href; if (navigator.share) await navigator.share({ title: article.title, url }); else await navigator.clipboard?.writeText(url) }
  return <MarketingLayout><PageMeta title={article.title} description={article.excerpt} canonicalPath={`/blog/${article.slug}`} ogType="article" structuredData={{ '@context': 'https://schema.org', '@type': 'Article', headline: article.title, datePublished: article.date, author: { '@type': 'Organization', name: 'MeticleCare' }, description: article.excerpt }} /><Box sx={{ bgcolor: C.bone, py: { xs: 7, md: 10 }, borderBottom: `1px solid ${C.line}` }}><Container maxWidth="md"><Button startIcon={<ArrowBack />} onClick={() => navigate('/blog')} sx={{ px: 0, color: C.navy, fontWeight: 600, mb: 4 }}>All articles</Button><Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}><Chip label={article.category} size="small" sx={{ bgcolor: C.emerald, color: C.white, fontWeight: 600 }} /><Typography sx={{ color: C.mist, fontSize: '.82rem' }}>{article.readingTime}</Typography></Stack><Typography variant="h1" sx={{ fontSize: { xs: '2.45rem', md: '3.8rem' }, fontWeight: 600, lineHeight: 1.04, mb: 2 }}>{article.title}</Typography><Typography sx={{ color: C.mist, fontSize: '1.1rem', lineHeight: 1.75 }}>{article.excerpt}</Typography><Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 3 }}><Stack direction="row" spacing={.75} alignItems="center"><CalendarMonth sx={{ color: C.mist, fontSize: 17 }} /><Typography sx={{ color: C.mist, fontSize: '.82rem' }}>{article.date}</Typography></Stack><Button startIcon={<Share />} onClick={share} sx={{ color: C.navy, fontWeight: 600 }}>Share</Button></Stack></Container></Box><Box component="article" sx={{ py: { xs: 7, md: 10 } }}><Container maxWidth="md">{article.body.map((section) => <Box key={section.heading} sx={{ mb: 6 }}><Typography variant="h2" sx={{ fontSize: { xs: '1.7rem', md: '2.2rem' }, fontWeight: 600, mb: 2 }}>{section.heading}</Typography>{section.paragraphs.map((paragraph) => <Typography key={paragraph} component="p" sx={{ color: C.mist, fontSize: '1.05rem', lineHeight: 1.85, mb: 2 }}>{paragraph}</Typography>)}</Box>)}<Divider sx={{ borderColor: C.line, my: 5 }} /><Typography sx={{ color: C.mist, fontSize: '.86rem', lineHeight: 1.7 }}>MeticleCare provides software and general information. It is not legal, regulatory or clinical advice. Providers remain responsible for their own policies, procedures, professional judgement and regulatory obligations.</Typography></Container></Box></MarketingLayout>
}
