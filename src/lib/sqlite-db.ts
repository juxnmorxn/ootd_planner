import Database from 'better-sqlite3';
import path from 'path';
import type { Garment, Outfit, User } from '../types';
import { uploadImageToCloudinary, deleteImageFromCloudinary } from './cloudinary';

const DB_PATH = path.join(process.cwd(), 'outfit-planner.db');

class SQLiteDatabase {
    private db: Database.Database;

    constructor() {
        this.db = new Database(DB_PATH);
        this.db.pragma('journal_mode = WAL');
        this.initializeTables();
        console.log('[SQLite DB] Initialized at:', DB_PATH);
    }

    private initializeTables() {
        // Tabla de usuarios
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT,
        role TEXT DEFAULT 'user',
        password_hash TEXT NOT NULL,
        profile_pic TEXT,
        custom_subcategories TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

        // Tabla de prendas (sin image_data, solo URL de Cloudinary)
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS garments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        category TEXT NOT NULL,
        sub_category TEXT NOT NULL,
        image_url TEXT NOT NULL,
        cloudinary_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

        // Índice para búsquedas rápidas por usuario y categoría
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_garments_user_category 
      ON garments(user_id, category)
    `);

        // Tabla de outfits
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS outfits (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        date_scheduled TEXT NOT NULL,
        layers_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, date_scheduled)
      )
    `);

