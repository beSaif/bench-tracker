const pending = new Map()

self.addEventListener('message', (event) => {
  const data = event.data ?? {}
  const { type, id, delay, title, body, icon } = data

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
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow('/')
    })
  )
})
