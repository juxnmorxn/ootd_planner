# Endpoints Turso: Guía Técnica Completa

## Localización en el Código

**Archivo:** `server-turso.cjs` (líneas ~700-840)

**Inicialization:** Línea 1
```javascript
const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
```

## Todos los Endpoints (Completo)

### 🔐 Authentication

```
POST /api/auth/register
  Body: { username, email, password, profile_pic? }
  Response: { id, username, email, role, profile_pic, created_at, updated_at }
  
POST /api/auth/login
  Body: { username, password }
  Response: { id, username, email, role, profile_pic, custom_subcategories, ... }
  
POST /api/auth/change-password
  Body: { userId, oldPassword, newPassword }
  Response: { success: true }
```

### 👤 Users

```
GET /api/users
  Response: [{ id, username, email, role, profile_pic, ... }]
  
GET /api/users/:id
  Response: { id, username, email, ... }
  
POST /api/users
  Body: { id?, username?, email, password_hash?, ... }
  Response: { id, username, email }
  
PUT /api/users/:id
  Body: { username, email }
  Response: { id, username, email, profile_pic, ... }
  
DELETE /api/users/:id
  Response: { success: true }
  
POST /api/users/:id/profile-pic
  Body: { image_data (base64) }
  Response: { id, username, email, profile_pic, ... }
```

### 👕 Garments (Prendas)

```
POST /api/garments
  Body: { id, user_id, category, sub_category, image_data (base64) }
  Response: { id, user_id, category, sub_category, image_data }
  → Sube a Cloudinary + Guarda en Turso
  
GET /api/garments/user/:userId
  Response: [{ id, user_id, category, sub_category, image_data, created_at }]
  
GET /api/garments/user/:userId/category/:category
  Response: [{ id, user_id, category, sub_category, image_data, created_at }]
  
DELETE /api/garments/:id?userId=...
  Response: { success: true }
  → Elimina de Cloudinary + Turso
  
GET /api/admin/garments
  Response: [{ id, user_id, owner_name, owner_email, ... }]
  → Solo admin
```

### 📅 Outfits (Combinaciones)

```
POST /api/outfits
  Body: { id?, user_id, date_scheduled, layers_json, option_index? }
  Response: { id, user_id, date_scheduled, option_index, layers_json }
  
GET /api/outfits/user/:userId/date/:date
  Response: { id, user_id, date_scheduled, option_index, layers_json }
  → Retorna PRIMERA opción de la fecha
  
GET /api/outfits/user/:userId/date/:date/options
  Response: [{ id, user_id, date_scheduled, option_index, layers_json }]
  → Retorna TODAS las opciones de la fecha
  
GET /api/outfits/user/:userId
  Response: [{ id, user_id, date_scheduled, option_index, layers_json }]
  → Todos los outfits del usuario
  
GET /api/outfits/:id
  Response: { id, user_id, date_scheduled, option_index, layers_json }
  
PUT /api/outfits/:id
  Body: { layers_json }
  Response: { success: true }
  → Actualiza layers de un outfit
  
DELETE /api/outfits/:id
  Response: { success: true }
```

### 📊 Stats

```
GET /api/stats/:userId
  Response: { garments: number, outfits: number }
```

### 🎨 Remove Background (REMBG)

```
POST /api/remove-background
  Body: { imageData (base64) }
  Response: { imageData (base64 con fondo removido) }
  → Ejecuta Python subprocess: rembg
  → Timeout: 30 segundos
```

### 🔄 **NUEVOS** Sync Endpoints

```
POST /api/sync/pull
  Body: { userId, lastPulledAt }
  Response: { changes: { garments, outfits, users }, timestamp }
  → WatermelonDB descarga cambios desde Turso
  → Clasifica como: created, updated, deleted
  
POST /api/sync/push
  Body: { userId, changes: { garments, outfits, users } }
  Response: { success: true }
  → WatermelonDB carga cambios a Turso
  → Procesa: INSERT/UPDATE/DELETE
```

## Arquitectura de Comunicación

