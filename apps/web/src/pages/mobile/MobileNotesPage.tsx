import { useState, useRef } from 'react'
import { Box, Typography, Paper, Button, Stack, TextField, Chip, CircularProgress, Autocomplete, Alert } from '@mui/material'
import { Mic as MicIcon, Stop as StopIcon, Send as SendIcon } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'

export default function MobileNotesPage() {
  const qc = useQueryClient()
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [serviceUserId, setServiceUserId] = useState('')
  const [shift, setShift] = useState<'day' | 'night'>('day')
  const [category, setCategory] = useState('wellbeing')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef<any>(null)

  const { data: serviceUsers } = useQuery({
    queryKey: ['mobile-su'],
    queryFn: () => api.get('/service-users?status=active').then(r => r.data),
  })

  const saveNoteMutation = useMutation({
    mutationFn: (data: any) => api.post('/mobile/notes', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mobile-notes'] }); setSent(true); setTimeout(() => setSent(false), 3000) },
    onError: (e: any) => setError(e.response?.data?.message || 'Failed to save'),
  })

  const startRecording = () => {
    setError('')
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { setError('Voice input not supported on this device/browser'); return }
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

  const saveNote = () => {
    if (!transcript.trim() || !serviceUserId) { setError('Please speak a note and select a person'); return }
    saveNoteMutation.mutate({
      service_user_id: serviceUserId,
      content: transcript.trim(),
      shift, category,
      note_date: new Date().toISOString().split('T')[0],
    })
    setTranscript('')
  }

  return (
    <Box sx={{ p: 2.5 }}>
      <Typography variant="h6" fontWeight={800} sx={{ mb: 2, color: '#0F4C81' }}>
        <MicIcon sx={{ mr: 1, verticalAlign: 'middle' }} /> Voice Notes
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
      {sent && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>Note saved!</Alert>}

      <Stack spacing={2}>
        <Autocomplete options={serviceUsers || []} getOptionLabel={(o: any) => `${o.first_name} ${o.last_name}${o.room_number ? ` (${o.room_number})` : ''}`}
          value={serviceUsers?.find((s: any) => s.id === serviceUserId) || null}
          onChange={(_, v) => setServiceUserId(v?.id || '')}
          renderInput={p => <TextField {...p} label="Select Person" size="small" />} />

        <Stack direction="row" spacing={1}>
          <Chip label="Day" color={shift === 'day' ? 'primary' : 'default'} onClick={() => setShift('day')} size="small" />
          <Chip label="Night" color={shift === 'night' ? 'primary' : 'default'} onClick={() => setShift('night')} size="small" />
          <TextField select size="small" value={category} onChange={e => setCategory(e.target.value)} sx={{ minWidth: 110 }}>
            {['wellbeing', 'nutrition', 'hydration', 'mobility', 'mood', 'medication', 'personal_care', 'other'].map(c => (
              <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
            ))}
          </TextField>
        </Stack>

        <Paper sx={{ p: 3, borderRadius: 3, bgcolor: recording ? '#FEF2F2' : '#F8FAFC', border: '1px solid #E5E7EB', minHeight: 120, textAlign: 'center' }}>
          {transcript ? (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, color: '#374151' }}>
              {transcript}
            </Typography>
          ) : (
            <Typography color="#9CA3AF">
              {recording ? 'Listening...' : 'Tap the mic and start speaking'}
            </Typography>
          )}
        </Paper>

        <Stack direction="row" spacing={1}>
          {!recording ? (
            <Button variant="contained" fullWidth startIcon={<MicIcon />} onClick={startRecording}
              sx={{ bgcolor: '#DC2626', textTransform: 'none', borderRadius: 3, py: 1.5 }}>
              Start Recording
            </Button>
          ) : (
            <Button variant="contained" fullWidth startIcon={<StopIcon />} onClick={stopRecording}
              sx={{ bgcolor: '#6B7280', textTransform: 'none', borderRadius: 3, py: 1.5 }}>
              Stop Recording
            </Button>
          )}
          <Button variant="contained" startIcon={<SendIcon />} onClick={saveNote}
            disabled={!transcript.trim() || !serviceUserId || saveNoteMutation.isPending}
            sx={{ bgcolor: '#0F4C81', textTransform: 'none', borderRadius: 3, px: 3 }}>
            {saveNoteMutation.isPending ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}