        // Índice para búsquedas por fecha
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_outfits_user_date 
      ON outfits(user_id, date_scheduled)
    `);
    }

    // ============ USERS ============

    createUser(user: User): User {
        const stmt = this.db.prepare(`
      INSERT INTO users (id, username, email, role, password_hash, profile_pic, custom_subcategories, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            user.id,
            user.username,
            user.email || null,
            user.role || 'user',
            user.password_hash,
            user.profile_pic || null,
            user.custom_subcategories || null,
            user.created_at,
            user.updated_at
        );
        return user;
    }

    getUser(id: string): User | null {
        const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
        const row = stmt.get(id) as any;

        if (!row) return null;

        return {
            id: row.id,
            username: row.username,
            email: row.email,
            role: row.role || 'user',
            password_hash: row.password_hash,
            profile_pic: row.profile_pic,
            custom_subcategories: row.custom_subcategories,
            created_at: row.created_at,
            updated_at: row.updated_at,
        };
    }

    getAllUsers(): User[] {
        const stmt = this.db.prepare('SELECT * FROM users ORDER BY created_at DESC');
        const rows = stmt.all() as any[];

        return rows.map((row) => ({
            id: row.id,
            username: row.username,
            email: row.email,
            role: row.role || 'user',
            password_hash: row.password_hash,
            profile_pic: row.profile_pic,
            custom_subcategories: row.custom_subcategories,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }));
    }

    deleteUser(id: string): void {
        // Primero eliminar todas las imágenes de Cloudinary del usuario
        const garments = this.getGarmentsByUser(id);
        for (const garment of garments) {
            deleteImageFromCloudinary(id, garment.id).catch(console.error);
        }

        // Luego eliminar el usuario (CASCADE eliminará garments y outfits)
        const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
        stmt.run(id);
    }

    // ============ GARMENTS ============

    async createGarment(garment: Omit<Garment, 'id' | 'image_data'> & { id: string; image_data: string }): Promise<Garment> {
        try {
            // 1. Subir imagen a Cloudinary
            const imageUrl = await uploadImageToCloudinary(garment.image_data, garment.user_id, garment.id);

            // 2. Guardar metadata en SQLite
            const stmt = this.db.prepare(`
        INSERT INTO garments (id, user_id, category, sub_category, image_url, cloudinary_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

            const cloudinaryId = `outfit-planner/${garment.user_id}/garments/${garment.id}`;

            const now = new Date().toISOString();
            stmt.run(
                garment.id,
                garment.user_id,
                garment.category,
                garment.sub_category,
                imageUrl,
                cloudinaryId,
                now
            );

            return {
                id: garment.id,
                user_id: garment.user_id,
                category: garment.category,
                sub_category: garment.sub_category,
                image_data: imageUrl, // Ahora es la URL de Cloudinary
                created_at: now
            };
        } catch (error) {
            console.error('[SQLite DB] Failed to create garment:', error);
            throw error;
        }
    }

    getGarmentsByUser(userId: string): Garment[] {
        const stmt = this.db.prepare('SELECT * FROM garments WHERE user_id = ? ORDER BY created_at DESC');
        const rows = stmt.all(userId) as any[];

        return rows.map((row) => ({
            id: row.id,
            user_id: row.user_id,
            category: row.category,
            sub_category: row.sub_category,
            image_data: row.image_url, // URL de Cloudinary
            created_at: row.created_at
        }));
    }

    getGarmentsByCategory(userId: string, category: string): Garment[] {
        const stmt = this.db.prepare('SELECT * FROM garments WHERE user_id = ? AND category = ? ORDER BY created_at DESC');
        const rows = stmt.all(userId, category) as any[];

        return rows.map((row) => ({
            id: row.id,
            user_id: row.user_id,
            category: row.category,
            sub_category: row.sub_category,
            image_data: row.image_url,
            created_at: row.created_at
        }));
    }

    async deleteGarment(id: string, userId: string): Promise<void> {
        // 1. Eliminar de Cloudinary
        await deleteImageFromCloudinary(userId, id);

        // 2. Eliminar de SQLite
        const stmt = this.db.prepare('DELETE FROM garments WHERE id = ?');
        stmt.run(id);
    }

    // ============ OUTFITS ============

    createOutfit(outfit: Omit<Outfit, 'id'> & { id: string }): Outfit {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO outfits (id, user_id, date_scheduled, layers_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, date_scheduled) DO UPDATE SET
        layers_json = excluded.layers_json,
        updated_at = excluded.updated_at
    `);

        stmt.run(outfit.id, outfit.user_id, outfit.date_scheduled, outfit.layers_json, now, now);

        return {
            id: outfit.id,
            user_id: outfit.user_id,
            date_scheduled: outfit.date_scheduled,
            layers_json: outfit.layers_json,
        };
    }

    getOutfitByDate(userId: string, date: string): Outfit | null {
        const stmt = this.db.prepare('SELECT * FROM outfits WHERE user_id = ? AND date_scheduled = ?');
        const row = stmt.get(userId, date) as any;

        if (!row) return null;

        return {
            id: row.id,
            user_id: row.user_id,
            date_scheduled: row.date_scheduled,
            layers_json: row.layers_json,
        };
    }

    getOutfitsByUser(userId: string): Outfit[] {
        const stmt = this.db.prepare('SELECT * FROM outfits WHERE user_id = ? ORDER BY date_scheduled DESC');
        const rows = stmt.all(userId) as any[];

        return rows.map((row) => ({
            id: row.id,
            user_id: row.user_id,
            date_scheduled: row.date_scheduled,
            layers_json: row.layers_json,
        }));
    }

    updateOutfit(id: string, layersJson: string): void {
        const stmt = this.db.prepare(`
      UPDATE outfits 
      SET layers_json = ?, updated_at = ?
      WHERE id = ?
    `);

        stmt.run(layersJson, new Date().toISOString(), id);
    }

    deleteOutfit(id: string): void {
        const stmt = this.db.prepare('DELETE FROM outfits WHERE id = ?');
        stmt.run(id);
    }

    // ============ UTILITY ============

    close() {
        this.db.close();
    }

    getStats(userId: string) {
        const garmentsCount = this.db.prepare('SELECT COUNT(*) as count FROM garments WHERE user_id = ?').get(userId) as any;
        const outfitsCount = this.db.prepare('SELECT COUNT(*) as count FROM outfits WHERE user_id = ?').get(userId) as any;

        return {
            garments: garmentsCount.count,
            outfits: outfitsCount.count,
        };
    }
}

// Singleton instance
export const db = new SQLiteDatabase();

// Cleanup on process exit
process.on('exit', () => {
    db.close();
});

process.on('SIGINT', () => {
    db.close();
    process.exit(0);
});