```
┌─────────────────────────────────────────────────────────────┐
│                     PWA (WatermelonDB)                      │
│                                                             │
│  watermelon-service.ts                                     │
│  ├─ createGarment() → API POST /api/garments              │
│  ├─ deleteGarment() → API DELETE /api/garments/:id        │
│  ├─ createOutfit() → API POST /api/outfits                │
│  ├─ updateOutfit() → API PUT /api/outfits/:id             │
│  ├─ deleteOutfit() → API DELETE /api/outfits/:id          │
│  └─ syncDatabase() → API POST /api/sync/pull + push       │
│                                                             │
│  watermelon.ts                                             │
│  ├─ syncDatabase(userId, apiUrl)                          │
│  │  ├─ pullChanges() → POST /api/sync/pull               │
│  │  └─ pushChanges() → POST /api/sync/push               │
│  └─ startAutoSync() → Repite cada 30 segundos            │
└─────────────────────────────────────────────────────────────┘
                              │
                     HTTP REST (JSON)
                              │
┌─────────────────────────────────────────────────────────────┐
│              Express Server (server-turso.cjs)              │
│              Running on Render (Port 10000)                 │
│                                                             │
│  Middleware:                                                │
│  ├─ express.json() → Parse JSON bodies                     │
│  ├─ cors() → Cross-origin requests                         │
│  ├─ cloudinary → Upload images                             │
│  └─ bcrypt → Hash passwords                                │
│                                                             │
│  Turso Client (@libsql/client):                            │
│  ├─ turso.execute(sql) → Query Turso DB                   │
│  └─ Caching automático                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                     HTTP(S) (LibSQL Protocol)
                              │
┌─────────────────────────────────────────────────────────────┐
│              Turso Cloud (libsql.org)                       │
│                                                             │
│  Database: OOTD Planner                                    │
│  Tables:                                                    │
│  ├─ users (id, username, email, password_hash, ...)      │
│  ├─ garments (id, user_id, category, image_url, ...)     │
│  └─ outfits (id, user_id, date_scheduled, layers_json...) │
│                                                             │
│  Persistence: 100% (nunca se reinicia)                    │
│  Backup: Automático por Turso                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  Cloudinary (Image CDN)                     │
│                                                             │
│  Upload: POST request desde server-turso.cjs              │
│  Storage: outfit-planner/{user_id}/garments/{id}.png      │
│  Retrieval: CDN global para rápido acceso                 │
└─────────────────────────────────────────────────────────────┘
```

## Flujo de una Creación de Garment

### 1. Usuario selecciona imagen en la app

```
App (React)
├─ Usuario presiona "+"
├─ Selecciona archivo local
└─ Envía base64 a removeBackground()
```

### 2. Background removal en servidor

```
POST /api/remove-background
├─ Recibe: image_data (base64)
├─ Llama: python -m rembg i input.png output.png
├─ Espera: ~1-2 segundos
└─ Retorna: image_data procesado
```

### 3. Upload a Cloudinary + Crea en Turso

```
POST /api/garments
├─ Recibe: { user_id, category, sub_category, image_data }
├─ cloudinary.uploader.upload(image_data)
│  └─ Retorna: { secure_url, public_id }
├─ INSERT INTO garments (id, user_id, category, image_url)
│  └─ Guardar en Turso
└─ Responde: { id, user_id, category, image_url }
```

### 4. WatermelonDB guarda localmente (offline-first)

```
watermelon-service.createGarment()
├─ watermelonDb.write(() => {
│  collection.create(garment_data)
│  })
├─ Guarda en IndexedDB
└─ Retorna: { id, user_id, category, ... }
```

### 5. Sincronización automática (30s después)

```
startAutoSync() cada 30 segundos
├─ POST /api/sync/pull
│  └─ Descarga cambios de otros devices
├─ POST /api/sync/push
│  ├─ Envía: { userId, changes: { garments: { created: [...] } } }
│  └─ Servidor procesa: INSERT OR REPLACE INTO garments
└─ Todos los devices ven el nuevo garment
```

## Flujo Completo de Sync en Detalle

### Cliente: watermelon.ts

```typescript
// Cada 30 segundos (si está online)
export async function syncDatabase(userId: string, apiUrl: string) {
  await synchronize({
    database: watermelonDb,
    
    // 1. PULL - Descargar cambios
    pullChanges: async ({ lastPulledAt }) => {
      const response = await fetch(`${apiUrl}/sync/pull`, {
        method: 'POST',
        body: JSON.stringify({
          userId,
          lastPulledAt: lastPulledAt || 0,
        }),
      });
      const { changes, timestamp } = await response.json();
      // changes = { garments: { created, updated, deleted }, ... }
      return { changes, timestamp };
    },
    
    // 2. PUSH - Enviar cambios
    pushChanges: async ({ changes }) => {
      await fetch(`${apiUrl}/sync/push`, {
        method: 'POST',
        body: JSON.stringify({
          userId,
          changes,  // WatermelonDB automáticamente rastrilla estos
        }),
      });
    },
    
    // 3. Callbacks
    onComplete: () => {
      window.dispatchEvent(new CustomEvent('db-synced'));
    },
    onError: (error) => {
      console.error('[WatermelonDB] Sync error:', error);
    }
  });
}
```

### Servidor: server-turso.cjs POST /api/sync/pull

