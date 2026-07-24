import { useState } from 'react'
import { Box, Typography, Grid, Card, CardContent, CardActions, Button, Chip, Stack, CircularProgress, Alert } from '@mui/material'
import {
  Assessment as ComplianceIcon,
  School as SchoolIcon,
  WarningAmber as WarningIcon,
  BeachAccess as BeachAccessIcon,
  People as PeopleIcon,
  Medication as MedIcon,
  Psychology as OutcomeIcon,
  TrendingUp as OrgOutcomeIcon,
  PictureAsPdf as PdfIcon,
  TableChart as CsvIcon,
} from '@mui/icons-material'
import api from '../../services/api'

interface ReportTemplate {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  color: string
}

const REPORTS: ReportTemplate[] = [
  { id: 'staff-compliance', title: 'Staff Compliance Summary', description: 'Overview of staff compliance status across all requirements', icon: <ComplianceIcon />, color: '#16A34A' },
  { id: 'training-matrix', title: 'Training Matrix Export', description: 'Staff x training module completion matrix', icon: <SchoolIcon />, color: '#6366F1' },
  { id: 'incident-log', title: 'Incident Log', description: 'Categorized incident reports by type and severity', icon: <WarningIcon />, color: '#F59E0B' },
  { id: 'leave-overview', title: 'Leave Overview', description: 'Staff leave balances, usage, and pending requests', icon: <BeachAccessIcon />, color: '#0EA5E9' },
  { id: 'service-user-roster', title: 'Service User Roster', description: 'Active service users by location with status overview', icon: <PeopleIcon />, color: '#8B5CF6' },
  { id: 'medication-admin', title: 'Medication Administration', description: 'MAR compliance rates and medication administration records', icon: <MedIcon />, color: '#EC4899' },
  { id: 'service-user-outcomes', title: 'Service User Outcomes', description: 'Goal progress, wellbeing scores, and outcome scale assessments per service user', icon: <OutcomeIcon />, color: '#0891B2' },
  { id: 'org-outcomes-summary', title: 'Organisation Outcomes Summary', description: 'Aggregate goal completion rates, CQC domain coverage, and wellbeing averages', icon: <OrgOutcomeIcon />, color: '#7C3AED' },
]

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

export default function ReportingPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleExport(reportId: string, format: 'pdf' | 'csv') {
    setLoading(`${reportId}-${format}`)
    setError('')
    try {
      const res = await api.get(`/reporting/export/${reportId}?format=${format}`, { responseType: 'blob' })
      const ext = format === 'pdf' ? 'pdf' : 'csv'
      downloadBlob(res.data as Blob, `${reportId}-${new Date().toISOString().split('T')[0]}.${ext}`)
    } catch {
      setError('Failed to generate report. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Reporting Suite</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
          Generate live PDF and CSV reports from your data
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Grid container spacing={3}>
        {REPORTS.map((report) => (
          <Grid item xs={12} sm={6} md={4} key={report.id}>
            <Card
              elevation={0}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'box-shadow 0.2s, border-color 0.2s',
                '&:hover': { borderColor: report.color, boxShadow: 2 },
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1.5,
                      bgcolor: `${report.color}14`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: report.color,
                    }}
                  >
                    {report.icon}
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', lineHeight: 1.3 }}>
                    {report.title}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {report.description}
                </Typography>
                <Chip
                  label="Live data — PDF & CSV export"
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 22 }}
                />
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2, gap: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  fullWidth
                  startIcon={loading === `${report.id}-pdf` ? <CircularProgress size={14} color="inherit" /> : <PdfIcon />}
                  disabled={!!loading}
                  sx={{ bgcolor: report.color, '&:hover': { bgcolor: report.color, opacity: 0.9 }, textTransform: 'none', fontWeight: 600 }}
                  onClick={() => handleExport(report.id, 'pdf')}
                >
                  PDF
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  fullWidth
                  startIcon={loading === `${report.id}-csv` ? <CircularProgress size={14} color="inherit" /> : <CsvIcon />}
                  disabled={!!loading}
                  sx={{ textTransform: 'none', fontWeight: 600, borderColor: 'divider' }}
                  onClick={() => handleExport(report.id, 'csv')}
                >
                  CSV
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
