/**
 * WatermelonDB Configuration
 * Offline-first database con sincronización automática
 */

import { Database } from '@nozbe/watermelondb';
import { synchronize } from '@nozbe/watermelondb/sync';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './db-schema';
import { UserModel, GarmentModel, OutfitModel } from './db-models';

// Crear el adaptador SQLite (en navegador usa sql.js)
const adapter = new SQLiteAdapter({
  schema,
  // En el navegador, WatermelonDB usa sql.js (incluido en el bundle)
  dbName: 'ootd_planner',
  jsi: false, // Navegador no soporta JSI, usa sql.js
});

export const watermelonDb = new Database({
  adapter,
  modelClasses: [UserModel, GarmentModel, OutfitModel],
});

/**
 * Sincronización con Turso (backend)
 * Se llama cuando hay conexión a internet
 */
export async function syncDatabase(userId: string, apiUrl: string) {
  try {
    console.log('[WatermelonDB] Starting sync...');

    await synchronize({
      database: watermelonDb,
      pullChanges: async ({ lastPulledAt }) => {
        // Traer cambios del servidor desde lastPulledAt
        const response = await fetch(`${apiUrl}/sync/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            lastPulledAt: lastPulledAt || 0,
          }),
        });

        if (!response.ok) {
          throw new Error(`Pull failed: ${response.statusText}`);
        }

        const { changes, timestamp } = await response.json();
        console.log('[WatermelonDB] Pulled changes:', changes);
        return { changes, timestamp };
      },
      pushChanges: async ({ changes }) => {
        // Enviar cambios locales al servidor
        const response = await fetch(`${apiUrl}/sync/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            changes,
          }),
        });

        if (!response.ok) {
          throw new Error(`Push failed: ${response.statusText}`);
        }

        console.log('[WatermelonDB] Pushed changes successfully');
      },
      onComplete: () => {
        console.log('[WatermelonDB] ✅ Sync complete');
        // Dispatchear evento para actualizar UI
        window.dispatchEvent(new CustomEvent('db-synced'));
      },
      onError: (error) => {
        console.error('[WatermelonDB] Sync error:', error);
        // Reintentar en background más tarde
      },
    });
  } catch (error) {
    console.error('[WatermelonDB] Sync failed:', error);
  }
}

/**
 * Sincronización automática cada 30 segundos cuando hay internet
 */
let syncInterval: NodeJS.Timeout | null = null;

export function startAutoSync(userId: string, apiUrl: string) {
  if (syncInterval) return; // Ya está corriendo

  const performSync = async () => {
    if (navigator.onLine) {
      try {
        await syncDatabase(userId, apiUrl);
      } catch (error) {
        console.error('[AutoSync] Error:', error);
      }
    }
  };

  // Primera sincronización inmediata
  performSync();

  // Luego cada 30 segundos
  syncInterval = setInterval(performSync, 30000);

  console.log('[AutoSync] Started');
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[AutoSync] Stopped');
  }
}

export default watermelonDb;
