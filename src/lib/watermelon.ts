/**
 * WatermelonDB Configuration
 * Offline-first database con sincronización automática
 */

import { Database } from '@nozbe/watermelondb';
import { synchronize } from '@nozbe/watermelondb/sync';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './db-schema';
import { UserModel, GarmentModel, OutfitModel } from './db-models';

let watermelonDb: Database | null = null;
let initialized = false;

// Lazy initialization - solo cuando se use
async function initDatabase() {
  if (initialized) return watermelonDb;
  if (watermelonDb) return watermelonDb;

  try {
    const adapter = new SQLiteAdapter({
      schema,
      dbName: 'ootd_planner',
      jsi: false,
    });

    watermelonDb = new Database({
      adapter,
      modelClasses: [UserModel, GarmentModel, OutfitModel],
    });

    initialized = true;
    console.log('[WatermelonDB] Initialized successfully');
  } catch (error) {
    console.error('[WatermelonDB] Initialization error:', error);
    throw error;
  }

  return watermelonDb;
}

// Getter que asegura que la DB esté inicializada
export async function getWatermelonDb() {
  if (!watermelonDb) {
    await initDatabase();
  }
  return watermelonDb!;
}

export { watermelonDb };

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
