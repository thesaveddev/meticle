import { useState } from 'react'
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, elevation, radii, spacing, FONT, useAppColors } from '../theme'
import { detectMapApps, openMapApp, type MapApp } from '../services/navigation'
import { hapticLight } from '../services/haptics'
import { Ionicons } from '@expo/vector-icons'

interface Props {
  visible: boolean
  onClose: () => void
  destination?: string
  latitude?: number
  longitude?: number
  label?: string
}

/** Branded icon config for each map app */
const APP_BRAND: Record<string, { bg: string; icon: keyof typeof Ionicons.glyphMap; iconColor: string }> = {
  apple: { bg: '#007AFF', icon: 'location', iconColor: '#FFFFFF' },
  google: { bg: '#FFFFFF', icon: 'logo-google', iconColor: '#4285F4' },
  waze: { bg: '#33CCFF', icon: 'chatbubble-ellipses', iconColor: '#FFFFFF' },
  here: { bg: '#48DAD0', icon: 'navigate', iconColor: '#FFFFFF' },
  mapfactor: { bg: '#FF6B35', icon: 'compass', iconColor: '#FFFFFF' },
  web: { bg: '#F3F4F6', icon: 'globe-outline', iconColor: '#6B7280' },
}

function MapAppIcon({ appId }: { appId: string }) {
  const brand = APP_BRAND[appId] || APP_BRAND.web
  return (
    <View style={[mapStyles.iconCircle, { backgroundColor: brand.bg }]}>
      <Ionicons name={brand.icon} size={20} color={brand.iconColor} />
    </View>
  )
}

export function MapPickerModal({ visible, onClose, destination, latitude, longitude, label }: Props) {
  const c = useAppColors()
  const [apps, setApps] = useState<MapApp[]>([])
  const [loading, setLoading] = useState(false)

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

  if (visible && apps.length === 0 && !loading) {
    detectApps()
  }

  const handleSelect = async (app: MapApp) => {
    hapticLight()
    onClose()
    setTimeout(() => { openMapApp(app.url) }, 200)
    setApps([])
  }

  const handleClose = () => {
    hapticLight()
    setApps([])
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable onPress={handleClose} style={mapStyles.backdrop}>
        <Pressable>
          <View style={[mapStyles.sheet, { backgroundColor: c.surface }]}>
            <View style={[mapStyles.handle, { backgroundColor: c.border }]} />
            <Text style={[mapStyles.title, { color: c.ink }]}>Open navigation</Text>
            <Text style={[mapStyles.subtitle, { color: c.muted }]}>
              {label ? `Navigate to ${label}` : 'Choose a maps app'}
            </Text>

            {loading ? (
              <View style={mapStyles.loadingRow}>
                <Text style={[mapStyles.loadingText, { color: c.muted }]}>Detecting installed apps...</Text>
              </View>
            ) : (
              <View style={mapStyles.appList}>
                {apps.map((app) => (
                  <Pressable
                    key={app.id}
                    onPress={() => handleSelect(app)}
                    style={({ pressed }) => [[mapStyles.appRow, { backgroundColor: c.surfaceAlt }], pressed && { opacity: 0.7 }]}
                  >
                    <MapAppIcon appId={app.id} />
                    <Text style={[mapStyles.appName, { color: c.ink }]}>{app.name}</Text>
                    <Ionicons name="chevron-forward" size={18} color={c.subtle} />
                  </Pressable>
                ))}
              </View>
            )}

            <Pressable onPress={handleClose} style={mapStyles.cancelBtn}>
              <Text style={[mapStyles.cancelText, { color: c.muted }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const mapStyles = StyleSheet.create({
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
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  appName: { flex: 1, fontFamily: FONT, fontSize: 15, fontWeight: '600', color: colors.ink },

  cancelBtn: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  cancelText: { fontFamily: FONT, fontSize: 14, fontWeight: '600', color: colors.muted },
})
