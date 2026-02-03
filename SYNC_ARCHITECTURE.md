# Sincronización: Turso + WatermelonDB + PWA

## Por qué Turso es la BD oficial

Render reinicia el contenedor cada ~15 minutos. **Una base de datos local (SQLite en el servidor) se perdería completamente** en cada reinicio. Por eso:

- **Turso** = Base de datos oficial en la nube (persistente, nunca se pierde)
- **WatermelonDB (SQLite en navegador)** = Caché local para cada PWA en cada dispositivo
- **Sincronización bidireccional** = Mantiene los datos consistentes entre dispositivos

## Arquitectura de Sincronización

```
┌─────────────────────────────────────────────────────────────┐
│                        Tu Render Server                       │
│  (Reinicia cada ~15 min, pero Turso en nube es persistente)  │
│                                                               │
│  Endpoints:                                                   │
│  - POST /api/sync/pull   ← Envia cambios de Turso            │
│  - POST /api/sync/push   ← Recibe cambios del cliente        │
│  - POST /api/garments    ← Endpoint existente (crea + BD)    │
│  - PUT /api/outfits/:id  ← Endpoint existente (actualiza)    │
└─────────────────────────────────────────────────────────────┘
                              ↑
                              │ HTTP REST
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Turso Cloud DB                          │
│  (Persistente en libsql.org, nunca se reinicia)             │
│                                                               │
│  Tables:                                                      │
│  - users (id, username, email, ...)                          │
│  - garments (id, user_id, category, image_url, ...)         │
│  - outfits (id, user_id, date_scheduled, layers_json, ...)  │
└─────────────────────────────────────────────────────────────┘
                              ↑
                              │ HTTP REST
                              ↓
┌──────────────────────────────────────────────────────────────┐
│           Device 1: Chrome Browser (PWA)                      │
│                                                               │
│  WatermelonDB (SQLite en IndexedDB):                         │
│  - Mismas tablas que Turso (users, garments, outfits)       │
│  - Datos locales para acceso rápido                         │
│  - Auto-sync cada 30 segundos si está online                │
│                                                               │
│  Flujo:                                                       │
│  1. Usuario crea garment → Se guarda en SQLite local         │
│  2. WatermelonDB detecta cambio "pendiente"                  │
│  3. Cada 30 segundos: Push cambios a Turso                  │
│  4. Luego: Pull cambios de otros dispositivos desde Turso    │
│  5. UI se actualiza automáticamente                          │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│           Device 2: Safari en iPad (PWA)                      │
│                                                               │
│  WatermelonDB (SQLite en IndexedDB):                         │
│  - Mismas tablas que Turso                                   │
│  - Sincronización independiente cada 30 segundos            │
│                                                               │
│  El iPad ve los cambios que Chrome subió en el último pull   │
└──────────────────────────────────────────────────────────────┘
```

## Flujo de Sincronización Detallado

### 1. **PULL (Descargar cambios de Turso)**

El cliente WatermelonDB ejecuta cada 30 segundos:

```typescript
// En watermelon.ts - pullChanges()
const response = await fetch(`${apiUrl}/sync/pull`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId,
    lastPulledAt: lastPulledAt || 0,  // Timestamp del último pull
  }),
});

const { changes, timestamp } = await response.json();
// changes = { garments: [...], outfits: [...], ...}
// timestamp = timestamp del servidor ahora
```

**El servidor responde con:**

```javascript
{
  "changes": {
    "garments": {
      "created": [
        { id: "123", user_id: "user1", category: "tops", ... },
        { id: "456", user_id: "user1", category: "pants", ... }
      ],
      "updated": [
        { id: "789", user_id: "user1", category: "shoes", ... }
      ],
      "deleted": ["old-id-1", "old-id-2"]
    },
    "outfits": {
      "created": [...],
      "updated": [...],
      "deleted": [...]
    }
  },
  "timestamp": 1738600000000
}
```

### 2. **PUSH (Enviar cambios locales a Turso)**

Después del PULL, el cliente envía sus cambios locales:

```typescript
// En watermelon.ts - pushChanges()
const response = await fetch(`${apiUrl}/sync/push`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId,
    changes: {
      garments: {
        created: [...],
        updated: [...],
        deleted: [...]
      },
      outfits: {
        created: [...],
        updated: [...],
        deleted: [...]
      }
    }
  }),
});
```

**El servidor responde con:**

```javascript
{
  "success": true
}
```

