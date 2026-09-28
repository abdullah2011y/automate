/**
 * ByteForge Omni-Commerce — Service Worker
 *
 * CRITICAL SECURITY ARCHITECTURE:
 * - This is an enterprise live order-management and automated WhatsApp confirmation system.
 * - STRICT RULE: Never cache customer phone numbers, orders, messages, auth tokens,
 *   or API endpoints (/api/*) in CacheStorage.
 * - All backend API and SSE/WebSocket requests bypass the cache completely (Network-Only).
 * - Navigation failures when offline serve the secure /offline.html fallback.
 */

const CACHE_NAME = 'byteforge-shell-v1';

// Static immutable shell assets to pre-cache
const STATIC_PRECACHE_URLS = [
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_PRECACHE_URLS).catch((err) => {
        console.warn('[ByteForge SW] Pre-caching static assets non-critical error:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[ByteForge SW] Purging obsolete cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. STRICT SECURITY: Never cache any API requests, SSE streams, or auth routes
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/qr-stream') ||
    event.request.method !== 'GET'
  ) {
    // Pass directly to network without service worker caching
    event.respondWith(
      fetch(event.request).catch(() => {
        // Return structured 503 response if offline during an API call
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'NETWORK_OFFLINE',
              message: 'Device is offline. Backend communication is temporarily unavailable.',
            },
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // 2. Navigation requests: Network-first with offline.html fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedOffline = await cache.match('/offline.html');
        return cachedOffline || new Response('Offline — Connection required for ByteForge', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        });
      })
    );
    return;
  }

  // 3. Static Next.js chunks, fonts, and assets: Cache-first with network fallback
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.ico' ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Default: Network with graceful catch
  event.respondWith(fetch(event.request));
});
