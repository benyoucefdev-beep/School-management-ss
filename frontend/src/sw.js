import { precacheAndRoute } from 'workbox-precaching';

// Use the __WB_MANIFEST injection point for precaching
precacheAndRoute(self.__WB_MANIFEST || []);

// Force immediate activation — don't wait for old SW to die
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(self.clients.claim());
});

// ── Portal route caching ──────────────────────────────────────────
// Cache the SPA shell (index.html) for portal and supplier-portal
// routes so the installed PWA works even with poor connectivity.
const PORTAL_CACHE = 'portal-shell-v1';

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only intercept navigation requests to portal paths
  if (
    event.request.mode === 'navigate' &&
    (url.pathname.startsWith('/portal/') || url.pathname.startsWith('/supplier-portal/'))
  ) {
    event.respondWith(
      caches.open(PORTAL_CACHE).then(async (cache) => {
        try {
          // Network first — update cache with fresh response
          const response = await fetch(event.request);
          cache.put(event.request, response.clone());
          return response;
        } catch {
          // Offline — serve cached shell
          const cached = await cache.match(event.request);
          return cached || caches.match('/index.html');
        }
      })
    );
  }
});

// ── Push notifications ────────────────────────────────────────────
// Listen for push events — this fires even when app is closed
self.addEventListener('push', function (event) {
  console.log('[SW] Push received:', event.data ? 'has data' : 'no data');

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      // Fallback if payload isn't valid JSON
      data = { title: 'EduManage', body: event.data.text() || 'You have a new notification.' };
    }
  }

  const title = data.title || 'EduManage';
  const options = {
    body: data.body || 'You have a new notification.',
    icon: '/icons/logo-192.png',
    badge: '/badge-72.png',
    vibrate: [200, 100, 200, 100, 200],
    // Use unique tag per notification so Android NEVER deduplicates/suppresses them
    tag: `edumanage-${Date.now()}`,
    renotify: false,
    requireInteraction: false,
    silent: false,
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      console.log('[SW] ✅ Notification shown:', title);
      // Update badge count — use navigator directly (correct SW scope)
      try {
        if (navigator.setAppBadge) {
          navigator.setAppBadge(data.badgeCount || 1).catch(() => {});
        }
      } catch (_) {}
    }).catch((err) => {
      console.error('[SW] ❌ showNotification failed:', err);
    })
  );
});

// ── Notification click — open their exact portal URL ─────────────
self.addEventListener('notificationclick', function (event) {
  console.log('[SW] Notification clicked, url:', event.notification.data?.url);
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Clear badge
      try {
        if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
      } catch (_) {}

      // Try to focus an existing window
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if (client.navigate) client.navigate(targetUrl);
          return;
        }
      }
      // No existing window — open a new one at their portal URL
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
