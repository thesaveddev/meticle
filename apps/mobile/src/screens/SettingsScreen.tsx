import { useEffect, useState } from 'react'
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, commonStyles, spacing, type } from '../theme'
import type { MobileUser } from '../types'
import { PrimaryButton } from '../components/PrimaryButton'
import { requestReminderPermission } from '../services/notifications'

export function SettingsScreen({ user, onSignOut, onSync }: { user: MobileUser; onSignOut: () => void; onSync: () => void }) {
  const [reminders, setReminders] = useState<'unknown' | 'enabled' | 'disabled'>('unknown')
  const [message, setMessage] = useState('')
  useEffect(() => { requestReminderPermission().then(enabled => setReminders(enabled ? 'enabled' : 'disabled')).catch(() => setReminders('disabled')) }, [])

  async function enableReminders() {
    const enabled = await requestReminderPermission()
    setReminders(enabled ? 'enabled' : 'disabled')
    setMessage(enabled ? 'Visit reminders are enabled on this device.' : 'Notification permission was not granted.')
  }

  return <SafeAreaView style={commonStyles.screen}><ScrollView contentContainerStyle={styles.content}><Text style={styles.kicker}>ACCOUNT</Text><Text style={type.display}>{user.first_name || user.email.split('@')[0]}</Text><Text style={styles.email}>{user.email}</Text>
    <View style={styles.rule} />
    <Text style={styles.sectionTitle}>Visit reminders</Text><Text style={styles.copy}>Reminders are scheduled on this device before your assigned visits. You can change permission in your phone settings.</Text><View style={styles.status}><View style={[styles.dot, { backgroundColor: reminders === 'enabled' ? colors.emerald : colors.mist }]} /><Text style={styles.statusText}>{reminders === 'enabled' ? 'Enabled' : reminders === 'disabled' ? 'Not enabled' : 'Checking permission'}</Text></View>{reminders !== 'enabled' && <PrimaryButton label="Enable reminders" onPress={enableReminders} />}
    <View style={styles.rule} /><Text style={styles.sectionTitle}>Offline work</Text><Text style={styles.copy}>Visit actions are stored securely on this device until they reach MeticleCare. Retry sync after reconnecting.</Text><PrimaryButton label="Retry sync" onPress={onSync} />
    {message && <Text style={styles.message}>{message}</Text>}
    <View style={styles.rule} /><PrimaryButton label="Sign out" onPress={onSignOut} tone="emerald" />
  </ScrollView></SafeAreaView>
}

const styles = StyleSheet.create({
  content: { ...commonStyles.content, paddingTop: spacing.xl, gap: spacing.md },
  kicker: { ...type.label, color: colors.emeraldDeep, letterSpacing: 1.2 },
  email: { ...type.body, color: colors.mist, marginTop: spacing.xs },
  rule: { height: 1, backgroundColor: colors.hairline, marginVertical: spacing.lg },
  sectionTitle: { ...type.title, color: colors.ink },
  copy: { ...type.body, color: colors.mist },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  dot: { width: 9, height: 9, borderRadius: 5 },
  statusText: { ...type.bodyStrong, color: colors.ink, textTransform: 'capitalize' },
  message: { ...type.caption, color: colors.emeraldDeep },
})
