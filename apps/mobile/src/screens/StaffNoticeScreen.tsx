import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { radii, spacing, useAppColors } from '../theme'
import { hapticLight, hapticWarning } from '../services/haptics'
import { acknowledgeStaffNotice, setLocationDecision } from '../services/api'
import {
  CAPTURE_POINTS,
  STAFF_LOCATION_NOTICE,
  STAFF_LOCATION_NOTICE_KEY,
  STAFF_LOCATION_NOTICE_VERSION,
} from '../content/staffLocationNotice'

interface Props {
  accessToken: string
  onAcknowledged: () => void
  /** 'agreed' | 'declined' to show a single action, for changing an answer. */
  initialDecision?: 'agreed' | 'declined' | null
}

/**
 * The first-launch gate, and now the place a worker answers.
 *
 * Shown once per worker per version of the notice, and only to a worker whose
 * organisation has location recording switched on. Someone whose employer has
 * turned location off is not shown a notice about location, because a notice
 * about data that is not being collected is noise, and this screen is
 * unavoidable — putting it in front of every carer in an organisation that has
 * chosen not to use the feature trains people to tap through privacy screens
 * without reading them, which is the opposite of the point.
 *
 * Two buttons, and the framing of both matters:
 *
 *   - "Yes, record my location" is not "Accept". It names the thing being
 *     agreed to, so a worker who taps it knows what they said.
 *   - "No, don't record my location" is not greyed out, not second, and not
 *     labelled "decline" as though the app preferred the other answer. It is
 *     the same weight as the yes.
 *
 * Neither answer gives the employer a lawful basis — that is the employer's to
 * establish and the notice says so. What the app honours is the answer, in both
 * directions: saying no stops the position being sent, which is a control that
 * needs no legal standing to enforce because it is the one that collects less.
 */
export function StaffNoticeScreen({ accessToken, onAcknowledged, initialDecision = null }: Props) {
  const c = useAppColors()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const answer = async (decision: 'agreed' | 'declined') => {
    if (saving) return
    setSaving(true)
    setError('')
    hapticLight()
    try {
      // Both writes, and the decision second. The notice acknowledgement is
      // what proves the worker was told; the decision is what they did about
      // it. Recording the decision first would leave a worker who declined with
      // no evidence they were ever informed, which is the half that is for the
      // provider and the half that cannot be reconstructed later.
      await acknowledgeStaffNotice(accessToken, {
        notice_key: STAFF_LOCATION_NOTICE_KEY,
        notice_version: STAFF_LOCATION_NOTICE_VERSION,
      })
      await setLocationDecision(accessToken, decision, {
        notice_key: STAFF_LOCATION_NOTICE_KEY,
        notice_version: STAFF_LOCATION_NOTICE_VERSION,
      })
      onAcknowledged()
    } catch (e: any) {
      // Held on this screen rather than letting the worker through. If the
      // record is never written, the employer cannot evidence that this person
      // was told anything, and — more importantly — a worker who said no and
      // found out the app had not saved it has been told something untrue.
      hapticWarning()
      setError(e?.message || 'Could not save your answer. Check your connection and try again.')
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} testID="staff-notice-scroll">
        <Text style={[styles.title, { color: c.ink }]}>How your location is used</Text>
        <Text style={[styles.intro, { color: c.muted }]}>
          Please read this before you use the app. It takes a couple of minutes.
        </Text>

        {STAFF_LOCATION_NOTICE.map((section, i) => (
          <View key={section.heading} style={styles.section}>
            <Text style={[styles.heading, { color: c.ink }]}>{section.heading}</Text>
            {section.body.map((para, j) => (
              <Text key={j} style={[styles.para, { color: c.muted }]}>{para}</Text>
            ))}
            {section.points?.map((point, k) => (
              <View key={k} style={styles.bulletRow}>
                <Text style={[styles.bullet, { color: c.muted }]}>•</Text>
                <Text style={[styles.bulletText, { color: c.muted }]}>{point}</Text>
              </View>
            ))}
            {i === 1 && (
              // The two of three points that never leave the phone are worth
              // marking visually, because "when is my location sent" is the
              // question a worker is actually asking and a wall of prose buries
              // the answer.
              <View style={[styles.legend, { borderColor: c.border, borderLeftWidth: 3 }]}>
                <Text style={[styles.legendText, { color: c.muted }]}>
                  One of these three is sent to your employer. The other two are worked out on
                  your phone and never leave it.
                </Text>
              </View>
            )}
          </View>
        ))}

        {error ? (
          <Text style={[styles.error, { color: c.danger }]} testID="staff-notice-error">
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={() => answer('agreed')}
          disabled={saving}
          accessibilityRole="button"
          testID="staff-notice-confirm"
          style={[styles.button, { backgroundColor: c.primary, opacity: saving ? 0.6 : 1 }]}
        >
          <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Yes, record my location'}</Text>
        </Pressable>

        <Pressable
          onPress={() => answer('declined')}
          disabled={saving}
          accessibilityRole="button"
          testID="staff-notice-decline"
          style={[styles.buttonSecondary, { borderColor: c.border, opacity: saving ? 0.6 : 1 }]}
        >
          <Text style={[styles.buttonSecondaryText, { color: c.ink }]}>
            {saving ? 'Saving…' : 'No, don’t record my location'}
          </Text>
        </Pressable>

        <Text style={[styles.footnote, { color: c.muted }]}>
          {initialDecision
            ? `Your current answer is “${initialDecision === 'agreed' ? 'yes' : 'no'}”. Changing it takes effect from your next check-in.`
            : 'This records that you were shown this notice and what you decided. It is not an agreement on your employer’s behalf — they are responsible for the legal basis for any location they collect.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

/** Exported for the gate test: how many points report a device-only read. */
export const DEVICE_ONLY_CAPTURE_POINTS = CAPTURE_POINTS.filter(p => p.sent === 'stays_on_your_phone').length

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: spacing.xs },
  intro: { fontSize: 15, marginBottom: spacing.lg },
  section: { marginBottom: spacing.lg },
  heading: { fontSize: 17, fontWeight: '700', marginBottom: spacing.xs },
  para: { fontSize: 15, lineHeight: 22, marginBottom: spacing.sm },
  bulletRow: { flexDirection: 'row', marginBottom: spacing.sm },
  bullet: { fontSize: 15, minWidth: 16 },
  bulletText: { flex: 1, fontSize: 15, lineHeight: 22 },
  legend: { paddingLeft: spacing.sm, marginTop: spacing.sm },
  legendText: { fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  error: { fontSize: 14, marginBottom: spacing.sm },
  button: { borderRadius: radii.md, paddingVertical: 16, alignItems: 'center', marginTop: spacing.sm },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  buttonSecondary: { borderRadius: radii.md, borderWidth: 1, paddingVertical: 16, alignItems: 'center', marginTop: spacing.sm },
  buttonSecondaryText: { fontSize: 16, fontWeight: '700' },
  footnote: { fontSize: 13, lineHeight: 19, marginTop: spacing.md },
})