### 3. **Ejemplo Real: Flujo Completo en 30 segundos**

**Tiempo 00:00 - Usuario en Device 1 (Chrome) crea un garment:**
```
1. App llama watermelonService.createGarment()
2. WatermelonDB escribe en IndexedDB (INSTANTÁNEO)
3. Usuario ve el garment en la pantalla (OFFLINE)
4. Cambio se marca como "pending" en WatermelonDB
```

**Tiempo 00:00 - Usuario en Device 2 (iPad) tiene la app abierta (online):**
```
1. iPad espera siguiente sync (hasta 30s)
2. Otros cambios están en Turso pero iPad aún no los ve
```

**Tiempo 00:30 - Auto-sync se ejecuta en Device 1:**
```
POST /api/sync/pull (Device 1)
→ Turso retorna: cambios de otros dispositivos (nada nuevo aún)

POST /api/sync/push (Device 1)
→ Device 1 envia: { garments: { created: [{ id: "123", ... }] } }
→ Servidor Turso: INSERT INTO garments VALUES (...)
```

**Tiempo 00:30 - Auto-sync se ejecuta en Device 2 (iPad):**
```
POST /api/sync/pull (Device 2)
→ Servidor Turso: SELECT * FROM garments WHERE user_id='user1' AND updated_at > lastPulledAt
→ Retorna: { created: [{ id: "123" (el que Chrome creó) }] }

WatermelonDB en iPad: INSERT/UPDATE las tablas locales con los nuevos datos
UI en iPad: Se actualiza automáticamente, usuario ve el garment que creó en Chrome
```

**Tiempo 01:00 - Usuario en Device 2 edita el outfit:**
```
1. iPad guarda en su SQLite local
2. Espera próximo sync (30s)
```

**Tiempo 01:30 - Auto-sync en Device 2:**
```
POST /api/sync/push (Device 2)
→ Servidor Turso: UPDATE outfits SET ...

Después:
POST /api/sync/pull (Device 2)
→ Recibe actualizaciones de cualquier otro dispositivo
```

**Tiempo 02:00 - Device 1 (Chrome) ve los cambios:**
```
POST /api/sync/pull (Device 1)
→ Recibe: outfit actualizado
UI se actualiza
```

## Implementación de Endpoints

### POST /api/sync/pull

**Request:**
```json
{
  "userId": "user123",
  "lastPulledAt": 1738599970000
}
```

**Response (200 OK):**
```json
{
  "changes": {
    "garments": {
      "created": [...],
      "updated": [...],
      "deleted": [...]
    },
    "outfits": {
      "created": [...],
      "updated": [...],
      "deleted": [...]
    }
  },
  "timestamp": 1738600000000
}
```

**Lógica en servidor:**
1. Recibe `userId` y `lastPulledAt`
2. Consulta Turso: `SELECT * FROM garments WHERE user_id = ? AND updated_at > ?`
3. Clasifica cambios:
   - **created**: `created_at > lastPulledAt` AND `updated_at == created_at`
   - **updated**: `updated_at > lastPulledAt` AND `updated_at > created_at`
   - **deleted**: Requiere tabla "deleted_records" o lógica soft-delete
4. Retorna cambios + timestamp actual del servidor

### POST /api/sync/push

**Request:**
```json
{
  "userId": "user123",
  "changes": {
    "garments": {
      "created": [
        { "id": "g1", "category": "tops", "image_url": "...", ... }
      ],
      "updated": [
        { "id": "g2", "category": "pants", ... }
      ],
      "deleted": ["g3", "g4"]
    },
    "outfits": { ... }
  }
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Lógica en servidor:**
1. Recibe `userId` y `changes`
2. Inicia transacción
3. Para cada **garment created**:
   - INSERT INTO garments (id, user_id, category, ...) VALUES (...)
   - Si ya existe (mismo id): UPDATE (cliente lo creó offline, luego subió)
4. Para cada **garment updated**:
   - UPDATE garments SET ... WHERE id = ?
5. Para cada **garment deleted**:
   - DELETE FROM garments WHERE id = ?
6. Mismo para outfits y users
7. Commit transacción
8. Retorna success

## Cómo Maneja Render el Reinicio

### El Problema Detallado

Render reinicia tu contenedor cada ~15 minutos (o cuando hay deploy). Si tenías una BD SQLite en el servidor:
```
├─ Antes del reinicio
│  ├─ garments: 100 registros
│  ├─ outfits: 50 registros
│  └─ Todos los datos en /data/db.sqlite
│
├─ Render detiene el contenedor
│  └─ BORRA /data/db.sqlite (volúmenes no persistentes)
│
└─ Render inicia nuevo contenedor
   ├─ garments: 0 registros (BD nueva)
   ├─ outfits: 0 registros
   └─ DATOS PERDIDOS PARA SIEMPRE
