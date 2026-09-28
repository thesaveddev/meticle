import { useState } from 'react'
import {
  Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography,
} from '@mui/material'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useSnackbar } from '../context/SnackbarContext'

/**
 * A carer's own decision about their employer's location recording.
 *
 * Three rules this component is built around.
 *
 * The decision is the worker's. There is no manager path that writes it — the
 * API has no such endpoint — and this one posts to the worker's own endpoint.
 * An "agreement" an employer can enter on someone's behalf is not an agreement,
 * and a page that let a manager tick it would be evidence of the opposite.
 *
 * It collects less, never more. A worker who declines loses a feature (the
 * address check) and keeps everything that matters for their pay and their
 * record. The copy says so, because "no" that silently turned off timesheets
 * would be a different and much worse answer.
 *
 * It does not give the employer a lawful basis. The notice this decision refers
 * to is deliberately not worded as consent, and this page must not drift into
 * claiming consent either — it records what the worker was told and what they
 * chose, and the lawful basis for the employer's monitoring is the employer's
 * to establish, not something this screen confers.
 *
 * The full notice text is not reprinted here. It is a bundled app asset, shown
 * in the app where a carer reads it on a phone; a second copy in the browser
 * would be a second thing to keep true. So this page states the version it
 * records against, which the server supplies, and points at the app for the
 * wording.
 */
export default function LocationDecisionControl() {
  const { showSnackbar } = useSnackbar()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<'agreed' | 'declined' | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['myLocationDecision'],
    queryFn: async () => (await api.get('/homecare/location-decision')).data,
  })

  const save = useMutation({
    mutationFn: async (decision: 'agreed' | 'declined') => {
      setBusy(decision)
      return (await api.post('/homecare/location-decision', {
        decision,
        // The version the server calls current, not one typed in here. If the
        // notice text is revised and this page is not, the record still says
        // which notice the answer is being attached to, and the mobile app
        // re-asks on the next launch because it compares its own bundled
        // version against the stored one.
        notice_key: data?.current_notice_key,
        notice_version: data?.current_notice_version,
        app_version: 'web',
      })).data
    },
    onSuccess: (_res, decision) => {
      queryClient.invalidateQueries({ queryKey: ['myLocationDecision'] })
      showSnackbar(
        decision === 'agreed'
          ? 'Recorded. Your employer can now see that you agreed.'
          : 'Recorded. Your position will not be sent when you check in or out.',
        'success',
      )
    },
    onError: (e: any) => {
      showSnackbar(e?.response?.data?.message || 'Could not record your answer.', 'error')
    },
    onSettled: () => setBusy(null),
  })

  if (isLoading) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          <LocationOnIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Your location
        </Typography>
        <CircularProgress size={20} />
      </Paper>
    )
  }

  // Failing closed on the write as well as the read: a worker who cannot see
  // their current answer has no way to know what changing it would mean, so the
  // buttons stay hidden rather than offering a blind toggle.
  if (isError || !data) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          <LocationOnIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Your location
        </Typography>
        <Alert severity="warning">
          Your location answer could not be loaded, so it cannot be changed from here. The app
          will still ask you if you use it on a phone.
        </Alert>
      </Paper>
    )
  }

  const answered = data.decision === 'agreed' || data.decision === 'declined'
  const orgOff = data.organisation_collects_location === false

  return (
    <Paper sx={{ p: 4 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        <LocationOnIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Your location
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Whether your employer records your position when you check in and out of a call. This is
        your decision to make, and nobody else can make it for you.
      </Typography>

      <Stack spacing={1} sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>What would be recorded:</strong> one reading of your position when you press
          Check in or Check out, with the time and how accurate the reading was. Nothing else.
        </Typography>
        <Typography variant="body2">
          <strong>What would not:</strong> the app does not follow you in the background, does not
          watch your position while a visit is open, and does not send it to any AI provider.
        </Typography>
        <Typography variant="caption" color="text.secondary">
          The full notice is in the Meticle Care app, and it is the wording your answer is recorded
          against{answered && data.notice_version ? ` (version ${data.notice_version})` : ''}. If it
          changes, the app shows you the new version before you answer again.
        </Typography>
      </Stack>

      {orgOff && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Your organisation has switched location recording off, so nothing is being recorded at
          the moment whatever you choose. Your answer matters if they switch it back on.
        </Alert>
      )}

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Typography variant="body2" fontWeight={700}>Your answer:</Typography>
        {!answered && <Chip label="Not answered yet" size="small" sx={{ bgcolor: 'notice.warning.bg', color: 'notice.warning.fg' }} />}
        {data.decision === 'agreed' && <Chip label="Agreed" size="small" sx={{ bgcolor: 'notice.success.bg', color: 'notice.success.fg' }} />}
        {data.decision === 'declined' && <Chip label="Declined" size="small" sx={{ bgcolor: 'notice.muted.bg', color: 'text.secondary' }} />}
        {data.decided_at && (
          <Typography variant="caption" color="text.secondary">
            {new Date(data.decided_at).toLocaleDateString('en-GB')}
          </Typography>
        )}
      </Stack>

      {data.collects_location === false && !orgOff && !answered && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Until you answer, your position is not being recorded. Nothing is sent when you check in
          or out.
        </Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Button
          variant={data.decision === 'agreed' ? 'contained' : 'outlined'}
          onClick={() => save.mutate('agreed')}
          disabled={busy !== null || data.decision === 'agreed'}
        >
          {busy === 'agreed' ? 'Saving...' : 'Yes, record my location'}
        </Button>
        <Button
          variant={data.decision === 'declined' ? 'contained' : 'outlined'}
          color="error"
          onClick={() => save.mutate('declined')}
          disabled={busy !== null || data.decision === 'declined'}
        >
          {busy === 'declined' ? 'Saving...' : "No, don't record my location"}
        </Button>
      </Stack>

      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          You can change this at any time, in either direction, without giving a reason. Saying no
          does not affect your visits, care notes, timesheets or pay — you can still check in, do
          the call and check out normally. What is lost is the check that you were at the person's
          address, because the app would not be reading your position to do it. Your employer can
          see that you declined and when, because they have to be able to evidence who agreed.
        </Typography>
      </Box>
    </Paper>
  )
}
