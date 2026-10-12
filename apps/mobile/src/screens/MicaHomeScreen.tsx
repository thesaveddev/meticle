import { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View, ScrollView, Modal } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../theme'
import { spacing, radii, shadows, mcType, mica } from '../theme'
import { MICA_IDLE_IMAGE, MICA_ORB_IMAGE } from '../components/FloatingMicaOrb'
import type { AuthSession } from '../types'

interface Props {
  navigation: {
    pop: () => void
  }
  session: AuthSession | null
  onCloseSheet: () => void
  onOpenSheet: () => void
}

/**
 * The Mica surface. It deliberately mounts no orb of its own: the screen frame
 * already mounts exactly one on every screen, and mounting a second here put two
 * floating controls on one screen — one over the other, neither obviously the
 * real one. The frame's orb keeps Mica reachable from this screen too.
 */
export function MicaHomeScreen({ navigation, onCloseSheet }: Props) {
  const { colors: c } = useTheme()
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
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
  title: { fontSize: 24, fontWeight: '700', color: '#0C1B2E', marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: '#51637A', lineHeight: 20, textAlign: 'center', marginBottom: spacing.xs },
  section: { paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderTopWidth: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#51637A', textTransform: 'uppercase', marginBottom: spacing.sm, letterSpacing: 0.4 },
  openButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radii.md, borderWidth: 1 },
  openButtonLabel: { flex: 1, fontSize: 15, fontWeight: '600', marginLeft: spacing.sm },
  footnote: { fontSize: 13, color: '#5D6E85', textAlign: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
  modal: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: '#00000040' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', padding: spacing.md, paddingBottom: spacing.xxl },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1 },
  sheetBody: { padding: spacing.md },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: '#0C1B2E' },
  sheetSubtitle: { fontSize: 14, color: '#51637A', lineHeight: 20, marginTop: spacing.xs, marginBottom: spacing.lg },
  card: { backgroundColor: '#FFFFFF', borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: '#E3E9F0', elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0C1B2E', marginBottom: spacing.xs },
  cardSubtitle: { fontSize: 14, color: '#51637A', lineHeight: 20 },
  closeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: '#E3E9F0', backgroundColor: '#F4F9FC', marginTop: spacing.md },
  closeButtonLabel: { fontSize: 15, fontWeight: '600', color: '#0164C8' },
})
