import * as Haptics from 'expo-haptics'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const HAPTIC_KEY = 'haptic_enabled'
let hapticEnabled = true // default on

// Load saved preference on import
AsyncStorage.getItem(HAPTIC_KEY).then((v: string | null) => {
  hapticEnabled = v === null ? true : v === 'true'
})

export async function isHapticEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(HAPTIC_KEY)
  return v === null ? true : v === 'true'
}

export async function setHapticEnabled(enabled: boolean) {
  hapticEnabled = enabled
  await AsyncStorage.setItem(HAPTIC_KEY, String(enabled))
}

async function fire(fn: () => Promise<void>) {
  if (hapticEnabled) await fn()
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