```javascript
app.post('/api/sync/pull', async (req, res) => {
  const { userId, lastPulledAt } = req.body;
  
  // 1. Query garments modificados desde lastPulledAt
  const { rows: garmentRows } = await turso.execute({
    sql: `SELECT * FROM garments 
          WHERE user_id = ?1 
          AND (created_at > ?2 OR updated_at > ?2)`,
    args: [userId, new Date(lastPulledAt || 0).toISOString()],
  });
  
  // 2. Clasificar en created/updated/deleted
  const garmentChanges = {
    created: garmentRows.filter(g => 
      new Date(g.created_at).getTime() === 
      new Date(g.updated_at).getTime()
    ),
    updated: garmentRows.filter(g => 
      new Date(g.created_at).getTime() !== 
      new Date(g.updated_at).getTime()
    ),
    deleted: [], // Requiere lógica de soft-delete si necesitas historial
  };
  
  // 3. Retornar cambios
  res.json({
    changes: { garments: garmentChanges, ... },
    timestamp: Date.now()
  });
});
```

### Servidor: server-turso.cjs POST /api/sync/push

```javascript
app.post('/api/sync/push', async (req, res) => {
  const { userId, changes } = req.body;
  
  // 1. Procesar created garments
  for (const g of changes.garments.created || []) {
    await turso.execute({
      sql: `INSERT OR REPLACE INTO garments 
            (id, user_id, category, ...) VALUES (...)`,
      args: [g.id, userId, g.category, ...],
    });
  }
  
  // 2. Procesar updated garments
  for (const g of changes.garments.updated || []) {
    await turso.execute({
      sql: `UPDATE garments SET ... WHERE id = ?1`,
      args: [g.id, ...],
    });
  }
  
  // 3. Procesar deleted garments
  for (const gId of changes.garments.deleted || []) {
    await turso.execute({
      sql: 'DELETE FROM garments WHERE id = ?1',
      args: [gId],
    });
  }
  
  res.json({ success: true });
});
```

## Validación de Datos

### Request Validation

```javascript
// POST /api/sync/pull
if (!userId) return res.status(400).json({ error: 'userId required' });

// POST /api/sync/push
if (!userId || !changes) return res.status(400).json({ error: '...' });

// POST /api/garments
if (!user_id || !category || !image_data) return res.status(400).json({ error: '...' });
```

### Error Handling

```javascript
try {
  // Ejecutar query
  const { rows } = await turso.execute(sql);
  res.json({ success: true, data: rows });
} catch (error) {
  console.error('[API] Error:', error);
  res.status(500).json({ error: error.message });
}
```

## Performance

| Operación | Tiempo | Ubicación |
|-----------|--------|-----------|
| **Crear garment (local)** | <50ms | IndexedDB |
| **Query garments (local)** | 1-5ms | IndexedDB |
| **Sync pull** | 200-500ms | HTTP + Turso query |
| **Sync push** | 300-800ms | HTTP + Turso INSERT/UPDATE |
| **Auto-sync loop** | 30 segundos | setInterval en cliente |
| **REMBG processing** | 1-2 segundos | Python subprocess |
| **Cloudinary upload** | 2-5 segundos | CDN |

## Seguridad

### Authentication
```javascript
// Login valida password con bcrypt
const isMatch = await bcrypt.compare(password, user.password_hash);

// Todos los endpoints deberían validar userId (futuro)
if (!userId || userId !== req.user.id) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

### Data Isolation
```javascript
// Cada query filtra por user_id
SELECT * FROM garments WHERE user_id = ?1
// El usuario solo ve sus propios datos
```

### CORS
```javascript
app.use(cors()); // Permite requests desde navegador
```

## Estado de Producción

### En Render
```
URL: ootd-planner.onrender.com
Port: 10000 (asignado por Render)
Turso: Conectado via TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
Cloudinary: Conectado via CLOUDINARY_* variables
```

### Environment Variables Requeridas
```
TURSO_DATABASE_URL=libsql://xxx.turso.io?authToken=xxx
TURSO_AUTH_TOKEN=xxx
CLOUDINARY_NAME=dogl9tho3
CLOUDINARY_KEY=xxx
CLOUDINARY_SECRET=xxx
```

## Logs Esperados

```
[Turso API Server] Running on http://localhost:10000
[Turso] Schema ensured
[API] Sync pull error: (none - request successful)
[API] Sync push successful for user: user123
[AutoSync] Started
[WatermelonDB] ✅ Sync complete
```

## Testing Endpoints con cURL

```bash
# Health check
curl http://localhost:3001/api/users

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user1","password":"pass123"}'

# Sync pull
curl -X POST http://localhost:3001/api/sync/pull \
  -H "Content-Type: application/json" \
  -d '{"userId":"user123","lastPulledAt":0}'

# Sync push
curl -X POST http://localhost:3001/api/sync/push \
  -H "Content-Type: application/json" \
  -d '{"userId":"user123","changes":{"garments":{"created":[],"updated":[],"deleted":[]}}}'
```

## Documentación Relacionada

- **SYNC_ARCHITECTURE.md** - Flujo completo de sincronización
- **SYNC_STATUS.md** - Resumen ejecutivo
- **TESTING_SYNC.md** - Cómo testear cada feature
- **WATERMELONDB_SETUP.md** - Setup de WatermelonDB
- **REMBG_SETUP.md** - Setup de REMBG
