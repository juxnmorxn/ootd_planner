import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { db } from './src/lib/sqlite-db';
import type { Garment, Outfit, User } from './src/types';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Para imágenes base64 grandes

// ============ AUTH & USERS ============

app.post('/api/users', (req, res) => {
    try {
        const user = db.createUser(req.body);
        res.json(user);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { id, username, email, password, profile_pic } = req.body;

        // Verificar si el usuario ya existe
        const existingUsers = db.getAllUsers();
        const existing = existingUsers.find(u =>
            u.username === username || (email && u.email === email)
        );

        if (existing) {
            return res.status(400).json({ error: 'El usuario o email ya está registrado' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        const now = new Date().toISOString();

        // Si es el primer usuario, lo hacemos admin
        const usersCount = existingUsers.length;
        const role: 'admin' | 'user' = usersCount === 0 ? 'admin' : 'user';

        const newUser: User = {
            id,
            username,
            email: email || undefined,
            role,
            password_hash,
            profile_pic: profile_pic || undefined,
            created_at: now,
            updated_at: now,
        };

        const user = db.createUser(newUser);

        // No devolver el hash de la contraseña
        const { password_hash: _, ...userResponse } = user;
        res.json(userResponse);
    } catch (error: any) {
        console.error('[API] Register error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const users = db.getAllUsers();
        const user = users.find(u => u.username === username || u.email === username);

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash || '');
        if (!isMatch) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        // No devolver el hash de la contraseña
        const { password_hash: _, ...userResponse } = user;
        res.json(userResponse);
    } catch (error: any) {
        console.error('[API] Login error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users', (req, res) => {
    try {
        const users = db.getAllUsers();
        res.json(users);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users/:id', (req, res) => {
    try {
        const user = db.getUser(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/users/:id', (req, res) => {
    try {
        db.deleteUser(req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============ GARMENTS ============

app.post('/api/garments', async (req, res) => {
    try {
        const garment = await db.createGarment(req.body);
        res.json(garment);
    } catch (error: any) {
        console.error('[API] Create garment error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/garments/user/:userId', (req, res) => {
    try {
        const garments = db.getGarmentsByUser(req.params.userId);
        res.json(garments);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/garments/user/:userId/category/:category', (req, res) => {
    try {
        const garments = db.getGarmentsByCategory(req.params.userId, req.params.category);
        res.json(garments);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/garments/:id', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }
        await db.deleteGarment(req.params.id, userId as string);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============ OUTFITS ============

app.post('/api/outfits', (req, res) => {
    try {
        const outfit = db.createOutfit(req.body);
        res.json(outfit);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/outfits/user/:userId/date/:date', (req, res) => {
    try {
        const outfit = db.getOutfitByDate(req.params.userId, req.params.date);
        if (!outfit) {
            return res.status(404).json({ error: 'Outfit not found' });
        }
        res.json(outfit);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/outfits/user/:userId', (req, res) => {
    try {
        const outfits = db.getOutfitsByUser(req.params.userId);
        res.json(outfits);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/outfits/:id', (req, res) => {
    try {
        db.updateOutfit(req.params.id, req.body.layers_json);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/outfits/:id', (req, res) => {
    try {
        db.deleteOutfit(req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============ STATS ============

app.get('/api/stats/:userId', (req, res) => {
    try {
        const stats = db.getStats(req.params.userId);
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`[API Server] Running on http://localhost:${PORT}`);
});
