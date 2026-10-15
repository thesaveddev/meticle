/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string | null }>
}

precacheAndRoute(self.__WB_MANIFEST)
self.skipWaiting()
clientsClaim()

/**
 * Self-hosted Inter, cached the first time a page actually needs a face.
 *
 * Deliberately not in the precache manifest. `public/fonts` holds 42 files — six
 * weights across seven subsets, about 1.25 MB — because the browser chooses a
 * subset from `unicode-range` rather than downloading them all. Precaching would
 * fetch every one of them at install, on every device, for glyphs that page may
 * never contain; caching on use keeps the offline promise for the faces a device
 * genuinely renders and costs nothing for the rest.
 *
 * CacheFirst never revalidates, which is why the Inter version is part of each
 * filename: a refreshed font is a new URL, not a stale cache hit.
 */
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' && url.origin === self.location.origin && /^\/fonts\/.*\.woff2$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'inter-fonts',
    plugins: [
      // Opaque cross-origin responses are not expected here — everything is
      // same-origin — but 0 stays allowed so a font served through a proxy is
      // cached rather than dropped.
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 48, maxAgeSeconds: 365 * 24 * 60 * 60, purgeOnQuotaError: true }),
    ],
  }),
)

self.addEventListener('push', event => {
  let data: { title?: string; body?: string; url?: string; tag?: string } = {}
  try {
    data = event.data?.json() || {}
  } catch {
    data = { title: 'Meticle Care', body: event.data?.text() || 'You have a new notification.' }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Meticle Care', {
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
