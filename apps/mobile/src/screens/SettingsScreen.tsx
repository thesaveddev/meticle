import { useEffect, useState } from 'react'
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, elevation, radii, spacing, type } from '../theme'
import type { MobileUser } from '../types'
import { PrimaryButton } from '../components/PrimaryButton'
import { requestReminderPermission } from '../services/notifications'

export function SettingsScreen({ user, onSignOut, onSync }: {
  user: MobileUser
  onSignOut: () => void
  onSync: () => void
}) {
  const [reminders, setReminders] = useState<'unknown' | 'enabled' | 'disabled'>('unknown')
  const [message, setMessage] = useState('')

  useEffect(() => {
    requestReminderPermission()
      .then(enabled => setReminders(enabled ? 'enabled' : 'disabled'))
      .catch(() => setReminders('disabled'))
  }, [])

  async function enableReminders() {
    const enabled = await requestReminderPermission()
    setReminders(enabled ? 'enabled' : 'disabled')
    setMessage(enabled ? 'Visit reminders enabled.' : 'Permission not granted.')
  }

  const initials = (user.first_name?.[0] || user.email[0]).toUpperCase()

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Settings</Text>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.first_name || user.email.split('@')[0]}</Text>
            <Text style={styles.profileEmail}>{user.email}</Text>
            {user.role && <Text style={styles.profileRole}>{user.role.replace(/_/g, ' ')}</Text>}
          </View>
        </View>

        {/* Notifications section */}
        <View style={styles.section}>
          <Text style={styles.sectionHead}>NOTIFICATIONS</Text>
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Visit reminders</Text>
                <Text style={styles.cardDesc}>
                  Reminders before your assigned calls. Change in phone settings.
                </Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: reminders === 'enabled' ? colors.success : colors.subtle }]} />
            </View>
            <Text style={styles.statusText}>
              {reminders === 'enabled' ? 'Enabled' : reminders === 'disabled' ? 'Not enabled' : 'Checking...'}
            </Text>
            {reminders !== 'enabled' && (
              <View style={{ marginTop: spacing.md }}>
                <PrimaryButton label="Enable reminders" onPress={enableReminders} tone="primary" size="small" />
              </View>
            )}
          </View>
        </View>

        {/* Offline section */}
        <View style={styles.section}>
          <Text style={styles.sectionHead}>OFFLINE</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Offline sync</Text>
            <Text style={styles.cardDesc}>
              Visit actions are stored on this device until they reach the server.
            </Text>
            <View style={{ marginTop: spacing.md }}>
              <PrimaryButton label="Retry sync" onPress={onSync} tone="primary" size="small" />
            </View>
          </View>
        </View>

        {message ? (
          <View style={styles.msgBanner}>
            <Text style={styles.msgText}>{message}</Text>
          </View>
        ) : null}

        {/* Sign out */}
        <View style={{ marginTop: spacing.lg }}>
          <PrimaryButton label="Sign out" onPress={onSignOut} tone="outline" />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  pageTitle: { ...type.title, marginBottom: spacing.base },

  /* Profile */
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.base,
    gap: spacing.base,
    marginBottom: spacing.xl,
    ...elevation.sm,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySurface,
    borderWidth: 2,
    borderColor: colors.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: 'System', fontSize: 20, fontWeight: '700', color: colors.primary },
  profileInfo: { flex: 1 },
  profileName: { ...type.bodyBold, fontSize: 17 },
  profileEmail: { ...type.small, marginTop: 1 },
  profileRole: {
    fontFamily: 'System',
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },

  /* Sections */
  section: { marginBottom: spacing.lg },
  sectionHead: {
    fontFamily: 'System',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.subtle,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.base,
    ...elevation.sm,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardContent: { flex: 1 },
  cardTitle: { ...type.bodyBold, marginBottom: spacing.xs },
  cardDesc: { ...type.small, lineHeight: 18 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  statusText: { ...type.small, color: colors.muted, textTransform: 'capitalize', marginTop: spacing.xs },

  /* Message */
  msgBanner: {
    backgroundColor: colors.successSurface,
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.base,
  },
  msgText: { ...type.small, color: colors.successDeep },
})
