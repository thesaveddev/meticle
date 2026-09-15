import * as Haptics from 'expo-haptics'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const HAPTIC_KEY = 'haptic_enabled'
let hapticEnabled = true // default on

// Load saved preference on import. A storage failure (or a device where
// AsyncStorage's native module is unavailable) must not break app startup.
AsyncStorage.getItem(HAPTIC_KEY)
  .then((v: string | null) => {
    hapticEnabled = v === null ? true : v === 'true'
  })
  .catch(() => {})

export async function isHapticEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(HAPTIC_KEY)
    return v === null ? true : v === 'true'
  } catch {
    return true // default on when the preference cannot be read
  }
}

export async function setHapticEnabled(enabled: boolean) {
  hapticEnabled = enabled
  try {
    await AsyncStorage.setItem(HAPTIC_KEY, String(enabled))
  } catch {
    // The preference still applies for this session even if it cannot be saved.
  }
}

/**
 * Haptics are cosmetic, so they must never be able to break a screen.
 *
 * Callers fire these without awaiting (`hapticLight(); onPress()`), and
 * expo-haptics rejects whenever the native module is missing — e.g. on a
 * development build created before expo-haptics was added, or on web — with
 * "The method or property Haptic.impactAsync is not available". An unawaited
 * rejection like that surfaced as an unhandled-rejection error naming the
 * screen that triggered it. Swallow every failure instead.
 */
async function fire(fn: () => Promise<void>) {
  if (!hapticEnabled) return
  try {
    await fn()
  } catch {
    // Haptics unavailable on this build/device: degrade to a silent no-op.
  }
}

export async function hapticLight() {
  await fire(() => {
    if (Platform.OS === 'ios') return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    return Haptics.selectionAsync()
  })
}

export async function hapticMedium() {
  await fire(() => {
    if (Platform.OS === 'ios') return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
  })
}

export async function hapticHeavy() {
  await fire(() => {
    if (Platform.OS === 'ios') return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  })
}

export async function hapticSuccess() {
  await fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))
}

export async function hapticWarning() {
  await fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning))
}

export async function hapticError() {
  await fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error))
}

export async function hapticSelection() {
  await fire(() => Haptics.selectionAsync())
}
