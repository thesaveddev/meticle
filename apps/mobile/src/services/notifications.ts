import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import type { HomecareVisit } from '../types'

// Local-only notification handler — no remote push
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
})

// Prevent expo-notifications from crashing on Android when FCM is not configured.
// We only use local scheduled notifications, never remote push.
let permissionGranted: boolean | null = null

export async function requestReminderPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync()
    if (current.status === 'granted') { permissionGranted = true; return true }
    // On Android 13+ we need POST_NOTIFICATIONS permission
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const requested = await Notifications.requestPermissionsAsync()
      permissionGranted = requested.status === 'granted'
      return permissionGranted
    }
    // On iOS, request as normal
    if (Platform.OS === 'ios') {
      const requested = await Notifications.requestPermissionsAsync()
      permissionGranted = requested.status === 'granted'
      return permissionGranted
    }
    // Older Android — permission is granted at install
    permissionGranted = true
    return true
  } catch {
    // Notification system unavailable — degrade gracefully
    permissionGranted = false
    return false
  }
}

export async function scheduleVisitReminder(visit: HomecareVisit, minutesBefore = 30): Promise<string | null> {
  try {
    const permitted = await requestReminderPermission()
    if (!permitted) return null
    const triggerAt = new Date(new Date(visit.scheduled_start).getTime() - minutesBefore * 60_000)
    if (triggerAt.getTime() <= Date.now()) return null
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: 'Upcoming care visit', body: `${visit.label}${visit.person_name ? ` with ${visit.person_name}` : ''} starts in ${minutesBefore} minutes.` },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerAt },
    })
    return id
  } catch {
    return null
  }
}

export async function cancelAllVisitReminders() {
  try { await Notifications.cancelAllScheduledNotificationsAsync() } catch { /* ignore */ }
}
