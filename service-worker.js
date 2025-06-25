// Service Worker Version
const CACHE_VERSION = 'v3'; // Incremented version
const CACHE_NAME = `FleetLinkr-cache-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html'; // Add an offline fallback page

// Core Assets for Offline Functionality
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/drivers.html',
  '/dealerships.html',
  '/garages.html',
  '/view-listings.html',
  '/assets/css/styles.css',
  '/assets/images/logo-new.png',
  '/assets/images/favicon.png',
  '/manifest.json',
  OFFLINE_URL // Include offline page in core assets
];

// Install Event - Cache Core Assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching core assets');
        return cache.addAll(CORE_ASSETS)
          .catch(error => {
            console.error('Failed to cache some assets:', error);
            // Continue even if some assets fail to cache
            return Promise.resolve();
          });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Clean Up Old Caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME && cache.startsWith('FleetLinkr-cache')) {
            console.log('Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
    .then(() => self.clients.claim())
  );
});

// Improved Fetch Handler with better error handling
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || request.url.startsWith('chrome-extension://')) {
    return;
  }

  // Handle API requests with network-first strategy
  if (request.url.includes('/api/') || request.url.includes('/storage/') || request.url.includes('/rest/')) {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          // Only cache successful responses
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(request, responseClone))
              .catch(err => console.error('Failed to cache API response:', err));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // For all other requests, use cache-first with network fallback
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        // Return cached response if available
        if (cachedResponse) {
          return cachedResponse;
        }

        // Otherwise fetch from network
        return fetch(request)
          .then(networkResponse => {
            // Only cache successful responses
            if (networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(request, responseClone))
                .catch(err => console.error('Failed to cache response:', err));
            }
            return networkResponse;
          })
          .catch(async () => {
            // Special handling for HTML pages
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match(OFFLINE_URL);
            }
            // Return empty response for other failed requests
            return Response.error();
          });
      })
  );
});

// Background Sync with retry logic
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

self.addEventListener('sync', (event) => {
  if (event.tag === 'submit-form') {
    console.log('Background sync for failed form submissions');
    event.waitUntil(
      retryFailedSubmissions()
        .catch(error => console.error('Background sync failed:', error))
    );
  }
});

async function retryFailedSubmissions() {
  const cache = await caches.open('failed-submissions');
  const keys = await cache.keys();
  
  for (const request of keys) {
    let retryCount = 0;
    let success = false;
    
    while (retryCount < MAX_RETRIES && !success) {
      try {
        const formData = await request.json();
        const response = await fetch(request.url, {
          method: 'POST',
          body: JSON.stringify(formData),
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          await cache.delete(request);
          success = true;
          console.log('Form submission retry succeeded');
        }
      } catch (error) {
        console.error(`Retry ${retryCount + 1} failed:`, error);
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
      }
    }
  }
}

// Push Notification with better error handling
self.addEventListener('push', (event) => {
  let data;
  try {
    data = event.data.json();
  } catch (e) {
    console.error('Failed to parse push data:', e);
    data = {
      title: 'New Update',
      body: 'There are new updates available!',
      url: '/'
    };
  }

  const options = {
    body: data.body,
    icon: '/assets/images/logo-new.png',
    badge: '/assets/images/favicon.png',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200] // Vibration pattern
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .catch(error => console.error('Failed to show notification:', error))
  );
});

// Notification click handler with fallback
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow(event.notification.data.url);
    })
  );
});

// Periodically clean up old caches
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cleanup-caches') {
    event.waitUntil(cleanupOldCaches());
  }
});

async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  const currentCache = cacheNames.find(name => name === CACHE_NAME);
  
  if (!currentCache) return;
  
  const cache = await caches.open(currentCache);
  const requests = await cache.keys();
  const now = Date.now();
  
  for (const request of requests) {
    const response = await cache.match(request);
    if (!response) continue;
    
    const date = response.headers.get('date');
    if (date && (now - new Date(date).getTime() > 30 * 24 * 60 * 60 * 1000)) {
      await cache.delete(request);
    }
  }
}