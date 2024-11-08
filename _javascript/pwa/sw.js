importScripts('./assets/js/data/swconf.js');

const purge = swconf.purge;
const interceptor = swconf.interceptor;

function verifyUrl(url) {
  const requestUrl = new URL(url);
  const requestPath = requestUrl.pathname;

  if (!requestUrl.protocol.startsWith('http')) {
    return false;
  }

  for (const prefix of interceptor.urlPrefixes) {
    if (requestUrl.href.startsWith(prefix)) {
      return false;
    }
  }

  for (const path of interceptor.paths) {
    if (requestPath.startsWith(path)) {
      return false;
    }
  }
  return true;
}

// Install event
self.addEventListener('install', (event) => {
  if (purge) return;

  event.waitUntil(
    caches.open(swconf.cacheName).then((cache) => cache.addAll(swconf.resources))
  );
  self.skipWaiting(); // Force this SW to activate as soon as it finishes installing
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => 
      Promise.all(
        keyList.map((key) => (key !== swconf.cacheName || purge) ? caches.delete(key) : undefined)
      )
    )
  );
  self.clients.claim(); // Take control of all pages immediately

  // Reload all clients silently in the background
  self.clients.matchAll({ type: 'window' }).then((clients) => {
    clients.forEach((client) => client.postMessage({ action: 'reload' }));
  });
});

// Listen for messages
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch event
self.addEventListener('fetch', (event) => {
  if (event.request.headers.has('range')) return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;

      return fetch(event.request).then((networkResponse) => {
        if (purge || event.request.method !== 'GET' || !verifyUrl(event.request.url)) {
          return networkResponse;
        }

        let responseToCache = networkResponse.clone();
        caches.open(swconf.cacheName).then((cache) => cache.put(event.request, responseToCache));
        return networkResponse;
      });
    })
  );
});