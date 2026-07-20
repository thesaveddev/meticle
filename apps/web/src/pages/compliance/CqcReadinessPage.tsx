import { useState, useRef } from 'react'
import { Box, Typography, Paper, Grid, Chip, LinearProgress, Stack, Button, Tooltip, CircularProgress, IconButton, Collapse, Alert, Dialog, DialogTitle, DialogContent, List, ListItemButton, ListItemAvatar, Avatar, ListItemText, TextField } from '@mui/material'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Refresh as RefreshIcon, ExpandMore as ExpandIcon, CheckCircle, Warning, Error as ErrorIcon, Download as DownloadIcon, Print as PrintIcon, Lightbulb as ActionIcon, ArrowBack as ArrowBackIcon, AutoAwesome as AiIcon, SmartToy as AiIconOutlined, Send as SendIcon, Chat as ChatIcon, PriorityHigh as PriorityIcon, AccessTime as EffortIcon, Star as StarIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import html2pdf from 'html2pdf.js'

function getRating(score: number, ratings?: any[]) {
  if (ratings && ratings.length > 0) {
    const sorted = [...ratings].sort((a, b) => b.min - a.min)
    return sorted.find(r => score >= r.min) || sorted[sorted.length - 1]
  }
  return score >= 81 ? { label: 'Good', color: '#16A34A', description: '' }
    : score >= 61 ? { label: 'Requires Improvement', color: '#F59E0B', description: '' }
    : { label: 'Inadequate', color: '#DC2626', description: '' }
}

function buildActions(gaps: string[]): { priority: 'high' | 'medium' | 'low'; action: string; detail: string }[] {
  const actions: { priority: 'high' | 'medium' | 'low'; action: string; detail: string }[] = []
  for (const gap of gaps) {
    const lower = gap.toLowerCase()
    if (lower.includes('training') || lower.includes('competenc')) {
      actions.push({ priority: 'high', action: 'Schedule training or competency assessment', detail: gap })
    } else if (lower.includes('document') || lower.includes('dbs') || lower.includes('visa') || lower.includes('passport') || lower.includes('identity')) {
      actions.push({ priority: 'high', action: 'Upload or renew identity document', detail: gap })
    } else if (lower.includes('expir') || lower.includes('overdue') || lower.includes('renew')) {
      actions.push({ priority: 'high', action: 'Renew expiring records', detail: gap })
    } else if (lower.includes('compliance') || lower.includes('require') || lower.includes('mandatory')) {
      actions.push({ priority: 'medium', action: 'Review compliance requirements', detail: gap })
    } else {
      actions.push({ priority: 'low', action: 'Review and address gap', detail: gap })
    }
  }
  return actions
}

function getFrameworkStyle(frameworkName: string) {
  const name = (frameworkName || '').toLowerCase()
  if (name.includes('cqc')) return { label: 'CQC', color: '#0F4C81' as const }
  if (name.includes('ciw')) return { label: 'CIW', color: '#7C3AED' as const }
  if (name.includes('care inspectorate')) return { label: 'Care Inspectorate', color: '#059669' as const }
  if (name.includes('rqia')) return { label: 'RQIA', color: '#DC2626' as const }
  return { label: frameworkName || 'Regulatory Framework', color: '#6B7280' as const }
}

