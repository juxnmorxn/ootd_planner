/**
 * WatermelonDB Configuration
 * Offline-first database con sincronización automática
 */

import { Database } from '@nozbe/watermelondb';
import { synchronize } from '@nozbe/watermelondb/sync';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { schema } from './db-schema';
import { UserModel, GarmentModel, OutfitModel } from './db-models';
import { uploadImageToCloudinary } from './cloudinary';

let watermelonDb: Database | null = null;
let initialized = false;

// Lazy initialization - solo cuando se use
async function initDatabase() {
  if (initialized) return watermelonDb;
  if (watermelonDb) return watermelonDb;

  try {
    // Importante: para web NO usar el adaptador sqlite (termina bundling better-sqlite3/"fs")
    // LokiJSAdapter persiste en IndexedDB y es compatible con navegador.
    const adapter = new LokiJSAdapter({
      schema,
      dbName: 'ootd_planner',
      useWebWorker: false,
      useIncrementalIndexedDB: true,
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

/**
 * Procesa imágenes pendientes de subir a Cloudinary
 * Se llama antes de sincronizar cambios al servidor
 */
async function processPendingImageUploads(userId: string) {
  try {
    const db = await getWatermelonDb();
    const collection = db.get<GarmentModel>('garments');

    // Obtener todas las prendas del usuario
    const allGarments = await collection.query().fetch() as any[];
    const userGarments = allGarments.filter((g: any) => g.user_id === userId);

    // Procesar solo las que aún son base64 (pendientes de upload)
    for (const garment of userGarments) {
      // Si image_url es base64 (empieza con "data:"), necesita upload
      if (garment.image_url?.startsWith('data:')) {
        try {
          console.log(`[WatermelonDB] Uploading pending image for garment ${garment.id}...`);
          
          // Subir base64 a Cloudinary
          const cloudinaryUrl = await uploadImageToCloudinary(
            garment.image_url,
            userId,
            garment.id
          );

          // Actualizar garment localmente con URL de Cloudinary
          await db.write(async () => {
            await garment.update((g: any) => {
              g.image_url = cloudinaryUrl;
            });
          });

          console.log(`[WatermelonDB] Image uploaded successfully for ${garment.id}`);
        } catch (error) {
          console.warn(`[WatermelonDB] Failed to upload image for ${garment.id}:`, error);
          // Continuar con otros garments, no bloquear sync
        }
      }
    }
  } catch (error) {
    console.warn('[WatermelonDB] processPendingImageUploads error:', error);
    // No bloquear sync si hay error
  }
}

/**
 * Se llama cuando hay conexión a internet
 */
export async function syncDatabase(userId: string, apiUrl: string) {
  try {
    console.log('[WatermelonDB] Starting sync...');

    // Procesar pending image uploads ANTES de sync
    await processPendingImageUploads(userId);

    const db = await getWatermelonDb();

    await synchronize({
      database: db,
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
        // Enviar cambios locales al servidor (con reintentos)
        let retries = 3;
        while (retries > 0) {
          try {
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
            break; // Éxito
          } catch (error) {
            retries--;
            if (retries === 0) {
              // Último reintento falló
              console.error('[WatermelonDB] Push failed after 3 retries:', error);
              throw error;
            }
            // Esperar exponencial backoff antes de reintentar
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, 3 - retries) * 1000));
          }
        }
      },
    });

    // Marcar sync exitoso
    window.dispatchEvent(new CustomEvent('sync-complete', { detail: { timestamp: Date.now() } }));
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
