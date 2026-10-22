import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { MICA_RECORD_PARAMS } from '@meticle/shared'
import AppButton from '../../components/design/AppButton'
import EmptyState from '../../components/design/EmptyState'
import api from '../../services/api'

const PAGE_SIZE = 10

const ratingLabel = (value: unknown) => value == null || value === '' ? '—' : `${Number(value)}/5`
const dateLabel = (value: string) => value ? new Date(value).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

/**
 * What families say after a visit, in the one place a manager can read it back.
 *
 * A submitted rating currently arrives as a notification and an email, and then
 * has nowhere to live: the list endpoint existed with no screen behind it, so a
 * second low score for the same carer was two separate emails and no pattern.
 * This board is that screen — averages up top, every submission below, and the
 * full reading one click away.
 */
export default function FamilyFeedbackBoard() {
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<any | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  // The one submission a notification or an email can name: `?feedback=<id>`, the
  // row it is about. Held in the same read-only dialog a card click opens, so
  // there is one way to read a submission rather than two.
  const linkedFeedbackId = searchParams.get(MICA_RECORD_PARAMS['family-feedback'])
  const openedLinkedFeedbackRef = useRef<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['family-feedback', page],
    queryFn: () => api.get('/family-feedback', { params: { limit: PAGE_SIZE, offset: page * PAGE_SIZE } }).then(r => r.data),
  })

  const stats = data?.stats || {}
  const rows: any[] = Array.isArray(data?.feedback) ? data.feedback : []

  // Opens the submission a link names, once the page that holds it has loaded. A
  // fresh submission is the newest row, so it is on the first page the board
  // reads; a link to anything older resolves against nothing and opens nothing
  // rather than a dialog full of blanks. Guarded by the id, so a refetch cannot
  // re-open a dialog the manager has closed. This sits above the loading return
  // on purpose: an effect behind an early return changes the hook count between
  // the loading render and the loaded one.
  useEffect(() => {
    if (!linkedFeedbackId || openedLinkedFeedbackRef.current === linkedFeedbackId || isLoading) return
    openedLinkedFeedbackRef.current = linkedFeedbackId
    const row = rows.find((r: any) => r.id === linkedFeedbackId)
    if (row) setSelected(row)
  }, [linkedFeedbackId, rows, isLoading])

  // Closing the reading also drops its link, so a reload cannot put the manager
  // back into a dialog they just closed. Only `feedback` is dropped: any other
  // parameter belongs to whatever sent them here.
  const closeSelected = () => {
    setSelected(null)
    if (!linkedFeedbackId) return
    const next = new URLSearchParams(searchParams)
    next.delete(MICA_RECORD_PARAMS['family-feedback'])
    setSearchParams(next, { replace: true })
  }

  if (isLoading) return <Box className="homecare-loading"><CircularProgress /><Typography color="text.secondary">Loading family feedback…</Typography></Box>
  if (isError) return <Alert severity="error">Could not load family feedback. Please try again.</Alert>

  const total = Number(stats.total_feedback || 0)
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageSafe = Math.min(page, pages - 1)

  return <>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
      <Paper variant="outlined" sx={{ p: 2, flex: 1 }}><Typography variant="caption" color="text.secondary">Submissions</Typography><Typography variant="h5">{total}</Typography></Paper>
      <Paper variant="outlined" sx={{ p: 2, flex: 1 }}><Typography variant="caption" color="text.secondary">Average overall</Typography><Typography variant="h5">{stats.avg_overall != null ? `${Number(stats.avg_overall)}/5` : '—'}</Typography></Paper>
      <Paper variant="outlined" sx={{ p: 2, flex: 1 }}><Typography variant="caption" color="text.secondary">Would recommend</Typography><Typography variant="h5">{stats.would_recommend_count ?? 0} of {total}</Typography></Paper>
    </Stack>

    {!rows.length
      ? <EmptyState title="No family feedback yet" description="When a family member rates a completed visit, their scores and comments will appear here for manager follow-up." />
      : <Stack spacing={1.5}>
        {rows.map((row: any) => (
          <Paper
            key={row.id}
            variant="outlined"
            onClick={() => setSelected(row)}
            sx={{ p: 2, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, cursor: 'pointer', '&:hover': { boxShadow: 2 } }}
          >
            <Box sx={{ flex: 1, minWidth: 220 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.person_first_name} {row.person_last_name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {row.visit_label || 'Care visit'} · {dateLabel(row.submitted_at)} · {row.family_member_name}{row.relationship ? ` (${row.relationship})` : ''} · Carer: {row.carer_name || '—'}
              </Typography>
              {row.feedback_text && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{row.feedback_text.length > 140 ? `${row.feedback_text.slice(0, 140)}…` : row.feedback_text}</Typography>}
            </Box>
            <Chip label={`Overall ${ratingLabel(row.overall_rating)}`} size="small" color={Number(row.overall_rating) >= 4 ? 'success' : Number(row.overall_rating) <= 2 ? 'error' : 'default'} />
          </Paper>
        ))}
      </Stack>}

    {pages > 1 && <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
      <Typography variant="caption" color="text.secondary">Showing {pageSafe * PAGE_SIZE + 1}–{Math.min((pageSafe + 1) * PAGE_SIZE, total)} of {total}</Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <AppButton variant="quiet" size="small" disabled={pageSafe === 0} onClick={() => setPage(pageSafe - 1)}>Previous</AppButton>
        <Typography variant="body2">Page {pageSafe + 1} of {pages}</Typography>
        <AppButton variant="quiet" size="small" disabled={pageSafe >= pages - 1} onClick={() => setPage(pageSafe + 1)}>Next</AppButton>
      </Stack>
    </Stack>}

    <Dialog open={Boolean(selected)} onClose={closeSelected} fullWidth maxWidth="sm">
      <DialogTitle>Family feedback · {selected ? `${selected.person_first_name} ${selected.person_last_name}` : ''}</DialogTitle>
      <DialogContent>
        {selected && <Stack spacing={1.5} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {selected.visit_label || 'Care visit'} · {dateLabel(selected.scheduled_start)} · Carer: {selected.carer_name || '—'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            From {selected.family_member_name}{selected.relationship ? ` (${selected.relationship})` : ''} · {dateLabel(selected.submitted_at)}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip label={`Overall ${ratingLabel(selected.overall_rating)}`} size="small" />
            <Chip label={`Care quality ${ratingLabel(selected.care_quality_rating)}`} size="small" variant="outlined" />
            <Chip label={`Communication ${ratingLabel(selected.communication_rating)}`} size="small" variant="outlined" />
            <Chip label={`Punctuality ${ratingLabel(selected.punctuality_rating)}`} size="small" variant="outlined" />
            {selected.would_recommend !== null && selected.would_recommend !== undefined && (
              <Chip label={selected.would_recommend ? 'Would recommend' : 'Would not recommend'} size="small" color={selected.would_recommend ? 'success' : 'error'} />
            )}
          </Stack>
          {selected.feedback_text
            ? <Typography variant="body1" sx={{ lineHeight: 1.6 }}>“{selected.feedback_text}”</Typography>
            : <Typography variant="body2" color="text.secondary">No written comment — ratings only.</Typography>}
        </Stack>}
      </DialogContent>
      <DialogActions><AppButton variant="quiet" onClick={closeSelected}>Close</AppButton></DialogActions>
    </Dialog>
  </>
}
