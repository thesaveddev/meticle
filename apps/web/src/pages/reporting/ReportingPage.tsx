import { useState } from 'react'
import { Box, Typography, Grid, Card, CardContent, CardActions, Button, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Stack } from '@mui/material'
import {
  Assessment as ComplianceIcon,
  School as SchoolIcon,
  WarningAmber as WarningIcon,
  BeachAccess as BeachAccessIcon,
  People as PeopleIcon,
  Medication as MedIcon,
  Close as CloseIcon,
  Download as DownloadIcon,
} from '@mui/icons-material'

interface ReportTemplate {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  color: string
  advancedFeature: string
  csvHeaders: string[]
  csvRows: string[][]
}

const REPORTS: ReportTemplate[] = [
  {
    id: 'staff-compliance',
    title: 'Staff Compliance Summary',
    description: 'Overview of staff compliance status across all requirements',
    icon: <ComplianceIcon />,
    color: '#16A34A',
    advancedFeature: 'Enhanced filtering by role, location, expiry window',
    csvHeaders: ['Staff Name', 'Role', 'Overall %', 'DBS Status', 'Training Status', 'Last Review'],
    csvRows: [
      ['Jane Smith', 'Care Worker', '92%', 'Valid', 'Compliant', '2026-06-15'],
      ['John Doe', 'Senior Carer', '87%', 'Renewal Due', '1 Expired', '2026-05-20'],
      ['Sarah Brown', 'Manager', '95%', 'Valid', 'Compliant', '2026-06-28'],
    ],
  },
  {
    id: 'training-matrix',
    title: 'Training Matrix Export',
    description: 'Staff x training module completion matrix',
    icon: <SchoolIcon />,
    color: '#6366F1',
    advancedFeature: 'PDF export with CQC-mandated module highlighting',
    csvHeaders: ['Staff Name', 'Mandatory Training', 'Completed', 'Expiring Soon', 'Expired', 'Compliance %'],
    csvRows: [
      ['Jane Smith', 'Safeguarding', '12/14', '1', '1', '85.7%'],
      ['John Doe', 'Health & Safety', '10/14', '2', '2', '71.4%'],
      ['Sarah Brown', 'Medication Admin', '14/14', '0', '0', '100%'],
    ],
  },
  {
    id: 'incident-log',
    title: 'Incident Log',
    description: 'Categorized incident reports by type and severity',
    icon: <WarningIcon />,
    color: '#F59E0B',
    advancedFeature: 'Date range picker with trend analysis',
    csvHeaders: ['Date', 'Location', 'Type', 'Severity', 'Reported By', 'Status', 'Resolution'],
    csvRows: [
      ['2026-07-01', 'Oak House', 'Fall', 'Low', 'Jane Smith', 'Resolved', 'Monitored — no injury'],
      ['2026-06-28', 'Elm House', 'Medication Error', 'High', 'John Doe', 'Under Review', 'Pending investigation'],
      ['2026-06-25', 'Beech House', 'Safeguarding', 'Critical', 'Sarah Brown', 'Closed', 'Reported to CQC'],
    ],
  },
  {
    id: 'leave-overview',
    title: 'Leave Overview',
    description: 'Staff leave balances, usage, and pending requests',
    icon: <BeachAccessIcon />,
    color: '#0EA5E9',
    advancedFeature: 'Exportable per-staff breakdowns with year-over-year comparison',
    csvHeaders: ['Staff Name', 'Entitled Days', 'Used Days', 'Pending Days', 'Remaining Days'],
    csvRows: [
      ['Jane Smith', '28', '14', '2', '12'],
      ['John Doe', '28', '10', '0', '18'],
      ['Sarah Brown', '30', '18', '3', '9'],
    ],
  },
  {
    id: 'service-user-roster',
    title: 'Service User Roster',
    description: 'Active service users by location with status overview',
    icon: <PeopleIcon />,
    color: '#8B5CF6',
    advancedFeature: 'Status filters (active/discharged/transition) and assignment view',
    csvHeaders: ['Name', 'Location', 'Status', 'Start Date', 'Assigned Key Worker', 'Care Level'],
    csvRows: [
      ['Mary Johnson', 'Oak House', 'Active', '2025-03-10', 'Jane Smith', 'Level 2'],
      ['Peter Williams', 'Elm House', 'Active', '2025-01-15', 'John Doe', 'Level 3'],
      ['Linda Brown', 'Beech House', 'Transition', '2024-09-20', 'Sarah Brown', 'Level 1'],
    ],
  },
  {
    id: 'medication-admin',
    title: 'Medication Administration',
    description: 'MAR compliance rates and medication administration records',
    icon: <MedIcon />,
    color: '#EC4899',
    advancedFeature: 'Full audit export with GP Connect integration',
    csvHeaders: ['Medication', 'Scheduled Times', 'Administered %', 'Missed', 'Refused', 'Self-Administered'],
    csvRows: [
      ['Lisinopril 10mg', '08:00', '98.2%', '1', '0', '0'],
      ['Metformin 500mg', '12:00', '96.5%', '2', '1', '3'],
      ['Paracetamol 500mg', '16:00 (PRN)', '100%', '0', '0', '0'],
    ],
  },
]

function downloadCSV(headers: string[], rows: string[][], filename: string) {
  const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function ReportingPage() {
  const [selected, setSelected] = useState<ReportTemplate | null>(null)

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Reporting Suite</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
          Basic reports — live data coming soon
        </Typography>
      </Box>

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
                  label={`Phase 2: ${report.advancedFeature}`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 22 }}
                />
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2 }}>
                <Button
                  variant="contained"
                  size="small"
                  fullWidth
                  sx={{
                    bgcolor: report.color,
                    '&:hover': { bgcolor: report.color, opacity: 0.9 },
                    textTransform: 'none',
                    fontWeight: 600,
                  }}
                  onClick={() => setSelected(report)}
                >
                  Generate Report
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        maxWidth="sm"
        fullWidth
      >
        {selected && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ color: selected.color, display: 'flex' }}>{selected.icon}</Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>{selected.title}</Typography>
              </Stack>
              <IconButton size="small" onClick={() => setSelected(null)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ mb: 3 }}>
                <Chip
                  label="Coming in Phase 2"
                  color="warning"
                  size="small"
                  sx={{ mb: 2 }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  This report will be available in Phase 2 with full filtering, date ranges, and PDF/CSV export.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.7 }}>
                  Advanced features planned: {selected.advancedFeature}.
                </Typography>
              </Box>
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Sample Preview ({selected.csvRows.length} rows)
                </Typography>
                <Box
                  component="table"
                  sx={{
                    mt: 1,
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.75rem',
                    '& th': { textAlign: 'left', fontWeight: 600, pb: 1, borderBottom: '2px solid', borderColor: 'divider' },
                    '& td': { py: 0.75, borderBottom: '1px solid', borderColor: 'divider' },
                    '& tr:last-child td': { borderBottom: 'none' },
                  }}
                >
                  <thead>
                    <tr>
                      {selected.csvHeaders.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selected.csvRows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </Box>
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => {
                  downloadCSV(selected.csvHeaders, selected.csvRows, `${selected.id}-sample.csv`)
                }}
                sx={{ textTransform: 'none' }}
              >
                Download Sample
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  )
}
