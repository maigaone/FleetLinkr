// Service Worker Configuration
const VERSION = 'v1.0.3';
const CACHE_NAME = `FleetLinkr-cache-${VERSION}`;
const API_CACHE_NAME = `FleetLinkr-api-cache-${VERSION}`;
const OFFLINE_URL = '/offline.html';
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

// Core Assets to Cache Immediately
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/assets/css/styles.css',
  '/assets/images/logo-new.png',
  '/assets/js/mobile-menu.js',
  '/manifest.json',
  '/offline.html',
  
  // Critical pages
  '/contact.html',
  '/drivers.html',
  '/dealerships.html',
  '/garages.html',
  '/insurance.html',
  '/sell-vehicle.html',
  '/view-listings.html',
  '/yellow-garages.html',
  '/thank-you.html',
  
  // Essential icons
  '/assets/icons/android-chrome-192x192.png',
  '/assets/icons/android-chrome-512x512.png',
  '/assets/icons/favicon.ico'
];

// ========== INSTALL EVENT ==========
self.addEventListener('install', (event) => {
  console.log(`Service Worker installing (${VERSION})`);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        console.log('Caching core assets');
        const cachePromises = CORE_ASSETS.map(async (asset) => {
          try {
            await cache.add(asset);
            console.log(`Cached: ${asset}`);
          } catch (error) {
            console.error(`Failed to cache ${asset}:`, error);
          }
        });
        await Promise.all(cachePromises);
      })
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('Service Worker installation failed:', error);
      })
  );
});

// ========== ACTIVATE EVENT ==========
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          // Delete old caches that don't match current version
          if (![CACHE_NAME, API_CACHE_NAME].includes(cache)) {
            console.log('Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
    .then(() => self.clients.claim())
    .then(() => enforceCacheSizeLimit(CACHE_NAME))
    .then(() => {
      // Set up periodic cache cleanup
      setInterval(() => {
        enforceCacheSizeLimit(CACHE_NAME);
        enforceCacheSizeLimit(API_CACHE_NAME);
      }, CLEANUP_INTERVAL);
    })
  );
});

// ========== FETCH EVENT ==========
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET requests and internal requests
  if (request.method !== 'GET' || 
      request.url.startsWith('chrome-extension://') ||
      request.url.includes('sockjs-node')) {
    return;
  }

  // API requests strategy
  if (isApiRequest(request)) {
    event.respondWith(apiFirstStrategy(request));
    return;
  }

  // Image-specific strategy
  if (request.destination === 'image') {
    event.respondWith(imageCacheStrategy(request));
    return;
  }

  // Default static assets strategy
  event.respondWith(assetFirstStrategy(request));
});

function isApiRequest(request) {
  return request.url.includes('/api/') || 
         request.url.includes('/storage/') || 
         request.url.includes('/rest/');
}

async function imageCacheStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  // Return cached image if available
  if (cached) return cached;
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Return placeholder image if fetch fails
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="#eee"/><text x="50" y="50" font-size="8" text-anchor="middle" fill="#aaa">Image not available</text></svg>', 
      { headers: { 'Content-Type': 'image/svg+xml' }}
    );
  }
}

async function apiFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || Response.error();
  }
}

async function assetFirstStrategy(request) {
  try {
    // Return from cache if available
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    
    // Otherwise fetch from network
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Fallback for navigation requests
    if (request.headers.get('accept').includes('text/html')) {
      return caches.match(OFFLINE_URL);
    }
    return Response.error();
  }
}

// ========== BACKGROUND SYNC ==========
self.addEventListener('sync', (event) => {
  if (event.tag === 'submit-form') {
    console.log('Background sync for failed submissions');
    event.waitUntil(
      retryFailedSubmissions()
        .catch(error => console.error('Sync failed:', error))
    );
  }
});

async function retryFailedSubmissions() {
  const cache = await caches.open('failed-submissions');
  const requests = await cache.keys();
  
  for (const request of requests) {
    let retryCount = 0;
    let success = false;
    
    while (retryCount < MAX_RETRIES && !success) {
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.delete(request);
          success = true;
          console.log('Submission retry succeeded');
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

// ========== PUSH NOTIFICATIONS ==========
self.addEventListener('push', (event) => {
  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'New Update',
      body: 'There are new updates available!',
      url: '/'
    };
  }

  const options = {
    body: data.body,
    icon: '/assets/icons/android-chrome-192x192.png',
    badge: '/assets/icons/favicon-32x32.png',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(clientList => {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        return clients.openWindow(event.notification.data.url);
      })
  );
});

// ========== CACHE MANAGEMENT ==========
async function enforceCacheSizeLimit(cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    let size = 0;
    const resources = [];
    
    // Calculate total cache size
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        const resourceSize = blob.size;
        resources.push({
          request,
          size: resourceSize,
          lastUsed: response.headers.get('date') || new Date().toISOString()
        });
        size += resourceSize;
      }
    }
    
    // If over limit, delete oldest resources first
    if (size > MAX_CACHE_SIZE) {
      console.log(`Cache exceeds limit (${bytesToSize(size)}), cleaning...`);
      
      // Sort by last used (oldest first)
      resources.sort((a, b) => new Date(a.lastUsed) - new Date(b.lastUsed));
      
      let deletedSize = 0;
      for (const resource of resources) {
        if (size - deletedSize <= MAX_CACHE_SIZE * 0.9) break; // Stop at 90% of limit
        
        await cache.delete(resource.request);
        deletedSize += resource.size;
        console.log(`Deleted: ${resource.request.url} (${bytesToSize(resource.size)})`);
      }
      
      console.log(`Freed ${bytesToSize(deletedSize)} of cache`);
    }
  } catch (error) {
    console.error('Cache cleanup failed:', error);
  }
}

function bytesToSize(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Byte';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

// ========== MESSAGE HANDLER ==========
self.addEventListener('message', (event) => {
  if (event.data.action === 'UPDATE_CACHE') {
    caches.open(CACHE_NAME)
      .then(cache => {
        const cachePromises = CORE_ASSETS.map(async (asset) => {
          try {
            await cache.add(asset);
          } catch (error) {
            console.error(`Failed to update ${asset}:`, error);
          }
        });
        return Promise.all(cachePromises);
      })
      .catch(console.error);
  }
  
  if (event.data.action === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME)
      .then(() => console.log('Cache cleared'))
      .catch(console.error);
  }
});