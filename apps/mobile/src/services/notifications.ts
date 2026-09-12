import { Platform } from 'react-native'
import type { HomecareVisit } from '../types'

// Lazy-load expo-notifications to avoid remote push initialization on Android.
// We only use local scheduled notifications, never remote push.
let Notifications: typeof import('expo-notifications') | null = null

async function getNotifications() {
  if (Notifications) return Notifications
  try {
    Notifications = await import('expo-notifications')
    // Set handler only once
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
    })
    return Notifications
  } catch {
    // expo-notifications unavailable in Expo Go on Android SDK 53+
    return null
  }
}

let permissionGranted: boolean | null = null

export async function requestReminderPermission(): Promise<boolean> {
  try {
    const N = await getNotifications()
    if (!N) return false
    const current = await N.getPermissionsAsync()
    if (current.status === 'granted') { permissionGranted = true; return true }
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const requested = await N.requestPermissionsAsync()
      permissionGranted = requested.status === 'granted'
      return permissionGranted
    }
    if (Platform.OS === 'ios') {
      const requested = await N.requestPermissionsAsync()
      permissionGranted = requested.status === 'granted'
      return permissionGranted
    }
    permissionGranted = true
    return true
  } catch {
    permissionGranted = false
    return false
  }
}

export async function scheduleVisitReminder(visit: HomecareVisit, minutesBefore = 30): Promise<string | null> {
  try {
    const N = await getNotifications()
    if (!N) return null
    const permitted = await requestReminderPermission()
    if (!permitted) return null
    const triggerAt = new Date(new Date(visit.scheduled_start).getTime() - minutesBefore * 60_000)
    if (triggerAt.getTime() <= Date.now()) return null
    const id = await N.scheduleNotificationAsync({
      content: { title: 'Upcoming care visit', body: `${visit.label}${visit.person_name ? ` with ${visit.person_name}` : ''} starts in ${minutesBefore} minutes.` },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: triggerAt },
    })
    return id
  } catch {
    return null
  }
}

export async function cancelAllVisitReminders() {
  try {
    const N = await getNotifications()
    if (N) await N.cancelAllScheduledNotificationsAsync()
  } catch { /* ignore */ }
}
