import { useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { StaffNoticeScreen } from '../screens/StaffNoticeScreen'
import { getLocationDecision, getLocationTrackingEnabled, getStaffNotice } from '../services/api'
import { readSession } from '../services/storage'
import {
  STAFF_LOCATION_NOTICE_KEY,
  needsAcknowledgement,
  needsDecision,
} from '../content/staffLocationNotice'

/**
 * Shows the staff location notice before the app, once per worker per version.
 *
 * Three conditions, and all three have to hold before the notice appears:
 *
 *   1. The server could be asked, and said this worker has not read it. Not
 *      "no record" by default because we could not check.
 *   2. The organisation collects location. A worker whose employer has turned
 *      it off is not shown a notice about data that is not being collected.
 *   3. This worker has not already read the current version.
 *
 * Fails open, deliberately, and this is the opposite of how a consent gate
 * would fail. The first version of this failed closed, and it was wrong: a
 * carer in a client's house with no signal could not start their shift at all,
 * because the check could not complete. That is a worse outcome than a worker
 * seeing a privacy notice one visit later than intended, and it is the outcome
 * that would have happened on the ordinary bad-signal mornings this app is used
 * on. The next successful check shows the notice, so the information still
 * arrives — just not at the cost of somebody being unable to clock in.
 *
 * Failing open on the *screen* is safe now in a way it was not before, because
 * it is not the screen that collects anything. Collection requires a recorded
 * agreement, and a worker who never got past this gate has no agreement, so
 * the worst case of letting them through is that their position is not
 * recorded — which is the fail-closed direction for the data even while the
 * gate itself is fail-open. The two are not in tension: the gate decides
 * whether a worker is interrupted, and the decision record decides what is
 * collected, and only the second one holds data.
 *
 * The write still holds the screen, because once a worker *has* been shown the
 * notice, letting them past without recording what they decided would mean the
 * record the employer relies on says they were told when it cannot — and, worse,
 * would leave a worker who said no collecting nothing while the app implied
 * they had agreed.
 */
export function StaffNoticeGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'show' | 'done'>('checking')
  // Held rather than re-read from storage on confirm: the notice screen needs a
  // token to record the acknowledgement, and reading it again at that point
  // would be a second async step between the tap and the record.
  const [token, setToken] = useState('')

  useEffect(() => {
    let cancelled = false
    readSession()
      .then(async session => {
        if (!session) { if (!cancelled) setState('done'); return }
        const [enabled, status, decision] = await Promise.all([
          getLocationTrackingEnabled(session.accessToken),
          getStaffNotice(session.accessToken, STAFF_LOCATION_NOTICE_KEY),
          // 'unreachable' is kept distinct from a null decision, because the two
          // mean opposite things for this screen. Unreachable is "we cannot ask",
          // which fails open like the notice does. Null is "we asked and there
          // is no answer", which is a question still to be put.
          getLocationDecision(session.accessToken)
            .then(d => d?.decision ?? null)
            .catch(() => 'unreachable' as const),
        ])
        if (cancelled) return
        setToken(session.accessToken)
        // Unreachable: let the worker in. The notice is re-checked next time.
        if (!status.reachable) { setState('done'); return }
        // Same for a decision check we could not complete. Re-asking a worker
        // who has already answered is a nuisance; blocking somebody's shift on a
        // network failure is the failure this gate has to avoid.
        if (decision === 'unreachable') { setState('done'); return }
        const outstanding =
          needsAcknowledgement(status.acknowledgement) || needsDecision(decision)
        setState(enabled && outstanding ? 'show' : 'done')
      })
      .catch(() => { if (!cancelled) setState('done') })
    return () => { cancelled = true }
  }, [])

  if (state === 'checking') {
    // Brief. Shown while two small requests resolve; a spinner beats either
    // flashing the app or flashing the notice and then retracting it.
    return <View style={{ flex: 1 }}><ActivityIndicator accessibilityLabel="Loading" /></View>
  }

  if (state === 'show') {
    return (
      <StaffNoticeScreen
        accessToken={token}
        onAcknowledged={() => setState('done')}
      />
    )
  }

  return <>{children}</>
}