```

### La Solución: Turso

**Turso está en libsql.org** (servidores de Turso, no en tu Render):

```
┌─────────────────────────┐
│   Render Server         │  ← Reinicia cada 15 min, pierde datos locales
│   (Express + Node.js)   │
└────────────┬────────────┘
             │ (HTTP queries)
             ↓
┌─────────────────────────┐
│   libsql.org Turso      │  ← NUNCA reinicia, datos 100% persistentes
│   (Cloud Database)      │
└─────────────────────────┘
```

**Cuando Render reinicia:**
1. Tu servidor Express se reinicia
2. Turso **no se reinicia** (está en servidores diferentes)
3. Cuando el servidor Express vuelve a levantarse, **todos los datos están en Turso**
4. Los usuarios con PWA descargan los datos vía `/api/sync/pull`

### Datos Distribuidos Después del Reinicio de Render

**Antes (500ms antes del reinicio):**
```
Device 1 (Chrome):      Device 2 (iPad):         Render Server:          Turso (Nube):
Garments: 100           Garments: 100           Garments: 100           Garments: 100
```

**Durante reinicio (Render se apaga):**
```
Device 1 (Chrome):      Device 2 (iPad):         Render Server:          Turso (Nube):
Garments: 100           Garments: 100           ❌ Apagado             Garments: 100
(offline)               (offline)               (datos perdidos)        (intacto)
```

**Después (Render se levanta nuevamente):**
```
Device 1 (Chrome):      Device 2 (iPad):         Render Server:          Turso (Nube):
Garments: 100           Garments: 100           Garments: 100           Garments: 100
(local, offline)        (local, offline)        (desde Turso)           (intacto)

↓ Siguiente sync
Device 1 pulls
→ Descarga cambios de Turso
```

## Resumen: ¿Por qué Turso es la BD oficial?

| Aspecto | SQLite local | Turso Cloud |
|--------|-------------|------------|
| **Persistencia** | ❌ Se borra con Render | ✅ 100% persistente |
| **Multi-dispositivo** | ❌ Cada servidor tiene su copia | ✅ Una fuente de verdad |
| **Reinicio de Render** | ❌ Pierde todo | ✅ Todos los datos intactos |
| **Latencia** | ✅ Local | ⚠️ HTTP ~200ms |
| **Disponibilidad offline** | N/A (es el servidor) | ✅ Via WatermelonDB en cada device |

## WatermelonDB: Caché Inteligente

**WatermelonDB = Copia local en cada dispositivo (IndexedDB en navegador)**

```
Cada PWA instalada en un dispositivo:
├─ Chrome en Laptop: WatermelonDB con 100 garments
├─ Safari en iPad: WatermelonDB con 100 garments
├─ Firefox en Desktop: WatermelonDB con 100 garments
└─ Android en Phone: WatermelonDB con 100 garments

Todos ven los MISMOS 100 garments porque se sincronizan vía Turso cada 30s
```

**Beneficios:**
1. **Acceso instantáneo**: Lectura desde IndexedDB (~1ms)
2. **Offline-first**: App funciona sin internet
3. **Menos carga en servidor**: No hace queries complejas, solo sincroniza cambios
4. **Sincronización automática**: Cada 30 segundos actualiza

## Estructura de Cambios para Sincronización

### Garment (ejemplo)

```typescript
interface Garment {
  id: string;              // UUID generado en cliente
  user_id: string;         // ID del usuario
  category: string;        // "tops", "pants", etc
  sub_category: string;    // "shirt", "jeans", etc
  image_url: string;       // URL en Cloudinary (después de upload)
  cloudinary_id: string;   // "outfit-planner/user123/garments/id"
  created_at: number;      // Timestamp (ms) creación
  updated_at: number;      // Timestamp (ms) última actualización
}
```

**Durante PULL:**
```json
{
  "garments": {
    "created": [
      { "id": "g1", "category": "tops", "created_at": 1738600000000, ... }
    ],
    "updated": [
      { "id": "g2", "category": "pants", "updated_at": 1738600010000, ... }
    ],
    "deleted": ["g3", "g4"]
  }
}
```

### Outfit (ejemplo)

```typescript
interface Outfit {
  id: string;                 // UUID
  user_id: string;           // ID del usuario
  date_scheduled: string;    // "2025-02-03" (YYYY-MM-DD)
  option_index: number;      // Opción 1, 2, 3, etc
  layers_json: string;       // JSON stringificado de las capas
  created_at: number;
  updated_at: number;
}

