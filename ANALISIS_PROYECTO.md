# 📱 OOTD Planner - Análisis Completo del Proyecto

## 🎯 ¿Qué es OOTD Planner?

**OOTD** = "Outfit Of The Day" - Es una aplicación para planificar outfits (atuendos) diarios. Los usuarios pueden:
- 📸 Subir fotos de prendas de ropa
- 🎨 Organizarlas por categorías (camisetas, pantalones, etc.)
- 📅 Crear outfits para fechas específicas
- 🌐 Acceder offline si no hay internet

---

## 🏗️ ARQUITECTURA DEL PROYECTO

```
OOTD Planner (Full Stack)
│
├── 🖥️ FRONTEND (React + TypeScript + Vite)
│   ├── src/
│   │   ├── pages/           # Pantallas principales
│   │   │   ├── Auth.tsx
│   │   │   ├── CalendarHome.tsx
│   │   │   ├── Closet.tsx
│   │   │   ├── OutfitEditor.tsx
│   │   │   └── Profile.tsx
│   │   │
│   │   ├── components/       # Componentes reutilizables
│   │   │   ├── closet/       (GarmentCard, UploadModal)
│   │   │   ├── layout/       (BottomNav)
│   │   │   └── ui/           (Button, Card, etc.)
│   │   │
│   │   ├── hooks/            # Custom React hooks
│   │   │   ├── useGarments.ts
│   │   │   └── useOutfits.ts
│   │   │
│   │   ├── lib/              # LÓGICA PRINCIPAL
│   │   │   ├── db.ts                    ← API Client Wrapper
│   │   │   ├── api-db.ts                ← Llamadas HTTP al servidor
│   │   │   ├── db-hybrid.ts             ← Online/Offline Automático
│   │   │   ├── db-offline.ts            ← IndexedDB (localStorage avanzado)
│   │   │   ├── sqlite-db.ts             ← NO se usa en frontend (backend)
│   │   │   ├── cloudinary.ts            ← Subida de imágenes a nube
│   │   │   ├── background-removal-hybrid.ts ← Quita fondos de fotos
│   │   │   ├── store.ts                 ← Estado global (Zustand)
│   │   │   └── watermelon.ts            ← Base de datos local (WatermelonDB)
│   │   │
│   │   ├── types/            # TypeScript types
│   │   └── App.tsx           # Componente raíz
│   │
│   └── index.html            # Punto de entrada HTML
│
├── 🔗 BACKEND (Node.js + Express + SQLite)
│   ├── server.ts             # Servidor principal
│   ├── server.cjs            # Versión CommonJS
│   ├── server-turso.cjs      # Alternativa con Turso (DB remoto)
│   └── src/lib/
│       ├── sqlite-db.ts      # Manejo de SQLite
│       └── cloudinary.ts     # Integración Cloudinary
│
├── 📱 MOBILE (Android con Capacitor)
│   └── android/              # Proyecto Android nativo
│
├── 🗄️ DATABASES
│   ├── SQLite (backend)      # outfit-planner.db (persistencia server)
│   ├── IndexedDB (frontend)  # ootd_planner_offline (browser)
│   ├── Turso (opcional)      # MySQL remoto
│   └── WatermelonDB          # ORM local para React
│
└── 🖼️ SERVICIOS EXTERNOS
    ├── Cloudinary            # Almacenamiento de imágenes
    └── Python REMBG          # Eliminación de fondos
```

---

## 🔄 FLUJO DE DATOS: ONLINE vs OFFLINE

### ⚡ MODO ONLINE (Con Internet)

```
Usuario interactúa
        ↓
    React UI
        ↓
api-db.ts (HTTP Client)
        ↓
Backend Express (server.ts)
        ↓
SQLite Database (outfit-planner.db)
        ↓
Cloudinary (almacena imágenes)
```

**Ejemplo: Subir una prenda**
1. Usuario sube foto en `Closet.tsx`
2. `UploadModal.tsx` → procesa la imagen
3. `removeBackgroundHybrid()` → llama servidor Python para quitar fondo
4. `uploadImageToCloudinary()` → sube a Cloudinary
5. `api-db.createGarment()` → HTTP POST a `/api/garments`
6. Backend guarda en SQLite + Cloudinary

---

### 📴 MODO OFFLINE (Sin Internet)

```
Usuario interactúa
        ↓
    React UI
        ↓
db-hybrid.ts (detecta desconexión)
        ↓
IndexedDB (almacenamiento local)
        ↓
Genera sincronización pendiente
```

