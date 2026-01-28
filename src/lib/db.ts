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
            // Verificar que el servidor API esté corriendo
            const response = await fetch('http://localhost:3001/api/users');
            if (!response.ok) {
                throw new Error('API server not responding');
            }

            this.initialized = true;
            console.log('[Database] Connected to API server');
        } catch (error) {
            console.error('[Database] Failed to connect to API server:', error);
            console.error('[Database] Make sure to run: npm run server');
            throw new Error('API server not available. Run "npm run server" first.');
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
        return apiDb.login(data);
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
        return apiDb.updateProfilePicture(id, imageData);
    }

    // ============ GARMENTS ============

    async createGarment(garment: Omit<Garment, 'created_at'>): Promise<Garment> {
        // Generar id en el cliente; created_at lo gestiona el backend
        const payload: Omit<Garment, 'id' | 'created_at'> & { id: string } = {
            ...garment,
            id: uuidv4(),
        };
        return apiDb.createGarment(payload);
    }

    async getGarmentsByUser(userId: string): Promise<Garment[]> {
        return apiDb.getGarmentsByUser(userId);
    }

    async getGarmentsByCategory(userId: string, category: string): Promise<Garment[]> {
        return apiDb.getGarmentsByCategory(userId, category);
    }

    async deleteGarment(id: string, userId: string): Promise<void> {
        return apiDb.deleteGarment(id, userId);
    }

    // ============ OUTFITS ============

    async createOutfit(outfit: Omit<Outfit, 'id'>): Promise<Outfit> {
        const payload: Outfit = {
            ...outfit,
            id: uuidv4(),
        };
        return apiDb.createOutfit(payload);
    }

    async getOutfitByDate(userId: string, date: string): Promise<Outfit | null> {
        return apiDb.getOutfitByDate(userId, date);
    }

    async getOutfitsByUser(userId: string): Promise<Outfit[]> {
        return apiDb.getOutfitsByUser(userId);
    }

    async updateOutfit(id: string, layersJson: string): Promise<void> {
        return apiDb.updateOutfit(id, layersJson);
    }

    async deleteOutfit(id: string): Promise<void> {
        return apiDb.deleteOutfit(id);
    }

    async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
        return apiDb.changePassword(userId, oldPassword, newPassword);
    }

    // ============ STATS ============

    async getStats(userId: string): Promise<{ garments: number; outfits: number }> {
        return apiDb.getStats(userId);
    }
}

// Singleton instance
export const db = new DatabaseService();
export default db;
