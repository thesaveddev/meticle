/**
 * One Update Service subscription, read-only.
 *
 * This is the record itself — the consent that makes a check lawful, the two
 * things DBS requires before one (the paper certificate seen, identity verified),
 * the certificate the subscription covers, and every status check recorded
 * against it. It renders the same facts on the compliance page, where the
 * subscription is administered, and on a staff member's own compliance tab, where
 * it sits beside their other evidence; the two are one component so a fact cannot
 * appear on one screen and be missing on the other.
 *
 * Nothing here changes anything. A status check, a renewal and a withdrawal of
 * consent are all acts on the compliance page, and deliberately not at the end of
 * a record a manager may have opened by following a link.
 *
 * `BadgeTone` is derived from `StatusBadge` rather than restated, so a tone this
 * record asks for that the badge does not have is a type error here.
 */
import type { ComponentProps } from 'react'
import {
  Alert, Box, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  Typography, useTheme,
} from '@mui/material'
import { formatDateOnly } from '../utils/dateFormat'
import {
  capitalise,
  duePhrase,
  labelFor,
  UPDATE_SERVICE_IDENTITY_METHODS,
  UPDATE_SERVICE_OUTCOMES,
} from '../utils/updateService'
import { StatusBadge } from './ui'

type BadgeTone = NonNullable<ComponentProps<typeof StatusBadge>['tone']>

/** How urgent a subscription is, in the badge tones this product already uses. */
export const UPDATE_SERVICE_DUE_TONES: Record<string, BadgeTone> = {
  current: 'success',
  due_soon: 'warning',
  overdue: 'error',
  not_active: 'neutral',
}

export const UPDATE_SERVICE_STATUS_TONES: Record<string, BadgeTone> = {
  active: 'success',
  withdrawn: 'neutral',
  lapsed: 'warning',
}

/** A read-only label/value line, used throughout the record. */
function DetailLine({ label, value }: { label: string; value: React.ReactNode }) {
  const theme = useTheme()
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ py: 0.5 }}>
      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>{value}</Typography>
    </Stack>
  )
}

/** The badge for a subscription's urgency. Exported so a list can use the same one. */
export function UpdateServiceDueBadge({ subscription }: { subscription: any }) {
  const withdrawnOrInactive = subscription.status !== 'active'
  return (
    <StatusBadge
      // A withdrawn subscription has no due date to be late for, so it reads as
      // not active rather than overdue — a consent decision is not a failure.
      label={withdrawnOrInactive
        ? (subscription.due_state === 'not_active' ? 'Not active' : capitalise(subscription.status))
        : duePhrase(subscription.days_until_check)}
      tone={UPDATE_SERVICE_DUE_TONES[subscription.due_state] || 'neutral'}
    />
  )
}

