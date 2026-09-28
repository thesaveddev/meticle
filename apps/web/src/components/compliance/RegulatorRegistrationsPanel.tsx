/**
 * Registration numbers, by regulator.
 *
 * This exists because there was nowhere to record them. A provider is registered
 * with a body — CQC in England, CIW in Wales, the Care Inspectorate in Scotland,
 * RQIA in Northern Ireland — and that number is the first thing an inspector
 * asks for and the last thing the product could hold.
 *
 * Two distinctions the panel is careful about:
 *
 *   - Every regulator is listed, recorded or not. An empty list is ambiguous —
 *     "not registered anywhere" and "never entered it" look identical — and a
 *     compliance officer should be able to see which one they are looking at.
 *   - The label comes from the regulator, not from us. It is "CIW registration
 *     number" in Wales, and telling a Welsh provider to enter their "Social Care
 *     Wales" number would be pointing at the wrong register: Social Care Wales
 *     registers people, CIW registers services.
 *
 * `verified` is the user asserting they have checked the number against that
 * regulator's public register. Nothing here verifies anything — a tick is a
 * claim by a human, recorded so an inspection can ask who made it and when.
 */
import { useState } from 'react'
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Link, Stack,
  Switch, FormControlLabel, TextField, Tooltip, Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import api from '../../services/api'

type Registration = {
  regulator_id: string
  regulator_name: string
  nations: string[]
  label: string
  register_url: string
  format_hint: string | null
  note: string
  registration_number: string | null
  verified_at: string | null
  recorded: boolean
}

export default function RegulatorRegistrationsPanel() {
  const queryClient = useQueryClient()
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['regulator-registrations'],
    queryFn: async () => (await api.get('/compliance/regulator-registrations')).data,
  })

  const save = useMutation({
    mutationFn: async (row: { regulator_id: string; registration_number: string; verified: boolean }) => {
      const res = await api.put('/compliance/regulator-registrations', row)
      return res.data
    },
    onSuccess: (d) => queryClient.setQueryData(['regulator-registrations'], d),
  })

  const remove = useMutation({
    mutationFn: async (regulator_id: string) => {
      const res = await api.delete('/compliance/regulator-registrations', { data: { regulator_id } })
      return res.data
    },
    onSuccess: (d) => queryClient.setQueryData(['regulator-registrations'], d),
  })

  if (isLoading) return <CircularProgress size={24} />
  if (data?.migration_pending) {
    // A missing row here would otherwise look like "you are not registered
    // anywhere", which is a materially different statement.
    return (
      <Alert severity="warning">
        Registration records are not available yet — the database migration for
        them has not run on this environment.
      </Alert>
    )
  }

  const rows: Registration[] = data?.registrations ?? []

  return (
    <Card>
      <CardContent>
        <Stack spacing={1} sx={{ mb: 2 }}>
          <Typography variant="h6">Regulator registrations</Typography>
          <Typography variant="body2" color="text.secondary">
            Your registration number with each service regulator. A national
            provider is genuinely registered with more than one, so each body is
            listed separately.
          </Typography>
        </Stack>

        <Stack spacing={2}>
          {rows.map((row) => {
            const draft = drafts[row.regulator_id] ?? row.registration_number ?? ''
            const dirty = draft !== (row.registration_number ?? '')
            return (
              <Box
                key={row.regulator_id}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}
              >
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  alignItems={{ md: 'center' }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography fontWeight={700}>{row.regulator_name}</Typography>
                      {row.recorded ? (
                        <Chip
                          size="small"
                          label={row.verified_at ? 'Verified' : 'Recorded'}
                          color={row.verified_at ? 'success' : 'default'}
                          variant="outlined"
                        />
                      ) : (
                        <Chip size="small" label="Not recorded" variant="outlined" />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {row.label}
                    </Typography>
                    {row.format_hint && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {row.format_hint}
                      </Typography>
                    )}
                    <Link
                      href={row.register_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="caption"
                      display="inline-flex"
                      alignItems="center"
                      gap={0.5}
                      sx={{ mt: 0.5 }}
                    >
                      Check this number on their public register
                      <OpenInNewIcon sx={{ fontSize: 12 }} />
                    </Link>
                  </Box>

                  <Box sx={{ flex: 1.4 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label={row.label}
                      value={draft}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [row.regulator_id]: e.target.value }))
                      }
                      // Deliberately not pattern-validated. CIW numbers have had
                      // several published formats and can contain a slash; a
                      // regex that rejects a real number is worse than one that
                      // accepts a typo, because a typo is visible to a human.
                      placeholder={row.format_hint ? 'e.g. CYM00002456' : 'Not recorded'}
                    />
                  </Box>

                  <Stack spacing={1} sx={{ minWidth: 180 }}>
                    <Tooltip title="Tick only if you have checked this number against the regulator's public register. We do not verify registrations for you.">
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={!!row.verified_at}
                            disabled={!dirty && !!row.verified_at}
                            onChange={(e) => {
                              // Save immediately so the tick and the number it
                              // refers to cannot disagree.
                              if (dirty) return
                              save.mutate({
                                regulator_id: row.regulator_id,
                                registration_number: row.registration_number ?? '',
                                verified: e.target.checked,
                              })
                            }}
                          />
                        }
                        label={<Typography variant="body2">Checked on the register</Typography>}
                      />
                    </Tooltip>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={!dirty || !draft.trim() || save.isPending}
                        onClick={() =>
                          save.mutate({
                            regulator_id: row.regulator_id,
                            registration_number: draft,
                            verified: !!row.verified_at,
                          })
                        }
                      >
                        Save
                      </Button>
                      {row.recorded && (
                        <Button
                          size="small"
                          color="error"
                          disabled={remove.isPending}
                          onClick={() => {
                            setDrafts((d) => {
                              const next = { ...d }
                              delete next[row.regulator_id]
                              return next
                            })
                            remove.mutate(row.regulator_id)
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                </Stack>

                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  {row.note}
                  {row.verified_at && (
                    <> Last checked {new Date(row.verified_at).toLocaleString()}.</>
                  )}
                </Typography>
              </Box>
            )
          })}
        </Stack>
      </CardContent>
    </Card>
  )
}
