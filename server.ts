import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { db } from './src/lib/sqlite-db';
import type { Garment, Outfit, User, Contact, Conversation, Message } from './src/types';
import { v4 as uuidv4 } from 'uuid';

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

// ============ CONTACTS ============

// Buscar usuario por username
app.get('/api/contacts/search/:username', (req, res) => {
    try {
        const allUsers = db.getAllUsers();
        const searchResult = allUsers.find(u => u.username?.toLowerCase() === req.params.username.toLowerCase());

        if (!searchResult) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // No devolver password_hash
        const { password_hash: _, ...userPublic } = searchResult;
        res.json(userPublic);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Enviar solicitud de amistad
app.post('/api/contacts/request', (req, res) => {
    try {
        const { user_id, contact_id } = req.body;

        if (!user_id || !contact_id) {
            return res.status(400).json({ error: 'user_id y contact_id requeridos' });
        }

        if (user_id === contact_id) {
            return res.status(400).json({ error: 'No puedes agregarte a ti mismo' });
        }

        // Verificar que ambos usuarios existan
        const userExists = db.getUser(user_id);
        const contactExists = db.getUser(contact_id);

        if (!userExists || !contactExists) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Verificar si ya existe una solicitud
        const existing = db.getContact(user_id, contact_id);
        if (existing) {
            return res.status(400).json({ error: 'Ya existe una solicitud con este usuario' });
        }

        const contact = db.createContact({
            id: uuidv4(),
            user_id,
            contact_id,
            status: 'pendiente',
        });

        res.json(contact);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener solicitudes pendientes de un usuario (recibidas)
app.get('/api/contacts/pending/:userId', (req, res) => {
    try {
        const contacts = db.getPendingRequestsForUser(req.params.userId);

        // Enriquecer con datos del usuario que envió la solicitud
        const enriched = contacts.map((contact) => {
            const fromUser = db.getUser(contact.user_id);
            return {
                ...contact,
                contact_user: fromUser
                    ? { id: fromUser.id, username: fromUser.username, profile_pic: fromUser.profile_pic }
                    : null,
            };
        });

        res.json(enriched);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener contactos aceptados de un usuario
app.get('/api/contacts/accepted/:userId', (req, res) => {
    try {
        const contacts = db.getContactsByUser(req.params.userId, 'aceptado');

        // Enriquecer con datos del contacto
        const enriched = contacts.map((contact) => {
            const contactUser = db.getUser(contact.contact_id);
            return {
                ...contact,
                contact_user: contactUser ? { id: contactUser.id, username: contactUser.username, profile_pic: contactUser.profile_pic } : null,
            };
        });

        res.json(enriched);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Aceptar solicitud de amistad
app.post('/api/contacts/accept', (req, res) => {
    try {
        const { user_id, contact_id } = req.body;

        if (!user_id || !contact_id) {
            return res.status(400).json({ error: 'user_id y contact_id requeridos' });
        }

        // Verificar que existe la solicitud
        const contact = db.getContact(contact_id, user_id);
        if (!contact || contact.status !== 'pendiente') {
            return res.status(404).json({ error: 'Solicitud no encontrada o no pendiente' });
        }

        // Actualizar estado
        db.updateContactStatus(contact_id, user_id, 'aceptado');

        // Crear contacto inverso
        const existingInverse = db.getContact(user_id, contact_id);
        if (!existingInverse) {
            db.createContact({
                id: uuidv4(),
                user_id,
                contact_id,
                status: 'aceptado',
            });
        } else {
            db.updateContactStatus(user_id, contact_id, 'aceptado');
        }

        // Crear conversación
        const existingConversation = db.getConversationByUsers(user_id, contact_id);
        if (!existingConversation) {
            db.createConversation({
                id: uuidv4(),
                user_id_1: user_id,
                user_id_2: contact_id,
            });
        }

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Rechazar solicitud de amistad
app.post('/api/contacts/reject', (req, res) => {
    try {
        const { user_id, contact_id } = req.body;

        if (!user_id || !contact_id) {
            return res.status(400).json({ error: 'user_id y contact_id requeridos' });
        }

        // Actualizar estado
        db.updateContactStatus(contact_id, user_id, 'rechazado');

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Bloquear contacto
app.post('/api/contacts/block', (req, res) => {
    try {
        const { user_id, contact_id } = req.body;

        if (!user_id || !contact_id) {
            return res.status(400).json({ error: 'user_id y contact_id requeridos' });
        }

        const contact = db.getContact(user_id, contact_id);
        if (contact) {
            db.updateContactStatus(user_id, contact_id, 'bloqueado');
        } else {
            db.createContact({
                id: uuidv4(),
                user_id,
                contact_id,
                status: 'bloqueado',
            });
        }

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar contacto
app.delete('/api/contacts/:user_id/:contact_id', (req, res) => {
    try {
        db.deleteContact(req.params.user_id, req.params.contact_id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============ CONVERSATIONS ============

// Obtener conversaciones de un usuario
app.get('/api/conversations/:userId', (req, res) => {
    try {
        const conversations = db.getConversationsByUser(req.params.userId);

        // Enriquecer con último mensaje y datos del otro usuario
        const enriched = conversations.map((conv) => {
            const otherUserId = conv.user_id_1 === req.params.userId ? conv.user_id_2 : conv.user_id_1;
            const otherUser = db.getUser(otherUserId);
            const messages = db.getMessagesByConversation(conv.id);
            const unreadCount = messages.filter(m => !m.read && m.sender_id !== req.params.userId).length;

            return {
                ...conv,
                other_user: otherUser ? { id: otherUser.id, username: otherUser.username, profile_pic: otherUser.profile_pic } : null,
                last_message: messages[messages.length - 1] || null,
                unread_count: unreadCount,
            };
        });

        res.json(enriched);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener mensajes de una conversación
app.get('/api/conversations/:conversationId/messages', (req, res) => {
    try {
        const messages = db.getMessagesByConversation(req.params.conversationId);

        // Enriquecer con datos del remitente
        const enriched = messages.map((msg) => {
            const sender = db.getUser(msg.sender_id);
            return {
                ...msg,
                sender: sender ? { id: sender.id, username: sender.username, profile_pic: sender.profile_pic } : null,
            };
        });

        res.json(enriched);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============ MESSAGES ============

// Enviar mensaje
app.post('/api/messages', (req, res) => {
    try {
        const { conversation_id, sender_id, content, message_type } = req.body;

        if (!conversation_id || !sender_id || !content) {
            return res.status(400).json({ error: 'conversation_id, sender_id y content requeridos' });
        }

        // Verificar que la conversación existe
        const conversation = db.getConversation(conversation_id);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversación no encontrada' });
        }

        // Verificar que sender es parte de la conversación
        if (conversation.user_id_1 !== sender_id && conversation.user_id_2 !== sender_id) {
            return res.status(403).json({ error: 'No tienes permiso para enviar mensajes en esta conversación' });
        }

        // Verificar que son contactos aceptados
        const otherUserId = conversation.user_id_1 === sender_id ? conversation.user_id_2 : conversation.user_id_1;
        const contactStatus = db.getContact(sender_id, otherUserId);
        if (!contactStatus || contactStatus.status !== 'aceptado') {
            return res.status(403).json({ error: 'No puedes enviar mensajes a este usuario' });
        }

        const message = db.createMessage({
            id: uuidv4(),
            conversation_id,
            sender_id,
            content,
            message_type: message_type || 'text',
        });

        // Actualizar timestamp de la conversación
        // (SQLite no expone update directo, pero se puede hacer con exec)

        res.json(message);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Marcar mensaje como leído
app.put('/api/messages/:messageId/read', (req, res) => {
    try {
        db.markMessageAsRead(req.params.messageId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Marcar conversación como leída
app.put('/api/conversations/:conversationId/read', (req, res) => {
    try {
        db.markConversationMessagesAsRead(req.params.conversationId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar mensaje
app.delete('/api/messages/:messageId', (req, res) => {
    try {
        db.deleteMessage(req.params.messageId);
        res.json({ success: true });
    } catch (error: any) {
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
    } catch (error: any) {
        console.error('[API] Remove background error:', error);
        res.status(500).json({ error: error.message });
    }
});

async function removeBackgroundViaRembg(imageData: string): Promise<string> {
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
            const rembg = spawn('python', ['-m', 'rembg', 'i', inputFile, outputFile]);

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
                    reject(new Error('REMBG failed'));
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

// Start server
app.listen(PORT, () => {
    console.log(`[API Server] Running on http://localhost:${PORT}`);
});
