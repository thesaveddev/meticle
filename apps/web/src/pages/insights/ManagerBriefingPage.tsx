import { useMemo, useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, Divider, Grid, Paper, Stack, TextField, Typography } from '@mui/material'
import { AutoAwesome, CalendarMonth, CheckCircle, OpenInNew, WarningAmber } from '@mui/icons-material'
import PageContainer from '../../components/design/PageContainer'
import api from '../../services/api'

const today = new Date()
const toInputDate = (date: Date) => date.toISOString().slice(0, 10)
const initialTo = toInputDate(today)
const initialFrom = toInputDate(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000))

type Briefing = {
  headline: string
  today?: string[]
  attention?: Array<{ title: string; detail: string; priority: 'high' | 'medium' | 'low'; source_type: string; source_id: string }>
  people?: string[]
  workforce?: string[]
  compliance?: string[]
  incidents?: string[]
  medication?: string[]
  scheduling?: string[]
  follow_up?: Array<{ action: string; reason: string; source_type: string; source_id: string }>
  generated_by_ai?: boolean
  ai_generated_at?: string
}

const categories: Array<{ key: keyof Briefing; label: string }> = [
  { key: 'today', label: 'What happened' },
  { key: 'people', label: 'People' },
  { key: 'workforce', label: 'Workforce' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'incidents', label: 'Incidents' },
  { key: 'medication', label: 'Medication' },
  { key: 'scheduling', label: 'Scheduling' },
]

export default function ManagerBriefingPage() {
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [sources, setSources] = useState<Record<string, number> | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const validRange = useMemo(() => Boolean(from && to && from <= to), [from, to])

  const runBriefing = async () => {
    if (!validRange) {
      setError('Choose a valid date range.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await api.post('/ai/manager-briefing', { from, to })
      setBriefing(response.data.briefing)
      setSources(response.data.sources || null)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Could not generate the manager briefing.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageContainer>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <AutoAwesome sx={{ color: '#7C3AED' }} />
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Manager Briefing</Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 680 }}>
            A concise view of what may need attention, built only from records you are authorised to access.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <TextField label="From" type="date" size="small" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="To" type="date" size="small" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" startIcon={loading ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <CalendarMonth />} onClick={runBriefing} disabled={loading || !validRange} sx={{ bgcolor: '#0F4C81', whiteSpace: 'nowrap' }}>
            {loading ? 'Preparing…' : 'Generate briefing'}
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!briefing && !loading && <Paper sx={{ p: { xs: 3, md: 5 }, textAlign: 'center', border: '1px solid', borderColor: 'grey.200' }}><AutoAwesome sx={{ color: '#7C3AED', fontSize: 40, mb: 1 }} /><Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Start with a date range</Typography><Typography color="text.secondary">The briefing will show the underlying record counts and source references alongside the AI-assisted summary.</Typography></Paper>}

      {briefing && (
        <Stack spacing={2.5}>
          <Paper sx={{ p: { xs: 2.5, md: 3.5 }, border: '1px solid #DDD6FE', bgcolor: '#FAF8FF' }}>
            <Stack direction="row" spacing={1} alignItems="flex-start"><CheckCircle sx={{ color: '#7C3AED', mt: .2 }} /><Box><Typography variant="h6" sx={{ fontWeight: 800, mb: .75 }}>{briefing.headline}</Typography><Typography variant="body2" color="text.secondary">Period: {from} to {to}{briefing.ai_generated_at ? ` · Generated ${new Date(briefing.ai_generated_at).toLocaleString('en-GB')}` : ''}</Typography></Box></Stack>
          </Paper>

          {briefing.attention && briefing.attention.length > 0 && <Paper sx={{ p: { xs: 2.5, md: 3 }, border: '1px solid #FDE68A' }}><Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}><WarningAmber sx={{ color: '#B45309' }} /><Typography variant="h6" sx={{ fontWeight: 800 }}>Needs attention</Typography></Stack><Stack spacing={1.5}>{briefing.attention.map((item, index) => <Box key={`${item.source_id}-${index}`} sx={{ p: 2, bgcolor: item.priority === 'high' ? '#FEF2F2' : '#FFFBEB', borderLeft: `4px solid ${item.priority === 'high' ? '#DC2626' : '#D97706'}` }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}><Typography sx={{ fontWeight: 800 }}>{item.title}</Typography><Chip label={item.priority} size="small" color={item.priority === 'high' ? 'error' : item.priority === 'medium' ? 'warning' : 'default'} /></Stack><Typography variant="body2" color="text.secondary" sx={{ mt: .75 }}>{item.detail}</Typography><SourceRef type={item.source_type} id={item.source_id} /></Box>)}</Stack></Paper>}

          <Grid container spacing={2}>{categories.map(({ key, label }) => { const values = briefing[key] as string[] | undefined; if (!values?.length) return null; return <Grid item xs={12} md={6} key={String(key)}><Paper sx={{ p: 2.5, height: '100%', border: '1px solid', borderColor: 'grey.200' }}><Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.25 }}>{label}</Typography><Stack spacing={1}>{values.map((value, index) => <Stack direction="row" spacing={1} alignItems="flex-start" key={`${value}-${index}`}><Box sx={{ width: 6, height: 6, bgcolor: '#10B981', borderRadius: 1, mt: .75, flexShrink: 0 }} /><Typography variant="body2" sx={{ lineHeight: 1.6 }}>{value}</Typography></Stack>)}</Stack></Paper></Grid> })}</Grid>

          {briefing.follow_up && briefing.follow_up.length > 0 && <Paper sx={{ p: { xs: 2.5, md: 3 }, border: '1px solid', borderColor: 'grey.200' }}><Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Suggested follow-up</Typography><Stack spacing={1.5}>{briefing.follow_up.map((item, index) => <Box key={`${item.source_id}-${index}`} sx={{ p: 2, bgcolor: 'grey.50' }}><Typography sx={{ fontWeight: 800 }}>{item.action}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>{item.reason}</Typography><SourceRef type={item.source_type} id={item.source_id} /></Box>)}</Stack></Paper>}

          <Divider />
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}><Typography variant="caption" color="text.secondary">AI output is an assistive summary, not a clinical decision or regulatory judgement. Review the source records before acting.</Typography>{sources && <Typography variant="caption" color="text.secondary">Sources: {Object.entries(sources).map(([key, value]) => `${key} ${value}`).join(' · ')}</Typography>}</Stack>
        </Stack>
      )}
    </PageContainer>
  )
}

function SourceRef({ type, id }: { type: string; id: string }) {
  return <Stack direction="row" spacing={.5} alignItems="center" sx={{ mt: 1 }}><OpenInNew sx={{ fontSize: 14, color: 'text.secondary' }} /><Typography variant="caption" color="text.secondary">Source: {type.replace(/_/g, ' ')} · {id}</Typography></Stack>
}
