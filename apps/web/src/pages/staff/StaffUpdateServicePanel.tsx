/**
 * A staff member's DBS Update Service subscription, on their compliance tab.
 *
 * The re-check record belongs with the rest of a person's compliance evidence: the
 * compliance page administers Update Service subscriptions in the organisation-wide
 * sense, but a manager asking "is this person due a re-check?" is looking at this
 * page, and until now the answer lived on another screen with every other member of
 * staff on it.
 *
 * Read-only, on purpose. Recording a status check, raising a renewal and
 * withdrawing consent are acts with consequences for somebody's DBS record, and they
 * stay in one place — the compliance page, which the dialog links to. What this
 * panel does is show the record: the entitlement, the reference, when the next check
 * is due and how urgent that is, whether the certificate has changed, and every check
 * recorded so far when the row is opened.
 *
 * It is rendered for managers and administrators only, which is the same role gate
 * the API puts on `/dbs/update-service` (`dbs.routes.ts`): an Update Service
 * subscription is somebody's DBS data, and a care worker looking at their own profile
 * does not get it from the API either.
 *
 * The query keys are the compliance page's own (`dbs-update-service`, and
 * `dbs-update-service-detail` for one subscription), namespaced by `staff` for the
 * list. That is deliberate: the compliance page's mutations invalidate the
 * `dbs-update-service` prefix, so a check recorded there refreshes this list too, and
 * one subscription cannot show two different due dates on two screens.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Paper, Stack, Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { formatDateOnly } from '../../utils/dateFormat'
import { capitalise } from '../../utils/updateService'
import { EmptyRow, LoadingState, NAVY, StatusBadge } from '../../components/ui'
import {
  UPDATE_SERVICE_STATUS_TONES,
  UpdateServiceDueBadge,
  UpdateServiceRecordBody,
} from '../../components/UpdateServiceRecord'

export function StaffUpdateServicePanel({ staffId, recordId }: { staffId: string; recordId?: string | null }) {
  const navigate = useNavigate()
  const [detailId, setDetailId] = useState('')

  const { data: subscriptions, isLoading, isError } = useQuery({
    queryKey: ['dbs-update-service', 'staff', staffId],
    queryFn: async () => {
      const res = await api.get('/dbs/update-service', { params: { staffId } })
      // Normalised to a list here rather than trusted: a payload that is not an array
      // used to throw on `.some` — inside the profile page's own render — and take the
      // whole staff record down with it, which is a page-wide crash caused by one
      // optional panel's data.
      return Array.isArray(res.data) ? (res.data as any[]) : []
    },
    enabled: !!staffId,
  })

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['dbs-update-service-detail', detailId],
    queryFn: async () => {
      const res = await api.get(`/dbs/update-service/${detailId}`)
      return res.data as any
    },
    enabled: !!detailId,
  })

  // A link that names a subscription opens it here.
  //
  // `/staff/<id>?tab=compliance&record=<subscriptionId>` is what the compliance
  // page's Update Service row — and the reminder that carries the same target —
  // hands over. The subscription is not a compliance requirement and not a
  // competency assessment, so the profile page's own record lookup does not know
  // it; without this the parameter would be silently ignored and the link would
  // look exactly like one that worked. Opened once per id: the page re-renders as
  // its queries refresh, and a re-render must not re-open a dialog the reader
  // closed.
  const openedLinkedRecordRef = useRef<string | null>(null)
  useEffect(() => {
    if (!recordId || openedLinkedRecordRef.current === recordId) return
    if (!Array.isArray(subscriptions) || !subscriptions.some((subscription: any) => subscription.id === recordId)) return
    openedLinkedRecordRef.current = recordId
    setDetailId(recordId)
  }, [recordId, subscriptions])

  return (
    <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ px: 3.5, py: 2.5, borderBottom: '1px solid #F7FAFE' }}>
        <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', color: NAVY, textTransform: 'none', mb: 0.5 }}>
          DBS Update Service
        </Typography>
        <Typography variant="body2" color="text.secondary">
          The individual&rsquo;s own subscription, checked with their consent. A check needs the paper certificate seen
          and identity verified, and it records what the Update Service said — nothing is submitted and no certificate
          is created.
        </Typography>
      </Box>

      {isLoading ? (
        <Box sx={{ p: 3.5 }}>
          <LoadingState label="Loading the Update Service record..." />
        </Box>
      ) : isError ? (
        <Box sx={{ px: 3.5, py: 2.5 }}>
          <Alert severity="error" sx={{ borderRadius: 2 }}>
            Could not load this member of staff&rsquo;s Update Service record. Reload the page, or open the compliance
            page to see it there.
          </Alert>
        </Box>
      ) : !subscriptions?.length ? (
        <Box sx={{ p: 3.5 }}>
          <EmptyRow
            message="No DBS Update Service subscription is recorded for this member of staff."
            action={<Button size="small" variant="outlined" onClick={() => navigate('/compliance')}>Record one on the compliance page</Button>}
          />
        </Box>
      ) : (
        <Box sx={{ px: 3.5, py: 1 }}>
          {subscriptions.map((s: any) => (
            <Box
              key={s.id}
              onClick={() => setDetailId(s.id)}
              sx={{
                py: 1.75,
                borderTop: '1px solid #F4F9FC',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'notice.subtle.bg' },
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                spacing={1.5}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {`${capitalise(s.level)} certificate · ${capitalise(s.workforce)} workforce`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block' }}>
                    {s.update_service_id}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {s.status === 'active' ? `Next check ${formatDateOnly(s.next_check_due_on)} · ` : ''}
                    {`Last checked ${s.last_checked_on ? formatDateOnly(s.last_checked_on) : 'never'} · `}
                    {`${s.checks_recorded} status check${s.checks_recorded === 1 ? '' : 's'} recorded`}
                  </Typography>
                </Box>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexShrink: 0, flexWrap: 'wrap', rowGap: 1 }}>
                  <UpdateServiceDueBadge subscription={s} />
                  <StatusBadge label={capitalise(s.status)} tone={UPDATE_SERVICE_STATUS_TONES[s.status] || 'neutral'} />
                  {s.renewal_due_on && (
                    <StatusBadge label={`Renewal needed by ${formatDateOnly(s.renewal_due_on)}`} tone="error" />
                  )}
                </Stack>
              </Stack>
            </Box>
          ))}
        </Box>
      )}

      {/* The subscription in full, and nothing that changes it: the record opens by
          click, and every act on it lives on the compliance page the footer names. */}
      <Dialog open={Boolean(detailId)} onClose={() => setDetailId('')} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          Update Service subscription
          {detail && (
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600 }}>
              {`${capitalise(detail.level)} certificate · ${capitalise(detail.workforce)} workforce · ${detail.update_service_id}`}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading || !detail ? (
            <LoadingState label="Loading the Update Service record..." />
          ) : (
            <UpdateServiceRecordBody subscription={detail} />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 220 }}>
            Status checks, renewal dates and consent are recorded on the compliance page.
          </Typography>
          <Button onClick={() => setDetailId('')}>Close</Button>
          <Button
            variant="contained"
            onClick={() => navigate('/compliance')}
            sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#014FB5' } }}
          >
            Open the compliance page
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}

export default StaffUpdateServicePanel
