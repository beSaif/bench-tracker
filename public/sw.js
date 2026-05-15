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
  let data = { title: 'Lift Tracker', body: '' }
  try { data = event.data.json() } catch { data.body = event.data?.text() ?? '' }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/apple-icon.png',
      badge: '/apple-icon.png',
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
