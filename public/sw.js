const CACHE_NAME = 'ootd-v1';
const RUNTIME_CACHE = 'ootd-runtime-v1';
const VERSION_KEY = 'ootd-app-version';

const ASSETS = [
  '/',
  '/index.html',
  '/vite.svg',
  '/manifest.webmanifest',
];

// Detectar cambios de versión
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching assets');
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    Promise.all([
      // Limpiar caches viejos
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== RUNTIME_CACHE)
            .map((key) => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            }),
        ),
      ),
      // Verificar versión
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: new Date().getTime(),
          });
        });
      }),
    ])
  );
  self.clients.claim();
});

// Verificar actualizaciones periódicamente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    console.log('[SW] Checking for updates...');
    fetch('/index.html', { cache: 'no-store' })
      .then((response) => {
        if (response && response.status === 200) {
          const cloned = response.clone();
          cloned.text().then((html) => {
            // Si el contenido cambió, notificar al cliente
            event.ports[0].postMessage({
              type: 'UPDATE_AVAILABLE',
              timestamp: new Date().getTime(),
            });
          });
        }
      })
      .catch((err) => {
        console.error('[SW] Error checking updates:', err);
      });
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Para API calls, network-first con fallback a caché
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cachear response
          if (response && response.status === 200) {
            const clonedResponse = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, clonedResponse);
            });
          }
          return response;
        })
        .catch(() => {
          // Si falla, intenta caché
          return caches.match(request);
        }),
    );
    return;
  }

  // Para index.html, siempre network-first para detectar cambios
  if (request.url.includes('index.html') || request.url.endsWith('/')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response && response.status === 200) {
            const clonedResponse = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clonedResponse);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        }),
    );
    return;
  }

  // Para otros assets, cache-first pero con validación
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request, { cache: 'no-store' }).then((response) => {
        if (!response || response.status !== 200) {
          return response;
        }

        const clonedResponse = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(request, clonedResponse);
        });

        return response;
      });
    }),
  );
});
