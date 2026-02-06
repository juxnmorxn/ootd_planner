const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const { randomUUID } = require('crypto');
const { createClient } = require('@libsql/client');
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});
const PORT = process.env.PORT || 3001;

// === Turso client ===
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error('[Turso] TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set');
}

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function initDb() {
  // Users
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      name TEXT,
      gender TEXT NOT NULL DEFAULT 'unspecified',
      email TEXT UNIQUE,
      role TEXT DEFAULT 'user',
      password_hash TEXT NOT NULL,
      profile_pic TEXT,
      custom_subcategories TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Garments
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS garments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      sub_category TEXT NOT NULL,
      image_url TEXT NOT NULL,
      cloudinary_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Outfits: permitir múltiples opciones por día (option_index)
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS outfits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date_scheduled TEXT NOT NULL,
      option_index INTEGER NOT NULL DEFAULT 1,
      layers_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Migrar esquemas antiguos si es necesario (añadir option_index si falta)
  await migrateOutfitsTable();
  await migrateGarmentsTable();

  // ============ CHAT TABLES ============

  // Tabla de contactos/amigos
  await turso.execute(`
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
    );
  `);

  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_contacts_user
    ON contacts(user_id);
  `);

  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_contacts_status
    ON contacts(status);
  `);

  // Tabla de conversaciones privadas
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id_1 TEXT NOT NULL,
      user_id_2 TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id_1) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id_2) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id_1, user_id_2)
    );
  `);

  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_conversations_users
    ON conversations(user_id_1, user_id_2);
  `);

  // Tabla de mensajes
  await turso.execute(`
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
    );
  `);

  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages(conversation_id);
  `);

  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_messages_sender
    ON messages(sender_id);
  `);

  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_messages_created
    ON messages(created_at DESC);
  `);

  console.log('[Turso] Schema ensured');
}

// Migración defensiva para la tabla garments en Turso (añadir updated_at si no existe)
async function migrateGarmentsTable() {
  try {
    const { rows } = await turso.execute(`PRAGMA table_info(garments)`);
    if (!rows || rows.length === 0) {
      return; // tabla aún no existe
    }

    const names = new Set(rows.map((c) => c.name));

    if (!names.has('updated_at')) {
      await turso.execute('ALTER TABLE garments ADD COLUMN updated_at TEXT');
    }

    // Backfill: si hay registros viejos o NULL, usar created_at
    await turso.execute(`
      UPDATE garments
      SET updated_at = COALESCE(updated_at, created_at, datetime('now'))
      WHERE updated_at IS NULL OR updated_at = ''
    `);

    await turso.execute(`
      CREATE INDEX IF NOT EXISTS idx_garments_user_updated_at
      ON garments(user_id, updated_at);
    `);
  } catch (error) {
    console.error('[Turso] Garments table migration error:', error);
  }
}

// Migración defensiva para la tabla outfits en Turso (añadir option_index si no existe)
async function migrateOutfitsTable() {
  try {
    const { rows } = await turso.execute(`PRAGMA table_info(outfits)`);
    if (!rows || rows.length === 0) {
      return; // tabla aún no existe
    }

    const names = new Set(rows.map((c) => c.name));

    if (!names.has('option_index')) {
      await turso.execute('BEGIN TRANSACTION');

      await turso.execute(`
        CREATE TABLE IF NOT EXISTS outfits_new (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          date_scheduled TEXT NOT NULL,
          option_index INTEGER NOT NULL DEFAULT 1,
          layers_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await turso.execute(`
        INSERT INTO outfits_new (id, user_id, date_scheduled, option_index, layers_json, created_at, updated_at)
        SELECT id, user_id, date_scheduled, 1 as option_index, layers_json,
               COALESCE(created_at, datetime('now')), COALESCE(updated_at, datetime('now'))
        FROM outfits;
      `);

      await turso.execute('DROP TABLE outfits');
      await turso.execute("ALTER TABLE outfits_new RENAME TO outfits");

      await turso.execute('COMMIT');
    }

    await turso.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_outfits_user_date_option
      ON outfits(user_id, date_scheduled, option_index);
    `);
  } catch (error) {
    console.error('[Turso] Outfits table migration error:', error);
  }
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// === Helpers ===
async function getUserById(id) {
  const { rows } = await turso.execute({
    sql: 'SELECT * FROM users WHERE id = ?1',
    args: [id],
  });
  return rows[0] || null;
}

async function getUserByEmailOrUsername(identifier) {
  const { rows } = await turso.execute({
    sql: 'SELECT * FROM users WHERE username = ?1 OR email = ?1',
    args: [identifier],
  });
  return rows[0] || null;
}

async function getConversationByUsers(userId1, userId2) {
  const { rows } = await turso.execute({
    sql: `SELECT * FROM conversations 
           WHERE (user_id_1 = ?1 AND user_id_2 = ?2) 
              OR (user_id_1 = ?2 AND user_id_2 = ?1)` ,
    args: [userId1, userId2],
  });
  return rows[0] || null;
}

async function getConversationById(conversationId) {
  const { rows } = await turso.execute({
    sql: 'SELECT * FROM conversations WHERE id = ?1',
    args: [conversationId],
  });
  return rows[0] || null;
}

// ============ USERS & AUTH ============

// Basic list (health-check)
app.get('/api/users', async (req, res) => {
  try {
    const { rows } = await turso.execute('SELECT id, username, email, role, profile_pic, custom_subcategories, created_at, updated_at FROM users ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('[API] Get users error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Direct create (for migrations/internal)
app.post('/api/users', async (req, res) => {
  try {
    const { id, username, email, password_hash, profile_pic, created_at, updated_at } = req.body;
    if (!email) return res.status(400).json({ error: 'Email es obligatorio' });

    const now = new Date().toISOString();
    const userId = id || randomUUID();
    const safePasswordHash = password_hash || 'no_pass';
    const finalUsername = (username && username.trim()) || email.split('@')[0];
    const finalName = finalUsername;

    await turso.execute({
      sql: `INSERT INTO users (id, username, name, email, password_hash, profile_pic, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      args: [userId, finalUsername, finalName, email, safePasswordHash, profile_pic || null, created_at || now, updated_at || now],
    });

    res.json({ id: userId, username: finalUsername, email });
  } catch (error) {
    console.error('[API] Create user error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, profile_pic } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'El email es obligatorio' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const { rows: existingRows } = await turso.execute({
      sql: 'SELECT id FROM users WHERE email = ?1 OR (username IS NOT NULL AND username = ?2)',
      args: [email, username || ''],
    });
    if (existingRows.length > 0) {
      return res.status(400).json({ error: 'El usuario o email ya está registrado' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const now = new Date().toISOString();

    const { rows: countRows } = await turso.execute('SELECT COUNT(*) as count FROM users');
    const usersCount = Number(countRows[0].count || 0);
    const role = usersCount === 0 ? 'admin' : 'user';

    let finalUsername = username && username.trim().length > 0 ? username.trim() : email.split('@')[0];
    const baseUsername = finalUsername;

    let suffix = 1;
    // Ensure unique username
    while (true) {
      const { rows } = await turso.execute({
        sql: 'SELECT 1 FROM users WHERE username = ?1',
        args: [finalUsername],
      });
      if (rows.length === 0) break;
      finalUsername = `${baseUsername}${suffix++}`;
    }

    const id = randomUUID();
    const finalName = finalUsername;

    await turso.execute({
      sql: `INSERT INTO users (id, username, name, email, role, gender, password_hash, profile_pic, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
      args: [id, finalUsername, finalName, email, role, 'unspecified', password_hash, profile_pic || null, now, now],
    });

    res.json({ id, username: finalUsername, email, role, profile_pic: profile_pic || null, created_at: now, updated_at: now });
  } catch (error) {
    console.error('[API] Register error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await getUserByEmailOrUsername(username);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const isMatch = await bcrypt.compare(password, user.password_hash || '');
    if (!isMatch) return res.status(401).json({ error: 'Contraseña incorrecta' });

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role || 'user',
      profile_pic: user.profile_pic,
      custom_subcategories: user.custom_subcategories,
      created_at: user.created_at,
      updated_at: user.updated_at,
    });
  } catch (error) {
    console.error('[API] Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ CONTACTS ============

// Buscar usuarios por username/email (búsqueda parcial, predictiva)
app.get('/api/contacts/search/:query', async (req, res) => {
  try {
    const search = String(req.params.query || '').toLowerCase();
    const excludeUserId = req.query.excludeUserId ? String(req.query.excludeUserId) : null;

    const { rows } = await turso.execute('SELECT id, username, email, role, profile_pic, custom_subcategories, created_at, updated_at FROM users');

    const matches = rows.filter((u) => {
      if (excludeUserId && u.id === excludeUserId) return false;
      const username = (u.username || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return username.includes(search) || email.includes(search);
    });

    if (!matches.length) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(matches);
  } catch (error) {
    console.error('[API] Contacts search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enviar solicitud de amistad
app.post('/api/contacts/request', async (req, res) => {
  try {
    const { user_id, contact_id } = req.body;

    console.log('[API] Contacts request - user_id:', user_id, 'contact_id:', contact_id);

    if (!user_id || !contact_id) {
      console.log('[API] Missing user_id or contact_id');
      return res.status(400).json({ error: 'user_id y contact_id requeridos' });
    }

    if (user_id === contact_id) {
      console.log('[API] User trying to add themselves');
      return res.status(400).json({ error: 'No puedes agregarte a ti mismo' });
    }

    const user = await getUserById(user_id);
    const contactUser = await getUserById(contact_id);
    if (!user || !contactUser) {
      console.log('[API] User not found - user:', user, 'contactUser:', contactUser);
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const { rows: existingRows } = await turso.execute({
      sql: 'SELECT id, status FROM contacts WHERE user_id = ?1 AND contact_id = ?2',
      args: [user_id, contact_id],
    });
    if (existingRows.length > 0) {
      console.log('[API] Request already exists');
      return res.status(400).json({ error: 'Ya existe una solicitud con este usuario' });
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    await turso.execute({
      sql: 'INSERT INTO contacts (id, user_id, contact_id, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
      args: [id, user_id, contact_id, 'pendiente', now, now],
    });

    console.log('[API] Contact request created:', id);
    res.json({ id, user_id, contact_id, status: 'pendiente', created_at: now, updated_at: now });
  } catch (error) {
    console.error('[API] Contacts request error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener solicitudes pendientes recibidas por un usuario
app.get('/api/contacts/pending/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { rows } = await turso.execute({
      sql: 'SELECT * FROM contacts WHERE contact_id = ?1 AND status = ?2 ORDER BY created_at DESC',
      args: [userId, 'pendiente'],
    });

    const enriched = [];
    for (const row of rows) {
      const fromUser = await getUserById(row.user_id);
      enriched.push({
        id: row.id,
        user_id: row.user_id,
        contact_id: row.contact_id,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        contact_user: fromUser
          ? { id: fromUser.id, username: fromUser.username, profile_pic: fromUser.profile_pic }
          : null,
      });
    }

    res.json(enriched);
  } catch (error) {
    console.error('[API] Contacts pending error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener contactos aceptados de un usuario
app.get('/api/contacts/accepted/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { rows } = await turso.execute({
      sql: 'SELECT * FROM contacts WHERE user_id = ?1 AND status = ?2 ORDER BY created_at DESC',
      args: [userId, 'aceptado'],
    });

    const enriched = [];
    for (const row of rows) {
      const contactUser = await getUserById(row.contact_id);
      enriched.push({
        id: row.id,
        user_id: row.user_id,
        contact_id: row.contact_id,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        contact_user: contactUser
          ? { id: contactUser.id, username: contactUser.username, profile_pic: contactUser.profile_pic }
          : null,
      });
    }

    res.json(enriched);
  } catch (error) {
    console.error('[API] Contacts accepted error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Aceptar solicitud de amistad
app.post('/api/contacts/accept', async (req, res) => {
  try {
    const { user_id, contact_id } = req.body;

    if (!user_id || !contact_id) {
      return res.status(400).json({ error: 'user_id y contact_id requeridos' });
    }

    const now = new Date().toISOString();

    const { rows: pendingRows } = await turso.execute({
      sql: 'SELECT * FROM contacts WHERE user_id = ?1 AND contact_id = ?2',
      args: [contact_id, user_id],
    });

    const pending = pendingRows[0];
    if (!pending || pending.status !== 'pendiente') {
      return res.status(404).json({ error: 'Solicitud no encontrada o no pendiente' });
    }

    await turso.execute({
      sql: 'UPDATE contacts SET status = ?1, updated_at = ?2 WHERE user_id = ?3 AND contact_id = ?4',
      args: ['aceptado', now, contact_id, user_id],
    });

    const { rows: inverseRows } = await turso.execute({
      sql: 'SELECT * FROM contacts WHERE user_id = ?1 AND contact_id = ?2',
      args: [user_id, contact_id],
    });

    if (inverseRows.length === 0) {
      const id = randomUUID();
      await turso.execute({
        sql: 'INSERT INTO contacts (id, user_id, contact_id, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
        args: [id, user_id, contact_id, 'aceptado', now, now],
      });
    } else {
      await turso.execute({
        sql: 'UPDATE contacts SET status = ?1, updated_at = ?2 WHERE user_id = ?3 AND contact_id = ?4',
        args: ['aceptado', now, user_id, contact_id],
      });
    }

    const existingConversation = await getConversationByUsers(user_id, contact_id);
    if (!existingConversation) {
      const convId = randomUUID();
      await turso.execute({
        sql: 'INSERT INTO conversations (id, user_id_1, user_id_2, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)',
        args: [convId, user_id, contact_id, now, now],
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Contacts accept error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rechazar solicitud de amistad
app.post('/api/contacts/reject', async (req, res) => {
  try {
    const { user_id, contact_id } = req.body;

    if (!user_id || !contact_id) {
      return res.status(400).json({ error: 'user_id y contact_id requeridos' });
    }

    const now = new Date().toISOString();

    await turso.execute({
      sql: 'UPDATE contacts SET status = ?1, updated_at = ?2 WHERE user_id = ?3 AND contact_id = ?4',
      args: ['rechazado', now, contact_id, user_id],
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Contacts reject error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bloquear contacto
app.post('/api/contacts/block', async (req, res) => {
  try {
    const { user_id, contact_id } = req.body;

    if (!user_id || !contact_id) {
      return res.status(400).json({ error: 'user_id y contact_id requeridos' });
    }

    const now = new Date().toISOString();

    const { rows } = await turso.execute({
      sql: 'SELECT * FROM contacts WHERE user_id = ?1 AND contact_id = ?2',
      args: [user_id, contact_id],
    });

    if (rows.length > 0) {
      await turso.execute({
        sql: 'UPDATE contacts SET status = ?1, updated_at = ?2 WHERE user_id = ?3 AND contact_id = ?4',
        args: ['bloqueado', now, user_id, contact_id],
      });
    } else {
      const id = randomUUID();
      await turso.execute({
        sql: 'INSERT INTO contacts (id, user_id, contact_id, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
        args: [id, user_id, contact_id, 'bloqueado', now, now],
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Contacts block error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Eliminar contacto
app.delete('/api/contacts/:user_id/:contact_id', async (req, res) => {
  try {
    const { user_id, contact_id } = req.params;

    await turso.execute({
      sql: 'DELETE FROM contacts WHERE user_id = ?1 AND contact_id = ?2',
      args: [user_id, contact_id],
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Contacts delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Asegurar conversación entre dos contactos (abrir chat)
app.post('/api/contacts/open-chat', async (req, res) => {
  try {
    const { user_id, contact_id } = req.body;

    if (!user_id || !contact_id) {
      return res.status(400).json({ error: 'user_id y contact_id requeridos' });
    }

    const { rows: contactRows } = await turso.execute({
      sql: 'SELECT * FROM contacts WHERE user_id = ?1 AND contact_id = ?2',
      args: [user_id, contact_id],
    });

    const contact = contactRows[0];
    // Permitir chats con contactos pendientes o aceptados
    if (!contact || (contact.status !== 'aceptado' && contact.status !== 'pendiente')) {
      return res.status(403).json({ error: 'No puedes chatear con este usuario' });
    }

    let conversation = await getConversationByUsers(user_id, contact_id);
    const now = new Date().toISOString();

    if (!conversation) {
      const convId = randomUUID();
      await turso.execute({
        sql: 'INSERT INTO conversations (id, user_id_1, user_id_2, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)',
        args: [convId, user_id, contact_id, now, now],
      });

      const { rows } = await turso.execute({
        sql: 'SELECT * FROM conversations WHERE id = ?1',
        args: [convId],
      });
      conversation = rows[0];
    }

    const otherUser = await getUserById(contact_id);

    res.json({
      id: conversation.id,
      user_id_1: conversation.user_id_1,
      user_id_2: conversation.user_id_2,
      created_at: conversation.created_at,
      updated_at: conversation.updated_at,
      other_user: otherUser
        ? { id: otherUser.id, username: otherUser.username, profile_pic: otherUser.profile_pic }
        : null,
    });
  } catch (error) {
    console.error('[API] Contacts open-chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ CONVERSATIONS ============

// Obtener conversaciones de un usuario
app.get('/api/conversations/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { rows } = await turso.execute({
      sql: 'SELECT * FROM conversations WHERE user_id_1 = ?1 OR user_id_2 = ?1 ORDER BY updated_at DESC',
      args: [userId],
    });

    console.log(`[API] Found ${rows.length} conversations for user ${userId}`);

    const enriched = [];

    for (const conv of rows) {
      const otherUserId = conv.user_id_1 === userId ? conv.user_id_2 : conv.user_id_1;
      const otherUser = await getUserById(otherUserId);
      
      console.log(`[API] Conversation ${conv.id}: otherUserId=${otherUserId}, otherUser found=${!!otherUser}`);

      const { rows: messageRows } = await turso.execute({
        sql: 'SELECT * FROM messages WHERE conversation_id = ?1 ORDER BY created_at ASC',
        args: [conv.id],
      });

      const unreadCount = messageRows.filter((m) => !m.read && m.sender_id !== userId).length;

      enriched.push({
        id: conv.id,
        user_id_1: conv.user_id_1,
        user_id_2: conv.user_id_2,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        other_user: otherUser
          ? { id: otherUser.id, username: otherUser.username, profile_pic: otherUser.profile_pic }
          : null,
        last_message: messageRows[messageRows.length - 1] || null,
        unread_count: unreadCount,
      });
    }

    console.log(`[API] Returning ${enriched.length} enriched conversations`);
    res.json(enriched);
  } catch (error) {
    console.error('[API] Conversations list error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener mensajes de una conversación
app.get('/api/conversations/:conversationId/messages', async (req, res) => {
  try {
    const { rows } = await turso.execute({
      sql: 'SELECT * FROM messages WHERE conversation_id = ?1 ORDER BY created_at ASC',
      args: [req.params.conversationId],
    });

    const enriched = [];
    for (const msg of rows) {
      const sender = await getUserById(msg.sender_id);
      enriched.push({
        ...msg,
        sender: sender
          ? { id: sender.id, username: sender.username, profile_pic: sender.profile_pic }
          : null,
      });
    }

    res.json(enriched);
  } catch (error) {
    console.error('[API] Conversation messages error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ MESSAGES ============

// Enviar mensaje
app.post('/api/messages', async (req, res) => {
  try {
    const { conversation_id, sender_id, content, message_type } = req.body;

    console.log('[API] POST /messages:', { conversation_id, sender_id, content: content?.substring(0, 50) });

    // Validación de entrada
    if (!conversation_id || !sender_id || !content?.trim()) {
      console.error('[API] Invalid message data');
      return res.status(400).json({ error: 'conversation_id, sender_id y content requeridos' });
    }

    const conversation = await getConversationById(conversation_id);
    if (!conversation) {
      console.error('[API] Conversation not found:', conversation_id);
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    if (conversation.user_id_1 !== sender_id && conversation.user_id_2 !== sender_id) {
      console.error('[API] Unauthorized message sender:', sender_id);
      return res.status(403).json({ error: 'No tienes permiso para enviar mensajes en esta conversación' });
    }

    const otherUserId = conversation.user_id_1 === sender_id ? conversation.user_id_2 : conversation.user_id_1;
    const { rows: contactRows } = await turso.execute({
      sql: 'SELECT * FROM contacts WHERE user_id = ?1 AND contact_id = ?2',
      args: [sender_id, otherUserId],
    });

    const contact = contactRows[0];
    if (!contact || contact.status !== 'aceptado') {
      console.error('[API] Contact not accepted:', sender_id, otherUserId);
      return res.status(403).json({ error: 'No puedes enviar mensajes a este usuario' });
    }

    const now = new Date().toISOString();
    const messageId = randomUUID();

    // Guardar con timestamp updated_at para sincronización
    await turso.execute({
      sql: 'INSERT INTO messages (id, conversation_id, sender_id, content, message_type, read, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)',
      args: [messageId, conversation_id, sender_id, content.trim(), message_type || 'text', 0, now, now],
    });

    await turso.execute({
      sql: 'UPDATE conversations SET updated_at = ?1 WHERE id = ?2',
      args: [now, conversation_id],
    });

    const newMessage = {
      id: messageId,
      conversation_id,
      sender_id,
      content: content.trim(),
      message_type: message_type || 'text',
      read: false,
      created_at: now,
      updated_at: now,
    };

    console.log('[API] Message saved successfully:', messageId);
    res.json(newMessage);
  } catch (error) {
    console.error('[API] Send message error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Marcar mensaje como leído
app.put('/api/messages/:messageId/read', async (req, res) => {
  try {
    await turso.execute({
      sql: 'UPDATE messages SET read = 1 WHERE id = ?1',
      args: [req.params.messageId],
    });
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Mark message read error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Marcar conversación como leída
app.put('/api/conversations/:conversationId/read', async (req, res) => {
  try {
    await turso.execute({
      sql: 'UPDATE messages SET read = 1 WHERE conversation_id = ?1',
      args: [req.params.conversationId],
    });
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Mark conversation read error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Change password
app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { userId, oldPassword, newPassword } = req.body;

    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Datos incompletos para cambiar contraseña' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const isMatch = await bcrypt.compare(oldPassword, user.password_hash || '');
    if (!isMatch) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);
    const now = new Date().toISOString();

    await turso.execute({
      sql: 'UPDATE users SET password_hash = ?1, updated_at = ?2 WHERE id = ?3',
      args: [newHash, now, userId],
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Change password error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user by id
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
  try {
    await turso.execute({
      sql: 'DELETE FROM users WHERE id = ?1',
      args: [req.params.id],
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update profile picture
app.post('/api/users/:id/profile-pic', async (req, res) => {
  try {
    const { id } = req.params;
    const { image_data } = req.body;

    if (!image_data || typeof image_data !== 'string') {
      return res.status(400).json({ error: 'Imagen inválida' });
    }

    const user = await getUserById(id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const result = await cloudinary.uploader.upload(image_data, {
      folder: `outfit-planner/${id}/profile`,
      public_id: 'avatar',
      overwrite: true,
      upload_preset: 'oodt_123',
      resource_type: 'image',
    });

    const imageUrl = result.secure_url;
    const now = new Date().toISOString();

    await turso.execute({
      sql: 'UPDATE users SET profile_pic = ?1, updated_at = ?2 WHERE id = ?3',
      args: [imageUrl, now, id],
    });

    const { rows } = await turso.execute({
      sql: 'SELECT id, username, email, profile_pic, custom_subcategories, created_at, updated_at FROM users WHERE id = ?1',
      args: [id],
    });

    res.json(rows[0]);
  } catch (error) {
    console.error('[API] Update profile pic error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
app.put('/api/users/:id', async (req, res) => {
  try {
    const { username, email } = req.body;
    const { id } = req.params;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'El email es obligatorio' });
    }

    const { rows: conflict } = await turso.execute({
      sql: 'SELECT id FROM users WHERE (email = ?1 OR username = ?2) AND id <> ?3',
      args: [email, username || '', id],
    });
    if (conflict.length > 0) {
      return res.status(400).json({ error: 'El usuario o email ya está registrado' });
    }

    const now = new Date().toISOString();
    const finalUsername = (username && username.trim().length > 0) ? username.trim() : email;
    const finalName = finalUsername;

    await turso.execute({
      sql: 'UPDATE users SET username = ?1, name = ?2, email = ?3, updated_at = ?4 WHERE id = ?5',
      args: [finalUsername, finalName, email, now, id],
    });

    const { rows } = await turso.execute({
      sql: 'SELECT id, username, email, profile_pic, custom_subcategories, created_at, updated_at FROM users WHERE id = ?1',
      args: [id],
    });

    res.json(rows[0]);
  } catch (error) {
    console.error('[API] Update user error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ GARMENTS ============

app.post('/api/garments', async (req, res) => {
  try {
    const { id, user_id, category, sub_category, image_data } = req.body;

    const result = await cloudinary.uploader.upload(image_data, {
      folder: `outfit-planner/${user_id}/garments`,
      public_id: id,
      upload_preset: 'oodt_123',
      overwrite: true,
      resource_type: 'image',
    });

    const imageUrl = result.secure_url;
    const cloudinaryId = `outfit-planner/${user_id}/garments/${id}`;
    const now = new Date().toISOString();

    await turso.execute({
      sql: `INSERT INTO garments (id, user_id, category, sub_category, image_url, cloudinary_id, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      args: [id, user_id, category, sub_category, imageUrl, cloudinaryId, now, now],
    });

    res.json({ id, user_id, category, sub_category, image_data: imageUrl });
  } catch (error) {
    console.error('[API] Create garment error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/garments/user/:userId', async (req, res) => {
  try {
    const { rows } = await turso.execute({
      sql: 'SELECT * FROM garments WHERE user_id = ?1 ORDER BY created_at DESC',
      args: [req.params.userId],
    });
    res.json(rows.map(g => ({
      id: g.id,
      user_id: g.user_id,
      category: g.category,
      sub_category: g.sub_category,
      image_data: g.image_url,
      created_at: g.created_at,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/garments/user/:userId/category/:category', async (req, res) => {
  try {
    const { rows } = await turso.execute({
      sql: 'SELECT * FROM garments WHERE user_id = ?1 AND category = ?2 ORDER BY created_at DESC',
      args: [req.params.userId, req.params.category],
    });
    res.json(rows.map(g => ({
      id: g.id,
      user_id: g.user_id,
      category: g.category,
      sub_category: g.sub_category,
      image_data: g.image_url,
      created_at: g.created_at,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: all garments
app.get('/api/admin/garments', async (req, res) => {
  try {
    const { rows } = await turso.execute(`
      SELECT g.*, u.username as owner_name, u.email as owner_email
      FROM garments g
      JOIN users u ON g.user_id = u.id
      ORDER BY g.created_at DESC
    `);
    res.json(rows.map(g => ({
      id: g.id,
      user_id: g.user_id,
      owner_name: g.owner_name,
      owner_email: g.owner_email,
      category: g.category,
      sub_category: g.sub_category,
      image_data: g.image_url,
      created_at: g.created_at,
    })));
  } catch (error) {
    console.error('[API] Admin get all garments error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/garments/:id', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    try {
      await cloudinary.uploader.destroy(`outfit-planner/${userId}/garments/${req.params.id}`);
    } catch (err) {
      console.error('[Cloudinary] Delete error:', err);
    }

    await turso.execute({
      sql: 'DELETE FROM garments WHERE id = ?1',
      args: [req.params.id],
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ OUTFITS ============

// Crear una nueva opción de outfit para una fecha.
app.post('/api/outfits', async (req, res) => {
  try {
    let { id, user_id, date_scheduled, layers_json, option_index } = req.body;
    if (!user_id || !date_scheduled || !layers_json) {
      return res.status(400).json({ error: 'Datos incompletos para crear outfit' });
    }

    const now = new Date().toISOString();
    if (typeof layers_json !== 'string') {
      layers_json = JSON.stringify(layers_json);
    }

    // Calcular option_index si no viene
    if (option_index == null) {
      const { rows: maxRows } = await turso.execute({
        sql: 'SELECT MAX(option_index) as maxOpt FROM outfits WHERE user_id = ?1 AND date_scheduled = ?2',
        args: [user_id, date_scheduled],
      });
      const maxOpt = maxRows.length && maxRows[0].maxOpt != null ? Number(maxRows[0].maxOpt) : 0;
      option_index = maxOpt + 1;
    }

    const outfitId = id || randomUUID();
    await turso.execute({
      sql: 'INSERT INTO outfits (id, user_id, date_scheduled, option_index, layers_json, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
      args: [outfitId, user_id, date_scheduled, option_index, layers_json, now, now],
    });

    res.json({ id: outfitId, user_id, date_scheduled, option_index, layers_json });
  } catch (error) {
    console.error('[API] Create outfit error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener la primera opción de outfit para una fecha (por compatibilidad)
app.get('/api/outfits/user/:userId/date/:date', async (req, res) => {
  try {
    const { rows } = await turso.execute({
      sql: 'SELECT * FROM outfits WHERE user_id = ?1 AND date_scheduled = ?2 ORDER BY option_index ASC LIMIT 1',
      args: [req.params.userId, req.params.date],
    });

    if (rows.length === 0) return res.status(404).json({ error: 'Outfit not found' });

    const o = rows[0];
    res.json({
      id: o.id,
      user_id: o.user_id,
      date_scheduled: o.date_scheduled,
      option_index: o.option_index,
      layers_json: o.layers_json,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener todas las opciones de outfit para una fecha
app.get('/api/outfits/user/:userId/date/:date/options', async (req, res) => {
  try {
    const { rows } = await turso.execute({
      sql: 'SELECT * FROM outfits WHERE user_id = ?1 AND date_scheduled = ?2 ORDER BY option_index ASC',
      args: [req.params.userId, req.params.date],
    });

    res.json(
      rows.map((o) => ({
        id: o.id,
        user_id: o.user_id,
        date_scheduled: o.date_scheduled,
        option_index: o.option_index,
        layers_json: o.layers_json,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/outfits/user/:userId', async (req, res) => {
  try {
    const { rows } = await turso.execute({
      sql: 'SELECT * FROM outfits WHERE user_id = ?1 ORDER BY date_scheduled DESC, option_index ASC',
      args: [req.params.userId],
    });

    res.json(
      rows.map((o) => ({
        id: o.id,
        user_id: o.user_id,
        date_scheduled: o.date_scheduled,
        option_index: o.option_index,
        layers_json: o.layers_json,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un outfit por ID
app.get('/api/outfits/:id', async (req, res) => {
  try {
    const { rows } = await turso.execute({
      sql: 'SELECT * FROM outfits WHERE id = ?1',
      args: [req.params.id],
    });

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Outfit not found' });
    }

    const o = rows[0];
    res.json({
      id: o.id,
      user_id: o.user_id,
      date_scheduled: o.date_scheduled,
      option_index: o.option_index,
      layers_json: o.layers_json,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/outfits/:id', async (req, res) => {
  try {
    const { layers_json } = req.body;
    const now = new Date().toISOString();

    await turso.execute({
      sql: 'UPDATE outfits SET layers_json = ?1, updated_at = ?2 WHERE id = ?3',
      args: [layers_json, now, req.params.id],
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/outfits/:id', async (req, res) => {
  try {
    await turso.execute({
      sql: 'DELETE FROM outfits WHERE id = ?1',
      args: [req.params.id],
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ STATS ============

app.get('/api/stats/:userId', async (req, res) => {
  try {
    const { rows: gRows } = await turso.execute({
      sql: 'SELECT COUNT(*) as count FROM garments WHERE user_id = ?1',
      args: [req.params.userId],
    });
    const { rows: oRows } = await turso.execute({
      sql: 'SELECT COUNT(*) as count FROM outfits WHERE user_id = ?1',
      args: [req.params.userId],
    });

    res.json({
      garments: Number(gRows[0].count || 0),
      outfits: Number(oRows[0].count || 0),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ SYNC (WatermelonDB) ============

/**
 * POST /api/sync/pull
 * WatermelonDB descarga cambios desde Turso
 * 
 * Request: { userId, lastPulledAt }
 * Response: { changes, timestamp }
 */
app.post('/api/sync/pull', async (req, res) => {
  try {
    const { userId, lastPulledAt } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const timestamp = Date.now();
    const lastPulledDate = new Date(lastPulledAt || 0).toISOString();

    // Traer garments modificados
    const { rows: garmentRows } = await turso.execute({
      sql: `SELECT * FROM garments 
            WHERE user_id = ?1 
            AND (created_at > ?2 OR COALESCE(updated_at, created_at) > ?2)
            ORDER BY COALESCE(updated_at, created_at) DESC`,
      args: [userId, lastPulledDate],
    });

    // Traer outfits modificados
    const { rows: outfitRows } = await turso.execute({
      sql: `SELECT * FROM outfits 
            WHERE user_id = ?1 
            AND (created_at > ?2 OR updated_at > ?2)
            ORDER BY updated_at DESC`,
      args: [userId, lastPulledDate],
    });

    // Clasificar garments en created, updated, deleted
    const garmentChanges = {
      created: [],
      updated: [],
      deleted: [],
    };

    for (const g of garmentRows) {
      const createdAt = new Date(g.created_at).getTime();
      const updatedAt = new Date(g.updated_at || g.created_at).getTime();

      // Si created_at == updated_at, es una creación
      if (createdAt === updatedAt) {
        garmentChanges.created.push(g);
      } else {
        garmentChanges.updated.push(g);
      }
    }

    // Clasificar outfits en created, updated, deleted
    const outfitChanges = {
      created: [],
      updated: [],
      deleted: [],
    };

    for (const o of outfitRows) {
      const createdAt = new Date(o.created_at).getTime();
      const updatedAt = new Date(o.updated_at || o.created_at).getTime();

      if (createdAt === updatedAt) {
        outfitChanges.created.push(o);
      } else {
        outfitChanges.updated.push(o);
      }
    }

    res.json({
      changes: {
        garments: garmentChanges,
        outfits: outfitChanges,
        users: {
          created: [],
          updated: [],
          deleted: [],
        },
      },
      timestamp,
    });
  } catch (error) {
    console.error('[API] Sync pull error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sync/push
 * WatermelonDB carga cambios a Turso
 * 
 * Request: { userId, changes: { garments, outfits, users } }
 * Response: { success: true }
 */
app.post('/api/sync/push', async (req, res) => {
  try {
    const { userId, changes } = req.body;

    if (!userId || !changes) {
      return res.status(400).json({ error: 'userId and changes required' });
    }

    const now = new Date().toISOString();

    // ===== GARMENTS =====
    if (changes.garments) {
      // Created garments
      for (const g of changes.garments.created || []) {
        const { id, category, sub_category, image_url, cloudinary_id } = g;
        await turso.execute({
          sql: `INSERT OR REPLACE INTO garments 
                (id, user_id, category, sub_category, image_url, cloudinary_id, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
          args: [id, userId, category, sub_category, image_url || '', cloudinary_id || '', now, now],
        });
      }

      // Updated garments
      for (const g of changes.garments.updated || []) {
        const { id, category, sub_category, image_url } = g;
        await turso.execute({
          sql: `UPDATE garments 
                SET category = ?1, sub_category = ?2, image_url = ?3, updated_at = ?4
                WHERE id = ?5`,
          args: [category, sub_category, image_url || '', now, id],
        });
      }

      // Deleted garments
      for (const gId of changes.garments.deleted || []) {
        await turso.execute({
          sql: 'DELETE FROM garments WHERE id = ?1 AND user_id = ?2',
          args: [gId, userId],
        });
      }
    }

    // ===== OUTFITS =====
    if (changes.outfits) {
      // Created outfits
      for (const o of changes.outfits.created || []) {
        const { id, date_scheduled, option_index, layers_json } = o;
        await turso.execute({
          sql: `INSERT OR REPLACE INTO outfits 
                (id, user_id, date_scheduled, option_index, layers_json, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
          args: [id, userId, date_scheduled, option_index || 1, layers_json || '[]', now, now],
        });
      }

      // Updated outfits
      for (const o of changes.outfits.updated || []) {
        const { id, date_scheduled, option_index, layers_json } = o;
        await turso.execute({
          sql: `UPDATE outfits 
                SET date_scheduled = ?1, option_index = ?2, layers_json = ?3, updated_at = ?4
                WHERE id = ?5`,
          args: [date_scheduled, option_index || 1, layers_json || '[]', now, id],
        });
      }

      // Deleted outfits
      for (const oId of changes.outfits.deleted || []) {
        await turso.execute({
          sql: 'DELETE FROM outfits WHERE id = ?1 AND user_id = ?2',
          args: [oId, userId],
        });
      }
    }

    // ===== USERS (si hay cambios en el perfil) =====
    if (changes.users) {
      for (const u of changes.users.updated || []) {
        const { id, username, email, profile_pic, custom_subcategories } = u;
        await turso.execute({
          sql: `UPDATE users 
                SET username = ?1, email = ?2, profile_pic = ?3, custom_subcategories = ?4, updated_at = ?5
                WHERE id = ?6`,
          args: [username, email, profile_pic, custom_subcategories, now, id],
        });
      }
    }

    console.log('[API] Sync push successful for user:', userId);
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Sync push error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ REMOVE BACKGROUND (REMBG) ============

app.post('/api/remove-background', async (req, res) => {
  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: 'imageData required' });
    }

    // Llamar a REMBG via Python subprocess
    const result = await removeBackgroundViaRembg(imageData);

    res.json({ imageData: result });
  } catch (error) {
    console.error('[API] Remove background error:', error);
    res.status(500).json({ error: error.message });
  }
});

async function removeBackgroundViaRembg(imageData) {
  const { spawn } = require('child_process');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  return new Promise((resolve, reject) => {
    try {
      // Crear archivos temporales
      const tmpDir = os.tmpdir();
      const inputFile = path.join(tmpDir, `rembg_input_${Date.now()}.png`);
      const outputFile = path.join(tmpDir, `rembg_output_${Date.now()}.png`);

      // Convertir base64 a archivo
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(inputFile, imageBuffer);

      // Ejecutar REMBG
      const pythonCmdFromEnv = process.env.REMBG_PYTHON || 'python';

      const spawnRembg = (pythonCmd) =>
        spawn(pythonCmd, ['-m', 'rembg', 'i', inputFile, outputFile], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });

      let rembg = spawnRembg(pythonCmdFromEnv);
      let stdout = '';
      let stderr = '';

      if (rembg.stdout) rembg.stdout.on('data', (d) => (stdout += d.toString()));
      if (rembg.stderr) rembg.stderr.on('data', (d) => (stderr += d.toString()));

      const timeout = setTimeout(() => {
        rembg.kill();
        fs.unlink(inputFile, () => {});
        fs.unlink(outputFile, () => {});
        reject(new Error('REMBG timeout (30s)'));
      }, 30000);

      rembg.on('close', (code) => {
        clearTimeout(timeout);

        if (code !== 0) {
          fs.unlink(inputFile, () => {});
          fs.unlink(outputFile, () => {});
          const details = (stderr || stdout || '').trim();
          reject(new Error(`REMBG failed (code ${code})${details ? `: ${details}` : ''}`));
          return;
        }

        if (!fs.existsSync(outputFile)) {
          fs.unlink(inputFile, () => {});
          reject(new Error('REMBG produced no output file'));
          return;
        }

        // Leer resultado y convertir a base64
        const resultBuffer = fs.readFileSync(outputFile);
        const resultBase64 = `data:image/png;base64,${resultBuffer.toString('base64')}`;

        // Limpiar archivos temporales
        fs.unlink(inputFile, () => {});
        fs.unlink(outputFile, () => {});

        resolve(resultBase64);
      });

      rembg.on('error', (error) => {
        // Render suele tener python3, no python
        if (error && error.code === 'ENOENT' && (process.env.REMBG_PYTHON || 'python') === 'python') {
          try {
            rembg = spawnRembg('python3');
            stdout = '';
            stderr = '';

            if (rembg.stdout) rembg.stdout.on('data', (d) => (stdout += d.toString()));
            if (rembg.stderr) rembg.stderr.on('data', (d) => (stderr += d.toString()));

            rembg.on('close', (code) => {
              clearTimeout(timeout);

              if (code !== 0) {
                fs.unlink(inputFile, () => {});
                fs.unlink(outputFile, () => {});
                const details = (stderr || stdout || '').trim();
                reject(new Error(`REMBG failed (code ${code})${details ? `: ${details}` : ''}`));
                return;
              }

              if (!fs.existsSync(outputFile)) {
                fs.unlink(inputFile, () => {});
                reject(new Error('REMBG produced no output file'));
                return;
              }

              const resultBuffer = fs.readFileSync(outputFile);
              const resultBase64 = `data:image/png;base64,${resultBuffer.toString('base64')}`;
              fs.unlink(inputFile, () => {});
              fs.unlink(outputFile, () => {});
              resolve(resultBase64);
            });

            rembg.on('error', (error2) => {
              clearTimeout(timeout);
              fs.unlink(inputFile, () => {});
              fs.unlink(outputFile, () => {});
              reject(error2);
            });

            return;
          } catch (retryErr) {
            // fall through to reject below
          }
        }
        clearTimeout(timeout);
        fs.unlink(inputFile, () => {});
        fs.unlink(outputFile, () => {});
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Static files
app.use(express.static(path.join(__dirname, 'dist')));

// SPA catch-all
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server after DB init
initDb()
  .then(() => {
    // Socket.io event handlers
    io.on('connection', (socket) => {
      console.log(`[Socket.io] User connected: ${socket.id}`);

      // User connects (sends userId)
      socket.on('user:connect', (userId) => {
        socket.data.userId = userId;
        
        // Unirse a room específico del usuario para mensajes dirigidos
        socket.join(`user:${userId}`);
        
        console.log(`[Socket.io] User authenticated: ${userId}, Socket ID: ${socket.id}`);

        // Notificar a otros que este usuario está online
        io.emit('user:status', {
          userId,
          status: 'online',
          timestamp: new Date().toISOString(),
        });
      });

      // Message events
      socket.on('message:send', async (data) => {
        console.log('[Socket.io] Received message:send event with data:', JSON.stringify(data, null, 2));
        
        const { conversationId, senderId, recipientId, content } = data;
        
        console.log('[Socket.io] Destructured values:');
        console.log('  - conversationId:', conversationId, 'type:', typeof conversationId);
        console.log('  - senderId:', senderId, 'type:', typeof senderId);
        console.log('  - recipientId:', recipientId, 'type:', typeof recipientId);
        console.log('  - content:', content, 'type:', typeof content, 'trimmed:', content?.trim());
        
        if (!conversationId || !senderId || !recipientId || !content?.trim()) {
          console.error('[Socket.io] Validation failed - Invalid message data:');
          console.error('  - conversationId exists?', !!conversationId);
          console.error('  - senderId exists?', !!senderId);
          console.error('  - recipientId exists?', !!recipientId);
          console.error('  - content exists and not empty?', !!(content?.trim()));
          socket.emit('message:error', { error: 'Invalid message data', received: { conversationId, senderId, recipientId, content } });
          return;
        }

        try {
          const id = randomUUID();
          const now = new Date().toISOString();

          // 1. Guardar en BD PRIMERO
          await turso.execute({
            sql: 'INSERT INTO messages (id, conversation_id, sender_id, content, message_type, read, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)',
            args: [id, conversationId, senderId, content.trim(), 'text', false, now, now],
          });

          console.log(`[Socket.io] Message saved to DB: ${id}`);

          // 2. Enviar confirmación al remitente
          socket.emit('message:sent', {
            id,
            created_at: now,
            status: 'delivered',
          });

          // 3. Enviar al recipiente si está online
          io.to(`user:${recipientId}`).emit('message:received', {
            id,
            conversation_id: conversationId,
            sender_id: senderId,
            content: content.trim(),
            message_type: 'text',
            read: false,
            created_at: now,
          });

          console.log(`[Socket.io] Message delivered to recipient: ${recipientId}`);
        } catch (error) {
          console.error('[Socket.io] Error saving message:', error);
          socket.emit('message:error', { 
            error: 'Failed to save message',
            details: error.message 
          });
        }
      });

      // Typing indicator
      socket.on('user:typing', (data) => {
        const { conversationId, userId, recipientId, isTyping } = data;
        io.emit('user:typing', {
          userId,
          isTyping,
          conversationId,
        });
      });

      // Mark message as read
      socket.on('message:markAsRead', async (data) => {
        const { messageId, conversationId, userId } = data;
        
        if (!messageId || !userId) {
          console.error('[Socket.io] Invalid markAsRead data:', data);
          return;
        }

        try {
          const now = new Date().toISOString();
          
          // Actualizar en BD
          await turso.execute({
            sql: 'UPDATE messages SET read = 1, updated_at = ?1 WHERE id = ?2',
            args: [now, messageId],
          });

          console.log(`[Socket.io] Message marked as read: ${messageId}`);

          // Notificar al remitente
          io.emit('message:read', {
            messageId,
            conversationId,
            userId,
            readAt: now,
          });
        } catch (error) {
          console.error('[Socket.io] Error marking message as read:', error);
        }
      });

      // Disconnect
      socket.on('disconnect', () => {
        console.log(`[Socket.io] User disconnected: ${socket.id}`);
        io.emit('user:status', {
          userId: socket.data.userId,
          status: 'offline',
          timestamp: new Date().toISOString(),
        });
      });
    });

    server.listen(PORT, () => {
      console.log(`[Turso API Server] Running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[Turso] Failed to initialize DB:', err);
    process.exit(1);
  });
