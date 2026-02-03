/**
 * Database API - WatermelonDB Layer
 * Todos los datos se guardan localmente primero (offline-first)
 * Sincronización automática con Turso cuando hay internet
 */

import watermelonDb, { syncDatabase, startAutoSync } from './watermelon';
import { GarmentModel, OutfitModel, UserModel } from './db-models';
import type { Garment, Outfit, User } from '../types';

class WatermelonDatabaseService {
  private initialized = false;
  private currentUserId: string | null = null;

  async initialize(userId: string): Promise<void> {
    if (this.initialized && this.currentUserId === userId) return;

    this.currentUserId = userId;
    this.initialized = true;

    console.log('[WatermelonDB] Initialized for user:', userId);

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
  }

  // ============ GARMENTS ============

  async createGarment(garment: Omit<Garment, 'created_at'> & { id: string }): Promise<Garment> {
    const now = Date.now();
    const collection = watermelonDb.get<GarmentModel>('garments');

    await watermelonDb.write(async () => {
      await collection.create((g) => {
        g._raw.id = garment.id;
        g.user_id = garment.user_id;
        g.category = garment.category;
        g.sub_category = garment.sub_category;
        g.image_url = garment.image_data || ''; // image_data se convierte a image_url
        g.cloudinary_id = `outfit-planner/${garment.user_id}/garments/${garment.id}`;
        g._raw.created_at = now;
        g._raw.updated_at = now;
      });
    });

    return {
      id: garment.id,
      user_id: garment.user_id,
      image_data: garment.image_data || '',
      category: garment.category,
      sub_category: garment.sub_category,
      created_at: new Date(now).toISOString(),
    };
  }

  async getGarmentsByUser(userId: string): Promise<Garment[]> {
    const collection = watermelonDb.get<GarmentModel>('garments');
    const garments = await collection.query().where('user_id', userId).fetch();

    return garments.map((g) => ({
      id: g.id,
      user_id: g.user_id,
      image_data: g.image_url,
      category: g.category,
      sub_category: g.sub_category,
      created_at: new Date(g.updatedAt).toISOString(),
    }));
  }

  async getGarmentsByCategory(userId: string, category: string): Promise<Garment[]> {
    const collection = watermelonDb.get<GarmentModel>('garments');
    const garments = await collection
      .query()
      .where('user_id', userId)
      .where('category', category)
      .fetch();

    return garments.map((g) => ({
      id: g.id,
      user_id: g.user_id,
      image_data: g.image_url,
      category: g.category,
      sub_category: g.sub_category,
      created_at: new Date(g.updatedAt).toISOString(),
    }));
  }

  async deleteGarment(id: string): Promise<void> {
    const collection = watermelonDb.get<GarmentModel>('garments');
    const garment = await collection.find(id);

    await watermelonDb.write(async () => {
      await garment.destroyPermanently();
    });
  }

  // ============ OUTFITS ============

  async createOutfit(outfit: Outfit): Promise<Outfit> {
    const now = Date.now();
    const collection = watermelonDb.get<OutfitModel>('outfits');

    await watermelonDb.write(async () => {
      await collection.create((o) => {
        o._raw.id = outfit.id;
        o.user_id = outfit.user_id;
        o.date_scheduled = outfit.date_scheduled;
        o.option_index = outfit.option_index || 1;
        o.layers_json = outfit.layers_json;
        o._raw.created_at = now;
        o._raw.updated_at = now;
      });
    });

    return outfit;
  }

  async getOutfitsByUser(userId: string): Promise<Outfit[]> {
    const collection = watermelonDb.get<OutfitModel>('outfits');
    const outfits = await collection.query().where('user_id', userId).fetch();

    return outfits.map((o) => ({
      id: o.id,
      user_id: o.user_id,
      date_scheduled: o.date_scheduled,
      option_index: o.option_index,
      layers_json: o.layers_json,
    }));
  }

  async getOutfitByDate(userId: string, date: string): Promise<Outfit | null> {
    const collection = watermelonDb.get<OutfitModel>('outfits');
    const outfits = await collection
      .query()
      .where('user_id', userId)
      .where('date_scheduled', date)
      .fetch();

    if (outfits.length === 0) return null;

    const o = outfits[0];
    return {
      id: o.id,
      user_id: o.user_id,
      date_scheduled: o.date_scheduled,
      option_index: o.option_index,
      layers_json: o.layers_json,
    };
  }

  async updateOutfit(id: string, layersJson: string): Promise<void> {
    const collection = watermelonDb.get<OutfitModel>('outfits');
    const outfit = await collection.find(id);

    await watermelonDb.write(async () => {
      await outfit.update((o) => {
        o.layers_json = layersJson;
        o._raw.updated_at = Date.now();
      });
    });
  }

  async deleteOutfit(id: string): Promise<void> {
    const collection = watermelonDb.get<OutfitModel>('outfits');
    const outfit = await collection.find(id);

    await watermelonDb.write(async () => {
      await outfit.destroyPermanently();
    });
  }

  // ============ HELPERS ============

  async clearAll(): Promise<void> {
    await watermelonDb.write(async () => {
      const garments = watermelonDb.get<GarmentModel>('garments');
      const outfits = watermelonDb.get<OutfitModel>('outfits');

      const allGarments = await garments.query().fetch();
      const allOutfits = await outfits.query().fetch();

      for (const g of allGarments) {
        await g.destroyPermanently();
      }
      for (const o of allOutfits) {
        await o.destroyPermanently();
      }
    });
  }
}

export const watermelonService = new WatermelonDatabaseService();
export default watermelonService;
