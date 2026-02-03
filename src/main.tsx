import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ToastProvider } from './components/ui/Toast';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);

// Simple service worker registration for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[PWA] Service worker registered');

        // Detectar cambios de versión
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Nueva versión disponible
                console.log('[PWA] New version available, reloading...');
                window.location.reload();
              }
            });
          }
        });

        // Verificar actualizaciones cada 30 segundos
        setInterval(() => {
          registration.update().catch((err) => {
            console.error('[PWA] Error checking for updates:', err);
          });
        }, 30000);
      })
      .catch((err) => {
        console.error('Service worker registration failed', err);
      });
  });
}

// Manejar mensajes del Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
      console.log('[PWA] Update available, reloading...');
      window.location.reload();
    }
  });
}
