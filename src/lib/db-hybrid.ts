/**
 * Hybrid Database
 * Usa Turso cuando hay internet, IndexedDB cuando no
 */

import { apiDb } from './api-db';
import { offlineDB } from './db-offline';
import type { Garment, Outfit } from '../types';

export class HybridDatabase {
  private isOnline: boolean = navigator.onLine;

  constructor() {
    // Detectar cambios de conexión
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('[HybridDB] Back online! Syncing...');
      this.syncPendingChanges();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('[HybridDB] Offline mode activated');
    });
  }

  async init(): Promise<void> {
    await offlineDB.init();
    console.log('[HybridDB] Initialized');
  }

  // ============ GARMENTS ============

  async getGarmentsByUser(
    userId: string,
    category?: string,
    forceRefresh: boolean = false
  ): Promise<Garment[]> {
    // ✅ CACHE-FIRST: Retorna caché primero si existe
    if (!forceRefresh) {
      const cached = await offlineDB.getGarmentsOffline(userId);
      if (cached.length > 0) {
        console.log('[HybridDB] Retornando caché (no descargando)');
        
        // Sincroniza en background (sin bloquear)
        if (this.isOnline) {
          this.syncGarmentsInBackground(userId, category).catch(() => {
            // Sync falló silenciosamente, caché sigue siendo válido
          });
        }
        
        return cached;
      }
    }

    // Sin caché o fuerza refresh → descarga del servidor
    if (this.isOnline) {
      try {
        const garments = category
          ? await apiDb.getGarmentsByCategory(userId, category)
          : await apiDb.getGarmentsByUser(userId);

        // Guarda en IndexedDB como caché
        for (const g of garments) {
          await offlineDB.saveGarmentOffline(g);
        }

        return garments;
      } catch (error) {
        console.warn('[HybridDB] Failed to fetch from API, using offline:', error);
      }
    }

    // Si no hay caché y falla, retorna vacío
    return await offlineDB.getGarmentsOffline(userId);
  }

  // Sincronización en background sin bloquear UI
  private async syncGarmentsInBackground(
    userId: string,
    category?: string
  ): Promise<void> {
    try {
      const fresh = category
        ? await apiDb.getGarmentsByCategory(userId, category)
        : await apiDb.getGarmentsByUser(userId);
      
      const cached = await offlineDB.getGarmentsOffline(userId);
      
      // Comparar si cambió algo
      const changed = JSON.stringify(fresh) !== JSON.stringify(cached);
      
      if (changed) {
        console.log('[HybridDB] Cambios detectados, actualizando caché en background');
        for (const g of fresh) {
          await offlineDB.saveGarmentOffline(g);
        }
        
        // Notificar al usuario que hay nuevos datos
        window.dispatchEvent(
          new CustomEvent('data-updated', {
            detail: { type: 'garments', data: fresh }
          })
        );
      } else {
        console.log('[HybridDB] Caché actual está sincronizado');
      }
    } catch (error) {
      console.warn('[HybridDB] Background sync falló (caché sigue siendo válido):', error);
    }
  }

  async createGarment(garment: Omit<Garment, 'created_at'> & { id: string }): Promise<Garment> {
    // 1. Guarda inmediatamente en IndexedDB (para usar offline)
    await offlineDB.saveGarmentOffline({
      ...garment,
      created_at: new Date().toISOString(),
      offline: true,
    });

    // 2. Intenta sincronizar con Turso
    if (this.isOnline) {
      try {
        const result = await apiDb.createGarment(garment);
        // Marca como sincronizado
        await offlineDB.saveGarmentOffline({
          ...result,
          synced: true,
          offline: false,
        });
        return result;
      } catch (error) {
        console.warn('[HybridDB] Failed to sync garment to Turso:', error);
        // Registro el cambio pendiente
        await offlineDB.addPendingSync('garment', 'create', garment);
      }
    } else {
      // Estamos offline, registra como pendiente
      await offlineDB.addPendingSync('garment', 'create', garment);
    }

    return garment as Garment;
  }

  async deleteGarment(id: string, userId: string): Promise<void> {
    // 1. Elimina inmediatamente del IndexedDB
    await offlineDB.deleteGarmentOffline(id);

    // 2. Intenta sincronizar con Turso
    if (this.isOnline) {
      try {
        await apiDb.deleteGarment(id, userId);
      } catch (error) {
        console.warn('[HybridDB] Failed to delete from Turso:', error);
        await offlineDB.addPendingSync('garment', 'delete', { id, userId });
      }
    } else {
      await offlineDB.addPendingSync('garment', 'delete', { id, userId });
    }
  }

  // ============ OUTFITS ============

  async getOutfitsByUser(userId: string, forceRefresh: boolean = false): Promise<Outfit[]> {
    // ✅ CACHE-FIRST: Retorna caché primero si existe
    if (!forceRefresh) {
      const cached = await offlineDB.getOutfitsOffline(userId);
      if (cached.length > 0) {
        console.log('[HybridDB] Retornando caché de outfits (no descargando)');
        
        // Sincroniza en background
        if (this.isOnline) {
          this.syncOutfitsInBackground(userId).catch(() => {});
        }
        
        return cached;
      }
    }

    // Sin caché o fuerza refresh → descarga
    if (this.isOnline) {
      try {
        const outfits = await apiDb.getOutfitsByUser(userId);

        // Guarda en IndexedDB como caché
        for (const o of outfits) {
          await offlineDB.saveOutfitOffline(o);
        }

        return outfits;
      } catch (error) {
        console.warn('[HybridDB] Failed to fetch outfits, using offline:', error);
      }
    }

    return await offlineDB.getOutfitsOffline(userId);
  }

  // Sincronización de outfits en background
  private async syncOutfitsInBackground(userId: string): Promise<void> {
    try {
      const fresh = await apiDb.getOutfitsByUser(userId);
      const cached = await offlineDB.getOutfitsOffline(userId);
      
      const changed = JSON.stringify(fresh) !== JSON.stringify(cached);
      
      if (changed) {
        console.log('[HybridDB] Cambios en outfits, actualizando caché');
        for (const o of fresh) {
          await offlineDB.saveOutfitOffline(o);
        }
        
        window.dispatchEvent(
          new CustomEvent('data-updated', {
            detail: { type: 'outfits', data: fresh }
          })
        );
      }
    } catch (error) {
      console.warn('[HybridDB] Background sync outfits falló:', error);
    }
  }

  async createOutfit(outfit: Outfit): Promise<Outfit> {
    // 1. Guarda inmediatamente en IndexedDB
    await offlineDB.saveOutfitOffline({
      ...outfit,
      offline: true,
    });

    // 2. Intenta sincronizar con Turso
    if (this.isOnline) {
      try {
        const result = await apiDb.createOutfit(outfit);
        await offlineDB.saveOutfitOffline({
          ...result,
          synced: true,
          offline: false,
        });
        return result;
      } catch (error) {
        console.warn('[HybridDB] Failed to sync outfit to Turso:', error);
        await offlineDB.addPendingSync('outfit', 'create', outfit);
      }
    } else {
      await offlineDB.addPendingSync('outfit', 'create', outfit);
    }

    return outfit;
  }

  async updateOutfit(id: string, layersJson: string): Promise<void> {
    // 1. Actualiza en IndexedDB
    await offlineDB.saveOutfitOffline({
      id,
      layers_json: layersJson,
      updated_at: new Date().toISOString(),
    });

    // 2. Intenta sincronizar con Turso
    if (this.isOnline) {
      try {
        await apiDb.updateOutfit(id, layersJson);
      } catch (error) {
        console.warn('[HybridDB] Failed to update outfit in Turso:', error);
        await offlineDB.addPendingSync('outfit', 'update', { id, layersJson });
      }
    } else {
      await offlineDB.addPendingSync('outfit', 'update', { id, layersJson });
    }
  }

  async deleteOutfit(id: string): Promise<void> {
    // 1. Elimina del IndexedDB
    // await offlineDB.deleteOutfitOffline(id);

    // 2. Intenta sincronizar con Turso
    if (this.isOnline) {
      try {
        await apiDb.deleteOutfit(id);
      } catch (error) {
        console.warn('[HybridDB] Failed to delete outfit from Turso:', error);
        await offlineDB.addPendingSync('outfit', 'delete', { id });
      }
    } else {
      await offlineDB.addPendingSync('outfit', 'delete', { id });
    }
  }

  // ============ SYNC ============

  async syncPendingChanges(): Promise<void> {
    if (!this.isOnline) {
      console.log('[HybridDB] Offline, skipping sync');
      return;
    }

    const pending = await offlineDB.getPendingSync();
    console.log(`[HybridDB] Syncing ${pending.length} pending changes...`);

    for (const change of pending) {
      try {
        const { type, action, data } = change;

        if (type === 'garment') {
          if (action === 'create') {
            await apiDb.createGarment(data);
          } else if (action === 'delete') {
            await apiDb.deleteGarment(data.id, data.userId);
          }
        } else if (type === 'outfit') {
          if (action === 'create') {
            await apiDb.createOutfit(data);
          } else if (action === 'update') {
            await apiDb.updateOutfit(data.id, data.layersJson);
          } else if (action === 'delete') {
            await apiDb.deleteOutfit(data.id);
          }
        }

        // Si llegó aquí, se sincronizó exitosamente
        console.log(`[HybridDB] ✅ Synced: ${type} ${action}`);
      } catch (error) {
        console.error('[HybridDB] Sync failed, will retry later:', error);
        // Los datos quedan pendientes para próximo intento
      }
    }

    // Limpia los cambios sincronizados
    await offlineDB.clearPendingSync();
    console.log('[HybridDB] ✅ Sync complete');
  }
}

export const hybridDb = new HybridDatabase();
