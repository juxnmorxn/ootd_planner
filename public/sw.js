// Incrementar estos nombres cuando hagamos cambios importantes en la UI
// para forzar que los clientes descarguen la versión nueva sin tener que
// borrar datos manualmente.
const CACHE_NAME = 'ootd-v2';
const RUNTIME_CACHE = 'ootd-runtime-v2';
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
      // Claim clients after other operations
      self.clients.claim(),
    ])
  );
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
    // Cache Storage solo soporta GET. Para POST/PUT/DELETE no se cachea.
    if (request.method !== 'GET') {
      event.respondWith(
        fetch(request).catch(() =>
          new Response(
            JSON.stringify({ error: 'offline', message: 'Sin conexión' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      );
      return;
    }

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
          return caches.match(request).then((cached) => {
            return (
              cached ||
              new Response(
                JSON.stringify({ error: 'offline', message: 'Sin conexión' }),
                { status: 503, headers: { 'Content-Type': 'application/json' } },
              )
            );
          });
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

  // Solo cachear GET requests con esquema http/https
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return event.respondWith(fetch(request).catch(() => {
      // Fallar silenciosamente si no es http/https
    }));
  }

  // Para otros assets, cache-first pero con validación
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request, { cache: 'no-store' }).then((response) => {
        if (!response || response.status !== 200) {
          return response;
        }

        try {
          const clonedResponse = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, clonedResponse).catch(() => {
              // Ignorar errores de cache
            });
          });
        } catch (e) {
          // Ignorar cualquier error de caching
        }

        return response;
      }).catch(() => {
        // Fallar silenciosamente en fetch
      });
    }).catch(() => {
      // Fallar silenciosamente en match
    }),
  );
});

// Manejo de notificaciones push
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { body: event.data.text() };
  }

  const title = data.title || 'Nuevo mensaje';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: data.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    if (allClients.length > 0) {
      const client = allClients[0];
      await client.focus();
      client.postMessage({
        type: 'OPEN_CONVERSATION',
        payload: data,
      });
      return;
    }

    const url = '/';
    const newClient = await self.clients.openWindow(url);
    if (newClient) {
      newClient.postMessage({
        type: 'OPEN_CONVERSATION',
        payload: data,
      });
    }
  })());
});
