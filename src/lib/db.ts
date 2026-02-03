/**
 * Database Service - API Client
 * 
 * Este archivo ahora actúa como un wrapper para la API del backend.
 * Las imágenes se guardan en Cloudinary y los datos en SQLite.
 */

import { apiDb } from './api-db';
import type { Garment, Outfit, User, RegisterData, LoginCredentials } from '../types';
import { v4 as uuidv4 } from 'uuid';

class DatabaseService {
    private initialized = false;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            // Verificar conectividad al API sin hardcodear localhost.
            // En producción usa /api (misma origin); en local usa http://localhost:3001/api.
            await apiDb.getAllUsers();
            this.initialized = true;
            console.log('[Database] Connected to API server');
        } catch (error) {
            console.error('[Database] Failed to connect to API server:', error);
            // No romper la app en producción/offline: permitir que la UI cargue.
            // Las llamadas al API fallarán individualmente y se manejarán en cada flujo.
            this.initialized = true;
        }
    }

    // ============ USERS ============

    async createUser(user: User): Promise<User> {
        return apiDb.createUser(user);
    }

    async register(data: RegisterData): Promise<User> {
        // El backend genera el id, hash de la contraseña y timestamps
        return apiDb.register(data);
    }

    async login(data: LoginCredentials): Promise<User> {
        const user = await apiDb.login(data);
        // Agregar timestamp de login y sync
        user.loginTimestamp = Date.now();
        user.lastSyncTimestamp = 0;
        return user;
    }

    async getAllUsers(): Promise<User[]> {
        return apiDb.getAllUsers();
    }

    async getUser(id: string): Promise<User | null> {
        return apiDb.getUser(id);
    }

    async deleteUser(id: string): Promise<void> {
        return apiDb.deleteUser(id);
    }

    async updateUser(id: string, data: { username?: string; email: string }): Promise<User> {
        return apiDb.updateUser(id, data);
    }

    async updateProfilePicture(id: string, imageData: string): Promise<User> {
        const user = await apiDb.updateProfilePicture(id, imageData);
        this.emitChange({ type: 'user', action: 'update', user });
        return user;
    }

    // ============ GARMENTS ============

    async createGarment(garment: Omit<Garment, 'created_at'>): Promise<Garment> {
        // Generar id en el cliente; created_at lo gestiona el backend
        const payload: Omit<Garment, 'id' | 'created_at'> & { id: string } = {
            ...garment,
            id: uuidv4(),
        };
        const created = await apiDb.createGarment(payload);
        this.emitChange({ type: 'garment', action: 'create', garment: created });
        return created;
    }

    async getGarmentsByUser(userId: string): Promise<Garment[]> {
        return apiDb.getGarmentsByUser(userId);
    }

    async getGarmentsByCategory(userId: string, category: string): Promise<Garment[]> {
        return apiDb.getGarmentsByCategory(userId, category);
    }

    async deleteGarment(id: string, userId: string): Promise<void> {
        await apiDb.deleteGarment(id, userId);
        this.emitChange({ type: 'garment', action: 'delete', id, userId });
    }

    // ============ OUTFITS ============

    async createOutfit(outfit: Omit<Outfit, 'id'>): Promise<Outfit> {
        const payload: Outfit = {
            ...outfit,
            id: uuidv4(),
        };
        const created = await apiDb.createOutfit(payload);
        this.emitChange({ type: 'outfit', action: 'upsert', outfit: created });
        return created;
    }

    async getOutfitByDate(userId: string, date: string): Promise<Outfit | null> {
        return apiDb.getOutfitByDate(userId, date);
    }

    async getOutfitById(id: string): Promise<Outfit | null> {
        return apiDb.getOutfitById(id);
    }

    async getOutfitsByUser(userId: string): Promise<Outfit[]> {
        return apiDb.getOutfitsByUser(userId);
    }

    async getOutfitOptionsByDate(userId: string, date: string): Promise<Outfit[]> {
        return apiDb.getOutfitOptionsByDate(userId, date);
    }

    async updateOutfit(id: string, layersJson: string): Promise<void> {
        await apiDb.updateOutfit(id, layersJson);
        this.emitChange({ type: 'outfit', action: 'update', id, layersJson });
    }

    async deleteOutfit(id: string): Promise<void> {
        await apiDb.deleteOutfit(id);
        this.emitChange({ type: 'outfit', action: 'delete', id });
    }

    async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
        await apiDb.changePassword(userId, oldPassword, newPassword);
    }

    // ============ STATS ============

    async getStats(userId: string): Promise<{ garments: number; outfits: number }> {
        return apiDb.getStats(userId);
    }

    /**
     * Emite un evento global para que los hooks (useGarments/useOutfits) sepan que
     * hubo un cambio y recarguen datos sin necesidad de refrescar la página.
     */
    private emitChange(detail: any) {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent('db-change', { detail }));
    }
}

// Singleton instance
export const db = new DatabaseService();
export default db;
