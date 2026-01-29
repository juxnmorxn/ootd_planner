const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const { randomUUID } = require('crypto');
const { createClient } = require('@libsql/client');
require('dotenv').config();

const app = express();
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
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Outfits
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS outfits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date_scheduled TEXT NOT NULL,
      layers_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, date_scheduled)
    );
  `);

  console.log('[Turso] Schema ensured');
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
      sql: `INSERT INTO garments (id, user_id, category, sub_category, image_url, cloudinary_id, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      args: [id, user_id, category, sub_category, imageUrl, cloudinaryId, now],
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

app.post('/api/outfits', async (req, res) => {
  try {
    let { id, user_id, date_scheduled, layers_json } = req.body;
    if (!user_id || !date_scheduled || !layers_json) {
      return res.status(400).json({ error: 'Datos incompletos para crear outfit' });
    }

    const now = new Date().toISOString();
    if (typeof layers_json !== 'string') {
      layers_json = JSON.stringify(layers_json);
    }

    const { rows: existing } = await turso.execute({
      sql: 'SELECT id FROM outfits WHERE user_id = ?1 AND date_scheduled = ?2',
      args: [user_id, date_scheduled],
    });

    if (existing.length > 0) {
      await turso.execute({
        sql: 'UPDATE outfits SET layers_json = ?1, updated_at = ?2 WHERE id = ?3',
        args: [layers_json, now, existing[0].id],
      });

      return res.json({
        id: existing[0].id,
        user_id,
        date_scheduled,
        layers_json,
      });
    }

    const outfitId = id || randomUUID();
    await turso.execute({
      sql: 'INSERT INTO outfits (id, user_id, date_scheduled, layers_json, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
      args: [outfitId, user_id, date_scheduled, layers_json, now, now],
    });

    res.json({ id: outfitId, user_id, date_scheduled, layers_json });
  } catch (error) {
    console.error('[API] Create outfit error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/outfits/user/:userId/date/:date', async (req, res) => {
  try {
    const { rows } = await turso.execute({
      sql: 'SELECT * FROM outfits WHERE user_id = ?1 AND date_scheduled = ?2',
      args: [req.params.userId, req.params.date],
    });

    if (rows.length === 0) return res.status(404).json({ error: 'Outfit not found' });

    const o = rows[0];
    res.json({
      id: o.id,
      user_id: o.user_id,
      date_scheduled: o.date_scheduled,
      layers_json: o.layers_json,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/outfits/user/:userId', async (req, res) => {
  try {
    const { rows } = await turso.execute({
      sql: 'SELECT * FROM outfits WHERE user_id = ?1 ORDER BY date_scheduled DESC',
      args: [req.params.userId],
    });

    res.json(rows.map(o => ({
      id: o.id,
      user_id: o.user_id,
      date_scheduled: o.date_scheduled,
      layers_json: o.layers_json,
    })));
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

// Static files
app.use(express.static(path.join(__dirname, 'dist')));

// SPA catch-all
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server after DB init
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[Turso API Server] Running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[Turso] Failed to initialize DB:', err);
    process.exit(1);
  });
