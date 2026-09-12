import { useEffect, useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, elevation, radii, spacing, type, FONT, useTheme } from '../theme'
import { dyn } from '../utils/dynamicStyles'
import type { MobileUser } from '../types'
import { PrimaryButton } from '../components/PrimaryButton'
import { requestReminderPermission } from '../services/notifications'
import { isHapticEnabled, setHapticEnabled } from '../services/haptics'
import { IconProfile, IconSyncSmall, IconWarning, IconSettings, IconSchedule } from '../components/Icons'
import { hapticLight } from '../services/haptics'

export function SettingsScreen({ user, onSignOut, onSync, onProfile, onAvailability, onChat }: {
  user: MobileUser
  onSignOut: () => void
  onSync: () => void
  onProfile?: () => void
  onAvailability?: () => void
  onChat?: () => void
}) {
  const { mode, scheme, setMode, colors: c } = useTheme()
  const [reminders, setReminders] = useState<'unknown' | 'enabled' | 'disabled'>('unknown')
  const [message, setMessage] = useState('')
  const [hapticOn, setHapticOn] = useState(true)

  useEffect(() => {
    requestReminderPermission()
      .then(enabled => setReminders(enabled ? 'enabled' : 'disabled'))
      .catch(() => setReminders('disabled'))
    isHapticEnabled().then(setHapticOn)
  }, [])

  async function enableReminders() {
    hapticLight()
    const enabled = await requestReminderPermission()
    setReminders(enabled ? 'enabled' : 'disabled')
    setMessage(enabled ? 'Visit reminders enabled.' : 'Permission not granted.')
  }

  const initials = (user.first_name?.[0] || user.email[0]).toUpperCase()
  const displayName = user.first_name
    ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
    : user.email.split('@')[0]
  const roleLabel = user.role ? user.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : ''

  return (
    <SafeAreaView style={[styles.screen, dyn(c).screen]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={[styles.pageTitle, { color: c.ink }]}>Settings</Text>

        {/* Profile card */}
        <Pressable onPress={() => { hapticLight(); onProfile?.() }} style={({ pressed }) => [styles.profileCard, { backgroundColor: c.surface, borderColor: c.borderLight }, pressed && { opacity: 0.85 }]}>
          <View style={styles.avatarWrap}>
            {(user as any).profile_picture_url ? (
              <Image source={{ uri: (user as any).profile_picture_url }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: c.primarySurface, borderColor: c.primary + '25' }]}>
                <Text style={[styles.avatarText, { color: c.primary }]}>{initials}</Text>
              </View>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: c.ink }]}>{displayName}</Text>
            <Text style={[styles.profileEmail, { color: c.muted }]}>{user.email}</Text>
            {roleLabel ? (
              <View style={[styles.roleBadge, { backgroundColor: c.primarySurface }]}>
                <Text style={[styles.roleBadgeText, { color: c.primary }]}>{roleLabel}</Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.chevronWrap, { backgroundColor: c.bg }]}>
            <Text style={[styles.chevron, { color: c.subtle }]}>→</Text>
          </View>
        </Pressable>

        {/* Settings groups */}
        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: c.subtle }]}>NOTIFICATIONS</Text>
          <View style={[styles.groupCard, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
            {/* Visit reminders */}
            <Pressable
              onPress={async () => {
                hapticLight()
                if (reminders === 'enabled') {
                  setReminders('disabled')
                  setMessage('Visit reminders disabled.')
                } else {
                  const enabled = await requestReminderPermission()
                  setReminders(enabled ? 'enabled' : 'disabled')
                  setMessage(enabled ? 'Visit reminders enabled.' : 'Permission not granted.')
                }
              }}
              style={styles.menuRow}
            >
              <View style={[styles.menuIconWrap, { backgroundColor: c.bg }]}>
                <IconWarning size={18} color={c.warning} />
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuTitle, { color: c.ink }]}>Visit reminders</Text>
                <Text style={[styles.menuDesc, { color: c.muted }]}>Alerts before your assigned calls</Text>
              </View>
              <View style={[styles.toggle, { backgroundColor: c.border }, reminders === 'enabled' && { backgroundColor: c.primary }]}>
                <View style={[styles.toggleDot, { backgroundColor: c.inverse }, reminders === 'enabled' && styles.toggleDotOn]} />
              </View>
            </Pressable>
          </View>
        </View>

        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: c.subtle }]}>APPEARANCE</Text>
          <View style={[styles.groupCard, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
            {/* Dark mode */}
            <View style={styles.menuRow}>
              <View style={[styles.menuIconWrap, { backgroundColor: c.bg }]}>
                <Text style={{ fontSize: 16 }}>{scheme === 'dark' ? '🌙' : '☀️'}</Text>
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuTitle, { color: c.ink }]}>Dark mode</Text>
                <Text style={[styles.menuDesc, { color: c.muted }]}>{mode === 'system' ? 'Following system setting' : mode === 'dark' ? 'Always dark' : 'Always light'}</Text>
              </View>
            </View>
            {/* Mode selector pills */}
            <View style={styles.modePills}>
              {([['light', 'Light'], ['system', 'Auto'], ['dark', 'Dark']] as const).map(([m, label]) => (
                <Pressable key={m} onPress={() => { hapticLight(); setMode(m) }}
                  style={({ pressed }) => [
                    styles.modePill,
                    { backgroundColor: c.bg, borderColor: c.border },
                    mode === m && { backgroundColor: c.primarySurface, borderColor: c.primary + '40' },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.modePillText, { color: c.muted }, mode === m && { color: c.primary }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Haptic feedback */}
          <View style={[styles.groupCard, { marginTop: spacing.sm, backgroundColor: c.surface, borderColor: c.borderLight }]}>  
            <Pressable
              onPress={async () => {
                hapticLight()
                const next = !hapticOn
                await setHapticEnabled(next)
                setHapticOn(next)
              }}
              style={styles.menuRow}
            >
              <View style={[styles.menuIconWrap, { backgroundColor: c.bg }]}>
                <IconSettings size={18} color={c.primary} />
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuTitle, { color: c.ink }]}>Haptic feedback</Text>
                <Text style={[styles.menuDesc, { color: c.muted }]}>Vibration on button presses</Text>
              </View>
              <View style={[styles.toggle, { backgroundColor: c.border }, hapticOn && { backgroundColor: c.primary }]}>
                <View style={[styles.toggleDot, { backgroundColor: c.inverse }, hapticOn && styles.toggleDotOn]} />
              </View>
            </Pressable>
          </View>
        </View>

        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: c.subtle }]}>AVAILABILITY</Text>
          <View style={[styles.groupCard, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
            <Pressable onPress={() => { hapticLight(); onAvailability?.() }} style={styles.menuRow}>
              <View style={[styles.menuIconWrap, { backgroundColor: c.bg }]}>
                <IconSchedule size={18} color={c.primary} />
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuTitle, { color: c.ink }]}>Submit availability</Text>
                <Text style={[styles.menuDesc, { color: c.muted }]}>Set your available hours for upcoming weeks</Text>
              </View>
              <Text style={[styles.menuArrow, { color: c.subtle }]}>→</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: c.subtle }]}>COMMUNICATION</Text>
          <View style={[styles.groupCard, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
            <Pressable onPress={() => { hapticLight(); onChat?.() }} style={styles.menuRow}>
              <View style={[styles.menuIconWrap, { backgroundColor: c.bg }]}>
                <IconSchedule size={18} color={c.primary} />
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuTitle, { color: c.ink }]}>Team chat</Text>
                <Text style={[styles.menuDesc, { color: c.muted }]}>Message your team across the organisation</Text>
              </View>
              <Text style={[styles.menuArrow, { color: c.subtle }]}>→</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: c.subtle }]}>DATA</Text>
          <View style={[styles.groupCard, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
            {/* Offline sync */}
            <View style={styles.menuRow}>
              <View style={[styles.menuIconWrap, { backgroundColor: c.bg }]}>
                <IconSyncSmall size={18} color={c.success} />
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuTitle, { color: c.ink }]}>Offline sync</Text>
                <Text style={[styles.menuDesc, { color: c.muted }]}>Actions stored until reconnected</Text>
              </View>
              <Pressable onPress={() => { hapticLight(); onSync() }} style={[styles.syncBtn, { backgroundColor: c.successSurface, borderColor: c.success + '25' }]}>
                <Text style={[styles.syncBtnText, { color: c.success }]}>Sync</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Message */}
        {message ? (
          <View style={[styles.msgBanner, { backgroundColor: c.successSurface, borderColor: c.success + '20' }]}>
            <Text style={[styles.msgText, { color: c.successDeep }]}>{message}</Text>
          </View>
        ) : null}

        {/* Sign out */}
        <Pressable onPress={() => { hapticLight(); onSignOut() }} style={({ pressed }) => [styles.signOutBtn, { borderColor: c.danger + '30', backgroundColor: c.dangerSurface }, pressed && { opacity: 0.7 }]}>
          <Text style={[styles.signOutText, { color: c.danger }]}>Sign out</Text>
        </Pressable>

        <Text style={[styles.version, { color: c.subtle }]}>MeticleCare v1.0</Text>

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
screen: { flex: 1 },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.lg },

  pageTitle: { fontFamily: FONT, fontSize: 22, fontWeight: '700', color: colors.ink, letterSpacing: -0.4, marginBottom: spacing.lg },

  /* Profile card */
  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.borderLight,
    padding: spacing.base, gap: spacing.base,
    marginBottom: spacing.xl, ...elevation.md,
  },
  avatarWrap: {},
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primarySurface,
    borderWidth: 2, borderColor: colors.primary + '25',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: colors.primary + '25' },
  avatarText: { fontFamily: FONT, fontSize: 22, fontWeight: '700', color: colors.primary },
  profileInfo: { flex: 1 },
  profileName: { fontFamily: FONT, fontSize: 17, fontWeight: '700', color: colors.ink },
  profileEmail: { fontFamily: FONT, fontSize: 13, fontWeight: '400', color: colors.muted, marginTop: 2 },
  roleBadge: {
    alignSelf: 'flex-start', marginTop: spacing.xs,
    backgroundColor: colors.primarySurface, paddingHorizontal: spacing.sm,
    paddingVertical: 3, borderRadius: radii.sm,
  },
  roleBadgeText: { fontFamily: FONT, fontSize: 10, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  chevronWrap: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center',
  },
  chevron: { fontFamily: FONT, fontSize: 16, fontWeight: '600', color: colors.subtle },

  /* Groups */
  group: { marginBottom: spacing.lg },
  groupLabel: {
    fontFamily: FONT, fontSize: 11, fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase', color: colors.subtle,
    marginBottom: spacing.sm, paddingLeft: 4,
  },
  groupCard: {
    backgroundColor: colors.surface, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.borderLight,
    overflow: 'hidden', ...elevation.sm,
  },

  /* Menu rows */
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.base, gap: spacing.md,
  },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center',
  },
  menuContent: { flex: 1 },
  menuTitle: { fontFamily: FONT, fontSize: 15, fontWeight: '600', color: colors.ink },
  menuDesc: { fontFamily: FONT, fontSize: 12, fontWeight: '400', color: colors.muted, marginTop: 2 },

  /* Status badge */
  statusBadge: {
    backgroundColor: colors.successSurface, paddingHorizontal: spacing.sm,
    paddingVertical: 4, borderRadius: radii.sm,
  },
  statusBadgeText: { fontFamily: FONT, fontSize: 11, fontWeight: '700', color: colors.success },

  /* Enable button */
  enableBtn: {
    backgroundColor: colors.primarySurface, paddingHorizontal: spacing.md,
    paddingVertical: 6, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.primary + '25',
  },
  enableBtnText: { fontFamily: FONT, fontSize: 12, fontWeight: '600', color: colors.primary },

  /* Sync button */
  syncBtn: {
    backgroundColor: colors.successSurface, paddingHorizontal: spacing.md,
    paddingVertical: 6, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.success + '25',
  },
  syncBtnText: { fontFamily: FONT, fontSize: 12, fontWeight: '600', color: colors.success },

  /* Mode pills */
  modePills: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.base, paddingBottom: spacing.base,
  },
  modePill: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.sm,
    borderRadius: radii.md, backgroundColor: colors.bg,
    borderWidth: 1.5, borderColor: colors.border,
  },
  modePillActive: { backgroundColor: colors.primarySurface, borderColor: colors.primary + '40' },
  modePillText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: colors.muted },
  modePillTextActive: { color: colors.primary },

  menuArrow: { fontFamily: FONT, fontSize: 16, fontWeight: '600', color: colors.subtle },

  /* Toggle */
  toggle: {
    width: 44, height: 24, borderRadius: 12,
    backgroundColor: colors.border, justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleOn: { backgroundColor: colors.primary },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.inverse },
  toggleDotOn: { alignSelf: 'flex-end' },

  /* Message */
  msgBanner: {
    backgroundColor: colors.successSurface, padding: spacing.md,
    borderRadius: radii.md, marginTop: spacing.base,
    borderWidth: 1, borderColor: colors.success + '20',
  },
  msgText: { fontFamily: FONT, fontSize: 13, fontWeight: '500', color: colors.successDeep },

  /* Sign out */
  signOutBtn: {
    alignItems: 'center', paddingVertical: spacing.base,
    marginTop: spacing.lg, borderRadius: radii.md,
    borderWidth: 1.5, borderColor: colors.danger + '30',
    backgroundColor: colors.dangerSurface,
  },
  signOutText: { fontFamily: FONT, fontSize: 15, fontWeight: '600', color: colors.danger },

  /* Version */
  version: { fontFamily: FONT, fontSize: 11, fontWeight: '400', color: colors.subtle, textAlign: 'center', marginTop: spacing.xl },
})
