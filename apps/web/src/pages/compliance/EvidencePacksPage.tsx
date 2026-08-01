import { useState, useRef } from 'react'
import { Box, Typography, Paper, Button, Chip, Stack, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, FormControlLabel, Switch, TextField, MenuItem, TablePagination, CircularProgress } from '@mui/material'
import { Download as DownloadIcon, Print as PrintIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

type Section = 'training' | 'documents' | 'competency'

const CQC_DOMAINS = [
  { key: 'safe', label: 'Safe', color: '#16A34A', statements: ['S1','S2','S3','S4','S5','S6','S7','S8'] },
  { key: 'effective', label: 'Effective', color: '#6366F1', statements: ['E1','E2','E3','E4','E5','E6','E7'] },
  { key: 'caring', label: 'Caring', color: '#D946EF', statements: ['C1','C2','C3','C4','C5'] },
  { key: 'responsive', label: 'Responsive', color: '#F59E0B', statements: ['R1','R2','R3','R4','R5','R6','R7'] },
  { key: 'well-led', label: 'Well-led', color: '#0F4C81', statements: ['W1','W2','W3','W4','W5','W6','W7'] },
]

export default function EvidencePacksPage() {
  const navigate = useNavigate()
  const [includeSections, setIncludeSections] = useState<Record<Section, boolean>>({
    training: true, documents: true, competency: true
  })
  const [staffFilter, setStaffFilter] = useState('')
  const [trainingPage, setTrainingPage] = useState(0)
  const [docPage, setDocPage] = useState(0)
  const [compPage, setCompPage] = useState(0)
  const [rowsPerPage] = useState(10)
  const printRef = useRef<HTMLDivElement>(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['evidence-pack', staffFilter],
    queryFn: async () => {
      const params = staffFilter ? `?staffId=${staffFilter}` : ''
      const res = await api.get(`/compliance/evidence-pack${params}`)
      return res.data
    }
  })

  const { data: staffList } = useQuery({
    queryKey: ['staff-list-simple'],
    queryFn: async () => {
      const res = await api.get('/staff/org-members')
      return res.data
    }
  })

  const toggleSection = (s: Section) => setIncludeSections(p => ({ ...p, [s]: !p[s] }))

  const buildDomainEvidence = () => {
    const result: Record<string, { label: string; color: string; evidence: string[] }> = {}
    for (const d of CQC_DOMAINS) {
      result[d.key] = { label: d.label, color: d.color, evidence: [] }
    }
    const mappings: any[] = data?.mappings || []

    const mapSource = (sourceType: string, category: string, fallback: string): string => {
      const exact = mappings.find((m: any) => m.source_type === sourceType && m.source_category === category)
      if (exact) return exact.target_domain
      const wildcard = mappings.find((m: any) => m.source_type === sourceType && !m.source_category)
      if (wildcard) return wildcard.target_domain
      return fallback
    }

    if (data?.training) {
      for (const r of data.training) {
        const domain = mapSource('training', r.module_category, r.module_category?.toLowerCase().includes('safeguarding') || r.module_category?.toLowerCase().includes('infection') || r.module_category?.toLowerCase().includes('fire') ? 'safe' : r.module_category?.toLowerCase().includes('medication') ? 'effective' : 'safe')
        const key = r.status === 'completed' ? `${r.module_name} — ${r.first_name} ${r.last_name}` : null
        if (key && !result[domain].evidence.includes(key)) result[domain].evidence.push(key)
      }
    }
    if (data?.documents) {
      for (const d of data.documents) {
        const domain = mapSource('documents', d.type, 'safe')
        if (d.status === 'approved' || d.status === 'pending') {
          result[domain].evidence.push(`${d.type} — ${d.first_name} ${d.last_name}`)
        }
      }
    }
    if (data?.competency) {
      for (const c of data.competency) {
        if (!c.passed) continue
        const domain = mapSource('competency', c.template_category, c.template_category?.toLowerCase().includes('medication') ? 'effective' : 'safe')
        result[domain].evidence.push(`${c.template_name} — ${c.first_name} ${c.last_name} (Passed)`)
      }
    }
    if (data?.care_plans) {
      for (const cp of data.care_plans) {
        const domain = mapSource('care_plans', cp.category, 'effective')
        result[domain].evidence.push(`Care Plan: ${cp.title} — ${cp.first_name} ${cp.last_name} (${cp.status})`)
      }
    }
    if (data?.incidents) {
      for (const i of data.incidents) {
        const domain = mapSource('incidents', i.severity, 'responsive')
        result[domain].evidence.push(`Incident: "${i.title}" — ${i.involved_people || 'N/A'} (${i.severity})`)
      }
    }
    if (data?.satisfaction?.total > 0) {
      const domain = mapSource('satisfaction', '', 'caring')
      result[domain].evidence.push(`Satisfaction: avg ${data.satisfaction.avg_rating}/5 from ${data.satisfaction.total} surveys (${data.satisfaction.positive} positive)`)
    }
    return Object.entries(result).filter(([_, v]) => v.evidence.length > 0)
  }

  const collectEmotionStyles = () => {
    const styles = Array.from(document.querySelectorAll('style[data-emotion]'))
      .map(s => s.textContent || '')
      .join('\n')
    return styles
  }

  const buildHTML = () => {
    if (!printRef.current) return null
    const html = printRef.current.outerHTML
    const emotionStyles = collectEmotionStyles()
    return `<!DOCTYPE html><html><head><title>Meticle Evidence Pack</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #111; margin: 0; }
        * { box-sizing: border-box; }
        h1 { color: #0F4C81; border-bottom: 2px solid #0F4C81; padding-bottom: 8px; }
        h2 { color: #0F4C81; margin-top: 32px; }
        h3 { margin-top: 24px; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th, td { border: 1px solid #D1D5DB; padding: 8px 12px; text-align: left; font-size: 13px; }
        th { background: #F3F4F6; font-weight: 700; }
        .chip { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
        .success { background: #D1FAE5; color: #065F46; }
        .warning { background: #FEF3C7; color: #92400E; }
        .error { background: #FEE2E2; color: #991B1B; }
        .default { background: #F3F4F6; color: #374151; }
        .summary { display: flex; gap: 16px; margin: 16px 0; }
        .summary-card { border: 1px solid #D1D5DB; border-radius: 8px; padding: 16px; flex: 1; }
        .summary-card h3 { margin: 0 0 4px 0; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #D1D5DB; font-size: 12px; color: #6B7280; }
        @media print { .page-break { page-break-after: always; } table { page-break-inside: auto; } tr { page-break-inside: avoid; } }
      </style>
      <style>${emotionStyles}</style>
      </head><body>
      ${html}
      <div class="footer">Generated by Meticle on ${new Date().toLocaleString()}</div></body></html>`
  }

  const handleDownload = () => {
    const styled = buildHTML()
    if (!styled) return
    const blob = new Blob([styled], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `evidence-pack-${new Date().toISOString().split('T')[0]}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    const styled = buildHTML()
    if (!styled) return
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(styled)
      win.document.close()
      win.focus()
      win.print()
    }
  }

  const handleDownloadPdf = async () => {
    setPdfLoading(true)
    try {
      const params = staffFilter ? `?staffId=${staffFilter}` : ''
      const res = await api.get(`/compliance/evidence-pack/pdf${params}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `evidence-pack-${new Date().toISOString().split('T')[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* ignore */ }
    finally { setPdfLoading(false) }
  }

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><CircularProgress /></Box>

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/compliance')} sx={{ mb: 2, color: '#0F4C81', fontWeight: 600 }}>
        Back to Compliance Dashboard
      </Button>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">Audit-Ready Evidence Packs</Typography>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" startIcon={pdfLoading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <DownloadIcon />} onClick={handleDownloadPdf} disabled={pdfLoading} sx={{ bgcolor: '#0F4C81' }}>Download PDF</Button>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleDownload}>Download HTML</Button>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>Print / PDF</Button>
          </Stack>
      </Stack>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Configure Evidence Pack</Typography>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField label="Filter by Staff" select value={staffFilter} onChange={e => setStaffFilter(e.target.value)} fullWidth size="small">
              <MenuItem value="">All Staff</MenuItem>
              {staffList?.staff?.filter((s: any) => s.status === 'active')?.map((s: any) => (
                <MenuItem key={s.staff_id || s.id} value={s.staff_id || s.id}>{s.first_name} {s.last_name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={8}>
            <Stack direction="row" spacing={3}>
              <FormControlLabel control={<Switch checked={includeSections.training} onChange={() => toggleSection('training')} />} label="Training" />
              <FormControlLabel control={<Switch checked={includeSections.documents} onChange={() => toggleSection('documents')} />} label="Identity Documents" />
              <FormControlLabel control={<Switch checked={includeSections.competency} onChange={() => toggleSection('competency')} />} label="Competency" />
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      <Box ref={printRef}>
        <Paper sx={{ p: 4, mb: 3 }}>
          <Typography variant="h5" sx={{ color: '#0F4C81', mb: 1 }}>Meticle Evidence Pack</Typography>
          <Typography variant="body2" color="text.secondary">
            Generated: {new Date(data?.generated_at || Date.now()).toLocaleString()}
            {data?.summary && ` · ${data.summary.total_staff} staff, ${data.summary.total_service_users || 0} people`}
          </Typography>

          {data?.summary && (
            <Box className="summary" sx={{ display: 'flex', gap: 2, my: 3, flexWrap: 'wrap' }}>
              {Object.entries(data.summary).map(([k, v]) => (
                <Box key={k} sx={{ flex: 1, minWidth: 100, border: '1px solid #D1D5DB', borderRadius: 2, p: 2, textAlign: 'center' }}>
                  <Typography variant="h5" fontWeight={800}>{v as number}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {k === 'total_staff' ? 'Staff' : k === 'total_service_users' ? 'People' : k === 'active_service_users' ? 'Active SUs' : k === 'training_records' ? 'Training Records' : k === 'documents' ? 'Documents' : k === 'competency_records' ? 'Competency' : k === 'incidents' ? 'Incidents' : k === 'satisfaction_avg' ? 'Satisfaction Avg' : ''}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Paper>

        {/* KLOE Summary — Evidence mapped to CQC domains */}
        {buildDomainEvidence().length > 0 && (
          <Paper sx={{ p: 3, mb: 3, border: '2px solid #0F4C81' }}>
            <Typography variant="h6" sx={{ color: '#0F4C81', mb: 2 }}>Key Lines of Enquiry (KLOE) — Evidence Mapping</Typography>
            <Grid container spacing={2}>
              {buildDomainEvidence().map(([key, val]) => (
                <Grid item xs={12} sm={6} key={key}>
                  <Paper variant="outlined" sx={{ p: 2, borderLeft: `4px solid ${val.color}` }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>{val.label} ({val.evidence.length} items)</Typography>
                    {val.evidence.slice(0, 8).map((e, i) => (
                      <Typography key={i} variant="caption" display="block" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>• {e}</Typography>
                    ))}
                    {val.evidence.length > 8 && <Typography variant="caption" color="text.secondary">+{val.evidence.length - 8} more...</Typography>}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>
        )}

        {includeSections.training && data?.training?.length > 0 && (
          <Paper sx={{ p: 3, mb: 3, '@media print': { pageBreakAfter: 'always' } }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Training Compliance ({data.training.length} records)</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Staff</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Module</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Completed</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Expires</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.training.slice(trainingPage * rowsPerPage, trainingPage * rowsPerPage + rowsPerPage).map((r: any) => (
                    <TableRow key={r.id} hover>
                      <TableCell>{r.first_name} {r.last_name}</TableCell>
                      <TableCell>{r.module_name}</TableCell>
                      <TableCell><Chip label={r.module_category || '—'} size="small" variant="outlined" /></TableCell>
                      <TableCell>
                        <Chip label={r.status} size="small" color={r.status === 'completed' ? 'success' : r.status === 'expired' ? 'error' : 'warning'} />
                      </TableCell>
                      <TableCell>{r.completed_at ? new Date(r.completed_at).toLocaleDateString() : '—'}</TableCell>
                      <TableCell>{r.expires_at ? new Date(r.expires_at).toLocaleDateString() : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={data.training.length} page={trainingPage} onPageChange={(_, p) => setTrainingPage(p)} rowsPerPage={rowsPerPage} rowsPerPageOptions={[10]} />
          </Paper>
        )}

        {includeSections.documents && data?.documents?.length > 0 && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Identity Documents ({data.documents.length} records)</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Staff</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Expiry</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.documents.slice(docPage * rowsPerPage, docPage * rowsPerPage + rowsPerPage).map((d: any) => (
                    <TableRow key={d.id} hover>
                      <TableCell>{d.first_name} {d.last_name}</TableCell>
                      <TableCell><Chip label={d.type} size="small" color="primary" variant="outlined" /></TableCell>
                      <TableCell><Chip label={d.status} size="small" color={d.status === 'approved' ? 'success' : d.status === 'expired' ? 'error' : 'warning'} /></TableCell>
                      <TableCell>{d.expiry_date ? new Date(d.expiry_date).toLocaleDateString() : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={data.documents.length} page={docPage} onPageChange={(_, p) => setDocPage(p)} rowsPerPage={rowsPerPage} rowsPerPageOptions={[10]} />
          </Paper>
        )}

        {includeSections.competency && data?.competency?.length > 0 && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Competency Assessments ({data.competency.length} records)</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Staff</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Assessment</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Assessor</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Result</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.competency.slice(compPage * rowsPerPage, compPage * rowsPerPage + rowsPerPage).map((a: any) => (
                    <TableRow key={a.id} hover>
                      <TableCell>{a.first_name} {a.last_name}</TableCell>
                      <TableCell>{a.template_name}</TableCell>
                      <TableCell>{a.assessor_first && a.assessor_last ? `${a.assessor_first} ${a.assessor_last}` : '—'}</TableCell>
                      <TableCell>{new Date(a.assessed_at).toLocaleDateString()}</TableCell>
                      <TableCell><Chip label={a.passed ? 'Passed' : 'Failed'} color={a.passed ? 'success' : 'error'} size="small" /></TableCell>
                      <TableCell>{a.notes || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={data.competency.length} page={compPage} onPageChange={(_, p) => setCompPage(p)} rowsPerPage={rowsPerPage} rowsPerPageOptions={[10]} />
          </Paper>
        )}

        {/* Person Evidence */}
        {data?.service_users?.length > 0 && (
          <Paper sx={{ p: 3, mb: 3, '@media print': { pageBreakAfter: 'always' } }}>
            <Typography variant="h6" sx={{ mb: 2 }}>People ({data.service_users.length} total, {data.summary?.active_service_users} active)</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Room</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Care Plans</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Open Risks</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Goals</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.service_users.map((su: any) => (
                    <TableRow key={su.id} hover>
                      <TableCell>{su.first_name} {su.last_name}</TableCell>
                      <TableCell>{su.room_number || '—'}</TableCell>
                      <TableCell><Chip label={su.status} size="small" color={su.status === 'active' ? 'success' : 'default'} /></TableCell>
                      <TableCell align="right">{su.active_care_plans}</TableCell>
                      <TableCell align="right">{su.open_risks > 0 ? <Chip label={su.open_risks} size="small" color="error" /> : '0'}</TableCell>
                      <TableCell align="right">{su.total_goals}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {data?.care_plans?.length > 0 && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Care Plans ({data.care_plans.length})</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Person</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Review Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.care_plans.slice(0, 25).map((cp: any) => (
                    <TableRow key={cp.id} hover>
                      <TableCell>{cp.first_name} {cp.last_name}</TableCell>
                      <TableCell>{cp.title}</TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{(cp.category || '').replace(/_/g, ' ')}</TableCell>
                      <TableCell><Chip label={cp.status} size="small" color={cp.status === 'active' ? 'success' : 'default'} /></TableCell>
                      <TableCell>{cp.review_date ? new Date(cp.review_date).toLocaleDateString() : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {data?.incidents?.length > 0 && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Recent Incidents ({data.incidents.length})</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Involved People</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Severity</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.incidents.slice(0, 25).map((inc: any) => (
                    <TableRow key={inc.id} hover>
                      <TableCell>{inc.title}</TableCell>
                      <TableCell>{inc.involved_people || 'N/A'}</TableCell>
                      <TableCell><Chip label={inc.severity} size="small" color={inc.severity === 'critical' || inc.severity === 'high' ? 'error' : inc.severity === 'medium' ? 'warning' : 'success'} /></TableCell>
                      <TableCell><Chip label={inc.status} size="small" variant="outlined" /></TableCell>
                      <TableCell>{inc.occurred_at ? new Date(inc.occurred_at).toLocaleDateString() : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {data?.satisfaction?.total > 0 && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Satisfaction Surveys Overview</Typography>
            <Stack direction="row" spacing={3}>
              <Box sx={{ flex: 1, textAlign: 'center', p: 2, border: '1px solid #D1D5DB', borderRadius: 2 }}>
                <Typography variant="h5" fontWeight={800} color="#0F4C81">{data.satisfaction.avg_rating}/5</Typography>
                <Typography variant="caption">Average Rating</Typography>
              </Box>
              <Box sx={{ flex: 1, textAlign: 'center', p: 2, border: '1px solid #D1D5DB', borderRadius: 2 }}>
                <Typography variant="h5" fontWeight={800} color="#16A34A">{data.satisfaction.total}</Typography>
                <Typography variant="caption">Total Responses</Typography>
              </Box>
              <Box sx={{ flex: 1, textAlign: 'center', p: 2, border: '1px solid #D1D5DB', borderRadius: 2 }}>
                <Typography variant="h5" fontWeight={800} color="#D97706">{data.satisfaction.positive}</Typography>
                <Typography variant="caption">Positive (4+ Rating)</Typography>
              </Box>
            </Stack>
          </Paper>
        )}

        {data?.training?.length === 0 && data?.documents?.length === 0 && data?.competency?.length === 0 && (!data?.service_users || data.service_users.length === 0) && (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">No compliance data found for the selected filters.</Typography>
          </Paper>
        )}
      </Box>
    </Box>
  )
}
