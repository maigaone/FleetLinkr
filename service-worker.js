// FleetLinkr Service Worker - Optimized PWA
const CACHE_VERSION = 'v2';
const CACHE_NAME = `fleetlinkr-cache-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

// Core app shell to cache on install
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/styles.css',
  '/drivers.html',
  '/dealerships.html',
  '/garages.html',
  '/yellow-garages.html',
  '/insurance.html',
  '/view-listings.html',
  '/add-listing.html',
  '/sell-vehicle.html',
  '/contact.html',
  '/privacy-policy.html',
  '/terms-of-service.html'
];

// Install: cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .catch(err => console.error('[SW] Install cache failed:', err))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('fleetlinkr-cache-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch handler: network-first for navigation, cache-first for static assets
self.addEventListener('fetch', event => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then(cached => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  const url = new URL(request.url);

  // Static assets (CSS, JS, images, manifest)
  if (
    url.origin === self.location.origin &&
    (
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.jpg') ||
      url.pathname.endsWith('.jpeg') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.ico') ||
      url.pathname.endsWith('.webmanifest') ||
      url.pathname.endsWith('.json')
    )
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        });
      })
    );
  }
});
