import { useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { StaffNoticeScreen } from '../screens/StaffNoticeScreen'
import { getLocationTrackingEnabled, getStaffNotice } from '../services/api'
import { readSession } from '../services/storage'
import {
  STAFF_LOCATION_NOTICE_KEY,
  needsAcknowledgement,
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
 * Failing closed would be right if this were a consent gate. It is not one:
 * tapping through surrenders nothing, and the notice is information, not a
 * condition of access. The write still holds the screen, because once a worker
 * *has* been shown the notice, letting them past without recording it would
 * mean the record the employer relies on says they were told when it cannot.
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
        const [enabled, status] = await Promise.all([
          getLocationTrackingEnabled(session.accessToken),
          getStaffNotice(session.accessToken, STAFF_LOCATION_NOTICE_KEY),
        ])
        if (cancelled) return
        setToken(session.accessToken)
        // Unreachable: let the worker in. The notice is re-checked next time.
        if (!status.reachable) { setState('done'); return }
        setState(enabled && needsAcknowledgement(status.acknowledgement) ? 'show' : 'done')
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