**Ejemplo: Crear outfit sin internet**
1. Usuario crea outfit en `OutfitEditor.tsx`
2. `db-hybrid.ts` detecta que `navigator.onLine === false`
3. Guarda en `IndexedDB` (offline_DB)
4. Registra cambio como "pendiente de sincronización"
5. Cuando vuelve internet → sync automático

---

## 🗂️ CAPAS DE BASE DE DATOS (Explicado)

### 1️⃣ **API Client Layer** - `api-db.ts`
```typescript
// Solo hace HTTP requests al backend
async getGarmentsByUser(userId: string): Promise<Garment[]> {
    const response = await fetch('/api/garments...');
    return response.json();
}
```
- **Usa**: HTTP Fetch API
- **Destino**: Backend Express
- **Cuando**: Siempre hay internet

---

### 2️⃣ **Hybrid Layer** - `db-hybrid.ts`
```typescript
class HybridDatabase {
    private isOnline: boolean = navigator.onLine;
    
    async getGarmentsByUser(userId, category) {
        if (this.isOnline) {
            // Intenta traer de API (Turso)
            const garments = await apiDb.getGarmentsByUser(userId);
            // Cachea en IndexedDB
            await offlineDB.saveGarmentOffline(garment);
            return garments;
        }
        // Si no hay internet, usa IndexedDB
        return await offlineDB.getGarmentsOffline(userId);
    }
}
```
- **Detecta**: Cambios online/offline automáticamente
- **Sincroniza**: Cambios locales cuando vuelve internet
- **Estrategia**: Cache-first fallback

---

### 3️⃣ **Offline Storage** - `db-offline.ts`
```typescript
// Usa IndexedDB del navegador
class OfflineDB {
    async saveGarmentOffline(garment) {
        const tx = this.db.transaction(['garments'], 'readwrite');
        const store = tx.objectStore('garments');
        store.put({ ...garment, synced: false });
    }
}
```
- **Usa**: IndexedDB (mejor que localStorage)
- **Tamaño**: ~50-100MB disponibles
- **Estructuras**: Garments, Outfits, Cambios pendientes

---

### 4️⃣ **Backend Storage** - `sqlite-db.ts`
```typescript
// Base de datos SQLite en servidor
class SQLiteDatabase {
    constructor() {
        this.db = new Database('outfit-planner.db');
        this.initializeTables();
    }
}
```
- **Usa**: SQLite (archivo `outfit-planner.db`)
- **Ubicación**: Servidor Node.js
- **Tablas**: 
  - `users` - Información de usuarios
  - `garments` - Prendas (sin images, solo URLs de Cloudinary)
  - `outfits` - Combinaciones de ropa por fecha

---

## 🖼️ CLOUDINARY - Almacenamiento de Imágenes

### ¿Por qué Cloudinary?

```
Opciones:
1. Guardar imágenes en base de datos ❌ (muy lento, DB enorme)
2. Guardar en servidor ❌ (espacio limitado)
3. Guardar en Cloudinary ✅ (optimizado, rápido, escalable)
```

### Flujo de Cloudinary

```typescript
// 1. Subir imagen
await cloudinary.uploader.upload(imageData, {
    folder: `outfit-planner/${userId}/garments`,
    public_id: garmentId,
    upload_preset: 'oodt_123'
});
// Retorna: { secure_url: "https://res.cloudinary.com/..." }

// 2. Guardar solo la URL en SQLite
db.createGarment({
    id: garmentId,
    image_url: "https://res.cloudinary.com/...",
    cloudinary_id: "outfit-planner/user/..." 
});

// 3. Cuando necesitas optimizar
cloudinary.url(publicId, {
    width: 800,
    quality: 'auto',
    fetch_format: 'auto'  // WebP para navegadores modernos
});
```

### Credenciales (⚠️ EXPUESTAS!)
```
Cloud: dogl9tho3
API Key: 637587472785454
```
⚠️ **RIESGO DE SEGURIDAD**: Las credenciales están en código. Deberían estar en variables de entorno.

---

## 🎨 ELIMINACIÓN DE FONDOS - `background-removal-hybrid.ts`

### Estrategia Hybrid

```
┌─────────────────────────────────────┐
│ Usuario sube foto                   │
└──────────────┬──────────────────────┘
               ↓
    ¿Hay internet?
      ↙        ↖
    SÍ          NO
    ↓           ↓
REMBG      @imgly
(Rápido)   (Lento, local)
(1-2s)     (10-30s)
    ↓           ↓
    └─────┬─────┘
          ↓
    PNG transparente
```

### Opción 1: REMBG (Servidor Python) - 🚀 RÁPIDO
```typescript
// Llama servidor backend que tiene Python + rembg instalado
const response = await fetch('/api/remove-background', {
    method: 'POST',
    body: JSON.stringify({ imageData })
});
// Retorna PNG sin fondo en ~1-2 segundos
```

