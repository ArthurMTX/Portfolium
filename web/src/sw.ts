/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

declare let self: ServiceWorkerGlobalScope;

// Take control immediately
self.skipWaiting();
clientsClaim();

// Clean up old caches
cleanupOutdatedCaches();

// Precache assets from the build - vite-plugin-pwa will inject the manifest here
// In dev mode, __WB_MANIFEST may not be defined, so we use a try-catch
try {
  // @ts-expect-error __WB_MANIFEST is injected by workbox at build time
  if (typeof self.__WB_MANIFEST !== 'undefined') {
    // @ts-expect-error __WB_MANIFEST is injected by workbox at build time
    precacheAndRoute(self.__WB_MANIFEST);
  }
} catch {
  console.log('[Service Worker] No precache manifest available (dev mode)');
}

console.log('[Service Worker] Portfolium service worker loaded v2 with push support');

interface PushData {
  title?: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  data?: Record<string, unknown>;
}

self.addEventListener('push', (event: PushEvent) => {
  console.log('[Service Worker] Push event received!', event);

  let data: PushData = {
    title: 'Portfolium',
    body: 'You have a new notification',
    icon: '/web-app-manifest-192x192.png',
    badge: '/favicon.ico',
    url: '/notifications',
  };

  if (event.data) {
    try {
      const payload = event.data.json() as PushData;
      console.log('[Service Worker] Push payload:', payload);
      data = { ...data, ...payload };
    } catch {
      // If not JSON, use the text as the body
      const text = event.data.text();
      console.log('[Service Worker] Push text:', text);
      if (text) {
        data.body = text;
      }
    }
  } else {
    console.log('[Service Worker] Push event has no data (DevTools test)');
    data.body = 'Test notification from DevTools';
  }

  const options: NotificationOptions = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag || 'portfolium-notification',
    requireInteraction: false,
    silent: false,
    data: {
      url: data.url || '/notifications',
      ...data.data,
    },
  };

  console.log('[Service Worker] Showing notification:', data.title, options);

  const notificationPromise = self.registration.showNotification(
    data.title || 'Portfolium',
    options
  );

  event.waitUntil(notificationPromise);
});

// Handle notification click
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  console.log('[Service Worker] Notification clicked');

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Get the URL from notification data
  const url = (event.notification.data?.url as string) || '/notifications';

  // Focus or open the app at the notification URL
  const urlToOpen = new URL(url, self.location.origin).href;

  const promiseChain = self.clients
    .matchAll({
      type: 'window',
      includeUncontrolled: true,
    })
    .then((windowClients) => {
      // Check if there's already a window open
      for (const client of windowClients) {
        if ('focus' in client) {
          // Navigate existing client to the URL
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // No window found, open a new one
      return self.clients.openWindow(urlToOpen);
    });

  event.waitUntil(promiseChain);
});

// Handle notification close (for analytics if needed)
self.addEventListener('notificationclose', (event: NotificationEvent) => {
  console.log('[Service Worker] Notification closed', event.notification.tag);
});

// Handle push subscription change (browser may refresh the subscription)
self.addEventListener('pushsubscriptionchange', (event: Event) => {
  console.log('[Service Worker] Push subscription changed');
  
  const pushEvent = event as unknown as { oldSubscription: PushSubscription | null; newSubscription: PushSubscription | null; waitUntil: (promise: Promise<unknown>) => void };
  
  // Re-subscribe with the new subscription
  const resubscribe = async () => {
    try {
      // Get the new subscription if available, or create a new one
      const subscription = pushEvent.newSubscription || 
        await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          // The applicationServerKey should be stored and reused
          // This is a fallback - the app should handle this on the client side
        });

      if (subscription) {
        // Send the new subscription to the server
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
              auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))),
            },
          }),
        });
      }
    } catch (error) {
      console.error('[Service Worker] Failed to re-subscribe:', error);
    }
  };

  pushEvent.waitUntil(resubscribe());
});

console.log('[Service Worker] Portfolium service worker loaded');
