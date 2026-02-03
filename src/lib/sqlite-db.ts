import Database from 'better-sqlite3';
import path from 'path';
import type { Garment, Outfit, User, Contact, Conversation, Message } from '../types';
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

        // ============ CHAT TABLES ============

        // Tabla de contactos/amigos
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        status TEXT DEFAULT 'pendiente',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (contact_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, contact_id)
      )
    `);

        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_contacts_user 
      ON contacts(user_id)
    `);

        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_contacts_status 
      ON contacts(status)
    `);

        // Tabla de conversaciones privadas
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id_1 TEXT NOT NULL,
        user_id_2 TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id_1) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id_2) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id_1, user_id_2)
      )
    `);

        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_conversations_users 
      ON conversations(user_id_1, user_id_2)
    `);

        // Tabla de mensajes
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        read INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation 
      ON messages(conversation_id)
    `);

        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_sender 
      ON messages(sender_id)
    `);

        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_created 
      ON messages(created_at DESC)
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

    // ============ CONTACTS ============

    createContact(contact: Omit<Contact, 'created_at' | 'updated_at'>): Contact {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO contacts (id, user_id, contact_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            contact.id,
            contact.user_id,
            contact.contact_id,
            contact.status,
            now,
            now
        );

        return {
            id: contact.id,
            user_id: contact.user_id,
            contact_id: contact.contact_id,
            status: contact.status,
            created_at: now,
            updated_at: now,
        };
    }

    getContact(userId: string, contactId: string): Contact | null {
        const stmt = this.db.prepare('SELECT * FROM contacts WHERE user_id = ? AND contact_id = ?');
        const row = stmt.get(userId, contactId) as any;

        if (!row) return null;

        return {
            id: row.id,
            user_id: row.user_id,
            contact_id: row.contact_id,
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at,
        };
    }

    getContactsByUser(userId: string, status?: string): Contact[] {
        const query = status
            ? 'SELECT * FROM contacts WHERE user_id = ? AND status = ? ORDER BY created_at DESC'
            : 'SELECT * FROM contacts WHERE user_id = ? ORDER BY created_at DESC';

        const stmt = this.db.prepare(query);
        const rows = status ? stmt.all(userId, status) as any[] : stmt.all(userId) as any[];

        return rows.map((row) => ({
            id: row.id,
            user_id: row.user_id,
            contact_id: row.contact_id,
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }));
    }

    // Solicitudes pendientes recibidas por un usuario (donde él es el contacto)
    getPendingRequestsForUser(userId: string): Contact[] {
        const stmt = this.db.prepare(
            'SELECT * FROM contacts WHERE contact_id = ? AND status = ? ORDER BY created_at DESC'
        );
        const rows = stmt.all(userId, 'pendiente') as any[];

        return rows.map((row) => ({
            id: row.id,
            user_id: row.user_id,
            contact_id: row.contact_id,
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }));
    }

    updateContactStatus(userId: string, contactId: string, status: string): void {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(
            'UPDATE contacts SET status = ?, updated_at = ? WHERE user_id = ? AND contact_id = ?'
        );
        stmt.run(status, now, userId, contactId);
    }

    deleteContact(userId: string, contactId: string): void {
        const stmt = this.db.prepare('DELETE FROM contacts WHERE user_id = ? AND contact_id = ?');
        stmt.run(userId, contactId);
    }

    // ============ CONVERSATIONS ============

    createConversation(conversation: Omit<Conversation, 'id' | 'created_at' | 'updated_at'> & { id: string }): Conversation {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO conversations (id, user_id_1, user_id_2, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

        stmt.run(conversation.id, conversation.user_id_1, conversation.user_id_2, now, now);

        return {
            id: conversation.id,
            user_id_1: conversation.user_id_1,
            user_id_2: conversation.user_id_2,
            created_at: now,
            updated_at: now,
        };
    }

    getConversation(id: string): Conversation | null {
        const stmt = this.db.prepare('SELECT * FROM conversations WHERE id = ?');
        const row = stmt.get(id) as any;

        if (!row) return null;

        return {
            id: row.id,
            user_id_1: row.user_id_1,
            user_id_2: row.user_id_2,
            created_at: row.created_at,
            updated_at: row.updated_at,
        };
    }

    getConversationByUsers(userId1: string, userId2: string): Conversation | null {
        const stmt = this.db.prepare(
            'SELECT * FROM conversations WHERE (user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)'
        );
        const row = stmt.get(userId1, userId2, userId2, userId1) as any;

        if (!row) return null;

        return {
            id: row.id,
            user_id_1: row.user_id_1,
            user_id_2: row.user_id_2,
            created_at: row.created_at,
            updated_at: row.updated_at,
        };
    }

    getConversationsByUser(userId: string): Conversation[] {
        const stmt = this.db.prepare(
            'SELECT * FROM conversations WHERE user_id_1 = ? OR user_id_2 = ? ORDER BY updated_at DESC'
        );
        const rows = stmt.all(userId, userId) as any[];

        return rows.map((row) => ({
            id: row.id,
            user_id_1: row.user_id_1,
            user_id_2: row.user_id_2,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }));
    }

    deleteConversation(id: string): void {
        const stmt = this.db.prepare('DELETE FROM conversations WHERE id = ?');
        stmt.run(id);
    }

    // ============ MESSAGES ============

    createMessage(message: Omit<Message, 'id' | 'read' | 'created_at'> & { id: string }): Message {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO messages (id, conversation_id, sender_id, content, message_type, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            message.id,
            message.conversation_id,
            message.sender_id,
            message.content,
            message.message_type,
            0,
            now
        );

        return {
            id: message.id,
            conversation_id: message.conversation_id,
            sender_id: message.sender_id,
            content: message.content,
            message_type: message.message_type,
            read: false,
            created_at: now,
        };
    }

    getMessage(id: string): Message | null {
        const stmt = this.db.prepare('SELECT * FROM messages WHERE id = ?');
        const row = stmt.get(id) as any;

        if (!row) return null;

        return {
            id: row.id,
            conversation_id: row.conversation_id,
            sender_id: row.sender_id,
            content: row.content,
            message_type: row.message_type,
            read: Boolean(row.read),
            created_at: row.created_at,
        };
    }

    getMessagesByConversation(conversationId: string): Message[] {
        const stmt = this.db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC');
        const rows = stmt.all(conversationId) as any[];

        return rows.map((row) => ({
            id: row.id,
            conversation_id: row.conversation_id,
            sender_id: row.sender_id,
            content: row.content,
            message_type: row.message_type,
            read: Boolean(row.read),
            created_at: row.created_at,
        }));
    }

    markMessageAsRead(id: string): void {
        const stmt = this.db.prepare('UPDATE messages SET read = 1 WHERE id = ?');
        stmt.run(id);
    }

    markConversationMessagesAsRead(conversationId: string): void {
        const stmt = this.db.prepare('UPDATE messages SET read = 1 WHERE conversation_id = ?');
        stmt.run(conversationId);
    }

    deleteMessage(id: string): void {
        const stmt = this.db.prepare('DELETE FROM messages WHERE id = ?');
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
