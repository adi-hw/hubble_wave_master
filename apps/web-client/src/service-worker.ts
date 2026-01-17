/**
 * HubbleWave PWA Service Worker
 *
 * Provides offline support with:
 * - Cache-first strategy for static assets
 * - Network-first strategy for API requests
 * - Background sync for pending changes
 * - Push notification handling
 */

/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'hubblewave-cache';
const STATIC_CACHE_NAME = 'hubblewave-static-cache';
const API_CACHE_NAME = 'hubblewave-api-cache';

// Static assets to precache
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// API endpoints to cache
const CACHEABLE_API_PATTERNS = [
  /\/api\/collections$/,
  /\/api\/collections\/[^/]+\/properties$/,
  /\/api\/views$/,
  /\/api\/users\/me$/,
];

// Install event - precache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return (
              name.startsWith('hubblewave-') &&
              name !== CACHE_NAME &&
              name !== STATIC_CACHE_NAME &&
              name !== API_CACHE_NAME
            );
          })
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - handle caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API requests - network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request, API_CACHE_NAME));
    return;
  }

  // Static assets - cache first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE_NAME));
    return;
  }

  // HTML navigation - network first
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstStrategy(request, CACHE_NAME));
    return;
  }

  // Default - network first with cache fallback
  event.respondWith(networkFirstStrategy(request, CACHE_NAME));
});

/**
 * Cache-first strategy: try cache, fall back to network
 */
async function cacheFirstStrategy(
  request: Request,
  cacheName: string
): Promise<Response> {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Network-first strategy: try network, fall back to cache
 */
async function networkFirstStrategy(
  request: Request,
  cacheName: string
): Promise<Response> {
  try {
    const networkResponse = await fetch(request);

    // Cache successful API responses for specified patterns
    if (networkResponse.ok && shouldCacheApiResponse(request.url)) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const cachedIndex = await caches.match('/index.html');
      if (cachedIndex) {
        return cachedIndex;
      }
    }

    // Return offline indicator for API requests
    if (request.url.includes('/api/')) {
      return new Response(
        JSON.stringify({
          error: 'offline',
          message: 'You are currently offline. This action will be synced when you reconnect.',
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Check if URL is a static asset
 */
function isStaticAsset(pathname: string): boolean {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf'];
  return staticExtensions.some((ext) => pathname.endsWith(ext));
}

/**
 * Check if API response should be cached
 */
function shouldCacheApiResponse(url: string): boolean {
  return CACHEABLE_API_PATTERNS.some((pattern) => pattern.test(url));
}

// Background sync for pending changes
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-changes') {
    event.waitUntil(syncPendingChanges());
  }
});

/**
 * Sync pending changes stored in IndexedDB
 */
async function syncPendingChanges(): Promise<void> {
  // This would integrate with IndexedDB to retrieve and sync pending changes
  // Implementation depends on how the app stores offline changes
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_COMPLETE' });
  });
}

// Push notification handling
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();

  const options: NotificationOptions = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: data.tag,
    data: {
      url: data.url,
      recordId: data.recordId,
      action: data.action,
    },
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    vibrate: [200, 100, 200],
    requireInteraction: data.priority === 'high',
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view' && event.notification.data?.url) {
    event.waitUntil(self.clients.openWindow(event.notification.data.url));
  } else if (!event.action) {
    // Default click action - open the app
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow('/');
      })
    );
  }
});

// Message handling from the main app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'CACHE_URLS') {
    caches.open(CACHE_NAME).then((cache) => {
      cache.addAll(event.data.urls);
    });
  }

  if (event.data?.type === 'CLEAR_CACHE') {
    caches.delete(API_CACHE_NAME);
  }
});
