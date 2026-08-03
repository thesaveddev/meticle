import { useState } from 'react'
import { Box, Typography, Paper, Stack, Chip, Autocomplete, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, IconButton, Tooltip, Collapse, Button } from '@mui/material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowBack, Medication as MedIcon, Schedule as ScheduleIcon, Check as CheckIcon, Close as CloseIcon, ExpandMore, ExpandLess, Search as SearchIcon, Unarchive as UnarchiveIcon } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

const ADMIN_STATUSES = ['given', 'refused', 'missed', 'omitted', 'not_available', 'n/a'] as const
type AdminStatus = typeof ADMIN_STATUSES[number]

const STATUS_CONFIG: Record<AdminStatus, { label: string; color: 'success' | 'error' | 'warning' | 'default'; icon: React.ReactNode }> = {
  given: { label: 'Given', color: 'success', icon: <CheckIcon sx={{ fontSize: 14 }} /> },
  refused: { label: 'Refused', color: 'error', icon: <CloseIcon sx={{ fontSize: 14 }} /> },
  missed: { label: 'Missed', color: 'error', icon: <CloseIcon sx={{ fontSize: 14 }} /> },
  omitted: { label: 'Omitted', color: 'warning', icon: <span style={{ fontSize: 14 }}>&ndash;</span> },
  not_available: { label: 'N/A', color: 'warning', icon: <CloseIcon sx={{ fontSize: 14 }} /> },
  'n/a': { label: 'N/A', color: 'default', icon: <span style={{ fontSize: 14 }}>&ndash;</span> },
}

interface MedicationRecord {
  id: string; title: string; person_id: string; person_name: string
  start_date: string; end_date: string; status: string
}

interface MedicationItem {
  id: string; name: string; dosage: string; unit: string; route: string
  frequency: string; times: string[]; instructions: string
  is_prn: boolean; is_active: boolean; emedication_record_id: string
}

interface Administration {
  id: string; emedication_item_id: string; scheduled_time: string
  administered_time: string; status: string; notes: string; user_id?: string
  first_name: string; last_name: string; staff_id?: string
}

interface MarChartData {
  record: MedicationRecord
  days: string[]
  items: MedicationItem[]
  adminMap: Record<string, Record<string, Administration[]>>
}

const todayStr = () => new Date().toISOString().split('T')[0]

function getAdminDisplay(admins: Administration[] | undefined): Administration | undefined {
  if (!admins || admins.length === 0) return undefined
  return admins[admins.length - 1]
}

