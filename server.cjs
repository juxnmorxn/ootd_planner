const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Indicador de si la tabla users tiene una columna heredada "gender"
let USERS_HAS_GENDER = false;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Configurar Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Inicializar SQLite
const DB_PATH = path.join(__dirname, 'outfit-planner.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Pequeña migración defensiva para asegurar que la tabla users
// tiene todas las columnas esperadas incluso si el archivo SQLite
// es antiguo.
function migrateUsersTable() {
    try {
        const columns = db.prepare("PRAGMA table_info('users')").all();
        const names = new Set(columns.map((c) => c.name));

        // Registrar si existe la columna heredada "gender"
        if (names.has('gender')) {
            USERS_HAS_GENDER = true;
        }

        // Si la tabla no existe aún, no hacemos nada aquí; la
        // creación completa ocurrirá en los CREATE TABLE posteriores.
        if (columns.length === 0) {
            return;
        }

        if (!names.has('email')) {
            // Hacer email opcional para no romper filas antiguas; las nuevas
            // inserciones seguirán validando este campo a nivel de API.
            db.exec("ALTER TABLE users ADD COLUMN email TEXT");
        }

        if (!names.has('username')) {
            db.exec("ALTER TABLE users ADD COLUMN username TEXT");
        }

        // Algunas versiones antiguas del esquema usaban "name" como campo obligatorio.
        // Lo mantenemos por compatibilidad pero siempre lo rellenamos a partir de username.
        if (!names.has('name')) {
            db.exec("ALTER TABLE users ADD COLUMN name TEXT");
        }

        if (!names.has('profile_pic')) {
            db.exec("ALTER TABLE users ADD COLUMN profile_pic TEXT");
        }

        // Si no existe la columna gender, la añadimos como opcional con valor por defecto
        if (!names.has('gender')) {
            db.exec("ALTER TABLE users ADD COLUMN gender TEXT NOT NULL DEFAULT 'unspecified'");
            USERS_HAS_GENDER = true;
        }

        if (!names.has('password_hash')) {
            // Para usuarios antiguos sin contraseña, usamos un valor placeholder;
            // las nuevas cuentas siempre establecerán un hash real.
            db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT DEFAULT 'no_pass'");
        }

        if (!names.has('custom_subcategories')) {
            db.exec("ALTER TABLE users ADD COLUMN custom_subcategories TEXT");
        }

        if (!names.has('created_at')) {
            db.exec(
                "ALTER TABLE users ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'))"
            );
        }

        if (!names.has('updated_at')) {
            db.exec(
                "ALTER TABLE users ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))"
            );
        }

        if (!names.has('role')) {
            db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
        }
    } catch (err) {
        console.error('[DB] Users table migration error:', err);
    }
}

// Migración defensiva para la tabla outfits, para soportar múltiples opciones por día
function migrateOutfitsTable() {
    try {
        const columns = db.prepare("PRAGMA table_info('outfits')").all();
        if (columns.length === 0) {
            // La tabla no existe aún; la creará el CREATE TABLE posterior
            return;
        }

        const names = new Set(columns.map((c) => c.name));

        // Si falta option_index, migramos a una nueva tabla con el nuevo esquema
        if (!names.has('option_index')) {
            db.exec('BEGIN TRANSACTION');

            db.exec(`
              CREATE TABLE IF NOT EXISTS outfits_new (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                date_scheduled TEXT NOT NULL,
                option_index INTEGER NOT NULL DEFAULT 1,
                layers_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
              )
            `);

            // Copiar datos existentes, asignando option_index = 1 por defecto
            db.exec(`
              INSERT INTO outfits_new (id, user_id, date_scheduled, option_index, layers_json, created_at, updated_at)
              SELECT id, user_id, date_scheduled, 1 as option_index, layers_json,
                     COALESCE(created_at, datetime('now')), COALESCE(updated_at, datetime('now'))
              FROM outfits
            `);

            db.exec('DROP TABLE outfits');
            db.exec("ALTER TABLE outfits_new RENAME TO outfits");

            db.exec('COMMIT');
        }

        // Asegurar índice único por usuario/fecha/opción
        db.exec(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_outfits_user_date_option
          ON outfits(user_id, date_scheduled, option_index)
        `);
    } catch (err) {
        console.error('[DB] Outfits table migration error:', err);
    }
}

// Crear tablas
// Crear tablas
// Crear tablas
db.exec(`
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
  )
`);

// Ejecutar migración por si el esquema era antiguo
migrateUsersTable();

db.exec(`
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

db.exec(`
    CREATE TABLE IF NOT EXISTS outfits (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        date_scheduled TEXT NOT NULL,
        option_index INTEGER NOT NULL DEFAULT 1,
        layers_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
`);

// Ejecutar migración de outfits por si el esquema era antiguo (y asegurar índice)
migrateOutfitsTable();

// ============ AUTH & USERS ============

// Listado básico de usuarios (también usado como health-check desde el frontend)
app.get('/api/users', (req, res) => {
    try {
        const stmt = db.prepare('SELECT id, username, email, role, profile_pic, custom_subcategories, created_at, updated_at FROM users ORDER BY created_at DESC');
        const users = stmt.all();
        res.json(users);
    } catch (error) {
        console.error('[API] Get users error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Creación directa (para migraciones/sync internas)
app.post('/api/users', async (req, res) => {
    try {
        const { id, username, email, password_hash, profile_pic, created_at, updated_at } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email es obligatorio' });
        }

        const now = new Date().toISOString();
        const userId = id || randomUUID();
        const safePasswordHash = password_hash || 'no_pass';
        const finalUsername = (username && username.trim().length > 0) ? username.trim() : email.split('@')[0];
        const finalName = finalUsername;

        const stmt = db.prepare('INSERT INTO users (id, username, name, email, password_hash, profile_pic, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        stmt.run(
            userId,
            finalUsername,
            finalName,
            email,
            safePasswordHash,
            profile_pic || null,
            created_at || now,
            updated_at || now
        );

        res.json({ id: userId, username: finalUsername, email });
    } catch (error) {
        console.error('[API] Create user error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Registro desde la app (email obligatorio, username opcional)
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, profile_pic } = req.body;

        if (!email || typeof email !== 'string') {
            return res.status(400).json({ error: 'El email es obligatorio' });
        }
        if (!password || typeof password !== 'string' || password.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }

        // Verificar si ya existe por email o username
        const existing = db.prepare('SELECT id FROM users WHERE email = ? OR (username IS NOT NULL AND username = ?)').get(email, username || '');
        if (existing) {
            return res.status(400).json({ error: 'El usuario o email ya está registrado' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        const now = new Date().toISOString();
        const id = randomUUID();

        // Si es el primer usuario, lo hacemos admin
        const usersCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const role = usersCount === 0 ? 'admin' : 'user';

        // Si no hay username, derivarlo del email (antes de la @)
        let finalUsername = username && username.trim().length > 0 ? username.trim() : email.split('@')[0];

        // Asegurar unicidad de username añadiendo sufijos si fuera necesario
        let suffix = 1;
        while (db.prepare('SELECT 1 FROM users WHERE username = ?').get(finalUsername)) {
            finalUsername = `${email.split('@')[0]}${suffix}`;
            suffix += 1;
        }

        const finalName = finalUsername;
        if (USERS_HAS_GENDER) {
            const stmt = db.prepare('INSERT INTO users (id, username, name, email, role, gender, password_hash, profile_pic, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            stmt.run(id, finalUsername, finalName, email, role, 'unspecified', password_hash, profile_pic || null, now, now);
        } else {
            const stmt = db.prepare('INSERT INTO users (id, username, name, email, role, password_hash, profile_pic, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
            stmt.run(id, finalUsername, finalName, email, role, password_hash, profile_pic || null, now, now);
        }

        res.json({
            id,
            username: finalUsername,
            email,
            role,
            profile_pic: profile_pic || null,
            created_at: now,
            updated_at: now,
        });
    } catch (error) {
        console.error('[API] Register error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);

        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        const isMatch = await bcrypt.compare(password, user.password_hash);
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

// Cambio de contraseña seguro
app.post('/api/auth/change-password', async (req, res) => {
    try {
        const { userId, oldPassword, newPassword } = req.body;

        if (!userId || !oldPassword || !newPassword) {
            return res.status(400).json({ error: 'Datos incompletos para cambiar contraseña' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
        }

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Contraseña actual incorrecta' });
        }

        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);
        const now = new Date().toISOString();

        db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
            newHash,
            now,
            userId
        );

        res.json({ success: true });
    } catch (error) {
        console.error('[API] Change password error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Actualizar sólo la foto de perfil
app.post('/api/users/:id/profile-pic', async (req, res) => {
    try {
        const { id } = req.params;
        const { image_data } = req.body;

        if (!image_data || typeof image_data !== 'string') {
            return res.status(400).json({ error: 'Imagen inválida' });
        }

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Subir a Cloudinary en carpeta de perfil del usuario
        const result = await cloudinary.uploader.upload(image_data, {
            folder: `outfit-planner/${id}/profile`,
            public_id: 'avatar',
            overwrite: true,
            upload_preset: 'oodt_123',
            resource_type: 'image',
        });

        const imageUrl = result.secure_url;
        const now = new Date().toISOString();

        db.prepare('UPDATE users SET profile_pic = ?, updated_at = ? WHERE id = ?').run(
            imageUrl,
            now,
            id
        );

        const updated = db
            .prepare('SELECT id, username, email, profile_pic, custom_subcategories, created_at, updated_at FROM users WHERE id = ?')
            .get(id);

        res.json(updated);
    } catch (error) {
        console.error('[API] Update profile pic error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Actualizar perfil de usuario (email obligatorio, username opcional)
app.put('/api/users/:id', (req, res) => {
    try {
        const { username, email } = req.body;
        const { id } = req.params;

        if (!email || typeof email !== 'string') {
            return res.status(400).json({ error: 'El email es obligatorio' });
        }

        // Comprobar unicidad de email y username para otros usuarios
        const conflict = db
            .prepare('SELECT id FROM users WHERE (email = ? OR username = ?) AND id <> ?')
            .get(email, username || '', id);
        if (conflict) {
            return res.status(400).json({ error: 'El usuario o email ya está registrado' });
        }

        const now = new Date().toISOString();
        const finalUsername = (username && username.trim().length > 0) ? username.trim() : email;
        const finalName = finalUsername;

        const stmt = db.prepare(
            'UPDATE users SET username = ?, name = ?, email = ?, updated_at = ? WHERE id = ?'
        );
        stmt.run(finalUsername, finalName, email, now, id);

        const updated = db
            .prepare('SELECT id, username, email, profile_pic, custom_subcategories, created_at, updated_at FROM users WHERE id = ?')
            .get(id);

        res.json(updated);
    } catch (error) {
        console.error('[API] Update user error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ BACKGROUND REMOVAL (REMBG BACKEND) ============

/**
 * Usa REMBG (Python) para eliminar fondos de imágenes de forma rápida en servidor
 */
app.post('/api/remove-background', async (req, res) => {
    try {
        const { imageData } = req.body;
        
        if (!imageData) {
            return res.status(400).json({ error: 'imageData required' });
        }

        // Decodificar base64 a buffer
        const base64Data = imageData.replace(/^data:image\/[^;]+;base64,/, '');
        const inputBuffer = Buffer.from(base64Data, 'base64');

        // Crear archivos temporales
        const tmpDir = os.tmpdir();
        const inputPath = path.join(tmpDir, `input_${Date.now()}.png`);
        const outputPath = path.join(tmpDir, `output_${Date.now()}.png`);

        // Guardar imagen de entrada
        fs.writeFileSync(inputPath, inputBuffer);

        try {
            // Ejecutar rembg como proceso Python
            await new Promise((resolve, reject) => {
                const process = spawn('python', ['-m', 'rembg', 'i', inputPath, outputPath], {
                    timeout: 30000, // 30 segundos máximo
                });

                let errorOutput = '';
                
                process.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                    console.error('[REMBG] Error:', data.toString());
                });

                process.on('close', (code) => {
                    if (code !== 0) {
                        reject(new Error(`REMBG process exited with code ${code}: ${errorOutput}`));
                    } else {
                        resolve();
                    }
                });

                process.on('error', (err) => {
                    reject(err);
                });
            });

            // Leer imagen procesada
            const outputBuffer = fs.readFileSync(outputPath);
            const resultBase64 = outputBuffer.toString('base64');

            // Limpiar archivos temporales
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);

            res.json({
                imageData: `data:image/png;base64,${resultBase64}`,
            });
        } catch (error) {
            // Limpiar archivos en caso de error
            try { fs.unlinkSync(inputPath); } catch (e) {}
            try { fs.unlinkSync(outputPath); } catch (e) {}
            
            throw error;
        }
    } catch (error) {
        console.error('[API] Background removal error:', error);
        res.status(500).json({ error: error.message || 'Failed to remove background' });
    }
});

// ============ GARMENTS ============

app.post('/api/garments', async (req, res) => {
    try {
        const { id, user_id, category, sub_category, image_data } = req.body;

        // Subir a Cloudinary
        const result = await cloudinary.uploader.upload(image_data, {
            folder: `outfit-planner/${user_id}/garments`,
            public_id: id,
            upload_preset: 'oodt_123',
            overwrite: true,
            resource_type: 'image',
        });

        const imageUrl = result.secure_url;
        const cloudinaryId = `outfit-planner/${user_id}/garments/${id}`;

        // Guardar en SQLite
        const stmt = db.prepare(`
      INSERT INTO garments (id, user_id, category, sub_category, image_url, cloudinary_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

        stmt.run(id, user_id, category, sub_category, imageUrl, cloudinaryId, Date.now());

        res.json({
            id,
            user_id,
            category,
            sub_category,
            image_data: imageUrl,
        });
    } catch (error) {
        console.error('[API] Create garment error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/garments/user/:userId', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM garments WHERE user_id = ? ORDER BY created_at DESC');
        const garments = stmt.all(req.params.userId);
        res.json(garments.map(g => ({
            id: g.id,
            user_id: g.user_id,
            category: g.category,
            sub_category: g.sub_category,
            image_data: g.image_url,
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Get ALL garments from all users
app.get('/api/admin/garments', (req, res) => {
    try {
        const stmt = db.prepare(`
            SELECT g.*, u.username as owner_name, u.email as owner_email 
            FROM garments g 
            JOIN users u ON g.user_id = u.id 
            ORDER BY g.created_at DESC
        `);
        const garments = stmt.all();
        res.json(garments.map(g => ({
            id: g.id,
            user_id: g.user_id,
            owner_name: g.owner_name,
            owner_email: g.owner_email,
            category: g.category,
            sub_category: g.sub_category,
            image_data: g.image_url,
            created_at: g.created_at
        })));
    } catch (error) {
        console.error('[API] Admin get all garments error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/garments/user/:userId/category/:category', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM garments WHERE user_id = ? AND category = ? ORDER BY created_at DESC');
        const garments = stmt.all(req.params.userId, req.params.category);
        res.json(garments.map(g => ({
            id: g.id,
            user_id: g.user_id,
            category: g.category,
            sub_category: g.sub_category,
            image_data: g.image_url,
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/garments/:id', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        // Eliminar de Cloudinary
        try {
            await cloudinary.uploader.destroy(`outfit-planner/${userId}/garments/${req.params.id}`);
        } catch (err) {
            console.error('[Cloudinary] Delete error:', err);
        }

        // Eliminar de SQLite
        const stmt = db.prepare('DELETE FROM garments WHERE id = ?');
        stmt.run(req.params.id);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ OUTFITS ============

// Crear una nueva opción de outfit para una fecha.
app.post('/api/outfits', (req, res) => {
    try {
        let { id, user_id, date_scheduled, layers_json, option_index } = req.body;

        if (!user_id || !date_scheduled || !layers_json) {
            return res.status(400).json({ error: 'Datos incompletos para crear outfit' });
        }

        const now = new Date().toISOString();

        // Asegurar que layers_json sea string
        if (typeof layers_json !== 'string') {
            layers_json = JSON.stringify(layers_json);
        }

        // Calcular option_index si no viene
        if (option_index == null) {
            const row = db
                .prepare('SELECT MAX(option_index) as maxOpt FROM outfits WHERE user_id = ? AND date_scheduled = ?')
                .get(user_id, date_scheduled) as any;
            const maxOpt = row && row.maxOpt != null ? Number(row.maxOpt) : 0;
            option_index = maxOpt + 1;
        }

        const outfitId = id || randomUUID();

        db.prepare(
            'INSERT INTO outfits (id, user_id, date_scheduled, option_index, layers_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(outfitId, user_id, date_scheduled, option_index, layers_json, now, now);

        res.json({ id: outfitId, user_id, date_scheduled, option_index, layers_json });
    } catch (error) {
        console.error('[API] Create outfit error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener la primera opción de outfit para una fecha (por compatibilidad)
app.get('/api/outfits/user/:userId/date/:date', (req, res) => {
    try {
        const stmt = db.prepare(
            'SELECT * FROM outfits WHERE user_id = ? AND date_scheduled = ? ORDER BY option_index ASC LIMIT 1'
        );
        const outfit = stmt.get(req.params.userId, req.params.date);

        if (!outfit) {
            return res.status(404).json({ error: 'Outfit not found' });
        }

        res.json({
            id: outfit.id,
            user_id: outfit.user_id,
            date_scheduled: outfit.date_scheduled,
            option_index: outfit.option_index,
            layers_json: outfit.layers_json,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener todas las opciones de outfit para una fecha
app.get('/api/outfits/user/:userId/date/:date/options', (req, res) => {
    try {
        const stmt = db.prepare(
            'SELECT * FROM outfits WHERE user_id = ? AND date_scheduled = ? ORDER BY option_index ASC'
        );
        const outfits = stmt.all(req.params.userId, req.params.date);

        res.json(
            outfits.map((o) => ({
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

app.get('/api/outfits/user/:userId', (req, res) => {
    try {
        const stmt = db.prepare(
            'SELECT * FROM outfits WHERE user_id = ? ORDER BY date_scheduled DESC, option_index ASC'
        );
        const outfits = stmt.all(req.params.userId);

        res.json(
            outfits.map((o) => ({
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
app.get('/api/outfits/:id', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM outfits WHERE id = ?');
        const outfit = stmt.get(req.params.id);

        if (!outfit) {
            return res.status(404).json({ error: 'Outfit not found' });
        }

        res.json({
            id: outfit.id,
            user_id: outfit.user_id,
            date_scheduled: outfit.date_scheduled,
            option_index: outfit.option_index,
            layers_json: outfit.layers_json,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/outfits/:id', (req, res) => {
    try {
        const { layers_json } = req.body;
        const stmt = db.prepare('UPDATE outfits SET layers_json = ?, updated_at = ? WHERE id = ?');
        stmt.run(layers_json, Date.now(), req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/outfits/:id', (req, res) => {
    try {
        const stmt = db.prepare('DELETE FROM outfits WHERE id = ?');
        stmt.run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ STATS ============

app.get('/api/stats/:userId', (req, res) => {
    try {
        const garmentsCount = db.prepare('SELECT COUNT(*) as count FROM garments WHERE user_id = ?').get(req.params.userId);
        const outfitsCount = db.prepare('SELECT COUNT(*) as count FROM outfits WHERE user_id = ?').get(req.params.userId);

        res.json({
            garments: garmentsCount.count,
            outfits: outfitsCount.count,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve static files from the Vite build directory
app.use(express.static(path.join(__dirname, 'dist')));

// Catch-all route to serve the SPA (for React Router/Navigation)
// Using a RegExp here avoids the path-to-regexp "Missing parameter name" error
// that happens with wildcard strings like '*' or '/*' in Express 5.
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`[API Server] Running on http://localhost:${PORT}`);
});

// Cleanup
process.on('SIGINT', () => {
    db.close();
    process.exit(0);
});
