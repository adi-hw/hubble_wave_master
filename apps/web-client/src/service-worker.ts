/**
 * HubbleWave PWA Service Worker
 *
 * Source-of-truth service worker, compiled by VitePWA's `injectManifest`
 * strategy. Combines workbox-managed precache + runtime caching with the
 * platform's auth-aware cache gating, notification URL validation, and
 * CLEAR_USER_CACHE handler.
 *
 * Caching strategies:
 * - Precache: every asset emitted by the build (JS/CSS/HTML/icons/fonts).
 * - /api/(identity|data|metadata)/: NetworkFirst, 5 min, cache only when an
 *   Authorization header was on the request — anonymous responses must never
 *   be cached on a per-user disk.
 * - Image extensions: CacheFirst, 30 days.
 * - Font extensions: CacheFirst, 1 year.
 */

/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

const API_CACHE_NAME = 'hubblewave-api-cache';
const LOCAL_API_CACHE_NAME = 'hubblewave-local-api-cache';
const IMAGES_CACHE_NAME = 'hubblewave-images-cache';
const FONTS_CACHE_NAME = 'hubblewave-fonts-cache';

// Workbox-injected precache list. Populated at build time by VitePWA from
// `injectManifest.globPatterns`.
precacheAndRoute(self.__WB_MANIFEST ?? []);
cleanupOutdatedCaches();

/**
 * NetworkFirst for instance APIs. Only caches a response when the originating
 * request carried an Authorization header — otherwise the response is either
 * anonymous or unauthenticated and persisting it would let a logged-out user
 * read prior content. The session logout flow additionally posts
 * CLEAR_USER_CACHE to wipe any residue.
 */
const authGatedCachePlugin = {
  cacheWillUpdate: async ({
    request,
    response,
  }: {
    request: Request;
    response: Response;
  }) => {
    if (!response || !response.ok) return null;
    if (!request.headers.has('Authorization')) return null;
    return response;
  },
};

registerRoute(
  ({ url }) => /\/api\/(identity|data|metadata)\//i.test(url.pathname),
  new NetworkFirst({
    cacheName: LOCAL_API_CACHE_NAME,
    networkTimeoutSeconds: 10,
    plugins: [
      authGatedCachePlugin,
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 5, // 5 minutes
      }),
    ],
  }),
  'GET',
);

registerRoute(
  ({ url }) => /\.(png|jpg|jpeg|svg|gif|webp)$/i.test(url.pathname),
  new CacheFirst({
    cacheName: IMAGES_CACHE_NAME,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
    ],
  }),
  'GET',
);

registerRoute(
  ({ url }) => /\.(woff|woff2|ttf|eot)$/i.test(url.pathname),
  new CacheFirst({
    cacheName: FONTS_CACHE_NAME,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
    ],
  }),
  'GET',
);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Background sync for pending changes
self.addEventListener('sync', (event: Event) => {
  const syncEvent = event as Event & { tag: string; waitUntil(p: Promise<unknown>): void };
  if (syncEvent.tag === 'sync-pending-changes') {
    syncEvent.waitUntil(syncPendingChanges());
  }
});

/**
 * Sync pending changes stored in IndexedDB. Notifies open clients so the
 * application layer can drain its queue.
 */
async function syncPendingChanges(): Promise<void> {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_COMPLETE' });
  });
}

/**
 * Validate notification target URLs before opening them. Mirrors the
 * validateInternalUrl policy in src/lib/safe-navigate.ts so push payloads
 * cannot redirect users to attacker-controlled origins.
 */
function isSafeInternalNotificationUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.includes('\\') || trimmed.includes('\0') || trimmed.includes('..')) return false;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.hostname === self.location.hostname;
    } catch {
      return false;
    }
  }
  if (!trimmed.startsWith('/')) return false;
  if (trimmed.startsWith('//')) return false;
  return true;
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
  } as NotificationOptions;

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view' && event.notification.data?.url) {
    const targetUrl = event.notification.data.url;
    if (isSafeInternalNotificationUrl(targetUrl)) {
      event.waitUntil(self.clients.openWindow(targetUrl));
    } else {
      // Refuse to follow notification payloads that point off-origin or
      // contain traversal markers — open the app root instead.
      event.waitUntil(self.clients.openWindow('/'));
    }
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

  if (event.data?.type === 'CLEAR_CACHE') {
    caches.delete(API_CACHE_NAME);
    caches.delete(LOCAL_API_CACHE_NAME);
  }

  // CLEAR_USER_CACHE is dispatched by the auth logout flow before local state
  // is wiped. It removes any per-user API responses cached by the SW so the
  // next session cannot read prior data from disk.
  if (event.data?.type === 'CLEAR_USER_CACHE') {
    event.waitUntil(
      Promise.all([
        caches.delete(API_CACHE_NAME),
        caches.delete(LOCAL_API_CACHE_NAME),
      ])
    );
  }
});
