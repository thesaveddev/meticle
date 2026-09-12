import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'

export async function hapticLight() {
  if (Platform.OS === 'ios') {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  } else {
    await Haptics.selectionAsync()
  }
}

export async function hapticMedium() {
  if (Platform.OS === 'ios') {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  } else {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
  }
}

export async function hapticHeavy() {
  if (Platform.OS === 'ios') {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
  } else {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  }
}

export async function hapticSuccess() {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
}

export async function hapticWarning() {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
}

export async function hapticError() {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
}

export async function hapticSelection() {
  await Haptics.selectionAsync()
}
