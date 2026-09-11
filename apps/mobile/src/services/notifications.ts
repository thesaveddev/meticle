import * as Notifications from 'expo-notifications'
import type { HomecareVisit } from '../types'

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
})

export async function requestReminderPermission() {
  const current = await Notifications.getPermissionsAsync()
  if (current.status === 'granted') return true
  const requested = await Notifications.requestPermissionsAsync()
  return requested.status === 'granted'
}

export async function scheduleVisitReminder(visit: HomecareVisit, minutesBefore = 30) {
  const permitted = await requestReminderPermission()
  if (!permitted) return null
  const triggerAt = new Date(new Date(visit.scheduled_start).getTime() - minutesBefore * 60_000)
  if (triggerAt.getTime() <= Date.now()) return null
  return Notifications.scheduleNotificationAsync({
    content: { title: 'Upcoming care visit', body: `${visit.label}${visit.person_name ? ` with ${visit.person_name}` : ''} starts in ${minutesBefore} minutes.` },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerAt },
  })
}

export async function cancelAllVisitReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync()
}
