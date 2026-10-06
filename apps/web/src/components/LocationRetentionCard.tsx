import { useState } from 'react'
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useSnackbar } from '../context/SnackbarContext'

type Summary = {
  retention_days: number | null
  configured_at: string | null
  configured_by_name: string | null
  is_configured: boolean
  positions_stored: number
  oldest_position_at: string | null
  next_deletion_due_at: string | null
  tracking_enabled: boolean
  unconfigured_warning: string | null
}

type Run = {
  id: string
  trigger: 'scheduled' | 'manual' | 'switch_off' | 'policy_set'
  retention_days: number | null
  cutoff: string
  visit_rows_updated: number
  positions_removed: number
  audit_rows_cleaned: number
  mobile_check_ins_deleted: number
  triggered_by_name: string | null
  started_at: string
}

const TRIGGER_LABEL: Record<Run['trigger'], string> = {
  scheduled: 'Nightly job',
  manual: 'Run by a manager',
  switch_off: 'When collection was switched off',
  policy_set: 'When the period was changed',
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB') : '—')

/**
 * How long this organisation keeps carer location, and the evidence that it does.
 *
 * The reason this card exists in the shape it does: retention that is "not set"
 * is indistinguishable from retention that is "set to a very long time" unless
 * something says so in words. A provider whose DPO escalated this to them, and
 * who has never opened the setting, is accumulating positions indefinitely and
 * has no way of seeing that from a settings page that renders an empty field.
 *
 * So the unconfigured state is not an empty input. It is a warning, in the
 * provider's own numbers — how many positions are held, how old the oldest is —
 * taken verbatim from the server rather than assembled here, so there is one
 * sentence that has to be true and it lives in one place.
 *
 * Two rules the interactions follow:
 *
 *   - Setting a period never deletes anything. A provider who has just typed 1
 *     instead of 365 has made a mistake, and the cure for that is a second
 *     click they can see coming, not an empty visit history.
 *   - Deleting says what it will remove first, and the count comes from the
 *     server rather than from anything this component worked out.
 */
export default function LocationRetentionCard() {
  const { showSnackbar } = useSnackbar()
  const queryClient = useQueryClient()
  const [days, setDays] = useState('')
  const [confirm, setConfirm] = useState<'period' | 'all' | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['locationRetention'],
    queryFn: async () => (await api.get('/homecare/settings/location-retention')).data as Summary,
  })

  const { data: runsData } = useQuery({
    queryKey: ['locationRetentionRuns'],
    queryFn: async () => (await api.get('/homecare/settings/location-retention/runs')).data as { runs: Run[] },
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['locationRetention'] })
    queryClient.invalidateQueries({ queryKey: ['locationRetentionRuns'] })
  }

  const save = useMutation({
    mutationFn: async () => {
      const parsed = Number(days)
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3650) {
        throw new Error('Enter a whole number of days between 1 and 3650.')
      }
      return (await api.put('/homecare/settings/location-retention', { retention_days: parsed })).data
    },
    onSuccess: () => {
      setDays('')
      refresh()
      showSnackbar('Retention period saved. Nothing has been deleted — the nightly job will enforce it from now on.', 'success')
    },
    onError: (e: any) => showSnackbar(e?.response?.data?.message || e?.message || 'Could not save the period.', 'error'),
  })

  const clear = useMutation({
    mutationFn: () => api.delete('/homecare/settings/location-retention'),
    onSuccess: () => {
      refresh()
      showSnackbar('Retention period removed. Nothing was deleted, and the nightly job has stopped.', 'info')
    },
    onError: (e: any) => showSnackbar(e?.response?.data?.message || 'Could not remove the period.', 'error'),
  })

  const runNow = useMutation({
    mutationFn: async (all: boolean) => (await api.post('/homecare/settings/location-retention/run', { all })).data,
    onSuccess: (res: any) => {
      setConfirm(null)
      refresh()
      const left = res?.remaining?.positions_stored ?? 0
      showSnackbar(
        res?.run?.positions_removed
          ? `Deleted ${res.run.positions_removed} positions. ${left} still held.`
          : 'Nothing was old enough to delete. The rule is holding.',
        'success',
      )
    },
    onError: (e: any) => {
      setConfirm(null)
      showSnackbar(e?.response?.data?.message || 'The deletion did not run.', 'error')
    },
  })

  if (isLoading) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          <DeleteSweepIcon sx={{ mr: 1, verticalAlign: 'middle' }} />How long you keep carer location
        </Typography>
        <CircularProgress size={20} />
      </Paper>
    )
  }

  if (isError || !data) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          <DeleteSweepIcon sx={{ mr: 1, verticalAlign: 'middle' }} />How long you keep carer location
        </Typography>
        <Alert severity="warning">
          This could not be loaded, so the retention period in force is unknown. Nothing on this
          screen should be read as a policy.
        </Alert>
      </Paper>
    )
  }

  return (
    <Paper sx={{ p: 4 }} data-testid="location-retention-card">
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        <DeleteSweepIcon sx={{ mr: 1, verticalAlign: 'middle' }} />How long you keep carer location
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        A reading of a carer's position, taken once when they check in or out of a call. Set how
        long to keep it, and the deletion happens on its own — you do not have to remember to run it.
      </Typography>

      {data.unconfigured_warning && (
        <Alert severity="warning" sx={{ mb: 3 }} data-testid="retention-unconfigured">
          {data.unconfigured_warning}
        </Alert>
      )}

      <Stack direction="row" spacing={1} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        <Chip
          label={data.is_configured ? `${data.retention_days} days` : 'No period set'}
          size="small"
          sx={{
            bgcolor: data.is_configured ? 'notice.success.bg' : 'notice.warning.bg',
            color: data.is_configured ? 'notice.success.fg' : 'notice.warning.fg',
            fontWeight: 600,
          }}
        />
        <Chip label={`${data.positions_stored.toLocaleString('en-GB')} positions held`} size="small"
          sx={{ bgcolor: 'notice.muted.bg', color: 'text.secondary', fontWeight: 600 }} />
        <Chip label={`Oldest ${date(data.oldest_position_at)}`} size="small"
          sx={{ bgcolor: 'notice.muted.bg', color: 'text.secondary', fontWeight: 600 }} />
        {!data.tracking_enabled && (
          <Chip label="Collection is off" size="small" sx={{ bgcolor: 'notice.muted.bg', color: 'text.secondary' }} />
        )}
      </Stack>

      {data.is_configured && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Set by {data.configured_by_name || 'an administrator'} on {date(data.configured_at)}.
          {data.next_deletion_due_at
            ? ` Positions older than ${data.retention_days} days are removed; the next is due from ${date(data.next_deletion_due_at)}.`
            : ' Nothing is old enough to delete yet.'}
        </Typography>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
        <TextField
          label="Keep for (days)"
          type="number"
          size="small"
          value={days}
          onChange={e => setDays(e.target.value)}
          inputProps={{ min: 1, max: 3650, 'data-testid': 'retention-days-input' }}
          helperText="Up to 3650. Setting this does not delete anything."
          sx={{ maxWidth: 220 }}
        />
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || days === ''}
            sx={{ textTransform: 'none' }}>
            {save.isPending ? 'Saving...' : data.is_configured ? 'Change period' : 'Set period'}
          </Button>
          {data.is_configured && (
            <Button onClick={() => clear.mutate()} disabled={clear.isPending} sx={{ textTransform: 'none' }}>
              Remove period
            </Button>
          )}
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        <Button variant="outlined" color="error" sx={{ textTransform: 'none' }}
          onClick={() => setConfirm('period')} disabled={!data.is_configured || runNow.isPending}>
          Run the deletion now
        </Button>
        <Button variant="outlined" color="error" sx={{ textTransform: 'none' }}
          onClick={() => setConfirm('all')} disabled={runNow.isPending}>
          Delete all carer location
        </Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 3 }}>
        Deleting a position does not delete the visit, the timesheet or the pay — those are built
        from the two timestamps and what the carer entered. What is lost is the ability to check
        afterwards that they were at the person's address, for visits that old.
      </Alert>

      {runsData?.runs && runsData.runs.length > 0 && (
        <>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Deletions</Typography>
          <Table size="small" sx={{ mb: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>What caused it</TableCell>
                <TableCell>Period</TableCell>
                <TableCell align="right">Positions removed</TableCell>
                <TableCell align="right">Visit rows</TableCell>
                <TableCell align="right">Audit copies cleaned</TableCell>
                <TableCell align="right">Check-ins deleted</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {runsData.runs.map(r => (
                <TableRow key={r.id} data-testid={`retention-run-${r.id}`}>
                  <TableCell>{new Date(r.started_at).toLocaleString('en-GB')}</TableCell>
                  <TableCell>{TRIGGER_LABEL[r.trigger]}{r.triggered_by_name ? ` · ${r.triggered_by_name}` : ''}</TableCell>
                  <TableCell>{r.retention_days == null ? 'Everything' : `${r.retention_days} days`}</TableCell>
                  <TableCell align="right">{r.positions_removed.toLocaleString('en-GB')}</TableCell>
                  <TableCell align="right">{r.visit_rows_updated.toLocaleString('en-GB')}</TableCell>
                  <TableCell align="right">{r.audit_rows_cleaned.toLocaleString('en-GB')}</TableCell>
                  <TableCell align="right">{r.mobile_check_ins_deleted.toLocaleString('en-GB')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography variant="caption" color="text.secondary">
            Runs that removed nothing are listed too. A nightly run that finds zero is the evidence
            that the period is being held to, and leaving those out would make the total here
            impossible to reconcile against how many positions there were.
          </Typography>
        </>
      )}

      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          Meticle Care does not set this for you. The period is yours — and your DPO's — to decide,
          and until it is set nothing is deleted automatically. That is why the state above says so
          in words rather than leaving an empty field to be read as a long default.
        </Typography>
      </Box>

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: '#EF4444' }}>
          {confirm === 'all' ? 'Delete all carer location?' : 'Run the deletion now?'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {confirm === 'all'
              ? `This removes every carer position held for this organisation — currently ${data.positions_stored.toLocaleString('en-GB')}, the oldest from ${date(data.oldest_position_at)}. It reaches the visit record, the copy in the audit log, and SecureVisit check-ins.`
              : `This removes the ${data.positions_stored.toLocaleString('en-GB')} positions held that are older than ${data.retention_days} days. Newer ones stay until they reach that age.`}
          </Typography>
          <Typography variant="body2">
            Visits, timesheets and pay are not affected. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => runNow.mutate(confirm === 'all')}
            sx={{ textTransform: 'none' }} data-testid="retention-confirm-delete">
            {runNow.isPending ? 'Deleting...' : confirm === 'all' ? 'Delete all' : 'Delete now'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}
