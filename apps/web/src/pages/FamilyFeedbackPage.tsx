import { useState } from 'react'
import {
  Box, Typography, Paper, Stack, Rating, TextField, Button,
  CircularProgress, Alert, Chip, Divider,
} from '@mui/material'
import { CheckCircle, ThumbUp, ThumbDown } from '@mui/icons-material'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import axios from 'axios'
import PageMeta from '../components/PageMeta'

const apiBase = '/api/family-feedback'

interface FeedbackData {
  visit: {
    label: string
    scheduled_start: string
    scheduled_end: string
    carer_name: string
  }
  person: { first_name: string; last_name: string }
  organization: { name: string }
  family_member_name: string
  relationship: string
}

function RatingRow({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number) => void }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1.5 }}>
      <Typography sx={{ fontWeight: 500, color: '#344054' }}>{label}</Typography>
      <Rating
        value={value || 0}
        onChange={(_, v) => { if (v) onChange(v) }}
        size="large"
        sx={{
          '& .MuiRating-iconFilled': { color: '#10BFA5' },
          '& .MuiRating-iconHover': { color: '#10BFA5' },
        }}
      />
    </Stack>
  )
}

export default function FamilyFeedbackPage() {
  const { token } = useParams()
  const [overallRating, setOverallRating] = useState<number | null>(null)
  const [careQuality, setCareQuality] = useState<number | null>(null)
  const [communication, setCommunication] = useState<number | null>(null)
  const [punctuality, setPunctuality] = useState<number | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null)

  const { data, isLoading, error } = useQuery<FeedbackData>({
    queryKey: ['family-feedback', token],
    queryFn: () => axios.get(`${apiBase}/${token}`).then(r => r.data),
    enabled: !!token,
    retry: false,
  })

  const submitMutation = useMutation({
    mutationFn: () => axios.post(`${apiBase}/${token}`, {
      overall_rating: overallRating,
      care_quality_rating: careQuality,
      communication_rating: communication,
      punctuality_rating: punctuality,
      feedback_text: feedbackText || undefined,
      would_recommend: wouldRecommend,
    }).then(r => r.data),
  })

  if (isLoading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#FBFCFE' }}>
        <CircularProgress sx={{ color: '#10BFA5' }} />
      </Box>
    )
  }

  if (error || !data) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#FBFCFE', p: 3 }}>
        <Paper sx={{ p: 5, maxWidth: 480, textAlign: 'center', borderRadius: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#17202A', mb: 2 }}>
            Link expired or already used
          </Typography>
          <Typography sx={{ color: '#667085' }}>
            This feedback link has expired or has already been submitted. Please contact the care team if you need a new link.
          </Typography>
        </Paper>
      </Box>
    )
  }

  if (submitMutation.isSuccess) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#FBFCFE', p: 3 }}>
        <Paper sx={{ p: 6, maxWidth: 480, textAlign: 'center', borderRadius: 3 }}>
          <CheckCircle sx={{ fontSize: 64, color: '#10BFA5', mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#17202A', mb: 1 }}>
            Thank you for your feedback
          </Typography>
          <Typography sx={{ color: '#667085', lineHeight: 1.6 }}>
            Your feedback has been recorded and will help us maintain high standards of care for {data.person.first_name}.
          </Typography>
        </Paper>
      </Box>
    )
  }

  const visitDate = data.visit.scheduled_start
    ? new Date(data.visit.scheduled_start).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : ''
  const visitTime = data.visit.scheduled_start
    ? `${new Date(data.visit.scheduled_start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} – ${new Date(data.visit.scheduled_end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
    : ''

  return (
    <>
      <PageMeta title="Share your feedback" description="Rate your care visit experience" />
      <Box sx={{ minHeight: '100vh', bgcolor: '#FBFCFE', py: { xs: 3, md: 6 }, px: 2 }}>
        <Paper sx={{ maxWidth: 560, mx: 'auto', borderRadius: 3, overflow: 'hidden' }}>
          {/* Header */}
          <Box sx={{
            bgcolor: '#F4F8FF', color: '#17202A', p: { xs: 3, md: 4 },
            borderBottom: '1px solid #E6EAF0',
          }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#087A55', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>
              {data.organization.name}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
              How was the visit?
            </Typography>
            <Typography sx={{ color: '#667085', fontSize: '0.9rem' }}>
              Your feedback helps us improve care for {data.person.first_name} {data.person.last_name}.
            </Typography>
          </Box>

          {/* Visit info */}
          <Box sx={{ px: { xs: 3, md: 4 }, pt: 3, pb: 1 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
              <Chip
                label={data.visit.label || 'Care visit'}
                size="small"
                sx={{ bgcolor: '#E8FAF6', color: '#087A55', fontWeight: 600, fontSize: '0.75rem' }}
              />
              {visitDate && (
                <Typography sx={{ fontSize: '0.8rem', color: '#94A3B8' }}>{visitDate}</Typography>
              )}
            </Stack>
            {visitTime && (
              <Typography sx={{ fontSize: '0.8rem', color: '#667085', mb: 1 }}>{visitTime}</Typography>
            )}
            {data.visit.carer_name && (
              <Typography sx={{ fontSize: '0.8rem', color: '#667085' }}>
                Visited by <strong style={{ color: '#344054' }}>{data.visit.carer_name}</strong>
              </Typography>
            )}
          </Box>

          <Divider sx={{ mx: { xs: 3, md: 4 }, my: 2 }} />

          {/* Ratings */}
          <Box sx={{ px: { xs: 3, md: 4 } }}>
            <RatingRow label="Overall experience" value={overallRating} onChange={setOverallRating} />
            <Divider />
            <RatingRow label="Quality of care" value={careQuality} onChange={setCareQuality} />
            <Divider />
            <RatingRow label="Communication" value={communication} onChange={setCommunication} />
            <Divider />
            <RatingRow label="Punctuality" value={punctuality} onChange={setPunctuality} />
          </Box>

          {/* Would recommend */}
          <Box sx={{ px: { xs: 3, md: 4 }, py: 2 }}>
            <Typography sx={{ fontWeight: 500, color: '#344054', mb: 1.5 }}>
              Would you recommend our service?
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button
                variant={wouldRecommend === true ? 'contained' : 'outlined'}
                startIcon={<ThumbUp />}
                onClick={() => setWouldRecommend(true)}
                sx={{
                  flex: 1, py: 1.2, textTransform: 'none', fontWeight: 600, borderRadius: 2,
                  ...(wouldRecommend === true
                    ? { bgcolor: '#10BFA5', color: '#FFFFFF', '&:hover': { bgcolor: '#0FAF97' } }
                    : { borderColor: '#CBD5E1', color: '#667085', '&:hover': { borderColor: '#10BFA5', bgcolor: '#E8FAF6' } }),
                }}
              >
                Yes
              </Button>
              <Button
                variant={wouldRecommend === false ? 'contained' : 'outlined'}
                startIcon={<ThumbDown />}
                onClick={() => setWouldRecommend(false)}
                sx={{
                  flex: 1, py: 1.2, textTransform: 'none', fontWeight: 600, borderRadius: 2,
                  ...(wouldRecommend === false
                    ? { bgcolor: '#EF4444', color: '#FFFFFF', '&:hover': { bgcolor: '#EF4444' } }
                    : { borderColor: '#CBD5E1', color: '#667085', '&:hover': { borderColor: '#EF4444', bgcolor: '#FEF0F0' } }),
                }}
              >
                No
              </Button>
            </Stack>
          </Box>

          {/* Comments */}
          <Box sx={{ px: { xs: 3, md: 4 }, pb: 3 }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="Any additional comments? (optional)"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&:hover fieldset': { borderColor: '#10BFA5' },
                },
              }}
            />
          </Box>

          {/* Submit */}
          <Box sx={{ px: { xs: 3, md: 4 }, pb: 4 }}>
            {submitMutation.isError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                Something went wrong. Please try again.
              </Alert>
            )}
            <Button
              fullWidth
              variant="contained"
              disabled={!overallRating || submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
              sx={{
                bgcolor: '#10BFA5', color: '#FFFFFF', fontWeight: 700, py: 1.5,
                borderRadius: 2, textTransform: 'none', fontSize: '1rem',
                '&:hover': { bgcolor: '#0FAF97' },
                '&.Mui-disabled': { bgcolor: '#CBD5E1', color: '#94A3B8' },
              }}
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit feedback'}
            </Button>
            <Typography sx={{ textAlign: 'center', fontSize: '0.7rem', color: '#94A3B8', mt: 1.5 }}>
              Your feedback is confidential. Logged in as {data.family_member_name}.
            </Typography>
          </Box>
        </Paper>
      </Box>
    </>
  )
}
