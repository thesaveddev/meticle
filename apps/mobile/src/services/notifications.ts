import { Platform } from 'react-native'
import type { HomecareVisit } from '../types'

// Lazy-load expo-notifications to avoid remote push initialization on Android SDK 53+.
let Notifications: typeof import('expo-notifications') | null = null

async function getNotifications() {
  if (Notifications) return Notifications
  try {
    Notifications = await import('expo-notifications')
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
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

/* ─── Local scheduled reminders ─────────────────────────────── */

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

/* ─── Push notification registration ─────────────────────────── */

let pushToken: string | null = null

export async function registerForPushNotifications(accessToken: string): Promise<string | null> {
  try {
    const N = await getNotifications()
    if (!N) return null

    const permitted = await requestReminderPermission()
    if (!permitted) return null

    // Get existing token
    const existingToken = await N.getExpoPushTokenAsync({
      projectId: 'meticlecare', // Update with actual project ID
    })
    pushToken = existingToken.data

    // Register with server
    const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://meticlecare.com/api'
    await fetch(`${API_BASE}/notifications/register-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        push_token: pushToken,
        platform: Platform.OS,
      }),
    }).catch(() => {})

    return pushToken
  } catch {
    return null
  }
}

/* ─── Notification listeners ─────────────────────────────────── */

type NotificationCallback = (type: string, data: any) => void

let notificationListeners: { sub: any; responseSub: any } | null = null

export async function addNotificationListeners(onNotification: NotificationCallback, onNotificationResponse: NotificationCallback) {
  const N = await getNotifications()
  if (!N) return

  // Handle notifications received while app is in foreground
  const sub = N.addNotificationReceivedListener((notification: any) => {
    const data = notification.request.content.data
    onNotification(data.type || 'unknown', data)
  })

  // Handle notification taps (when user opens the app from a notification)
  const responseSub = N.addNotificationResponseReceivedListener((response: any) => {
    const data = response.notification.request.content.data
    onNotificationResponse(data.type || 'unknown', data)
  })

  notificationListeners = { sub, responseSub }
}

export function removeNotificationListeners() {
  if (notificationListeners) {
    notificationListeners.sub?.remove()
    notificationListeners.responseSub?.remove()
    notificationListeners = null
  }
}

/* ─── Missed / Overdue / Unassigned alerts ───────────────────── */

export async function scheduleMissedCallAlert(visit: HomecareVisit) {
  try {
    const N = await getNotifications()
    if (!N) return null
    return N.scheduleNotificationAsync({
      content: {
        title: 'Missed call',
        body: `The ${visit.label} call for ${visit.person_name || 'client'} was not completed. Tap to view.`,
        data: { type: 'missed_call', visitId: visit.id },
        sound: true,
      },
      trigger: null, // immediate
    })
  } catch {
    return null
  }
}

export async function scheduleOverdueAlert(visit: HomecareVisit) {
  try {
    const N = await getNotifications()
    if (!N) return null
    return N.scheduleNotificationAsync({
      content: {
        title: 'Overdue call',
        body: `The ${visit.label} call for ${visit.person_name || 'client'} is past its scheduled time.`,
        data: { type: 'overdue_call', visitId: visit.id },
        sound: true,
      },
      trigger: null,
    })
  } catch {
    return null
  }
}

export async function scheduleUnassignedAlert() {
  try {
    const N = await getNotifications()
    if (!N) return null
    return N.scheduleNotificationAsync({
      content: {
        title: 'Unassigned calls',
        body: 'There are calls without an assigned carer. Tap to review.',
        data: { type: 'unassigned_calls' },
        sound: true,
      },
      trigger: null,
    })
  } catch {
    return null
  }
}

export async function scheduleAssignmentAlert(visitLabel: string, clientName: string) {
  try {
    const N = await getNotifications()
    if (!N) return null
    return N.scheduleNotificationAsync({
      content: {
        title: 'New call assigned',
        body: `You've been assigned the ${visitLabel} call for ${clientName}.`,
        data: { type: 'call_assigned' },
        sound: true,
      },
      trigger: null,
    })
  } catch {
    return null
  }
}
