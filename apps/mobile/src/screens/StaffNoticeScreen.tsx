import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { radii, spacing, useAppColors } from '../theme'
import { hapticLight, hapticWarning } from '../services/haptics'
import { acknowledgeStaffNotice } from '../services/api'
import {
  CAPTURE_POINTS,
  STAFF_LOCATION_NOTICE,
  STAFF_LOCATION_NOTICE_KEY,
  STAFF_LOCATION_NOTICE_VERSION,
} from '../content/staffLocationNotice'

interface Props {
  accessToken: string
  onAcknowledged: () => void
}

/**
 * The first-launch gate.
 *
 * Shown once per worker per version of the notice, and only to a worker whose
 * organisation has location recording switched on. Someone whose employer has
 * turned location off is not shown a notice about location, because a notice
 * about data that is not being collected is noise, and this screen is
 * unavoidable — putting it in front of every carer in an organisation that has
 * chosen not to use the feature trains people to tap through privacy screens
 * without reading them, which is the opposite of the point.
 *
 * The button says "I have read this" rather than "Accept" or "I agree", because
 * this is not a consent capture and must not read like one. MeticleCare is a
 * processor; it cannot give a worker a lawful basis for their employer's
 * monitoring, and presenting a button as though it could would be inventing an
 * agreement the app has no standing to create. What the button does is record
 * that the worker was informed.
 */
export function StaffNoticeScreen({ accessToken, onAcknowledged }: Props) {
  const c = useAppColors()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const confirm = async () => {
    if (saving) return
    setSaving(true)
    setError('')
    hapticLight()
    try {
      await acknowledgeStaffNotice(accessToken, {
        notice_key: STAFF_LOCATION_NOTICE_KEY,
        notice_version: STAFF_LOCATION_NOTICE_VERSION,
      })
      onAcknowledged()
    } catch (e: any) {
      // Held on this screen rather than letting the worker through. If the
      // record is never written, the employer cannot evidence that this person
      // was told anything, and that is the only thing this screen is for.
      hapticWarning()
      setError(e?.message || 'Could not record that you have read this. Check your connection and try again.')
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
          onPress={confirm}
          disabled={saving}
          accessibilityRole="button"
          testID="staff-notice-confirm"
          style={[styles.button, { backgroundColor: c.primary, opacity: saving ? 0.6 : 1 }]}
        >
          <Text style={styles.buttonText}>{saving ? 'Saving…' : 'I have read this'}</Text>
        </Pressable>

        <Text style={[styles.footnote, { color: c.muted }]}>
          This records that you were shown this notice. It does not change what your employer
          collects, and it is not an agreement on their behalf — they are responsible for that.
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
  footnote: { fontSize: 13, lineHeight: 19, marginTop: spacing.md },
})
