import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Box, Button, Chip, CircularProgress, Divider, Paper, Stack, TextField, Typography } from '@mui/material'
import { AutoAwesome, OpenInNew, WarningAmber } from '@mui/icons-material'
import PageContainer from '../../components/design/PageContainer'
import api from '../../services/api'

const capabilities = [
  { key: 'manager-briefing', label: 'Manager Briefing', description: 'A source-linked view of what happened and what may need attention.' },
  { key: 'care-summary', label: 'Person Care Summary', description: 'Summarise one person\'s selected-period records with source references.' },
  { key: 'change-detection', label: 'Change Detection', description: 'Compare the selected period for meaningful operational changes.' },
  { key: 'risk-signals', label: 'Risk Signals', description: 'Surface incidents, missed visits and overdue records for human review.' },
  { key: 'compliance-copilot', label: 'Compliance Copilot', description: 'Highlight evidence and training records that may need attention.' },
  { key: 'assistant', label: 'Data Assistant', description: 'Ask an authorised operational question in plain language.' },
  { key: 'end-of-day', label: 'End-of-day Intelligence', description: 'Review the day with transparent sources and follow-up prompts.' },
  { key: 'operations-copilot', label: 'Domiciliary Copilot', description: 'Review missed calls, conflicts and unresolved operational follow-ups.' },
  { key: 'anomaly-detection', label: 'Anomaly Detection', description: 'Use rules-first signals to identify unusual operational patterns.' },
  { key: 'rota-alternatives', label: 'Rota Alternatives', description: 'Review explainable alternatives without publishing changes automatically.' },
  { key: 'competency-coaching', label: 'Competency Coaching', description: 'Identify supervised coaching opportunities from training and assessments.' },
  { key: 'family-communication-draft', label: 'Family Draft', description: 'Draft a manager-reviewed family update without sending it automatically.' },
] as const

type Result = { headline: string; summary: string; items?: Array<{ title: string; detail: string; priority: string; source_type: string; source_id: string; source_url?: string }>; suggested_follow_up?: string[]; limitations?: string[]; generated_by_ai?: boolean }

