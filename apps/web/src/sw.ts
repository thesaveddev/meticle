/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string | null }>
}

precacheAndRoute(self.__WB_MANIFEST)
self.skipWaiting()
clientsClaim()

self.addEventListener('push', event => {
  let data: { title?: string; body?: string; url?: string; tag?: string } = {}
  try {
    data = event.data?.json() || {}
  } catch {
    data = { title: 'MeticleCare', body: event.data?.text() || 'You have a new notification.' }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'MeticleCare', {
      body: data.body || 'You have a new notification.',
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      tag: data.tag || 'meticle-notification',
      data: { url: data.url || '/dashboard' },
      requireInteraction: false,
    }),
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url || '/dashboard', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const existing = clientList.find(client => 'focus' in client && client.url.startsWith(self.location.origin))
      if (existing && 'navigate' in existing) {
        return existing.navigate(targetUrl).then(client => client?.focus())
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})