export function UpdateServiceRecordBody({ subscription }: { subscription: any }) {
  const theme = useTheme()
  const tableHeaderSx = {
    fontWeight: 700,
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: theme.palette.text.secondary,
    borderBottom: `1px solid ${theme.palette.divider}`,
  }
  const tableCellSx = { borderBottom: `1px solid ${theme.palette.divider}` }
  const blockSx = { p: 2, borderRadius: 2, bgcolor: 'action.hover' }

  const withdrawn = Boolean(subscription.consent_withdrawn_on)
  const inactive = subscription.status !== 'active'

  return (
    <Stack spacing={2}>
      {withdrawn ? (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          {`Consent was withdrawn on ${formatDateOnly(subscription.consent_withdrawn_on)}${subscription.consent_withdrawn_reason ? ` — ${subscription.consent_withdrawn_reason}` : ''}. No further status checks can be recorded.`}
        </Alert>
      ) : inactive ? (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          {`This subscription is ${capitalise(subscription.status).toLowerCase()}. No further status checks can be recorded.`}
        </Alert>
      ) : (
        <Alert severity={subscription.due_state === 'overdue' ? 'error' : 'info'} sx={{ borderRadius: 2 }}>
          {`Next status check ${duePhrase(subscription.days_until_check)} (${formatDateOnly(subscription.next_check_due_on)}). ${subscription.checks_recorded} check${subscription.checks_recorded === 1 ? '' : 's'} recorded.`}
        </Alert>
      )}

      {/* A status check that came back `changed` raises a renewal, and a renewal is
          work rather than a number in a column — so it is stated above the record
          and not only inside it. */}
      {subscription.renewal_due_on && (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {`The certificate this subscription covers was changed: a new certificate is needed by ${formatDateOnly(subscription.renewal_due_on)}.`}
        </Alert>
      )}

      <Box sx={blockSx}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Consent</Typography>
        <DetailLine label="Given on" value={formatDateOnly(subscription.consent_given_on)} />
        <DetailLine label="Recorded as" value={capitalise(subscription.consent_method)} />
        <DetailLine label="Consent recorded by" value={subscription.consent_recorded_by_name || '—'} />
        {subscription.consent_withdrawn_on && <DetailLine label="Withdrawn on" value={formatDateOnly(subscription.consent_withdrawn_on)} />}
        {subscription.consent_withdrawn_reason && <DetailLine label="Reason" value={subscription.consent_withdrawn_reason} />}
      </Box>

      <Box sx={blockSx}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Before each check</Typography>
        <DetailLine label="Paper certificate seen" value={formatDateOnly(subscription.paper_certificate_seen_on)} />
        <DetailLine label="Identity verified" value={formatDateOnly(subscription.identity_verified_on)} />
        <DetailLine label="Identity verified by" value={labelFor(UPDATE_SERVICE_IDENTITY_METHODS, subscription.identity_method)} />
        <DetailLine label="Entitlement" value={`${capitalise(subscription.level)} · ${capitalise(subscription.workforce)}`} />
      </Box>

      <Box sx={blockSx}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Certificate on file</Typography>
        <DetailLine label="Reference" value={subscription.certificate_reference || '—'} />
        <DetailLine label="Issued" value={subscription.certificate_issued_on ? formatDateOnly(subscription.certificate_issued_on) : '—'} />
        <DetailLine label="Update Service reference" value={subscription.update_service_id} />
        <DetailLine label="Check cadence" value={`Every ${subscription.check_interval_months} months`} />
        <DetailLine label="Last checked" value={subscription.last_checked_on ? formatDateOnly(subscription.last_checked_on) : 'Never'} />
        <DetailLine label="Renewal" value={subscription.renewal_due_on
          ? `New certificate needed by ${formatDateOnly(subscription.renewal_due_on)}`
          : subscription.renewal_completed_on ? `Completed ${formatDateOnly(subscription.renewal_completed_on)}` : 'Not raised'} />
        {subscription.renewal_note && <DetailLine label="Renewal note" value={subscription.renewal_note} />}
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Status checks</Typography>
        {!subscription.checks?.length ? (
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            No status checks recorded yet.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={tableHeaderSx}>Checked</TableCell>
                <TableCell sx={tableHeaderSx}>Result</TableCell>
                <TableCell sx={tableHeaderSx}>Recorded by</TableCell>
                <TableCell sx={tableHeaderSx}>Notes</TableCell>
                <TableCell sx={tableHeaderSx}>Next due</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {subscription.checks.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell sx={tableCellSx}>{formatDateOnly(c.checked_on)}</TableCell>
                  <TableCell sx={tableCellSx}>
                    <Chip
                      size="small"
                      sx={{
                        bgcolor: theme.palette.mode === 'dark'
                          ? `${c.outcome === 'changed' ? '#EF4444' : c.outcome === 'no_change' ? '#10B981' : '#F59E0B'}25`
                          : `${c.outcome === 'changed' ? '#EF4444' : c.outcome === 'no_change' ? '#10B981' : '#F59E0B'}18`,
                        color: c.outcome === 'changed' ? '#EF4444' : c.outcome === 'no_change' ? '#10B981' : '#F59E0B',
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        height: 22,
                        borderRadius: '11px',
                      }}
                      label={labelFor(UPDATE_SERVICE_OUTCOMES, c.outcome).split(' — ')[0]}
                    />
                  </TableCell>
                  <TableCell sx={{ ...tableCellSx, color: theme.palette.text.secondary }}>{c.checked_by_name || '—'}</TableCell>
                  <TableCell sx={{ ...tableCellSx, color: theme.palette.text.secondary }}>{c.notes || '—'}</TableCell>
                  <TableCell sx={tableCellSx}>{formatDateOnly(c.next_check_due_on)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>
    </Stack>
  )
}
