import api from './api'

function decodeBase64Url(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const bytes = Uint8Array.from(raw, character => character.charCodeAt(0))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

export type PushState = 'unsupported' | 'disabled' | 'subscribed' | 'available'

export async function getPushState(): Promise<PushState> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'disabled'
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  return subscription ? 'subscribed' : 'available'
}

export async function enablePushNotifications(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('This browser does not support push notifications.')
  }
  const config = await api.get<{ enabled: boolean; publicKey: string | null }>('/notifications/push/config')
  if (!config.data.enabled || !config.data.publicKey) {
    throw new Error('Push notifications are not configured for this service yet.')
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Browser notification permission was not granted.')

  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeBase64Url(config.data.publicKey),
  })
  await api.post('/notifications/push/subscribe', { subscription: subscription.toJSON() })
}

export async function disablePushNotifications(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return
  await api.post('/notifications/push/unsubscribe', { endpoint: subscription.endpoint })
  await subscription.unsubscribe()
}