**Ventajas**: Ultra rápido, profesional
**Desventajas**: Requiere servidor Python + dependencias

---

### Opción 2: @imgly (Frontend) - 🐢 LENTO pero Offline
```typescript
// Executa en el navegador del usuario
import { removeBackground } from '@imgly/background-removal';
const result = await removeBackground(imageData);
// Retorna PNG sin fondo en ~10-30 segundos
```

**Ventajas**: Funciona offline, sin servidor
**Desventajas**: Lento, consume CPU del usuario

---

## 🔐 AUTENTICACIÓN

### Flujo de Login

```
1. Usuario → POST /api/auth/login
2. Backend:
   - Busca usuario en SQLite
   - Compara contraseña (bcrypt)
   - Retorna usuario (sin password_hash)

3. Frontend (useStore - Zustand):
   - Guarda usuario en memoria
   - Guarda token en localStorage
   - Valida sesión cada 60 días
```

### Registro

```
1. Usuario → POST /api/auth/register
2. Backend:
   - Valida username/email únicos
   - Hash de password (bcrypt)
   - Si es primer usuario → admin, sino → user
   - Inserta en SQLite
```

---

## 🏗️ COMPONENTES PRINCIPALES

### 📄 Páginas (src/pages/)

| Página | Funcionalidad |
|--------|--------------|
| **Auth.tsx** | Login/Registro |
| **CalendarHome.tsx** | Vista calendario de outfits por fecha |
| **Closet.tsx** | Galería de prendas, subir nuevas |
| **OutfitEditor.tsx** | Armar outfit (seleccionar prendas por capas) |
| **Profile.tsx** | Ver/editar perfil |
| **AdminUsers.tsx** | Panel admin (si role=admin) |

### 🧩 Componentes (src/components/)

| Componente | Uso |
|------------|-----|
| **GarmentCard.tsx** | Tarjeta de prenda individual |
| **UploadModal.tsx** | Modal para subir prenda + quitar fondo |
| **BottomNav.tsx** | Navegación inferior entre pestañas |
| **Button, Card, Input** | Componentes UI básicos |
| **TabBar.tsx** | Selector de tabs |
| **HorizontalDateStrip.tsx** | Tira horizontal de fechas |
| **Toast.tsx** | Notificaciones emergentes |

---

## ⚙️ ESTADO GLOBAL - `store.ts` (Zustand)

```typescript
// Estado centralizado
interface AppStore {
    currentUser: User | null;
    currentView: string;
    selectedOutfit: Outfit | null;
    selectedDate: string | null;
    garments: Garment[];
    isLoading: boolean;
    
    // Métodos
    setCurrentUser(user);
    logout();
    setCurrentView(view);
    addGarment(garment);
    removeGarment(id);
}

// Uso en componentes
const { currentUser, logout } = useStore();
```

---

## 🚀 FLUJO COMPLETO: Crear Outfit

```
1. Usuario navega a CalendarHome
   ↓
2. Selecciona una fecha
   ↓
3. Abre OutfitEditor
   ↓
4. Selecciona prendas (top, bottom, shoes, etc.)
   ↓
5. Guarda outfit
   
   SI está ONLINE:
   ├─ Guarda en SQLite (backend)
   ├─ Guarda en IndexedDB (caché local)
   └─ Retorna outfit
   
   SI está OFFLINE:
   ├─ Guarda en IndexedDB
   ├─ Registra como "pendiente"
   └─ Sincroniza cuando vuelve internet
```

---

## 📱 MOBILE (Android + Capacitor)

```
Capacitor = Framework que permite usar código React en Android

El proyecto tiene:
├── capacitor.config.ts     # Configuración Capacitor
├── android/                # Proyecto Android nativo
│   ├── app/                # Módulo de app
│   └── build/              # APK compilado
└── public/
    ├── sw.js               # Service Worker (para offline)
    └── manifest.webmanifest # Web App Manifest
```

El app funciona como:
1. **Web View** (React) dentro de Android
2. **Sqlite nativa** con capacitor-sqlite
3. **Acceso a cámara/galería** del teléfono

---

## 🔧 STACK TECNOLÓGICO

### Frontend
- **React 19** - Framework UI
- **TypeScript** - Type safety
- **Vite** - Build tool (rápido)
- **Zustand** - Estado global (alternativa a Redux)
- **Tailwind CSS** - Estilos
- **WatermelonDB** - ORM local (sincronización avanzada)
- **@dnd-kit** - Drag & drop
- **Cloudinary SDK** - Cliente de Cloudinary
- **@imgly/background-removal** - Quitar fondos (fallback)