export default function CqcReadinessPage() {
  const navigate = useNavigate()
  const printRef = useRef<HTMLDivElement>(null)
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['cqc-readiness'],
    queryFn: async () => {
      const res = await api.get('/cqc/readiness')
      return res.data.data
    },
  })

  const [expandedDomain, setExpandedDomain] = useState<string | null>(null)
  const [aiResult, setAiResult] = useState<any>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const aiRef = useRef<HTMLDivElement>(null)

  const { data: gapData, isLoading: gapLoading } = useQuery({
    queryKey: ['cqc-gap-analysis'],
    queryFn: async () => {
      const res = await api.get('/cqc/gap-analysis')
      return res.data
    },
  })

  const { data: actionItems = [], refetch: refetchActions } = useQuery({
    queryKey: ['cqc-action-items'],
    queryFn: async () => {
      const res = await api.get('/cqc/action-items')
      return res.data
    },
  })

  const createAction = useMutation({
    mutationFn: (data: any) => api.post('/cqc/action-items', data),
    onSuccess: () => refetchActions(),
  })

  const updateAction = useMutation({
    mutationFn: (d: { id: string; data: any }) => api.patch(`/cqc/action-items/${d.id}`, d.data),
    onSuccess: () => refetchActions(),
  })

  const deleteAction = useMutation({
    mutationFn: (id: string) => api.delete(`/cqc/action-items/${id}`),
    onSuccess: () => refetchActions(),
  })

  // Share to Chat state
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [shareChannels, setShareChannels] = useState<any[]>([])
  const [shareChannelsLoading, setShareChannelsLoading] = useState(false)
  const [shareSending, setShareSending] = useState<string | null>(null)
  const [shareSearch, setShareSearch] = useState('')
  const [shareSuccess, setShareSuccess] = useState(false)

  const buildAiContent = () => {
    if (!aiResult || !data) return ''
    const chartRows = data.domains.map((d: any) => {
      const r = getRating(d.score, data?.framework?.ratings)
      return `<tr><td style="padding:4px 8px;font-size:13px;font-weight:600">${d.label}</td><td style="padding:4px 8px"><div style="width:100%;background:#E2E8F0;height:10px;border-radius:5px"><div style="width:${d.score}%;height:10px;background:${r.color};border-radius:5px"></div></div></td><td style="padding:4px 8px;text-align:right;font-size:13px;font-weight:700;color:${r.color}">${d.score}%</td></tr>`
    }).join('')
    const gapsRows = (aiResult.critical_gaps || []).map((g: any) => {
      const priColor = g.priority === 'critical' || g.priority === 'high' ? '#DC2626' : g.priority === 'medium' ? '#F59E0B' : '#6B7280'
      const priBg = g.priority === 'critical' || g.priority === 'high' ? '#FEF2F2' : g.priority === 'medium' ? '#FFFBEB' : '#F9FAFB'
      return `<div style="padding:8px 12px;margin:6px 0;border-left:4px solid ${priColor};background:${priBg}"><strong>${g.area}</strong> <span style="float:right;font-size:11px;font-weight:700;text-transform:uppercase">${g.priority}</span><br><span style="color:#6B7280;font-size:12px">Statement: ${g.statement || '-'}</span><br><span style="color:#6B7280;font-size:12px">Current: ${g.current_state || '-'}</span><br>→ ${g.recommended_action || ''}</div>`
    }).join('')
    const quickWinsRows = (aiResult.quick_wins || []).map((w: string) => `<div style="padding:8px 12px;margin:4px 0;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:4px;font-size:13px">✓ ${w}</div>`).join('')
    const frameworkName = data.framework?.name || 'CQC'
    return `
<h1 style="color:#7C3AED;font-size:22px;border-bottom:2px solid #7C3AED;padding-bottom:6px">AI Compliance Gap Analysis</h1>
<p style="font-size:13px;color:#6B7280">Regulator: ${frameworkName} &bull; Generated ${new Date().toLocaleString()}</p>
<h2 style="color:#0F4C81;font-size:16px;margin-top:20px">Domain Scores</h2>
<table style="width:100%;border-collapse:collapse">${chartRows}</table>
${aiResult.overall_assessment ? `<h2 style="color:#0F4C81;font-size:16px;margin-top:20px">Overall Assessment</h2><div style="background:#F5F3FF;padding:12px;border-radius:8px;margin:12px 0;border:1px solid #DDD6FE">${aiResult.overall_assessment}</div>` : ''}
${gapsRows ? `<h2 style="color:#0F4C81;font-size:16px;margin-top:20px">Critical Gaps (${aiResult.critical_gaps.length})</h2>${gapsRows}` : ''}
${quickWinsRows ? `<h2 style="color:#0F4C81;font-size:16px;margin-top:20px">Quick Wins</h2>${quickWinsRows}` : ''}
${aiResult.estimated_timeline ? `<div style="margin-top:16px;padding:8px 12px;background:#F8FAFC;border-left:3px solid #7C3AED;font-style:italic;font-size:13px;color:#6B7280">⏱ Estimated timeline: ${aiResult.estimated_timeline}</div>` : ''}
`
  }

  const buildAiPrintHTML = () => {
    const content = buildAiContent()
    if (!content) return ''
    return `<!DOCTYPE html>
<html><head><title>AI Compliance Gap Analysis - CareDesk</title>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; color: #111; max-width: 800px; margin: 0 auto; }
  @media print { body { padding: 16px; } }
</style></head><body>${content}<div class="footer" style="margin-top:24px;padding-top:12px;border-top:1px solid #D1D5DB;font-size:11px;color:#9CA3AF">CareDesk AI Analysis &bull; ${new Date().toLocaleString()}</div></body></html>`
  }

  const handleDownloadAiPDF = () => {
    if (!aiResult || !data) return
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:600px;border:none;visibility:hidden'
    document.body.appendChild(iframe)
    const doc = iframe.contentWindow?.document
    if (!doc) { document.body.removeChild(iframe); return }
    doc.open()
    doc.write(buildAiPrintHTML())
    doc.close()
    setTimeout(() => {
      html2pdf().from(iframe.contentWindow!.document.body).set({
        margin: [10, 10],
        filename: `ai-gap-analysis-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, logging: false, width: 800 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).save().then(() => {
        document.body.removeChild(iframe)
      }).catch(() => {
        document.body.removeChild(iframe)
      })
    }, 500)
  }

  const handlePrintAi = () => {
    const html = buildAiPrintHTML()
    if (!html) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 250)
  }

  const handleOpenShareDialog = async () => {
    setShareDialogOpen(true)
    setShareSuccess(false)
    setShareSearch('')
    setShareChannelsLoading(true)
    try {
      const res = await api.get('/chat/channels')
      setShareChannels(res.data || [])
    } catch { /* ignore */ }
    finally { setShareChannelsLoading(false) }
  }

  const handleShareToChannel = async (channel: any) => {
    if (shareSending) return
    setShareSending(channel.id)
    try {
      const msgText = `📊 AI Compliance Gap Analysis\n\nOverall: ${Math.round(data.overall)}% | Regulator: ${data.framework?.name || 'CQC'}\n\n${aiResult.overall_assessment || ''}\n\nSee attached PDF for full report with domain scores, critical gaps, and quick wins.`
      await api.post(`/chat/channels/${channel.id}/messages`, {
        content: msgText,
      })
      // Generate PDF and upload
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:600px;border:none;visibility:hidden'
      document.body.appendChild(iframe)
      const doc = iframe.contentWindow?.document
      if (!doc) { document.body.removeChild(iframe); throw new Error('iframe not available') }
      doc.open()
      doc.write(buildAiPrintHTML())
      doc.close()
      await new Promise(r => setTimeout(r, 500))
      const pdfBlob = await html2pdf().from(iframe.contentWindow!.document.body).set({
        margin: [10, 10],
        filename: `ai-gap-analysis-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, logging: false, width: 800 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).outputPdf('blob')
      document.body.removeChild(iframe)
      const pdfFile = new File([pdfBlob], `AI-Compliance-Analysis-${new Date().toISOString().split('T')[0]}.pdf`, { type: 'application/pdf' })
      const formData = new FormData()
      formData.append('file', pdfFile)
      const uploadRes = await api.post('/settings/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (uploadRes.data.url) {
        await api.post(`/chat/channels/${channel.id}/messages`, {
          content: undefined,
          file_url: uploadRes.data.url,
          file_name: `AI-Compliance-Analysis-${new Date().toISOString().split('T')[0]}.pdf`,
        })
      }
      setShareSuccess(true)
      setTimeout(() => { setShareDialogOpen(false); setShareSuccess(false) }, 1500)
    } catch { /* ignore */ }
    finally { setShareSending(null) }
  }

  const filteredShareChannels = shareChannels.filter((c: any) =>
    !shareSearch || (c.name || '').toLowerCase().includes(shareSearch.toLowerCase())
  )

  const handleAiAnalysis = async () => {
    if (!data) return
    setAiLoading(true)
    setAiError(null)
    try {
      const domainScores = data.domains.map((d: any) => `${d.key}: ${d.score}%`).join('\n')
      const keyIssues = (data.gaps || []).join('\n')
      const res = await api.post('/ai/analyze/compliance', {
        overallRate: data.overall,
        domainScores,
        keyIssues,
        regulator: data.framework?.name || 'CQC',
        orgName: data.orgName || '',
      })
      setAiResult(res.data.analysis)
    } catch (err: any) {
      setAiError(err?.response?.data?.error?.message || err?.message || 'Analysis failed')
    } finally {
      setAiLoading(false)
    }
  }

  const collectEmotionStyles = () => {
    return Array.from(document.querySelectorAll('style[data-emotion]'))
      .map(s => s.textContent || '')
      .join('\n')
  }

  const buildReportHTML = () => {
    if (!printRef.current || !data) return null
    const html = printRef.current.outerHTML
    const frameworkLabel = data.framework?.name || 'Regulatory'
    const emotionStyles = collectEmotionStyles()
    return `<!DOCTYPE html><html><head><title>CareDesk ${frameworkLabel} Readiness Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
        h1 { color: #0F4C81; border-bottom: 2px solid #0F4C81; padding-bottom: 8px; }
        h2 { color: #0F4C81; margin-top: 32px; }
        h3 { color: #0F4C81; margin-top: 24px; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th, td { border: 1px solid #D1D5DB; padding: 8px 12px; text-align: left; font-size: 13px; }
        th { background: #F3F4F6; font-weight: 700; }
        .chip { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #D1D5DB; font-size: 12px; color: #6B7280; }
        .gauge { text-align: center; padding: 40px; }
        .gauge-score { font-size: 48px; font-weight: 700; }
        .metric-card { text-align: center; padding: 16px; border: 1px solid #D1D5DB; border-radius: 8px; }
        .action-item { padding: 8px 12px; margin: 4px 0; border-left: 4px solid #DC2626; background: #FEF2F2; }
        .action-item.medium { border-left-color: #F59E0B; background: #FFFBEB; }
        .action-item.low { border-left-color: #6B7280; background: #F9FAFB; }
        .priority-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .priority-high { background: #FEE2E2; color: #991B1B; }
        .priority-medium { background: #FEF3C7; color: #92400E; }
        .priority-low { background: #F3F4F6; color: #374151; }
        @media print { body { padding: 20px; } .no-print { display: none; } }
      </style>
      <style>${emotionStyles}</style>
      </head><body>
      ${html}
      <div class="footer">Generated by CareDesk on ${new Date().toLocaleString()}</div></body></html>`
  }

  const handleDownloadReport = () => {
    const styled = buildReportHTML()
    if (!styled) return
    const blob = new Blob([styled], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const frameworkSlug = (data?.framework?.name || 'readiness').toLowerCase().replace(/\s+/g, '-')
    a.download = `${frameworkSlug}-readiness-${new Date().toISOString().split('T')[0]}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrintReport = () => {
    const styled = buildReportHTML()
    if (!styled) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(styled)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 250)
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (isError) {
    return <Alert severity="error" sx={{ m: 2 }}>Failed to load readiness data.</Alert>
  }

  const rating = getRating(data.overall, data.framework?.ratings)
  const fs = getFrameworkStyle(data.framework?.name)
  const actions = buildActions(data.gaps || [])

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/compliance')} sx={{ mb: 2, color: '#0F4C81', fontWeight: 600 }}>
        Back to Compliance Dashboard
      </Button>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h4">Readiness</Typography>
          {data?.framework && (
            <>
              <Chip label={fs.label} size="small" sx={{ bgcolor: fs.color, color: '#fff', fontWeight: 700 }} />
              <Chip label={data.framework.country} size="small" variant="outlined" />
            </>
          )}
        </Stack>
        <Stack direction="row" spacing={1} className="no-print">
          <Button startIcon={<PrintIcon />} onClick={handlePrintReport}>Print / PDF</Button>
          <Button startIcon={<DownloadIcon />} onClick={handleDownloadReport}>Download Report</Button>
          <Button startIcon={<RefreshIcon />} onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Stack>
      </Stack>

      <Box ref={printRef}>
        {/* Overall score */}
        <Paper sx={{ p: 4, mb: 3, textAlign: 'center', border: `4px solid ${rating.color}`, borderRadius: 3 }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2 }}>
            {data.framework?.name || 'CQC Single Assessment Framework'}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 2 }}>
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              <CircularProgress
                variant="determinate"
                value={100}
                size={160}
                thickness={4}
                sx={{ color: 'grey.200', position: 'absolute' }}
              />
              <CircularProgress
                variant="determinate"
                value={data.overall}
                size={160}
                thickness={4}
                sx={{ color: rating.color }}
              />
              <Box sx={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="h3" fontWeight={700} sx={{ color: rating.color }}>
                  {data.overall}%
                </Typography>
              </Box>
            </Box>
            <Typography variant="body1" fontWeight={700} sx={{ color: rating.color, mt: 2, fontSize: '1.1rem' }}>
              {rating.label}
            </Typography>
            {data.framework?.ratings && (
              <Stack direction="row" spacing={0.5} sx={{ mt: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[...data.framework.ratings].sort((a: any, b: any) => b.min - a.min).map((r: any, i: number) => (
                  <Chip key={i} icon={<StarIcon />} label={`${r.label}`} size="small" variant={r.label === rating.label ? 'filled' : 'outlined'} sx={{
                    bgcolor: r.label === rating.label ? r.color : 'transparent',
                    color: r.label === rating.label ? '#fff' : r.color,
                    borderColor: r.color,
                    fontWeight: r.label === rating.label ? 700 : 400,
                  }} />
                ))}
              </Stack>
            )}
          </Box>
          <Typography variant="body2" color="text.secondary">
            Generated {new Date(data.generated_at).toLocaleString()}
          </Typography>
        </Paper>

        {/* Top Actions */}
        {actions.length > 0 && (
          <Paper sx={{ p: 3, mb: 3, bgcolor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <ActionIcon sx={{ color: '#0F4C81' }} />
              <Typography variant="h6">What To Action Next</Typography>
            </Stack>
            <Stack spacing={1.5}>
              {actions.map((a, i) => (
                <Box key={i} sx={{
                  p: 2, borderRadius: 1, borderLeft: '4px solid',
                  borderColor: a.priority === 'high' ? '#DC2626' : a.priority === 'medium' ? '#F59E0B' : '#9CA3AF',
                  bgcolor: a.priority === 'high' ? '#FEF2F2' : a.priority === 'medium' ? '#FFFBEB' : '#F9FAFB'
                }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2" fontWeight={700}>{a.action}</Typography>
                    <Chip label={a.priority === 'high' ? 'High Priority' : a.priority === 'medium' ? 'Medium' : 'Low'} size="small"
                      color={a.priority === 'high' ? 'error' : a.priority === 'medium' ? 'warning' : 'default'} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{a.detail}</Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
        )}

        {/* Priority Action Plan */}
        <Paper sx={{ p: 3, mb: 3, border: '1px solid #E2E8F0' }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <PriorityIcon sx={{ color: '#DC2626' }} />
            <Typography variant="h6" sx={{ flex: 1 }}>Priority Action Plan</Typography>
            {gapLoading && <CircularProgress size={18} />}
          </Stack>
          {gapData?.gaps?.length > 0 && (
            <>
              <Stack direction="row" spacing={1.5} sx={{ mb: 2.5, flexWrap: 'wrap' }}>
                <Chip label={`${gapData.summary.total_gaps} gaps identified`} size="small" variant="outlined" />
                {gapData.summary.high_priority > 0 && (
                  <Chip label={`${gapData.summary.high_priority} high priority`} size="small" color="error" />
                )}
                {gapData.summary.medium_priority > 0 && (
                  <Chip label={`${gapData.summary.medium_priority} medium priority`} size="small" color="warning" />
                )}
              </Stack>
              <Stack spacing={1.5}>
                {gapData.gaps.map((g: any, i: number) => (
                  <Box key={i} sx={{
                    p: 2, borderRadius: 1, border: '1px solid',
                    borderColor: g.priority === 'HIGH' ? '#FECACA' : g.priority === 'MEDIUM' ? '#FDE68A' : '#E5E7EB',
                    borderLeft: '4px solid',
                    borderLeftColor: g.priority === 'HIGH' ? '#DC2626' : g.priority === 'MEDIUM' ? '#F59E0B' : '#9CA3AF',
                    bgcolor: g.priority === 'HIGH' ? '#FEF2F2' : g.priority === 'MEDIUM' ? '#FFFBEB' : '#FAFAFA'
                  }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2" fontWeight={700}>{g.area}</Typography>
                        <Chip label={g.priority} size="small" color={g.priority === 'HIGH' ? 'error' : g.priority === 'MEDIUM' ? 'warning' : 'default'} />
                      </Stack>
                      <Chip icon={<EffortIcon />} label={g.effort} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{g.statement}</Typography>
                    <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Current:</strong> {g.current_state}</Typography>
                    <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>→ {g.recommended_action}</Typography>
                    <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
                      <Button size="small" variant="outlined" startIcon={<ActionIcon />}
                        onClick={() => {
                          createAction.mutate({
                            cqc_statement: g.statement || 'GAP',
                            description: g.recommended_action || g.current_state,
                            priority: g.priority === 'HIGH' ? 'high' : g.priority === 'MEDIUM' ? 'medium' : 'low'
                          })
                        }}
                        disabled={createAction.isPending}
                        sx={{ textTransform: 'none', fontSize: '0.7rem' }}>
                        Create Action
                      </Button>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </>
          )}
          {!gapLoading && (!gapData?.gaps || gapData.gaps.length === 0) && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              No gaps identified — your organization is fully compliant.
            </Typography>
          )}
        </Paper>

        {/* Action Items */}
        {actionItems.length > 0 && (
          <Paper sx={{ p: 3, mb: 3, border: '1px solid #E2E8F0' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <ActionIcon sx={{ color: '#0F4C81' }} />
              <Typography variant="h6">Action Plan</Typography>
              <Chip label={`${actionItems.filter((a: any) => a.status === 'open').length} open`} size="small" color="error" />
              <Chip label={`${actionItems.filter((a: any) => a.status === 'in_progress').length} in progress`} size="small" color="warning" />
              <Chip label={`${actionItems.filter((a: any) => a.status === 'completed').length} done`} size="small" color="success" />
            </Stack>
            <Stack spacing={1}>
              {actionItems.map((a: any) => (
                <Paper key={a.id} sx={{ p: 1.5, borderRadius: 1, border: '1px solid #E5E7EB', borderLeft: '4px solid',
                  borderLeftColor: a.status === 'completed' ? '#16A34A' : a.status === 'in_progress' ? '#F59E0B' : '#0F4C81' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Tooltip title={a.status === 'open' ? 'Start' : a.status === 'in_progress' ? 'Complete' : ''}>
                        <IconButton size="small"
                          onClick={() => {
                            const next = a.status === 'open' ? 'in_progress' : a.status === 'in_progress' ? 'completed' : 'open'
                            updateAction.mutate({ id: a.id, data: { status: next } })
                          }}
                          sx={{ color: a.status === 'completed' ? '#16A34A' : a.status === 'in_progress' ? '#F59E0B' : '#D1D5DB' }}>
                          <CheckCircle fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Typography variant="body2" sx={{ textDecoration: a.status === 'completed' ? 'line-through' : 'none' }}>
                        {a.description}
                      </Typography>
                      <Chip label={a.priority} size="small" color={a.priority === 'high' ? 'error' : a.priority === 'medium' ? 'warning' : 'default'} />
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {a.staff_name && <Typography variant="caption" color="#6B7280">{a.staff_name}</Typography>}
                      <IconButton size="small" onClick={() => deleteAction.mutate(a.id)}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Paper>
        )}

        {/* AI Gap Analysis */}
        <Paper ref={aiRef} sx={{ p: 3, mb: 3, border: '1px solid #E2E8F0' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <AiIcon sx={{ color: '#7C3AED' }} />
            <Typography variant="h6" sx={{ flex: 1 }}>AI Gap Analysis</Typography>
            {aiResult && (
              <>
                <Button size="small" startIcon={<PrintIcon />} onClick={handlePrintAi}>Print</Button>
                <Button size="small" startIcon={<DownloadIcon />} onClick={handleDownloadAiPDF}>Download</Button>
                <Button size="small" startIcon={<ChatIcon />} variant="outlined" onClick={handleOpenShareDialog} sx={{ borderColor: '#7C3AED', color: '#7C3AED' }}>Share to Chat</Button>
              </>
            )}
            <Button
              variant="contained"
              size="small"
              startIcon={aiLoading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <AiIconOutlined />}
              onClick={handleAiAnalysis}
              disabled={aiLoading}
              sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}
            >
              {aiLoading ? 'Analyzing...' : 'Run Analysis'}
            </Button>
          </Stack>
          {aiError && <Alert severity="error" sx={{ mb: 2 }}>{aiError}</Alert>}
          {aiResult && (
            <Stack spacing={2}>
              {/* Domain Score Bar Chart */}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Domain Score Breakdown</Typography>
                {data.domains.map((domain: any) => {
                  const dr = getRating(domain.score, data?.framework?.ratings)
                  return (
                    <Stack key={domain.key} direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
                      <Typography variant="caption" sx={{ minWidth: 80, fontWeight: 600, fontSize: 11 }}>
                        {domain.label}
                      </Typography>
                      <Box sx={{ flex: 1, height: 14, bgcolor: '#F1F5F9', borderRadius: 7, overflow: 'hidden', position: 'relative' }}>
                        <Box sx={{
                          width: `${Math.max(domain.score, 3)}%`, height: '100%',
                          bgcolor: dr.color, borderRadius: 7,
                          transition: 'width 1s ease-out'
                        }} />
                      </Box>
                      <Typography variant="caption" fontWeight={700} sx={{ minWidth: 36, textAlign: 'right', fontSize: 12, color: dr.color }}>
                        {Math.round(domain.score)}%
                      </Typography>
                    </Stack>
                  )
                })}
                <Stack direction="row" spacing={2} sx={{ mt: 1.5, justifyContent: 'center' }}>
                  <Typography variant="caption" color="text.secondary">Overall: <strong>{Math.round(data.overall)}%</strong></Typography>
                  <Typography variant="caption" color="text.secondary">Regulator: <strong>{data.framework?.name || 'CQC'}</strong></Typography>
                </Stack>
              </Paper>

              {aiResult.overall_assessment && (
                <Paper variant="outlined" sx={{ p: 2, bgcolor: '#FAF5FF' }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>Overall Assessment</Typography>
                  <Typography variant="body2" color="text.secondary">{aiResult.overall_assessment}</Typography>
                </Paper>
              )}
              {aiResult.critical_gaps && aiResult.critical_gaps.length > 0 && (
                <>
                  <Typography variant="subtitle2" fontWeight={700}>Critical Gaps</Typography>
                  <Stack spacing={1}>
                    {aiResult.critical_gaps.map((item: any, i: number) => (
                      <Box key={i} sx={{
                        p: 1.5, borderRadius: 1, borderLeft: '4px solid',
                        borderColor: item.priority === 'critical' || item.priority === 'high' ? '#DC2626' : item.priority === 'medium' ? '#F59E0B' : '#9CA3AF',
                        bgcolor: item.priority === 'critical' || item.priority === 'high' ? '#FEF2F2' : item.priority === 'medium' ? '#FFFBEB' : '#F9FAFB'
                      }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                          <Typography variant="body2" fontWeight={600}>{item.area}</Typography>
                          {item.priority && (
                            <Chip label={item.priority} size="small" color={item.priority === 'critical' ? 'error' : item.priority === 'high' ? 'error' : item.priority === 'medium' ? 'warning' : 'default'} />
                          )}
                        </Stack>
                        {item.statement && <Typography variant="caption" display="block" color="text.secondary">CQC Statement: {item.statement}</Typography>}
                        {item.current_state && <Typography variant="caption" display="block" color="text.secondary">Current: {item.current_state}</Typography>}
                        {item.recommended_action && <Typography variant="body2" sx={{ mt: 0.5 }}>→ {item.recommended_action}</Typography>}
                      </Box>
                    ))}
                  </Stack>
                </>
              )}
              {aiResult.quick_wins && aiResult.quick_wins.length > 0 && (
                <>
                  <Typography variant="subtitle2" fontWeight={700}>Quick Wins</Typography>
                  <Stack spacing={1}>
                    {aiResult.quick_wins.map((item: string, i: number) => (
                      <Box key={i} sx={{ p: 1.5, borderRadius: 1, bgcolor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                        <Typography variant="body2">✓ {item}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </>
              )}
              {aiResult.estimated_timeline && (
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  ⏱ Estimated timeline: {aiResult.estimated_timeline}
                </Typography>
              )}
            </Stack>
          )}
          {!aiResult && !aiLoading && (
            <Typography variant="body2" color="text.secondary">
              Run an AI-powered analysis to get tailored recommendations, visual charts, and a shareable report for improving your {data?.framework?.name || 'CQC'} compliance score.
            </Typography>
          )}
        </Paper>

        {/* Share to Chat Dialog */}
        <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Share Analysis to Chat</DialogTitle>
          <DialogContent>
            {shareSuccess ? (
              <Box sx={{ py: 3, textAlign: 'center' }}>
                <CheckCircle sx={{ fontSize: 48, color: '#16A34A', mb: 1 }} />
                <Typography fontWeight={600}>Shared successfully!</Typography>
              </Box>
            ) : (
              <>
                <TextField
                  fullWidth size="small" placeholder="Search channels..."
                  value={shareSearch} onChange={e => setShareSearch(e.target.value)}
                  sx={{ mb: 1, mt: 0.5 }}
                />
                {shareChannelsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
                ) : filteredShareChannels.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No channels found.
                  </Typography>
                ) : (
                  <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {filteredShareChannels.map((channel: any) => (
                      <ListItemButton key={channel.id} onClick={() => handleShareToChannel(channel)} disabled={shareSending === channel.id}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: channel.type === 'group' ? '#6366F1' : '#0F4C81', width: 32, height: 32, fontSize: 14 }}>
                            {(channel.name || '?')[0].toUpperCase()}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={channel.name || 'Unknown channel'}
                          secondary={channel.type === 'group' ? 'Group' : 'Direct Message'}
                          primaryTypographyProps={{ fontSize: 14 }}
                          secondaryTypographyProps={{ fontSize: 11 }}
                        />
                        {shareSending === channel.id ? (
                          <CircularProgress size={18} />
                        ) : (
                          <SendIcon sx={{ fontSize: 18, color: '#9CA3AF' }} />
                        )}
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Metric cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h5" fontWeight={700}>{data.metrics.total_staff}</Typography>
              <Typography variant="caption" color="text.secondary">Active Staff</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h5" fontWeight={700} color={data.metrics.training_completion_rate >= 80 ? '#16A34A' : '#DC2626'}>{data.metrics.training_completion_rate}%</Typography>
              <Typography variant="caption" color="text.secondary">Training Completion</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h5" fontWeight={700} color={data.metrics.document_compliance_rate >= 80 ? '#16A34A' : '#DC2626'}>{data.metrics.document_compliance_rate}%</Typography>
              <Typography variant="caption" color="text.secondary">Document Compliance</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h5" fontWeight={700} color={data.metrics.competency_pass_rate >= 80 ? '#16A34A' : '#DC2626'}>{data.metrics.competency_pass_rate}%</Typography>
              <Typography variant="caption" color="text.secondary">Competency Pass Rate</Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Domain breakdown */}
        <Typography variant="h6" sx={{ mb: 2 }}>Key Questions — Domain Scores</Typography>
        {data.domains.map((domain: any) => {
          const isExpanded = expandedDomain === domain.key
          const domainRating = getRating(domain.score, data?.framework?.ratings)
          return (
            <Paper key={domain.key} sx={{ mb: 1.5, borderLeft: `4px solid ${domain.color}`, overflow: 'hidden' }}>
              <Stack
                direction="row"
                alignItems="center"
                sx={{ p: 2, cursor: 'pointer' }}
                onClick={() => setExpandedDomain(isExpanded ? null : domain.key)}
              >
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography fontWeight={700}>{domain.label}</Typography>
                    <Chip label={domain.score + '%'} size="small" sx={{ bgcolor: domainRating.color, color: '#fff', fontWeight: 600 }} />
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={domain.score}
                    sx={{ mt: 1, height: 6, borderRadius: 3, bgcolor: '#E2E8F0', '& .MuiLinearProgress-bar': { bgcolor: domainRating.color } }}
                  />
                </Box>
                <IconButton sx={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} aria-label={isExpanded ? 'Collapse domain' : 'Expand domain'}>
                  <ExpandIcon />
                </IconButton>
              </Stack>
              <Collapse in={isExpanded}>
                <Box sx={{ px: 2, pb: 2, borderTop: '1px solid #E2E8F0', pt: 1 }}>
                  <Grid container spacing={1}>
                    {domain.statements.map((stmt: any) => {
                      const stmtRating = getRating(stmt.score, data?.framework?.ratings)
                      return (
                        <Grid item xs={12} sm={6} md={4} key={stmt.id}>
                          <Tooltip title={`${stmt.label}: ${stmt.score}%`}>
                            <Paper variant="outlined" sx={{ p: 1.5 }}>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                {stmt.score >= 81 ? <CheckCircle sx={{ fontSize: 16, color: '#16A34A' }} /> :
                                 stmt.score >= 61 ? <Warning sx={{ fontSize: 16, color: '#F59E0B' }} /> :
                                 <ErrorIcon sx={{ fontSize: 16, color: '#DC2626' }} />}
                                <Typography variant="body2" sx={{ flex: 1 }} noWrap>{stmt.id}: {stmt.label}</Typography>
                                <Chip label={stmt.score + '%'} size="small" sx={{ bgcolor: stmtRating.color, color: '#fff', fontWeight: 600, fontSize: 11, minWidth: 40 }} />
                              </Stack>
                            </Paper>
                          </Tooltip>
                        </Grid>
                      )
                    })}
                  </Grid>
                </Box>
              </Collapse>
            </Paper>
          )
        })}
      </Box>
    </Box>
  )
}
