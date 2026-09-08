// Service Worker — solo Web Push. Sin cache ni soporte offline (Vigía no lo
// necesita: ver docs/DECISIONES.md 2026-09-06, "El Service Worker es un
// archivo estático en public/, sin plugin de PWA"). Portado de Bilans
// (app/public/sw.js).

self.addEventListener('push', (event) => {
  let title = 'Vigía'
  let options = {
    body: 'Un artículo de tu lista ha cambiado de precio.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'vigia-drops',
    renotify: false,
  }

  if (event.data) {
    try {
      const payload = event.data.json()
      if (payload.title) title = payload.title
      if (payload.body) options.body = payload.body
      if (payload.icon) options.icon = payload.icon
      if (payload.tag) options.tag = payload.tag
    } catch {
      // payload no valido: se usan los valores por defecto
    }
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/')
      }
    }),
  )
})