### Backend
- **Node.js + Express** - Servidor
- **SQLite + better-sqlite3** - Base de datos
- **bcryptjs** - Hasheo de contraseñas
- **Multer** - Upload de archivos
- **CORS** - Permitir requests cross-origin
- **Python + REMBG** - Quitar fondos (opcional)

### Deployment
- **Capacitor** - Empaquetar como app Android
- **Render.com** - Deploy automático (probable)
- **Turso** - Base de datos remota MySQL (alternativa)

---

## 🔌 VARIABLES DE ENTORNO (`.env` necesario!)

```env
# Backend
DATABASE_URL=sqlite:///outfit-planner.db
NODE_ENV=production
PORT=3001

# Cloudinary
CLOUDINARY_CLOUD_NAME=dogl9tho3
CLOUDINARY_API_KEY=637587472785454
CLOUDINARY_API_SECRET=cAi5Slb_lBoqNBqKWtIy2uURaRo

# REMBG Server (opcional)
REMBG_SERVER=http://localhost:5000
```

⚠️ **Actualmente**: Credenciales en código. Mover a variables de entorno.

---

## 🔄 SINCRONIZACIÓN (Sync)

### Cuando sincroniza automáticamente?

```
1. ✅ Al conectarse internet
   → Detecta evento 'online'
   → Sinc pendingSync de IndexedDB
   → Usa apiDb para actualizar backend

2. 📅 Diariamente (>24h sin sync)
   → App.tsx valida lastSyncTimestamp
   → Fuerza sync completo

3. ⏱️ Sesión vencida
   → Si pasaron >60 días desde login
   → Logout automático
```

### Tabla de Cambios Pendientes

```
pending_sync {
    id: autoincrement,
    type: 'garment' | 'outfit',      // qué cambió
    action: 'create' | 'update' | 'delete',  // qué hizo
    data: {...},                      // datos del cambio
    timestamp: Date
}
```

Cuando vuelve internet:
1. Lee todos los registros pendientes
2. Envía POST/PUT/DELETE al backend
3. Si éxito → borra de pending_sync
4. Si error → mantiene para reintentar

---

## 📊 FLUJO DE DATOS VISUAL

```
          ┌──────────────┐
          │   Usuario    │
          └──────┬───────┘
                 │
          ┌──────▼──────────┐
          │  React App      │
          │  (src/pages/)   │
          └──────┬──────────┘
                 │
          ┌──────▼──────────────┐
          │  Zustand Store      │
          │  (Estado Global)    │
          └──────┬──────────────┘
                 │
    ┌────────────┴────────────┐
    │                         │
    ▼                         ▼
┌────────────┐        ┌──────────────┐
│ db-hybrid  │        │ Watermelon   │
│(smart swap)│        │(WatermelonDB)│
└─┬──────┬──┘        └──────────────┘
  │      │
  ▼      ▼
┌──────┬──────┐
│ API  │IndexedDB│
│ HTTP │ offline │
└┬─────┴──┬────┘
 │        │
 ▼        ▼
┌──────────────────┐
│  Backend Server  │
│ (Express+SQLite) │
└────┬─────────────┘
     │
     ├─→ SQLite (outfit-planner.db)
     ├─→ Cloudinary (imágenes)
     └─→ Python REMBG (procesar fotos)
```

---

## 🎯 RESUMEN EJECUTIVO

| Aspecto | Detalles |
|--------|----------|
| **Tipo App** | Planificador de outfits (ropa) |
| **Stack** | React + Node.js + SQLite + Cloudinary |
| **Online** | API Express → SQLite + Cloudinary |
| **Offline** | IndexedDB caché local + Zustand |
| **Imágenes** | Cloudinary (rápido, escalable) |
| **Sync** | Automático al detectar conexión |
| **Auth** | Login con bcrypt, sesión 60 días |
| **Mobile** | Android vía Capacitor |
| **Procesamiento** | REMBG (servidor) o @imgly (fallback) |

---

## ⚠️ PROBLEMAS DE SEGURIDAD DETECTADOS

1. **Credenciales Cloudinary en código** → Expuestas públicamente
2. **API Keys sin validación** → Cualquiera puede usarlas
3. **Contraseñas NO en variables de entorno** → Riesgo en git
4. **CORS abierto** → Cualquiera puede llamar API
5. **No hay rate limiting** → Posible abuso

---

## 🚀 PRÓXIMOS PASOS RECOMENDADOS

1. Mover todas las credenciales a `.env`
2. Agregar validación de tokens JWT
3. Rate limiting en endpoints críticos
4. HTTPS en producción
5. Encriptación de datos sensibles en IndexedDB
6. Tests unitarios e integración
7. Versionamiento de API (`/api/v1/`)

