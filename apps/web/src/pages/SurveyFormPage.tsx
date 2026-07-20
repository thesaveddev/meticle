import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography, Paper, Button, Stack, TextField, Slider, Rating, CircularProgress, Alert, Select, MenuItem, FormControl, InputLabel } from '@mui/material'
import api from '../services/api'

const RELATIONSHIPS = ['Family Member', 'Friend', 'Carer', 'Advocate', 'Professional', 'Other']

export default function SurveyFormPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [formData, setFormData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [type, setType] = useState<'satisfaction' | 'engagement'>('satisfaction')
  const [questions, setQuestions] = useState<{ key: string; label: string }[]>([])
  const [ratings, setRatings] = useState<Record<string, number>>({ q1: 3, q2: 3, q3: 3, q4: 3, q5: 3, q6: 3 })
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [satRating, setSatRating] = useState(5)
  const [comments, setComments] = useState('')
  const [serviceUserChoice, setServiceUserChoice] = useState('')

  useEffect(() => {
    const path = window.location.pathname
    const surveyType = path.includes('/engagement/') ? 'engagement' : 'satisfaction'
    setType(surveyType)
    ;(async () => {
      try {
        const res = await api.get(`/api/surveys/form/${surveyType}/${token}`)
        setFormData(res.data)
        if (res.data?.service_user_name) setServiceUserChoice(res.data.service_user_name)
        if (res.data?.questions?.length > 0) {
          setQuestions(res.data.questions)
          const defaults: Record<string, number> = {}
          res.data.questions.forEach((q: any) => { defaults[q.key] = 3 })
          setRatings(defaults)
        }
      } catch {
        setError('This survey link is invalid or has expired.')
      } finally {
        setLoading(false)
      }
    })()
  }, [token])

  const handleSatisfactionSubmit = async () => {
    if (!name) { setError('Please enter your name'); return }
    if (!relationship) { setError('Please select your relationship'); return }
    setSubmitting(true)
    setError('')
    try {
      await api.post(`/api/surveys/submit/satisfaction/${token}`, {
        respondent_name: name, relationship, rating: satRating, comments: comments || undefined,
        service_user_name: serviceUserChoice || undefined,
      })
      setDone(true)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEngagementSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      await api.post(`/api/surveys/submit/engagement/${token}`, {
        ratings, comments: comments || undefined, is_anonymous: true,
      })
      setDone(true)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><CircularProgress /></Box>

  if (error && !formData) return (
    <Box sx={{ maxWidth: 480, mx: 'auto', mt: 8, p: 3 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5" sx={{ mb: 2, color: '#DC2626' }}>Survey Unavailable</Typography>
        <Typography color="text.secondary">{error}</Typography>
      </Paper>
    </Box>
  )

  if (done) return (
    <Box sx={{ maxWidth: 480, mx: 'auto', mt: 8, p: 3 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5" sx={{ color: '#16A34A', mb: 2 }}>Thank You!</Typography>
        <Typography color="text.secondary">Your feedback has been submitted successfully.</Typography>
        <Button variant="outlined" onClick={() => navigate('/')} sx={{ mt: 3 }}>Go to CareDesk</Button>
      </Paper>
    </Box>
  )

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', mt: 4, p: 2 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" sx={{ color: '#0F4C81', mb: 1 }}>
          {type === 'satisfaction' ? 'Share Your Feedback' : 'Staff Engagement Survey'}
        </Typography>
        {formData?.org_name && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{formData.org_name}</Typography>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {type === 'satisfaction' && (
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField label="Your Name" value={name} onChange={e => setName(e.target.value)} fullWidth required />
            <FormControl fullWidth required>
              <InputLabel>Your Relationship</InputLabel>
              <Select value={relationship} label="Your Relationship" onChange={e => setRelationship(e.target.value)}>
                {RELATIONSHIPS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </FormControl>

            {formData?.service_user_name && (
              <TextField label="Regarding" value={formData.service_user_name} disabled fullWidth size="small" />
            )}
            {!formData?.service_user_name && (
              <TextField label="Who is this feedback about? (optional)" value={serviceUserChoice} onChange={e => setServiceUserChoice(e.target.value)} fullWidth size="small" placeholder="e.g. a family member's name" />
            )}

            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>How would you rate the care provided?</Typography>
              <Rating value={satRating} onChange={(_, v) => setSatRating(v || 5)} size="large" />
            </Box>
            <TextField label="Your Comments (optional)" value={comments} onChange={e => setComments(e.target.value)} fullWidth multiline rows={4} />
            <Button variant="contained" size="large" onClick={handleSatisfactionSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </Stack>
        )}

        {type === 'engagement' && (
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">Rate each statement from 1 (strongly disagree) to 5 (strongly agree).</Typography>
            {(questions.length > 0 ? questions : [
              { key: 'q1', label: 'I feel valued at work' },
              { key: 'q2', label: 'Communication is effective' },
              { key: 'q3', label: 'My wellbeing is supported' },
              { key: 'q4', label: 'I can speak up about concerns' },
              { key: 'q5', label: 'I have development opportunities' },
              { key: 'q6', label: 'Teamwork is strong' },
            ]).map(q => (
              <Box key={q.key}>
                <Typography variant="body2" sx={{ mb: 1 }}>{q.label}</Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="caption">1</Typography>
                  <Slider value={ratings[q.key] || 3} onChange={(_, v) => setRatings(p => ({ ...p, [q.key]: v as number }))} min={1} max={5} step={1} marks sx={{ flex: 1 }} />
                  <Typography variant="caption">5</Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ minWidth: 24, textAlign: 'center' }}>{ratings[q.key] || 3}</Typography>
                </Stack>
              </Box>
            ))}
            <TextField label="Additional Comments (optional)" value={comments} onChange={e => setComments(e.target.value)} fullWidth multiline rows={4} />
            <Button variant="contained" size="large" onClick={handleEngagementSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Survey'}
            </Button>
          </Stack>
        )}
      </Paper>
    </Box>
  )
}