// layers_json ejemplo:
// "[{"type":"top","garmentId":"g1"},{"type":"bottom","garmentId":"g2"}]"
```

## Flujo Completo de Sync en Código

### Cliente (watermelon.ts)

```typescript
export async function syncDatabase(userId: string, apiUrl: string) {
  await synchronize({
    database: watermelonDb,
    pullChanges: async ({ lastPulledAt }) => {
      const response = await fetch(`${apiUrl}/sync/pull`, {
        method: 'POST',
        body: JSON.stringify({
          userId,
          lastPulledAt: lastPulledAt || 0,
        }),
      });
      const { changes, timestamp } = await response.json();
      return { changes, timestamp };
    },
    pushChanges: async ({ changes }) => {
      const response = await fetch(`${apiUrl}/sync/push`, {
        method: 'POST',
        body: JSON.stringify({
          userId,
          changes,
        }),
      });
    },
    onComplete: () => {
      window.dispatchEvent(new CustomEvent('db-synced'));
    },
  });
}
```

### Servidor (server-turso.cjs)

```javascript
// POST /api/sync/pull
app.post('/api/sync/pull', async (req, res) => {
  const { userId, lastPulledAt } = req.body;
  
  // Traer garments modificados desde lastPulledAt
  const { rows: garments } = await turso.execute({
    sql: 'SELECT * FROM garments WHERE user_id = ?1 AND updated_at > ?2',
    args: [userId, new Date(lastPulledAt).toISOString()],
  });
  
  // Clasificar como created, updated, deleted
  const changes = {
    garments: {
      created: garments.filter(g => g.created_at > lastPulledAt),
      updated: garments.filter(g => g.updated_at > g.created_at),
      deleted: [] // Requiere lógica adicional
    },
    outfits: { /* similar */ }
  };
  
  res.json({
    changes,
    timestamp: Date.now()
  });
});

// POST /api/sync/push
app.post('/api/sync/push', async (req, res) => {
  const { userId, changes } = req.body;
  
  // Procesar cada tabla
  for (const garment of changes.garments.created) {
    await turso.execute({
      sql: 'INSERT INTO garments (...) VALUES (...)',
      args: [garment.id, userId, garment.category, ...]
    });
  }
  
  for (const garment of changes.garments.updated) {
    await turso.execute({
      sql: 'UPDATE garments SET ... WHERE id = ?1',
      args: [garment.id, ...]
    });
  }
  
  for (const gId of changes.garments.deleted) {
    await turso.execute({
      sql: 'DELETE FROM garments WHERE id = ?1',
      args: [gId]
    });
  }
  
  res.json({ success: true });
});
```

## Testing de Sincronización

### Test 1: Offline-first
1. Abre Chrome DevTools → Network → Offline
2. Crea un garment
3. Verifica que aparezca en IndexedDB (no en Turso aún)
4. Vuelve a online
5. Espera 30s
6. Verifica que aparezca en Turso

### Test 2: Multi-dispositivo
1. Chrome (Device 1): Crea garment → sync
2. Safari (Device 2): Espera 30s
3. Safari debe ver el garment de Chrome

### Test 3: Después de reinicio de Render
1. Crea garment en Chrome (guarda en Turso)
2. `npm run start:turso` (reinicia servidor)
3. Abre nuevo navegador
4. Hace login
5. Debe descargar garment via `/api/sync/pull`

## Endpoints Requeridos en server-turso.cjs

✅ **Ya existen (para crear datos):**
- `POST /api/garments` - Crea + sube a Cloudinary + guarda en Turso
- `POST /api/outfits` - Crea outfit en Turso
- `PUT /api/outfits/:id` - Actualiza outfit en Turso
- `DELETE /api/garments/:id` - Elimina de Turso

❌ **Necesarios para sincronización (FALTA IMPLEMENTAR):**
- `POST /api/sync/pull` - Descarga cambios desde Turso
- `POST /api/sync/push` - Carga cambios a Turso

Con estos dos endpoints, la sincronización será **100% automática y transparente** al usuario.
