import { useState } from 'react'
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, elevation, radii, spacing, FONT, useAppColors } from '../theme'
import { detectMapApps, openMapApp, type MapApp } from '../services/navigation'
import { hapticLight } from '../services/haptics'

interface Props {
  visible: boolean
  onClose: () => void
  destination?: string
  latitude?: number
  longitude?: number
  label?: string
}

export function MapPickerModal({ visible, onClose, destination, latitude, longitude, label }: Props) {
  const c = useAppColors()
  const [apps, setApps] = useState<MapApp[]>([])
  const [loading, setLoading] = useState(false)

  // Detect apps when modal opens
  const detectApps = async () => {
    if (loading) return
    setLoading(true)
    try {
      const found = await detectMapApps({ destination, latitude, longitude, label })
      setApps(found)
    } catch {
      setApps([])
    } finally {
      setLoading(false)
    }
  }

  // Trigger detection when visibility changes
  if (visible && apps.length === 0 && !loading) {
    detectApps()
  }

  const handleSelect = async (app: MapApp) => {
    hapticLight()
    onClose()
    // Small delay so modal closes first
    setTimeout(() => { openMapApp(app.url) }, 200)
    // Reset for next open
    setApps([])
  }

  const handleClose = () => {
    hapticLight()
    setApps([])
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable onPress={handleClose} style={styles.backdrop}>
        <Pressable>              <View style={[styles.sheet, { backgroundColor: c.surface }]}>
            <View style={[styles.handle, { backgroundColor: c.border }]} />
            <Text style={[styles.title, { color: c.ink }]}>Open navigation</Text>
            <Text style={[styles.subtitle, { color: c.muted }]}>
              {label ? `Navigate to ${label}` : 'Choose a maps app'}
            </Text>

            {loading ? (
              <View style={styles.loadingRow}>
                <Text style={[styles.loadingText, { color: c.muted }]}>Detecting installed apps...</Text>
              </View>
            ) : (
              <View style={styles.appList}>
                {apps.map((app) => (
                  <Pressable
                    key={app.id}
                    onPress={() => handleSelect(app)}
                    style={({ pressed }) => [[styles.appRow, { backgroundColor: c.surfaceAlt }], pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.appIcon}>{app.icon}</Text>
                    <Text style={[styles.appName, { color: c.ink }]}>{app.name}</Text>
                    <Text style={[styles.appArrow, { color: c.subtle }]}>→</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Pressable onPress={handleClose} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: c.muted }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    padding: spacing.xl, paddingBottom: spacing.xxxl, ...elevation.lg,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.base },
  title: { fontFamily: FONT, fontSize: 18, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  subtitle: { fontFamily: FONT, fontSize: 13, fontWeight: '400', color: colors.muted, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.base },

  loadingRow: { paddingVertical: spacing.xl, alignItems: 'center' },
  loadingText: { fontFamily: FONT, fontSize: 13, fontWeight: '500', color: colors.muted },

  appList: { gap: spacing.xs },
  appRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.base,
    borderRadius: radii.md,
  },
  appIcon: { fontSize: 22, width: 32, textAlign: 'center' },
  appName: { flex: 1, fontFamily: FONT, fontSize: 15, fontWeight: '600', color: colors.ink },
  appArrow: { fontFamily: FONT, fontSize: 16, fontWeight: '600', color: colors.subtle },

  cancelBtn: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  cancelText: { fontFamily: FONT, fontSize: 14, fontWeight: '600', color: colors.muted },
})
