import {
  Alert, Chip, LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'

type Worker = {
  user_id: string
  name: string
  decision: 'agreed' | 'declined' | null
  notice_version: string | null
  decided_at: string | null
}

type Summary = {
  total: number
  agreed: number
  declined: number
  not_answered: number
  workers: Worker[]
}

/**
 * The provider's evidence that each carer was told what is collected, and what
 * they decided.
 *
 * The framing on this page is the whole point of it, and it is deliberately not
 * "consent". A carer who agreed here has recorded that they were told and that
 * they agreed; that is a record of a conversation and an answer. It is not a
 * lawful basis for the employer's monitoring of its staff, because Meticle Care
 * is a processor and cannot manufacture one. A provider reading this panel
 * should come away able to say "here is who we told, here is what they said",
 * and should not read it as "and therefore this is lawful". Saying otherwise
 * would put words in a carer's mouth on the one screen a regulator is most
 * likely to be shown.
 *
 * The denominator is every active worker, not the workers who have answered.
 * That is what stops the panel reading as a flattering score: an organisation
 * that has answered for four of forty workers is 10% agreed, not 100%.
 */
export default function LocationDecisionEvidence() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['locationDecisions'],
    queryFn: async () => (await api.get('/homecare/location-decisions')).data as Summary,
  })

  if (isLoading) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          <FactCheckIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Who has agreed to location recording
        </Typography>
        <Typography variant="body2" color="text.secondary">Loading…</Typography>
      </Paper>
    )
  }

  if (isError || !data) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          <FactCheckIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Who has agreed to location recording
        </Typography>
        <Alert severity="warning">
          This could not be loaded. It is a record of what workers were told and answered, so it
          should not be presented as anything else.
        </Alert>
      </Paper>
    )
  }

  const pct = (n: number) => (data.total > 0 ? Math.round((n / data.total) * 100) : 0)

  return (
    <Paper sx={{ p: 4 }} data-testid="location-decision-evidence">
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        <FactCheckIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Who has agreed to location recording
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        What each carer has been told about location, and what they decided. Every active worker is
        counted, including those who have not answered, so this cannot be read as a score you can
        improve by asking fewer people.
      </Typography>

      {data.total === 0 ? (
        <Typography variant="body2">No active workers to ask.</Typography>
      ) : (
        <>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
            <Chip label={`${data.agreed} of ${data.total} agreed`} size="small"
              sx={{ bgcolor: 'notice.success.bg', color: 'notice.success.fg', fontWeight: 600 }} />
            <Chip label={`${data.declined} declined`} size="small"
              sx={{ bgcolor: 'notice.muted.bg', color: 'text.secondary', fontWeight: 600 }} />
            <Chip label={`${data.not_answered} not answered`} size="small"
              sx={{ bgcolor: data.not_answered > 0 ? 'notice.warning.bg' : 'notice.muted.bg', color: data.not_answered > 0 ? 'notice.warning.fg' : 'text.secondary', fontWeight: 600 }} />
          </Stack>
          <LinearProgress
            variant="determinate"
            value={pct(data.agreed)}
            color="success"
            sx={{ height: 8, borderRadius: 4, mb: 1 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            {pct(data.agreed)}% of active workers have agreed. Position data is only collected from
            the {data.agreed} who agreed, and from nobody else.
          </Typography>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Worker</TableCell>
                <TableCell>Answer</TableCell>
                <TableCell>When</TableCell>
                <TableCell>Notice version</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.workers.map(w => (
                <TableRow key={w.user_id} data-testid={`location-decision-${w.user_id}`}>
                  <TableCell>{w.name}</TableCell>
                  <TableCell>
                    {w.decision === 'agreed' && <Chip label="Agreed" size="small" sx={{ bgcolor: 'notice.success.bg', color: 'notice.success.fg' }} />}
                    {w.decision === 'declined' && <Chip label="Declined" size="small" sx={{ bgcolor: 'notice.muted.bg', color: 'text.secondary' }} />}
                    {!w.decision && <Chip label="Not answered" size="small" sx={{ bgcolor: 'notice.warning.bg', color: 'notice.warning.fg' }} />}
                  </TableCell>
                  <TableCell>
                    {w.decided_at ? new Date(w.decided_at).toLocaleDateString('en-GB') : '—'}
                  </TableCell>
                  <TableCell>{w.notice_version || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      <Alert severity="info" sx={{ mt: 3 }}>
        This is a record of what each carer was told and what they answered. It is not a lawful
        basis for monitoring staff, and it does not become one: where an employer relies on
        legitimate interests, that is their assessment to document, and the record of a carer's
        answer is one input to it rather than the whole of it. Declining costs a carer the
        address check and nothing else.
      </Alert>
    </Paper>
  )
}
