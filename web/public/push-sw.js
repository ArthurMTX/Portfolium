// Minimal service worker for push notifications
// This file is registered manually when the vite-plugin-pwa service worker doesn't support push

self.addEventListener('push', (event) => {
  console.log('[Push SW] Push notification received');
  
  let data = {
    title: 'Portfolium',
    body: 'You have a new notification',
    icon: '/web-app-manifest-192x192.png',
    badge: '/favicon.ico',
    url: '/notifications',
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Portfolium', {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag || 'portfolium-notification',
      data: { url: data.url || '/notifications' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[Push SW] Notification clicked');
  event.notification.close();
  
  const url = event.notification.data?.url || '/notifications';
  event.waitUntil(clients.openWindow(url));
});

console.log('[Push SW] Push service worker loaded');
