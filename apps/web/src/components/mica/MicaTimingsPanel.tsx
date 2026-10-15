import { useEffect, useReducer } from 'react'
import { Box, Typography } from '@mui/material'
import { MICA_Z } from './mica.identity'
import {
  MICA_TIMING_LABEL,
  MICA_TIMING_STAGES,
  formatTimingMs,
  micaTimingRows,
  micaTimingSpans,
  type MicaTimingsRecorder,
  type MicaTimingStage,
} from './mica.timings'

/**
 * The on-device timing readout.
 *
 * ## Why a panel and not just a console handle
 *
 * The number that matters is the one from a real phone on a real network, and the
 * fastest way to be misled is to measure on a desktop dev build — a warm cache, a
 * fast CPU, and a microphone that was granted months ago. So the timings have to
 * be readable **on the device being tested**, which in practice means "visible on
 * the screen" rather than "attach remote debugging and hope the session is still
 * there when you get connected".
 *
 * `window.__micaTimings` is the other half of the same idea and is always
 * available; this panel is for when you cannot open a console.
 *
 * ## Off unless asked for
 *
 * It is a diagnostic overlay, so it is not part of Mica and never appears in a
 * normal session: it mounts only when the flag is set — `?micaTimings=1` in the URL
 * (which stores the flag, because Mica navigates and a query string does not
 * survive that) or `localStorage['mica.timings'] = '1'` directly. `?micaTimings=0`
 * turns it back off, which is how you remove it from a phone without a console.
 *
 * ## It shows all eight stages, including the ones that did not happen
 *
 * A missing stage is the most informative thing this panel can tell you: no
 * `micReady` means the microphone never opened, and no `firstToken` means no reply
 * ever arrived. Rendering only the stages that fired would hide exactly the
 * failures worth reading, so every stage is drawn in pipeline order and an absent
 * one reads `—`. That dash is not a zero and must not be read as one.
 *
 * The rows it draws are the **session's**, merged onto the turn that opened it, so
 * a reply that reopens the microphone does not blank the numbers the carer's tap
 * produced — see `micaSessionTiming` for what that merge does and does not keep.
 *
 * ## Why the z-index is outside the identity ladder
 *
 * `MICA_Z` is Mica's own layering contract, asserted in `mica.identity.test.ts`,
 * and this is not a Mica surface. But it must stay legible *while* a session runs
 * — a readout hidden behind the overlay it is measuring is useless — so it is
 * derived from the top rung rather than given a fixed number, which also means it
 * cannot be left below the overlay by a later change to the ladder.
 */
const PANEL_Z = MICA_Z.notice + 1

function Line({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
      <Box component="span" sx={{ color: 'text.secondary' }}>{label}</Box>
      <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{value}</Box>
    </Box>
  )
}

export default function MicaTimingsPanel({ recorder }: { recorder: MicaTimingsRecorder }) {
  // One render per mark — eight per turn — and none while the pipeline is idle.
  // Deliberately a reducer rather than state holding the turn: the recorder is the
  // store, and copying it into React state would create two versions of the same
  // numbers that could disagree.
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  useEffect(() => recorder.subscribe(refresh), [recorder])

  // The *session*, not the latest turn. A reply reopens the microphone, so the
  // latest turn a beat after any answer is a continuation with no tap in it; the
  // numbers worth reading are the ones the carer's own tap produced, and they
  // must not disappear from the panel the moment the reply finishes. See
  // `micaSessionTiming`.
  const turn = recorder.session()
  const rows = micaTimingRows(turn)
  const gapFor = (stage: MicaTimingStage) => rows.find(row => row.stage === stage)?.gapMs ?? null
  const spans = micaTimingSpans(turn)
  const sessionTurns = turn ? recorder.turns().filter(t => t.session === turn.session).length : 0

  return (
    <Box
      role="region"
      aria-label="Mica voice pipeline timings"
      sx={{
        position: 'fixed',
        top: 8,
        left: 8,
        zIndex: PANEL_Z,
        width: 232,
        p: 1.25,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        color: 'text.primary',
        boxShadow: 3,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 11,
        lineHeight: 1.5,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, fontWeight: 700 }}>
        <span>Mica timings</span>
        <span>
          {turn
            ? `session ${turn.session} · ${sessionTurns} turn${sessionTurns === 1 ? '' : 's'}`
            : 'no turn yet'}
        </span>
      </Box>

      {!turn && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Tap the orb to record a turn. Stages appear as the pipeline reaches them.
        </Typography>
      )}

      {turn && (
        <>
          <Box sx={{ color: 'text.secondary', mb: 0.5 }}>
            opened by {MICA_TIMING_LABEL[turn.openedBy]}
          </Box>

          {MICA_TIMING_STAGES.map(stage => {
            const at = turn.offsets[stage]
            const gap = gapFor(stage)
            return (
              <Box key={stage} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                {/* An absent stage is drawn, not skipped: it is the finding. */}
                <Box
                  component="span"
                  sx={{ color: at === undefined ? 'text.disabled' : 'text.primary' }}
                >
                  {MICA_TIMING_LABEL[stage]}
                </Box>
                <Box component="span" sx={{ display: 'flex', gap: 1 }}>
                  <Box component="span" sx={{ minWidth: 46, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {formatTimingMs(at)}
                  </Box>
                  <Box
                    component="span"
                    sx={{ minWidth: 52, textAlign: 'right', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {gap === null ? '' : `+${formatTimingMs(gap)}`}
                  </Box>
                </Box>
              </Box>
            )
          })}

          <Box sx={{ mt: 0.75, pt: 0.75, borderTop: '1px solid', borderColor: 'divider' }}>
            <Line label="Tap → first token" value={formatTimingMs(spans.tapToFirstToken)} />
            <Line label="Tap → done" value={formatTimingMs(spans.tapToDone)} />
            <Line label="Tap → idle" value={formatTimingMs(spans.tapToIdle)} />
            <Line label="Speech done → reply" value={formatTimingMs(spans.speechDoneToReplyStarted)} />
            <Line label="Reply → first token" value={formatTimingMs(spans.replyStartedToFirstToken)} />
          </Box>
        </>
      )}

      <Box sx={{ mt: 0.75, color: 'text.disabled' }}>
        {recorder.turns().length} turn(s) held · ?micaTimings=0 to hide
      </Box>
    </Box>
  )
}
