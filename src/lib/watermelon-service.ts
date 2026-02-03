/**
 * Database API - WatermelonDB Layer
 * Todos los datos se guardan localmente primero (offline-first)
 * Sincronización automática con Turso cuando hay internet
 */

import { getWatermelonDb, syncDatabase, startAutoSync } from './watermelon';
import { GarmentModel, OutfitModel } from './db-models';
import type { Garment, Outfit } from '../types';

class WatermelonDatabaseService {
  private initialized = false;
  private currentUserId: string | null = null;

  async initialize(userId: string): Promise<void> {
    if (this.initialized && this.currentUserId === userId) return;

    this.currentUserId = userId;
    this.initialized = true;

    console.log('[WatermelonDB] Initialized for user:', userId);

    try {
      // Inicializar la BD
      await getWatermelonDb();

      // Iniciar sincronización automática
      const apiUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:3001/api'
        : '/api';

      startAutoSync(userId, apiUrl);

      // Sincronizar inmediatamente si hay internet
      if (navigator.onLine) {
        try {
          await syncDatabase(userId, apiUrl);
        } catch (error) {
          console.error('[WatermelonDB] Initial sync failed:', error);
        }
      }
    } catch (error) {
      console.error('[WatermelonDB] Initialize failed:', error);
    }
  }

  // ============ GARMENTS ============

  async createGarment(garment: Omit<Garment, 'created_at'> & { id: string }): Promise<Garment> {
    const now = new Date().toISOString();
    
    try {
      const db = await getWatermelonDb();
      const collection = db.get<GarmentModel>('garments');

      await db.write(async () => {
        await collection.create((g: any) => {
          g.id = garment.id;
          g.user_id = garment.user_id;
          g.category = garment.category;
          g.sub_category = garment.sub_category;
          // Guardar base64 temporalmente (se subirá a Cloudinary en sync)
          g.image_url = garment.image_data || '';
          // cloudinary_id es solo para referencia interna
          g.cloudinary_id = `outfit-planner/${garment.user_id}/garments/${garment.id}`;
        });
      });
    } catch (error) {
      console.error('[WatermelonDB] Create garment error:', error);
    }

    return {
      id: garment.id,
      user_id: garment.user_id,
      image_data: garment.image_data || '',
      category: garment.category,
      sub_category: garment.sub_category,
      created_at: now,
      pending_upload: garment.image_data?.startsWith('data:') || false, // Marcar si es base64
    };
  }

  async getGarmentsByUser(userId: string): Promise<Garment[]> {
    try {
      const db = await getWatermelonDb();
      const collection = db.get<GarmentModel>('garments');
      
      const allGarments = await collection.query().fetch() as any[];
      const userGarments = allGarments.filter((g: any) => g.user_id === userId);
      return userGarments.map((g: any) => ({
        id: g.id,
        user_id: g.user_id,
        image_data: g.image_url,
        category: g.category,
        sub_category: g.sub_category,
        created_at: g.created_at || new Date().toISOString(),
      }));
    } catch (error) {
      console.error('[WatermelonDB] Get garments by user error:', error);
      return [];
    }
  }

  async getGarmentsByCategory(userId: string, category: string): Promise<Garment[]> {
    try {
      const db = await getWatermelonDb();
      const collection = db.get<GarmentModel>('garments');
      
      const allGarments = await collection.query().fetch() as any[];
      const filtered = allGarments.filter((g: any) => g.user_id === userId && g.category === category);

      return filtered.map((g: any) => ({
        id: g.id,
        user_id: g.user_id,
        image_data: g.image_url,
        category: g.category,
        sub_category: g.sub_category,
        created_at: g.created_at || new Date().toISOString(),
      }));
    } catch (error) {
      console.error('[WatermelonDB] Get garments by category error:', error);
      return [];
    }
  }

  async deleteGarment(garmentId: string): Promise<void> {
    try {
      const db = await getWatermelonDb();
      const collection = db.get<GarmentModel>('garments');

      const garment = await collection.find(garmentId);
      await db.write(async () => {
        await garment.destroyPermanently();
      });
    } catch (error) {
      console.error('[WatermelonDB] Delete garment error:', error);
    }
  }

  // ============ OUTFITS ============

  async createOutfit(outfit: Outfit): Promise<Outfit> {
    try {
      const db = await getWatermelonDb();
      const collection = db.get<OutfitModel>('outfits');

      await db.write(async () => {
        await collection.create((o: any) => {
          o.id = outfit.id;
          o.user_id = outfit.user_id;
          o.date_scheduled = outfit.date_scheduled;
          o.option_index = outfit.option_index || 1;
          o.layers_json = outfit.layers_json;
        });
      });
    } catch (error) {
      console.error('[WatermelonDB] Create outfit error:', error);
    }

    return outfit;
  }

  async getOutfitsByUser(userId: string): Promise<Outfit[]> {
    try {
      const db = await getWatermelonDb();
      const collection = db.get<OutfitModel>('outfits');
      
      const allOutfits = await collection.query().fetch() as any[];
      const userOutfits = allOutfits.filter((o: any) => o.user_id === userId);

      return userOutfits.map((o: any) => ({
        id: o.id,
        user_id: o.user_id,
        date_scheduled: o.date_scheduled,
        option_index: o.option_index,
        layers_json: o.layers_json,
      }));
    } catch (error) {
      console.error('[WatermelonDB] Get outfits by user error:', error);
      return [];
    }
  }

  async getOutfitByDate(userId: string, date: string): Promise<Outfit | null> {
    try {
      const db = await getWatermelonDb();
      const collection = db.get<OutfitModel>('outfits');
      
      const allOutfits = await collection.query().fetch() as any[];
      const outfits = allOutfits.filter((o: any) => o.user_id === userId && o.date_scheduled === date);

      if (outfits.length === 0) return null;

      const o = outfits[0];
      return {
        id: o.id,
        user_id: o.user_id,
        date_scheduled: o.date_scheduled,
        option_index: o.option_index,
        layers_json: o.layers_json,
      };
    } catch (error) {
      console.error('[WatermelonDB] Get outfit by date error:', error);
      return null;
    }
  }

  async updateOutfit(id: string, layersJson: string): Promise<void> {
    try {
      const db = await getWatermelonDb();
      const collection = db.get<OutfitModel>('outfits');

      const outfit = await collection.find(id);
      await db.write(async () => {
        await outfit.update((o: any) => {
          o.layers_json = layersJson;
        });
      });
    } catch (error) {
      console.error('[WatermelonDB] Update outfit error:', error);
    }
  }

  async deleteOutfit(id: string): Promise<void> {
    try {
      const db = await getWatermelonDb();
      const collection = db.get<OutfitModel>('outfits');

      const outfit = await collection.find(id);
      await db.write(async () => {
        await outfit.destroyPermanently();
      });
    } catch (error) {
      console.error('[WatermelonDB] Delete outfit error:', error);
    }
  }

  async clearAll(): Promise<void> {
    try {
      const db = await getWatermelonDb();
      await db.write(async () => {
        const garments = db.get<GarmentModel>('garments');
        const outfits = db.get<OutfitModel>('outfits');

        const allGarments = await garments.query().fetch();
        const allOutfits = await outfits.query().fetch();

        for (const g of allGarments) {
          await g.destroyPermanently();
        }
        for (const o of allOutfits) {
          await o.destroyPermanently();
        }
      });
    } catch (error) {
      console.error('[WatermelonDB] Clear all error:', error);
    }
  }
}

export const watermelonService = new WatermelonDatabaseService();
export default watermelonService;