export default function IntelligencePage() {
  const navigate = useNavigate()
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [selected, setSelected] = useState<(typeof capabilities)[number]['key']>('manager-briefing')
  const [question, setQuestion] = useState('')
  const [personId, setPersonId] = useState('')
  const [windowDays, setWindowDays] = useState('7')
  const [audience, setAudience] = useState('')
  const [tone, setTone] = useState('plain and reassuring')
  const [result, setResult] = useState<Result | null>(null)
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedCapability = useMemo(() => capabilities.find(item => item.key === selected)!, [selected])

  const run = async () => {
    setLoading(true); setError(''); setResult(null)
    try {
      const payload: Record<string, string> = { from, to, window: windowDays }
      if (question.trim()) payload.question = question.trim()
      if (['care-summary', 'family-communication-draft'].includes(selected) && personId.trim()) payload.personId = personId.trim()
      if (selected === 'family-communication-draft') { if (audience.trim()) payload.audience = audience.trim(); if (tone.trim()) payload.tone = tone.trim() }
      const response = await api.post(`/ai/${selected}`, payload)
      setResult(response.data.result)
      setCounts(response.data.counts || null)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'The intelligence request could not be completed.')
    } finally { setLoading(false) }
  }

  return <PageContainer>
    <Stack spacing={2.5}>
      <Box>
        <Stack direction="row" spacing={1} alignItems="center"><AutoAwesome sx={{ color: '#7C3AED' }} /><Typography variant="h5" sx={{ fontWeight: 800 }}>MeticleCare Intelligence</Typography></Stack>
        <Typography color="text.secondary" sx={{ mt: .75, maxWidth: 760 }}>Use authorised operational records to see what may need attention. AI suggestions are evidence-linked and never replace professional judgement.</Typography>
      </Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
        {capabilities.map(item => <Button key={item.key} variant={item.key === selected ? 'contained' : 'outlined'} onClick={() => { setSelected(item.key); setResult(null) }} sx={{ textTransform: 'none', justifyContent: 'flex-start', bgcolor: item.key === selected ? '#0F4C81' : undefined }}>{item.label}</Button>)}
      </Stack>
      <Paper sx={{ p: { xs: 2, md: 3 }, border: '1px solid', borderColor: 'grey.200' }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>{selectedCapability.label}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: .5, mb: 2 }}>{selectedCapability.description}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Stack direction="row" spacing={.5} alignItems="center">
            {[['7', '7 days'], ['14', '14 days'], ['30', '30 days']].map(([value, label]) => <Button key={value} size="small" variant={windowDays === value ? 'contained' : 'outlined'} onClick={() => { setWindowDays(value); if (value !== '7') { const d = new Date(); d.setDate(d.getDate() - (Number(value) - 1)); setFrom(d.toISOString().slice(0, 10)); setTo(new Date().toISOString().slice(0, 10)) } }} sx={{ textTransform: 'none', minWidth: 0, px: 1 }}>{label}</Button>)}
          </Stack>
          <TextField label="From" type="date" size="small" value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="To" type="date" size="small" value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="Question (optional)" size="small" fullWidth value={question} onChange={e => setQuestion(e.target.value)} placeholder="e.g. What needs my attention?" />
          <Button variant="contained" onClick={run} disabled={loading || !from || !to || from > to} startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />} sx={{ bgcolor: '#0F4C81', whiteSpace: 'nowrap' }}>{loading ? 'Reviewing…' : 'Run intelligence'}</Button>
        </Stack>
        {['care-summary', 'family-communication-draft'].includes(selected) && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}><TextField label="Person ID" size="small" value={personId} onChange={e => setPersonId(e.target.value)} helperText="Use the person record ID for source scoping." sx={{ maxWidth: 520 }} />{selected === 'family-communication-draft' && <><TextField label="Audience" size="small" value={audience} onChange={e => setAudience(e.target.value)} placeholder="e.g. authorised family contact" /><TextField label="Tone" size="small" value={tone} onChange={e => setTone(e.target.value)} /></>}</Stack>}
      </Paper>
      {error && <Alert severity="error">{error}</Alert>}
      {!result && !loading && <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#FAF8FF', border: '1px solid #DDD6FE' }}><AutoAwesome sx={{ color: '#7C3AED', fontSize: 38 }} /><Typography sx={{ fontWeight: 800, mt: 1 }}>Ready when you are</Typography><Typography variant="body2" color="text.secondary">Choose a capability and date range to generate an evidence-linked result.</Typography></Paper>}
      {result && <Stack spacing={2}>
        <Paper sx={{ p: { xs: 2.5, md: 3 }, bgcolor: '#FAF8FF', border: '1px solid #DDD6FE' }}><Typography variant="h6" sx={{ fontWeight: 800 }}>{result.headline}</Typography><Typography sx={{ mt: 1 }}>{result.summary}</Typography></Paper>
        {!!result.items?.length && <Paper sx={{ p: { xs: 2, md: 3 } }}><Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}><WarningAmber sx={{ color: '#B45309' }} /><Typography variant="h6" sx={{ fontWeight: 800 }}>Signals and evidence</Typography></Stack><Stack spacing={1.5}>{result.items.map((item, index) => <Box key={`${item.source_type}-${item.source_id}-${index}`} sx={{ p: 2, bgcolor: item.priority === 'high' ? '#FEF2F2' : '#FFFBEB', borderLeft: `4px solid ${item.priority === 'high' ? '#DC2626' : '#D97706'}` }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between"><Typography sx={{ fontWeight: 800 }}>{item.title}</Typography><Chip label={item.priority} size="small" /></Stack><Typography variant="body2" sx={{ mt: .5 }}>{item.detail}</Typography><Stack direction="row" spacing={.5} alignItems="center" sx={{ mt: 1 }}><OpenInNew sx={{ fontSize: 14 }} />{item.source_url ? <Button size="small" onClick={() => navigate(item.source_url!)} startIcon={<OpenInNew sx={{ fontSize: 14 }} />} sx={{ mt: 1, textTransform: 'none', p: 0, minWidth: 0 }}>View source</Button> : <Typography variant="caption" color="text.secondary">Source: {item.source_type} · {item.source_id}</Typography>}</Stack></Box>)}</Stack></Paper>}
        {!!result.suggested_follow_up?.length && <Paper sx={{ p: 2.5 }}><Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Suggested follow-up</Typography>{result.suggested_follow_up.map((item, index) => <Typography key={index} variant="body2" sx={{ mb: .5 }}>• {item}</Typography>)}</Paper>}
        <Divider /><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between"><Typography variant="caption" color="text.secondary">AI output is assistive. Verify source records before acting; it does not make clinical or regulatory decisions.</Typography>{counts && <Typography variant="caption" color="text.secondary">Sources: {Object.entries(counts).map(([key, value]) => `${key} ${value}`).join(' · ')}</Typography>}</Stack>
      </Stack>}
    </Stack>
  </PageContainer>
}
