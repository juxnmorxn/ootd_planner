const CACHE_NAME = 'ootd-static-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/vite.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        }),
      ),
    ),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // For API calls, go network-first
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request)),
    );
    return;
  }

  // For navigation and static assets, use cache-first
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  );
});
