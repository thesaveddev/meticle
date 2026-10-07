import { useCallback, useMemo } from 'react'
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../theme'
import { spacing, radii, mcType } from '../theme'
import { FloatingMicaOrb, SosContact, MICA_IDLE_IMAGE, MICA_ORB_IMAGE } from '../components/FloatingMicaOrb'
import { organisationSosContacts } from '../components/EmergencyButton'
import type { AuthSession, SessionOrganisation } from '../types'
import { hapticWarning, hapticMedium } from '../services/haptics'

interface Props {
  navigation: {
    pop: () => void
  }
  session: AuthSession | null
  onMicaPress: () => void
}

function orgContacts(org: SessionOrganisation | null | undefined): SosContact[] {
  if (!org) return []
  const pairs = [
    { label: org.emergency_contact_1_label as string | undefined || 'Office', phone: org.emergency_contact_1_phone as string | undefined | null || '' },
    { label: org.emergency_contact_2_label as string | undefined || 'Supervisor', phone: org.emergency_contact_2_phone as string | undefined | null || '' },
  ]
  return pairs.filter(c => c.phone).map(c => ({ label: c.label, phone: c.phone }))
}

export function SosHelpScreen({ navigation, session, onMicaPress }: Props) {
  const { colors: c } = useTheme()
  const contacts: SosContact[] = useMemo(() => orgContacts(session?.organization), [session?.organization])
  const managerPhone: string | undefined = session?.organization?.manager_phone as string | undefined

  const dial = useCallback(async (number: string) => {
    try {
      const url = `tel:${number}`
      const canOpen = await Linking.canOpenURL(url)
      if (canOpen) {
        hapticWarning()
        await Linking.openURL(url)
      } else {
        Alert.alert('Cannot make calls', `Dial ${number} manually from your phone app.`)
      }
    } catch {
      Alert.alert('Error', `Could not open phone dialer. Please call ${number} manually.`)
    }
  }, [])

  const show = useCallback(() => {
    const targets: SosContact[] = [
      { label: '999 — Emergency', phone: '999' },
      { label: '111 — NHS', phone: '111' },
      ...contacts,
      ...(managerPhone ? [{ label: 'Manager', phone: managerPhone }] : []),
    ]
    type AlertBtn = { text: string; onPress: () => void; style?: 'default' | 'cancel' | 'destructive' }
    const buttons: AlertBtn[] = targets.map((t): AlertBtn => ({
      text: `Call ${t.label}`,
      onPress: () => dial(t.phone),
      style: t.phone === '999' ? 'destructive' : 'default',
    }))
    if (Platform.OS === 'ios') {
      Alert.alert('Emergency Call', 'Who do you need to call?', [
        { text: 'Cancel', style: 'cancel' },
        ...buttons,
      ])
    } else {
      Alert.alert('Emergency Call', 'Who do you need to call?', [
        { text: 'Cancel', style: 'cancel' },
        ...buttons,
      ])
    }
  }, [contacts, managerPhone, dial])

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <FloatingMicaOrb
        onMicaPress={onMicaPress}
        onSosPress={show}
        sosContacts={contacts}
        managerPhone={managerPhone}
        idleImage={MICA_IDLE_IMAGE}
        listeningImage={MICA_ORB_IMAGE}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <Pressable onPress={navigation.pop} style={styles.back}>
            <Ionicons name="close" size={24} color={c.text} />
            <Text style={[mcType.label, { color: c.text, marginLeft: spacing.sm }]}>Back</Text>
          </Pressable>
          <Text style={[mcType.pageTitle, { color: c.text }]}>SOS & Help</Text>
        </View>

        <Text style={[styles.title, { color: c.text }]}>Emergency</Text>
        <Text style={[styles.subtitle, { color: c.muted }]}>
          Tap below to call emergency services or your office. Emergency services are always first.
        </Text>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          {[
            { label: '999 — Emergency', phone: '999', destructive: true },
            { label: '111 — NHS', phone: '111', destructive: false },
            ...contacts.map((contact) => ({ label: `${contact.label} — ${contact.phone}`, phone: contact.phone, destructive: false })),
            ...(managerPhone ? [{ label: `Manager — ${managerPhone}`, phone: managerPhone, destructive: false }] : []),
          ].map((item) => (
            <Pressable
              key={item.phone}
              onPress={() => dial(item.phone)}
              style={[styles.row, item.destructive && { borderTopWidth: 1, borderTopColor: c.border }]}
            >
              <Ionicons name="phone-portrait" size={22} color={item.destructive ? '#EF4444' : c.primary} />
              <Text style={[styles.rowLabel, { color: c.text }]}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={c.muted} />
            </Pressable>
          ))}
        </View>

        <Text style={[styles.title, { color: c.text, marginTop: spacing.lg }]}>Mica</Text>
        <Text style={[styles.subtitle, { color: c.muted }]}>
          Mica is your assistant inside Meticle Care. Tap the floating Mica button anywhere to open Mica.
        </Text>
        <Pressable onPress={onMicaPress} style={[styles.micaRow, { borderColor: c.border }]}>
          <Ionicons name="mic" size={22} color={c.primary} />
          <Text style={[styles.rowLabel, { color: c.primary }]}>Open Mica</Text>
          <Ionicons name="chevron-forward" size={20} color={c.muted} />
        </Pressable>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingBottom: 80 },
  body: { padding: spacing.md, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1 },
  back: { flexDirection: 'row', alignItems: 'center', padding: spacing.xs, borderRadius: radii.sm },
  title: { fontSize: 20, fontWeight: '700', color: '#17202A', marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: '#667085', lineHeight: 20, marginBottom: spacing.md },
  card: { borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: '#E6EAF0', marginBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600', marginLeft: spacing.sm },
  micaRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: '#E6EAF0', backgroundColor: '#EAF3FF', marginTop: spacing.sm },
})
