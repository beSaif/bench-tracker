const pending = new Map()

// Take control of the page immediately on first install — no reload required
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

self.addEventListener('message', (event) => {
  const data = event.data ?? {}
  const { type, id, delay, title, body, icon, url } = data

  if (type === 'SCHEDULE') {
    // Cancel any existing timer for this id
    if (pending.has(id)) {
      const entry = pending.get(id)
      clearTimeout(entry.timeoutId)
      entry.resolve()
      pending.delete(id)
    }

    let resolve
    const promise = new Promise((r) => { resolve = r })
    // Keep the SW alive until the notification fires or is cancelled
    event.waitUntil(promise)

    const timeoutId = setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon,
        badge: icon,
        vibrate: [300, 100, 300],
        tag: id,
        data: { url: url ?? '/' },
      })
      resolve()
      pending.delete(id)
    }, delay)

    pending.set(id, { timeoutId, resolve })
  }

  if (type === 'CANCEL') {
    if (pending.has(id)) {
      const entry = pending.get(id)
      clearTimeout(entry.timeoutId)
      entry.resolve()
      pending.delete(id)
    }
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.navigate(url).then(() => client.focus())
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

self.addEventListener('push', (event) => {
  let data = { title: 'Workout', body: '' }
  try { data = event.data.json() } catch { data.body = event.data?.text() ?? '' }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/apple-icon',
      badge: '/apple-icon',
      tag: data.tag ?? 'lift-push',
      vibrate: [200, 100, 200],
      data: { url: data.url ?? '/gymbros' },
    })
  )
})

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: event.oldSubscription?.options.applicationServerKey,
      })
      .then((sub) =>
        fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub),
        })
      )
  )
})

// Chrome only treats a site as installable once its service worker handles fetch,
// so without this the `beforeinstallprompt` event never fires and no native install
// dialog is ever offered. Network-first on document loads, with the last successful
// copy of the page kept as an offline fallback — gyms have bad signal.
const PAGE_CACHE = 'lift-pages-v1'
// A cached page is useless offline without the scripts and styles it loads: it would
// paint and never hydrate. Next's build assets are content-hashed, so they are served
// cache-first and never go stale; the cap keeps old deploys' files from piling up.
const STATIC_CACHE = 'lift-static-v1'
const STATIC_CACHE_MAX = 300

// Set by the registrar in production builds only (see SwRegistrar).
const CACHE_STATIC = new URL(self.location.href).searchParams.get('static') === '1'

function isStaticAsset(url) {
  return CACHE_STATIC && url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')
}

async function trimCache(name, max) {
  const cache = await caches.open(name)
  const keys = await cache.keys()
  // Insertion order, so the oldest go first.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)))
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  if (isStaticAsset(new URL(request.url))) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              event.waitUntil(
                caches
                  .open(STATIC_CACHE)
                  .then((cache) => cache.put(request, copy))
                  .then(() => trimCache(STATIC_CACHE, STATIC_CACHE_MAX))
                  .catch(() => {})
              )
            }
            return response
          })
      )
    )
    return
  }

  // Otherwise only full page loads. API calls and client-side navigations stay
  // untouched so nothing here can serve a stale session or swallow a write.
  if (request.mode !== 'navigate') return

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          event.waitUntil(
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
          )
        }
        return response
      })
      .catch(() =>
        caches
          .match(request)
          .then((cached) => cached ?? caches.match('/'))
          .then((cached) => cached ?? Response.error())
      )
  )
})
