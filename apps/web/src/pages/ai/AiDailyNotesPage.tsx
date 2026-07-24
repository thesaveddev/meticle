import { useState, useRef } from 'react'
import {
  Box, Typography, Paper, Button, Stack, TextField, Chip, CircularProgress,
  Autocomplete, Alert, Card, CardContent, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem,
  ListItemText, ListItemIcon
} from '@mui/material'
import {
  Mic as MicIcon, Stop as StopIcon, AutoAwesome as AiIcon,
  Warning as WarningIcon, CheckCircle as CheckIcon, Edit as EditIcon,
  Save as SaveIcon, Psychology as PsychologyIcon, HealthAndSafety as HealthIcon,
  Flag as FlagIcon, TrendingUp as TrendIcon, Lightbulb as LightbulbIcon,
  Shield as ShieldIcon
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'

interface AIResult {
  daily_note?: {
    content: string
    shift: string
    category: string
  }
  mood_analysis?: {
    mood_score: number
    mood_label: string
    indicators: string[]
    compared_to_baseline: string
  }
  safeguarding_flags?: Array<{
    concern_type: string
    severity: string
    description: string
    action_required: string
    reference_regulation?: string
  }>
  care_plan_updates?: Array<{
    goal_area: string
    suggested_update: string
    evidence: string
    priority: string
  }>
  interventions_suggested?: Array<{
    intervention: string
    reason: string
    expected_outcome: string
  }>
  risk_level?: string
  follow_up_required?: boolean
  follow_up_details?: string
}

export default function AiDailyNotesPage() {
  const qc = useQueryClient()
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [serviceUserId, setServiceUserId] = useState('')
  const [shift, setShift] = useState<'day' | 'night'>('day')
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0])
  const [aiResult, setAiResult] = useState<AIResult | null>(null)
  const [editingNote, setEditingNote] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const [approved, setApproved] = useState(false)
  const [error, setError] = useState('')
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const recognitionRef = useRef<any>(null)

  const { data: serviceUsers } = useQuery({
    queryKey: ['su-list'],
    queryFn: () => api.get('/service-users?status=active').then(r => r.data),
  })

  const generateMutation = useMutation({
    mutationFn: (data: any) => api.post('/ai/daily-notes/generate', data),
    onSuccess: (res) => {
      setAiResult(res.data.result)
      setEditedContent(res.data.result?.daily_note?.content || '')
    },
    onError: (e: any) => setError(e.response?.data?.error?.message || 'AI generation failed'),
  })

  const approveMutation = useMutation({
    mutationFn: (data: any) => api.post('/ai/daily-notes/approve', data),
    onSuccess: () => {
      setApproved(true)
      qc.invalidateQueries({ queryKey: ['daily-notes'] })
      setShowApproveDialog(false)
      setTimeout(() => {
        setAiResult(null)
        setApproved(false)
        setTranscript('')
        setEditedContent('')
      }, 2000)
    },
    onError: (e: any) => setError(e.response?.data?.error?.message || 'Failed to save'),
  })

  const startRecording = () => {
    setError('')
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { setError('Voice input not supported on this browser. Try Chrome.'); return }
    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-GB'
    rec.onresult = (e: any) => {
      let full = ''
      for (let i = e.resultIndex; i < e.results.length; i++) full += e.results[i][0].transcript
      setTranscript(full)
    }
    rec.onerror = (e: any) => { setError(`Voice error: ${e.error}`); setRecording(false) }
    rec.onend = () => setRecording(false)
    recognitionRef.current = rec
    rec.start()
    setRecording(true)
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()
    setRecording(false)
  }

  const handleGenerate = () => {
    if (!transcript.trim() || !serviceUserId) { setError('Please enter observations and select a service user'); return }
    setError('')
    setAiResult(null)
    generateMutation.mutate({
      serviceUserId,
      staffInput: transcript.trim(),
      shift,
      noteDate,
    })
  }

  const handleApprove = () => {
    if (!aiResult || !serviceUserId) return
    approveMutation.mutate({
      serviceUserId,
      dailyNote: {
        content: editedContent || aiResult.daily_note?.content || '',
        shift: aiResult.daily_note?.shift || shift,
        category: aiResult.daily_note?.category || 'wellbeing',
      },
      moodAnalysis: aiResult.mood_analysis,
      safeguardingFlags: aiResult.safeguarding_flags,
      carePlanUpdates: aiResult.care_plan_updates,
      interventionsSuggested: aiResult.interventions_suggested,
      riskLevel: aiResult.risk_level,
      followUpRequired: aiResult.follow_up_required,
      followUpDetails: aiResult.follow_up_details,
      noteDate,
    })
  }

  const getRiskColor = (level?: string) => {
    switch (level) {
      case 'high': return 'error'
      case 'medium': return 'warning'
      case 'low': return 'success'
      default: return 'default'
    }
  }

  const getMoodEmoji = (score?: number) => {
    if (!score) return '😐'
    if (score >= 8) return '😊'
    if (score >= 6) return '🙂'
    if (score >= 4) return '😐'
    if (score >= 2) return '😟'
    return '😢'
  }

  return (
    <Box sx={{ p: 2.5, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 1, color: '#0F4C81' }}>
        <AiIcon sx={{ mr: 1, verticalAlign: 'middle' }} /> AI Daily Notes
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Transform your observations into structured, CQC-compliant care documentation
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {approved && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>Daily note saved successfully!</Alert>}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
        {/* Left: Input Panel */}
        <Box sx={{ flex: 1 }}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
              Staff Observation
            </Typography>

            <Stack spacing={2}>
              <Autocomplete
                options={serviceUsers || []}
                getOptionLabel={(o: any) => `${o.first_name} ${o.last_name}${o.room_number ? ` (${o.room_number})` : ''}`}
                value={serviceUsers?.find((s: any) => s.id === serviceUserId) || null}
                onChange={(_, v) => setServiceUserId(v?.id || '')}
                renderInput={p => <TextField {...p} label="Select Service User" size="small" required />}
              />

              <Stack direction="row" spacing={1}>
                <TextField
                  label="Date"
                  type="date"
                  size="small"
                  value={noteDate}
                  onChange={e => setNoteDate(e.target.value)}
                  sx={{ flex: 1 }}
                  InputLabelProps={{ shrink: true }}
                />
                <Autocomplete
                  options={['day', 'night']}
                  value={shift}
                  onChange={(_, v) => setShift(v as any || 'day')}
                  renderInput={p => <TextField {...p} label="Shift" size="small" />}
                  sx={{ flex: 1 }}
                />
              </Stack>

              {/* Voice Input */}
              <Box sx={{ bgcolor: '#f8f9fa', borderRadius: 2, p: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Button
                    variant={recording ? 'contained' : 'outlined'}
                    color={recording ? 'error' : 'primary'}
                    startIcon={recording ? <StopIcon /> : <MicIcon />}
                    onClick={recording ? stopRecording : startRecording}
                    disabled={generateMutation.isPending}
                  >
                    {recording ? 'Stop Recording' : 'Start Voice Input'}
                  </Button>
                  {recording && (
                    <Chip label="Recording..." color="error" size="small" sx={{ animation: 'pulse 1.5s infinite' }} />
                  )}
                </Stack>
                <TextField
                  multiline
                  rows={4}
                  fullWidth
                  placeholder="Or type your observations here... e.g. 'John had breakfast, took his medication, walked in the garden for 30 minutes and seemed happier today'"
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                  disabled={generateMutation.isPending}
                />
              </Box>

              <Button
                variant="contained"
                startIcon={generateMutation.isPending ? <CircularProgress size={20} /> : <AiIcon />}
                onClick={handleGenerate}
                disabled={!transcript.trim() || !serviceUserId || generateMutation.isPending}
                fullWidth
                size="large"
                sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0D3D6B' } }}
              >
                {generateMutation.isPending ? 'Generating AI Analysis...' : 'Generate AI Daily Note'}
              </Button>
            </Stack>
          </Paper>
        </Box>

        {/* Right: AI Results Panel */}
        <Box sx={{ flex: 1.5 }}>
          {aiResult ? (
            <Stack spacing={2}>
              {/* Risk Level Badge */}
              <Paper sx={{ p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip
                  label={`${aiResult.risk_level?.toUpperCase() || 'UNKNOWN'} RISK`}
                  color={getRiskColor(aiResult.risk_level) as any}
                  icon={<FlagIcon />}
                  sx={{ fontWeight: 700 }}
                />
                {aiResult.follow_up_required && (
                  <Chip label="Follow-up Required" color="info" icon={<HealthIcon />} />
                )}
                <Box sx={{ flex: 1 }} />
                <Tooltip title="Edit note">
                  <IconButton onClick={() => setEditingNote(!editingNote)}>
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckIcon />}
                  onClick={() => setShowApproveDialog(true)}
                >
                  Approve & Save
                </Button>
              </Paper>

              {/* Daily Note */}
              <Card sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HealthIcon color="primary" /> Daily Note
                    <Chip label={aiResult.daily_note?.category} size="small" />
                    <Chip label={aiResult.daily_note?.shift} size="small" variant="outlined" />
                  </Typography>
                  {editingNote ? (
                    <TextField
                      multiline
                      rows={6}
                      fullWidth
                      value={editedContent}
                      onChange={e => setEditedContent(e.target.value)}
                    />
                  ) : (
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                      {editedContent || aiResult.daily_note?.content}
                    </Typography>
                  )}
                </CardContent>
              </Card>

              {/* Mood Analysis */}
              {aiResult.mood_analysis && (
                <Card sx={{ borderRadius: 3 }}>
                  <CardContent>
                    <Typography variant="h6" fontWeight={700} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PsychologyIcon color="secondary" /> Mood & Wellbeing
                    </Typography>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="h3">{getMoodEmoji(aiResult.mood_analysis.mood_score)}</Typography>
                      <Box>
                        <Typography variant="h6" fontWeight={700}>{aiResult.mood_analysis.mood_label}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Score: {aiResult.mood_analysis.mood_score}/10 • Trend: {aiResult.mood_analysis.compared_to_baseline}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                      {aiResult.mood_analysis.indicators?.map((ind, i) => (
                        <Chip key={i} label={ind} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {/* Safeguarding Flags */}
              {aiResult.safeguarding_flags && aiResult.safeguarding_flags.length > 0 && (
                <Card sx={{ borderRadius: 3, border: '1px solid #ffcdd2' }}>
                  <CardContent>
                    <Typography variant="h6" fontWeight={700} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1, color: '#d32f2f' }}>
                      <ShieldIcon /> Safeguarding Flags ({aiResult.safeguarding_flags.length})
                    </Typography>
                    <List dense>
                      {aiResult.safeguarding_flags.map((flag, i) => (
                        <ListItem key={i} sx={{ bgcolor: '#fff5f5', borderRadius: 1, mb: 0.5 }}>
                          <ListItemIcon>
                            <WarningIcon color={flag.severity === 'high' ? 'error' : flag.severity === 'medium' ? 'warning' : 'info'} />
                          </ListItemIcon>
                          <ListItemText
                            primary={<>
                              <Chip label={flag.severity.toUpperCase()} size="small" color={flag.severity === 'high' ? 'error' : 'warning'} sx={{ mr: 1 }} />
                              {flag.concern_type}
                            </>}
                            secondary={<>
                              {flag.description}
                              <br />
                              <strong>Action:</strong> {flag.action_required}
                              {flag.reference_regulation && <><br /><em>{flag.reference_regulation}</em></>}
                            </>}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              )}

              {/* Care Plan Updates */}
              {aiResult.care_plan_updates && aiResult.care_plan_updates.length > 0 && (
                <Card sx={{ borderRadius: 3 }}>
                  <CardContent>
                    <Typography variant="h6" fontWeight={700} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TrendIcon color="primary" /> Suggested Care Plan Updates
                    </Typography>
                    <List dense>
                      {aiResult.care_plan_updates.map((update, i) => (
                        <ListItem key={i} sx={{ bgcolor: '#f5f5f5', borderRadius: 1, mb: 0.5 }}>
                          <ListItemText
                            primary={<>
                              <Chip label={update.priority} size="small" color={update.priority === 'high' ? 'error' : update.priority === 'medium' ? 'warning' : 'info'} sx={{ mr: 1 }} />
                              {update.goal_area}
                            </>}
                            secondary={<>
                              {update.suggested_update}
                              <br />
                              <strong>Evidence:</strong> {update.evidence}
                            </>}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              )}

              {/* Interventions */}
              {aiResult.interventions_suggested && aiResult.interventions_suggested.length > 0 && (
                <Card sx={{ borderRadius: 3 }}>
                  <CardContent>
                    <Typography variant="h6" fontWeight={700} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LightbulbIcon color="warning" /> Suggested Interventions
                    </Typography>
                    <List dense>
                      {aiResult.interventions_suggested.map((int, i) => (
                        <ListItem key={i} sx={{ bgcolor: '#fff8e1', borderRadius: 1, mb: 0.5 }}>
                          <ListItemText
                            primary={int.intervention}
                            secondary={<>
                              <strong>Reason:</strong> {int.reason}
                              <br />
                              <strong>Expected outcome:</strong> {int.expected_outcome}
                            </>}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              )}

              {/* Follow-up Details */}
              {aiResult.follow_up_required && aiResult.follow_up_details && (
                <Paper sx={{ p: 2, borderRadius: 3, bgcolor: '#e3f2fd', border: '1px solid #90caf9' }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                    Follow-up Required
                  </Typography>
                  <Typography variant="body2">{aiResult.follow_up_details}</Typography>
                </Paper>
              )}
            </Stack>
          ) : (
            <Paper sx={{ p: 4, borderRadius: 3, textAlign: 'center', minHeight: 400, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <AiIcon sx={{ fontSize: 64, color: '#ccc', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>AI Analysis Results</Typography>
              <Typography variant="body2" color="text.secondary">
                Enter your observations and click "Generate AI Daily Note" to see structured analysis
              </Typography>
            </Paper>
          )}
        </Box>
      </Stack>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onClose={() => setShowApproveDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Approve & Save Daily Note</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This will save the daily note, update wellbeing records, and trigger any safeguarding alerts.
          </Typography>
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            All AI-generated content is reviewed by you before saving. This maintains CQC compliance with human oversight requirements.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowApproveDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            startIcon={approveMutation.isPending ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleApprove}
            disabled={approveMutation.isPending}
          >
            {approveMutation.isPending ? 'Saving...' : 'Approve & Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
