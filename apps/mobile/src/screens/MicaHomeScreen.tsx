import { useCallback, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View, ScrollView, Modal, Dimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../theme'
import { spacing, radii, shadows, mcType, mica } from '../theme'
import { FloatingMicaOrb, SosContact, MICA_IDLE_IMAGE, MICA_ORB_IMAGE } from '../components/FloatingMicaOrb'
import type { AuthSession, SessionOrganisation } from '../types'

interface Props {
  navigation: {
    pop: () => void
  }
  session: AuthSession | null
  onCloseSheet: () => void
  onOpenSheet: () => void
}

const { width: SCREEN_WIDTH } = Dimensions.get('window')

function orgContacts(org: SessionOrganisation | null | undefined): SosContact[] {
  if (!org) return []
  const pairs = [
    { label: org.emergency_contact_1_label as string | undefined || 'Office', phone: org.emergency_contact_1_phone as string | undefined | null || '' },
    { label: org.emergency_contact_2_label as string | undefined || 'Supervisor', phone: org.emergency_contact_2_phone as string | undefined | null || '' },
  ]
  return pairs.filter(c => c.phone).map(c => ({ label: c.label, phone: c.phone }))
}

export function MicaHomeScreen({ navigation, session, onCloseSheet, onOpenSheet }: Props) {
  const { colors: c } = useTheme()
  const contacts: SosContact[] = orgContacts(session?.organization)
  const managerPhone: string | undefined = session?.organization?.manager_phone as string | undefined

  const [sheetOpen, setSheetOpen] = useState(false)

  const handleMicaPress = useCallback(() => {
    onOpenSheet()
  }, [onOpenSheet])

  const handleSosPress = useCallback(() => {
    // Long-press the floating orb reappears here only on the Mica home screen.
    // The SOS targets are the same ones the SOS/Help screen offers.
    onOpenSheet()
  }, [onOpenSheet])

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <FloatingMicaOrb
        onMicaPress={handleMicaPress}
        onSosPress={handleSosPress}
        sosContacts={contacts}
        managerPhone={managerPhone}
        idleImage={MICA_IDLE_IMAGE}
        listeningImage={MICA_ORB_IMAGE}
        listening={sheetOpen}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <Pressable onPress={navigation.pop} style={styles.back}>
            <Ionicons name="close" size={24} color={c.text} />
            <Text style={[mcType.label, { color: c.text, marginLeft: spacing.sm }]}>Back</Text>
          </Pressable>
          <Text style={[mcType.pageTitle, { color: c.text }]}>Mica</Text>
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={[styles.hero, { backgroundColor: c.surface }]}>
            <Image source={MICA_IDLE_IMAGE} style={[styles.orb, { resizeMode: 'contain' }]} />
            <Text style={[styles.title, { color: c.text }]}>Mica</Text>
            <Text style={[styles.subtitle, { color: c.muted }]}>
              Your assistant inside Meticle Care.
            </Text>
            <Text style={[styles.subtitle, { color: c.muted }]}>
              Tap the floating Mica button anywhere to open Mica.
            </Text>
          </View>

          <View style={[styles.section, { borderTopColor: c.border }]}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Open Mica</Text>
            <Pressable onPress={() => setSheetOpen(true)} style={[styles.openButton, { backgroundColor: mica.blue }]}>
              <Ionicons name="mic" size={22} color="#FFFFFF" />
              <Text style={[styles.openButtonLabel, { color: '#FFFFFF' }]}>Open Mica</Text>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={[styles.section, { borderTopColor: c.border }]}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>SOS & Help</Text>
            <Pressable onPress={() => { navigation.pop(); }} style={[styles.openButton, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }]}>
              <Ionicons name="alert" size={22} color={c.danger} />
              <Text style={[styles.openButtonLabel, { color: c.danger }]}>SOS & Help</Text>
              <Ionicons name="chevron-forward" size={20} color={c.muted} />
            </Pressable>
          </View>
        </View>

        <Text style={[styles.footnote, { color: c.muted }]}>
          Mica is launching soon. Tap the floating Mica button from any screen to open Mica.
        </Text>
      </ScrollView>

      <Modal
        visible={sheetOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={onCloseSheet}
        statusBarTranslucent={true}
      >
        <View style={[styles.modal, { backgroundColor: '#00000040' }]}>
          <Pressable style={styles.modalBackdrop} onPress={onCloseSheet} />
          <View style={[styles.sheet, { backgroundColor: c.surface }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: c.border }]}>
              <Pressable onPress={onCloseSheet} style={styles.back}>
                <Ionicons name="close" size={24} color={c.text} />
                <Text style={[mcType.label, { color: c.text, marginLeft: spacing.sm }]}>Close</Text>
              </Pressable>
              <Text style={[mcType.pageTitle, { color: c.text, textAlign: 'center', flex: 1 }]}>Mica</Text>
            </View>
            <ScrollView contentContainerStyle={styles.sheetBody}>
              <Image source={MICA_ORB_IMAGE} style={[styles.orb, { resizeMode: 'contain', alignSelf: 'center', marginTop: spacing.xl }]} />
              <Text style={[styles.sheetTitle, { color: c.text, marginTop: spacing.md, textAlign: 'center' }]}>Mica</Text>
              <Text style={[styles.sheetSubtitle, { color: c.muted, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.lg }]}>
                Your assistant inside Meticle Care.
              </Text>
              <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, padding: spacing.md, borderRadius: radii.lg, elevation: 2 }]}>
                <Text style={[styles.cardTitle, { color: c.text }]}>Mica is open</Text>
                <Text style={[styles.cardSubtitle, { color: c.muted }]}>
                  Mica is ready to help you with your care work. This is the Mica conversation surface.
                </Text>
              </View>
              <Pressable onPress={onCloseSheet} style={[styles.closeButton, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }]}>
                <Text style={[styles.closeButtonLabel, { color: c.primary }]}>Close Mica</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingBottom: 80 },
  body: { padding: spacing.md, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1 },
  back: { flexDirection: 'row', alignItems: 'center', padding: spacing.xs, borderRadius: radii.sm },
  hero: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.md },
  orb: { width: 120, height: 120, ...shadows.lg, marginBottom: spacing.md },
  title: { fontSize: 24, fontWeight: '700', color: '#17202A', marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: '#667085', lineHeight: 20, textAlign: 'center', marginBottom: spacing.xs },
  section: { paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderTopWidth: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#667085', textTransform: 'uppercase', marginBottom: spacing.sm, letterSpacing: 0.4 },
  openButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radii.md, borderWidth: 1 },
  openButtonLabel: { flex: 1, fontSize: 15, fontWeight: '600', marginLeft: spacing.sm },
  footnote: { fontSize: 13, color: '#98A2B3', textAlign: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
  modal: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: '#00000040' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', padding: spacing.md, paddingBottom: spacing.xxl },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1 },
  sheetBody: { padding: spacing.md },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: '#17202A' },
  sheetSubtitle: { fontSize: 14, color: '#667085', lineHeight: 20, marginTop: spacing.xs, marginBottom: spacing.lg },
  card: { backgroundColor: '#FFFFFF', borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: '#E6EAF0', elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#17202A', marginBottom: spacing.xs },
  cardSubtitle: { fontSize: 14, color: '#667085', lineHeight: 20 },
  closeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: '#E6EAF0', backgroundColor: '#F7F9FC', marginTop: spacing.md },
  closeButtonLabel: { fontSize: 15, fontWeight: '600', color: '#2F80ED' },
})
