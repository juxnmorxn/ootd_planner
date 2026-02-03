/**
 * Offline Database - IndexedDB wrapper
 * Almacena datos locales cuando no hay internet
 * Sincroniza automáticamente cuando vuelve conexión
 */

const DB_NAME = 'ootd_planner_offline';
const DB_VERSION = 1;

export class OfflineDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Tabla de prendas (garments)
        if (!db.objectStoreNames.contains('garments')) {
          const garmentStore = db.createObjectStore('garments', { keyPath: 'id' });
          garmentStore.createIndex('user_id', 'user_id', { unique: false });
          garmentStore.createIndex('synced', 'synced', { unique: false });
        }

        // Tabla de outfits
        if (!db.objectStoreNames.contains('outfits')) {
          const outfitStore = db.createObjectStore('outfits', { keyPath: 'id' });
          outfitStore.createIndex('user_id', 'user_id', { unique: false });
          outfitStore.createIndex('synced', 'synced', { unique: false });
        }

        // Tabla de cambios pendientes (para sincronizar después)
        if (!db.objectStoreNames.contains('pending_sync')) {
          db.createObjectStore('pending_sync', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  // ============ GARMENTS ============

  async saveGarmentOffline(garment: any): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['garments'], 'readwrite');
      const store = tx.objectStore('garments');
      const request = store.put({ ...garment, synced: false, offline_saved_at: new Date().toISOString() });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getGarmentsOffline(userId: string): Promise<any[]> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['garments'], 'readonly');
      const index = tx.objectStore('garments').index('user_id');
      const request = index.getAll(userId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async deleteGarmentOffline(id: string): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['garments'], 'readwrite');
      const store = tx.objectStore('garments');
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // ============ OUTFITS ============

  async saveOutfitOffline(outfit: any): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['outfits'], 'readwrite');
      const store = tx.objectStore('outfits');
      const request = store.put({ ...outfit, synced: false, offline_saved_at: new Date().toISOString() });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getOutfitsOffline(userId: string): Promise<any[]> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['outfits'], 'readonly');
      const index = tx.objectStore('outfits').index('user_id');
      const request = index.getAll(userId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  // ============ PENDING SYNC ============

  async addPendingSync(type: 'garment' | 'outfit', action: 'create' | 'update' | 'delete', data: any): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['pending_sync'], 'readwrite');
      const store = tx.objectStore('pending_sync');
      const request = store.add({
        type,
        action,
        data,
        created_at: new Date().toISOString(),
      });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getPendingSync(): Promise<any[]> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['pending_sync'], 'readonly');
      const store = tx.objectStore('pending_sync');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async clearPendingSync(): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['pending_sync'], 'readwrite');
      const store = tx.objectStore('pending_sync');
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

// Singleton
export const offlineDB = new OfflineDB();