export default function ArchivedMarPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [selectedPerson, setSelectedPerson] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedChartId, setExpandedChartId] = useState<string | null>(null)

  const { data: people } = useQuery({
    queryKey: ['people-list'],
    queryFn: async () => { const res = await api.get('/people'); return res.data as any[] }
  })

  const { data: recordsData, isLoading: recordsLoading } = useQuery({
    queryKey: ['archived-mar-records', selectedPerson?.id],
    queryFn: async () => {
      if (!selectedPerson) return []
      const res = await api.get(`/emedication/records?personId=${selectedPerson.id}`)
      return (res.data as MedicationRecord[]).filter(r => r.status === 'archived')
    },
    enabled: !!selectedPerson
  })

  const unarchiveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/emedication/records/${id}`, { status: 'active' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archived-mar-records'] })
    }
  })

  const filteredRecords = (recordsData || []).filter(r =>
    !searchTerm || r.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const [chartMonth, setChartMonth] = useState<string | null>(null)

  const { data: chartData } = useQuery({
    queryKey: ['archived-mar-chart', expandedChartId, chartMonth],
    queryFn: async () => {
      if (!expandedChartId || !chartMonth) return null
      const refDate = chartMonth + '-01'
      const res = await api.get(`/emedication/records/${expandedChartId}/chart?date=${refDate}`)
      return res.data as MarChartData
    },
    enabled: !!expandedChartId && !!chartMonth
  })

  const regularItems = chartData?.items.filter((i: any) => !i.is_prn) || []
  const gridRows = regularItems.flatMap(item =>
    item.times.sort().map(time => ({ item, time }))
  )

  const handleExpand = (record: MedicationRecord) => {
    if (expandedChartId === record.id) {
      setExpandedChartId(null)
      setChartMonth(null)
    } else {
      setExpandedChartId(record.id)
      const cm = record.start_date.slice(0, 7)
      setChartMonth(cm)
    }
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate('/emedication')}><ArrowBack /></IconButton>
        <Typography variant="h4">Archived Medication Charts</Typography>
      </Stack>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Autocomplete
            options={people || []}
            getOptionLabel={(o: any) => `${o.first_name} ${o.last_name}`}
            value={selectedPerson}
            onChange={(_, v) => { setSelectedPerson(v); setExpandedChartId(null); setChartMonth(null) }}
            renderInput={(params) => <TextField {...params} label="Search Person" size="small" />}
            sx={{ minWidth: 300 }}
          />
          <TextField size="small" placeholder="Search by chart title..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> }}
            sx={{ minWidth: 250 }}
          />
        </Stack>
      </Paper>

      {recordsLoading ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={24} /></Paper>
      ) : !selectedPerson ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <MedIcon sx={{ fontSize: 48, color: '#D1D5DB', mb: 2 }} />
          <Typography color="text.secondary">Select a person to view archived charts</Typography>
        </Paper>
      ) : filteredRecords.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {recordsData?.length === 0 ? 'No archived charts for this person.' : 'No charts match your search.'}
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1}>
          {filteredRecords.map((record) => {
            const isExpanded = expandedChartId === record.id
            return (
              <Paper key={record.id} variant="outlined" sx={{ overflow: 'hidden' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center"
                  sx={{ p: 2, cursor: 'pointer', '&:hover': { bgcolor: '#F9FAFB' } }}
                  onClick={() => handleExpand(record)}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    {isExpanded ? <ExpandLess /> : <ExpandMore />}
                    <Box>
                      <Typography variant="subtitle2" fontWeight={600}>{record.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {record.person_name} &bull; {new Date(record.start_date).toLocaleDateString()} &ndash; {new Date(record.end_date).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip label="Archived" size="small" color="default" variant="outlined" />
                    <Button size="small" variant="outlined" startIcon={<UnarchiveIcon />}
                      onClick={(e) => { e.stopPropagation(); unarchiveMutation.mutate(record.id) }}
                      disabled={unarchiveMutation.isPending}>
                      {unarchiveMutation.isPending ? '...' : 'Unarchive'}
                    </Button>
                  </Stack>
                </Stack>

                <Collapse in={isExpanded}>
                  <Box sx={{ p: 2, borderTop: '1px solid #E5E7EB' }}>
                    {expandedChartId === record.id && !chartData ? (
                      <CircularProgress size={20} sx={{ display: 'block', mx: 'auto' }} />
                    ) : chartData ? (
                      <>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          {chartData.days.length} days &bull; {regularItems.length} medication{regularItems.length !== 1 ? 's' : ''}
                        </Typography>
                        <TableContainer sx={{ maxHeight: 500 }}>
                          <Table size="small" stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 700, minWidth: 200, bgcolor: '#F9FAFB', position: 'sticky', left: 0, zIndex: 3, borderRight: '2px solid #E5E7EB' }}>
                                  Medication
                                </TableCell>
                                <TableCell sx={{ fontWeight: 700, minWidth: 80, bgcolor: '#F8FAFC', position: 'sticky', left: 200, zIndex: 3, borderRight: '1px solid #E5E7EB' }}>
                                  Time
                                </TableCell>
                                {chartData.days.map((day, i) => (
                                  <TableCell key={day} align="center" sx={{
                                    fontWeight: 700, fontSize: '0.7rem', p: 0.5, minWidth: 36,
                                    bgcolor: '#F9FAFB', borderLeft: i > 0 ? '1px solid #F3F4F6' : 'none'
                                  }}>
                                    {new Date(day + 'T12:00:00').getDate()}
                                    <br />
                                    <Typography variant="caption" sx={{ fontSize: '0.55rem', color: '#9CA3AF' }}>
                                      {new Date(day + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' }).slice(0, 2)}
                                    </Typography>
                                  </TableCell>
                                ))}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {gridRows.map(({ item, time }) => (
                                <TableRow key={item.id + time} hover>
                                  <TableCell sx={{
                                    fontWeight: 600, fontSize: '0.75rem',
                                    position: 'sticky', left: 0, bgcolor: 'white', zIndex: 1,
                                    borderRight: '2px solid #E5E7EB', whiteSpace: 'nowrap'
                                  }}>
                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                      <MedIcon sx={{ fontSize: 14, color: '#0F4C81' }} />
                                      <span>{item.name}</span>
                                      <Typography variant="caption" color="text.secondary">{item.dosage}{item.unit}</Typography>
                                      <Chip label={item.route} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
                                    </Stack>
                                  </TableCell>
                                  <TableCell sx={{
                                    fontWeight: 500, fontSize: '0.75rem', bgcolor: '#F8FAFC',
                                    whiteSpace: 'nowrap', borderRight: '1px solid #E5E7EB',
                                    position: 'sticky', left: 200, zIndex: 1
                                  }}>
                                    {time}
                                  </TableCell>
                                  {chartData.days.map((day, i) => {
                                    const isCellToday = day === todayStr()
                                    const scheduledTime = new Date(`${day}T${time}:00`)
                                    const adminsForSlot = (chartData.adminMap[item.id]?.[day] || []).filter((a: Administration) => {
                                      const aTime = new Date(a.scheduled_time)
                                      return aTime.getHours() === scheduledTime.getHours() && aTime.getMinutes() === scheduledTime.getMinutes()
                                    })
                                    const existingAdmin = getAdminDisplay(adminsForSlot)
                                    const config = existingAdmin ? STATUS_CONFIG[existingAdmin.status as AdminStatus] : null
                                    return (
                                      <TableCell key={day} align="center" sx={{
                                        p: 0, minWidth: 36,
                                        bgcolor: isCellToday ? '#EFF6FF' : i % 2 === 0 ? 'white' : '#F9FAFB',
                                        borderLeft: i > 0 ? '1px solid #F3F4F6' : 'none'
                                      }}>
                                        {existingAdmin ? (
                                          <Tooltip title={`${config?.label}${existingAdmin.notes ? ': ' + existingAdmin.notes : ''}`}>
                                            <Box sx={{
                                              color: config?.color === 'success' ? '#16A34A' : config?.color === 'error' ? '#DC2626' : '#9CA3AF',
                                              display: 'flex', alignItems: 'center', justifyContent: 'center', height: 28
                                            }}>
                                              {config?.icon || <ScheduleIcon sx={{ fontSize: 14, color: '#D1D5DB' }} />}
                                            </Box>
                                          </Tooltip>
                                        ) : (
                                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 28 }}>
                                            <ScheduleIcon sx={{ fontSize: 14, color: '#D1D5DB' }} />
                                          </Box>
                                        )}
                                      </TableCell>
                                    )
                                  })}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </>
                    ) : null}
                  </Box>
                </Collapse>
              </Paper>
            )
          })}
        </Stack>
      )}
    </Box>
  )
}
