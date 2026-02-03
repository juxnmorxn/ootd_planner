# 📐 DIAGRAMAS DETALLADOS - OOTD Planner

## 1️⃣ ARQUITECTURA DE CAPAS

```
┌─────────────────────────────────────────────────────────────┐
│                    UI LAYER (React)                         │
│  ┌──────────┬──────────────┬────────────┬──────────────┐   │
│  │   Auth   │  CalendarHome│   Closet   │   OutfitEd   │   │
│  │  Page    │    Page      │    Page    │    Page      │   │
│  └──────────┴──────────────┴────────────┴──────────────┘   │
│                      ↓                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          COMPONENT LAYER                            │   │
│  │  Buttons, Cards, Modals, Forms                      │   │
│  └──────────────────┬──────────────────────────────────┘   │
└────────────────────┼──────────────────────────────────────┘
                     ↓
    ┌────────────────────────────────────┐
    │      STATE MANAGEMENT              │
    │  ┌──────────────────────────────┐  │
    │  │  Zustand Store               │  │
    │  │  ├─ currentUser              │  │
    │  │  ├─ currentView              │  │
    │  │  ├─ garments[]               │  │
    │  │  ├─ selectedOutfit           │  │
    │  │  └─ loading state            │  │
    │  └──────────────────────────────┘  │
    └────────────┬───────────────────────┘
                 ↓
    ┌────────────────────────────────────┐
    │    DATA ACCESS LAYER               │
    │  ┌──────────────────────────────┐  │
    │  │  db-hybrid.ts                │  │
    │  │  (inteligencia online/offline)│  │
    │  └──────┬──────────────┬────────┘  │
    │         ↓              ↓            │
    │    ┌────────────┬──────────────┐   │
    │    │  API DB    │ OFFLINE DB   │   │
    │    │(api-db.ts) │(db-offline)  │   │
    │    └────────────┴──────────────┘   │
    └────────────┬───────────────────────┘
                 ↓
    ┌────────────────────────────────────┐
    │      SERVICES LAYER                │
    │  ┌──────────────────────────────┐  │
    │  │ Cloudinary  │  Background    │  │
    │  │ Upload      │  Removal       │  │
    │  └──────────────────────────────┘  │
    └────────────┬───────────────────────┘
                 ↓
    ┌────────────────────────────────────┐
    │    BACKEND + STORAGE               │
    │  ┌──────────────────────────────┐  │
    │  │  Express Server (Node.js)    │  │
    │  │  ├─ Auth endpoints           │  │
    │  │  ├─ Garment endpoints        │  │
    │  │  └─ Outfit endpoints         │  │
    │  └──────────────────────────────┘  │
    │  ┌──────────────────────────────┐  │
    │  │  SQLite Database             │  │
    │  │  ├─ users table              │  │
    │  │  ├─ garments table           │  │
    │  │  └─ outfits table            │  │
    │  └──────────────────────────────┘  │
    └────────────┬───────────────────────┘
                 ↓
    ┌────────────────────────────────────┐
    │    EXTERNAL SERVICES               │
    │  ┌──────────────────────────────┐  │
    │  │ Cloudinary (almacenamiento)  │  │
    │  │ Python REMBG (procesamiento) │  │
    │  └──────────────────────────────┘  │
    └────────────────────────────────────┘
```

---

## 2️⃣ FLUJO ONLINE - Subir una Prenda

```
┌─────────────────────┐
│   Usuario Selecciona│
│     Imagen Física   │
└──────────┬──────────┘
           │
           ▼
┌──────────────────────────────────┐
│   UploadModal.tsx                │
│  ├─ Captura foto/galería         │
│  └─ Comprime imagen              │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ removeBackgroundHybrid()         │
│  ├─ Detecta: ¿hay internet?     │
│  └─ Sí → REMBG (rápido)         │
│     No → fallback @imgly (lento)│
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ POST /api/remove-background      │
│ (servidor Python)                │
│ Input: base64 imagen             │
│ Output: PNG sin fondo            │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  uploadImageToCloudinary()       │
│  ├─ Sube a Cloudinary            │
│  ├─ Folder: outfit-planner/user  │
│  └─ Retorna: secure_url          │
│     https://res.cloudinary.com/..│
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ POST /api/garments               │
│ {                                │
│   userId: "abc123",              │
│   category: "top",               │
│   image_url: "cloudinary_url",   │
│   cloudinary_id: "..."           │
│ }                                │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ Backend (server.ts)              │
│ ├─ Valida datos                  │
│ ├─ Genera ID de prenda           │
│ └─ Guarda en SQLite              │
│    INSERT INTO garments (...)    │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ API responde 200 OK              │
│ ├─ Retorna Garment completo      │
│ └─ con ID y timestamps           │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ Frontend actualiza                │
│ ├─ Zustand store.addGarment()    │
│ ├─ Cachea en IndexedDB           │
│ └─ Muestra en Closet             │
└──────────────────────────────────┘
```

---

## 3️⃣ FLUJO OFFLINE - Sin Internet

```
┌──────────────────────────┐
│ Usuario está OFFLINE     │
│ navigator.onLine = false │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│ db-hybrid.ts detecta OFF │
│ ├─ isOnline = false      │
│ └─ usa offlineDB.ts      │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│ OfflineDB (IndexedDB)    │
│ ├─ saveGarmentOffline()  │
│ ├─ offline: true         │
│ ├─ synced: false         │
│ └─ timestamp: Date.now() │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│ pending_sync table       │
│ {                        │
│   type: 'garment',       │
│   action: 'create',      │
│   data: {...},           │
│   timestamp: "2026-02-03"│
│ }                        │
└───────────┬──────────────┘
            │
            │ Usuario sigue usando la app
            │
            ▼
   ┌─────────────────────────────┐
   │ ¿VUELVE EL INTERNET?        │
   │ window.addEventListener     │
   │ ('online', syncPending...)  │
   └─────────┬───────────────────┘
             │ SÍ
             ▼
┌──────────────────────────────────┐
│ syncPendingChanges()             │
│ ├─ Lee todos los pending_sync    │
│ ├─ Por cada cambio:              │
│ │  ├─ Si action='create'         │
│ │  │  → POST /api/garments       │
│ │  ├─ Si action='update'         │
│ │  │  → PUT /api/garments/:id    │
│ │  └─ Si action='delete'         │
│ │     → DELETE /api/garments/:id │
│ └─ Espera respuesta del servidor │
└──────────┬───────────────────────┘
           │
       ┌───┴────┐
       │        │
   SUCCESS   ERROR
       │        │
       ▼        ▼
    ✅Borra  ⏳Reintenta
   pending  después
   _sync    (exponential
            backoff)
       │        │
       └─→ UI actualizada
```

---

## 4️⃣ CICLO DE SINCRONIZACIÓN COMPLETO

```
        ┌─────────────────────────────┐
        │  App Inicia (App.tsx)       │
        └────────┬────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────┐
    │ 1. ¿Usuario logged in?          │
    │    ✓ Sí → continuar             │
    │    ✗ No → mostrar Auth          │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │ 2. ¿Sesión válida?              │
    │    (loginTimestamp < 60 días)    │
    │    ✓ Sí → continuar             │
    │    ✗ No → logout automático     │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │ 3. ¿Necesita sincronizar?       │
    │    (lastSyncTimestamp > 24h)    │
    │    ✓ Sí → fuerza sync completo  │
    │    ✗ No → continuar normal      │
    └────────┬────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │ 4. Detectar cambios de conexión │
    │    ├─ window.addEventListener   │
    │    │  ('online')                │
    │    │  → syncPendingChanges()    │
    │    │                             │
    │    └─ window.addEventListener   │
    │       ('offline')               │
    │       → activar modo offline    │
    └────────┬────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
 ONLINE            OFFLINE
    │                 │
    ▼                 ▼
 Cada      Usuario    Cambios
 request   interactúa en IndexedDB
 → API     con la app  (no se envían
           normalmente  al servidor)
           │
           ▼ (cuando vuelve internet)
           Sync automático con API
```

---

## 5️⃣ ESTRUCTURA DE TABLAS SQLite

```
┌─────────────────────────────────────────────────────────┐
│                    DATABASE SCHEMA                      │
└─────────────────────────────────────────────────────────┘

┌──────────── USERS ────────────────────────────────────┐
│                                                         │
│  id (PK)        → UUID único                           │
│  username       → string UNIQUE                        │
│  email          → string optional                      │
│  role           → 'admin' | 'user'                     │
│  password_hash  → bcrypt hash (nunca se retorna)      │
│  profile_pic    → URL opcional                         │
│  custom_subcategories → JSON con categorías custom     │
│  created_at     → timestamp ISO                        │
│  updated_at     → timestamp ISO                        │
│                                                         │
│  INDICES:                                              │
│  - username (UNIQUE)                                   │
│  - email (UNIQUE)                                      │
└─────────────────────────────────────────────────────────┘

┌──────────── GARMENTS ────────────────────────────────┐
│                                                       │
│  id (PK)         → UUID único                        │
│  user_id (FK)    → referencia a users                │
│  category        → 'top', 'bottom', 'shoes', etc.   │
│  sub_category    → 'shirt', 'pants', 'dress', etc. │
│  image_url       → https://res.cloudinary.com/...   │
│  cloudinary_id   → público ID en Cloudinary         │
│  created_at      → timestamp ISO                     │
│                                                       │
│  INDICES:                                            │
│  - user_id (búsquedas rápidas por usuario)          │
│  - user_id + category (búsquedas combinadas)         │
│  - cloudinary_id (para eliminar de Cloudinary)       │
│                                                       │
│  ⚠️ IMPORTANTE: Sin image_data (base64)             │
│     Solo URLs de Cloudinary                          │
└───────────────────────────────────────────────────────┘

┌──────────── OUTFITS ────────────────────────────────┐
│                                                      │
│  id (PK)         → UUID único                       │
│  user_id (FK)    → referencia a users               │
│  date_scheduled  → YYYY-MM-DD (fecha del outfit)   │
│  layers_json     → JSON con prendas seleccionadas   │
│  created_at      → timestamp ISO                    │
│  updated_at      → timestamp ISO                    │
│                                                      │
│  layers_json ejemplo:                               │
│  {                                                   │
│    "top": "garment_id_123",                         │
│    "bottom": "garment_id_456",                      │
│    "shoes": "garment_id_789",                       │
│    "accessories": ["id_001", "id_002"]              │
│  }                                                   │
│                                                      │
│  INDICES:                                           │
│  - user_id + date_scheduled (UNIQUE)                │
│  - date_scheduled (para búsquedas por fecha)        │
└───────────────────────────────────────────────────────┘

┌──────── RELACIONES ENTRE TABLAS ────────────────────┐
│                                                      │
│   USERS                                              │
│    │                                                 │
│    ├─→ (1:N) ─→ GARMENTS                            │
│    │            (user_id FK)                        │
│    │                                                 │
│    └─→ (1:N) ─→ OUTFITS                             │
│                 (user_id FK)                        │
│                                                      │
│  Una prenda pertenece a exactamente 1 usuario      │
│  Un outfit pertenece a exactamente 1 usuario       │
│  Un usuario puede tener N prendas y N outfits      │
└──────────────────────────────────────────────────────┘
```

---

## 6️⃣ FLUJO DE AUTENTICACIÓN

```
┌─────────────────────────────────────────────────────┐
│              SIGNUP (REGISTRO)                      │
└─────────────────────────────────────────────────────┘

Usuario ingresa:
├─ username: "juan123"
├─ email: "juan@example.com"
└─ password: "MiContraseña123"

        ↓

POST /api/auth/register
{
  username: "juan123",
  email: "juan@example.com",
  password: "MiContraseña123"
}

        ↓

Backend valida:
├─ ¿username ya existe? → Error 400
├─ ¿email ya existe? → Error 400
└─ ✓ datos válidos → continuar

        ↓

Backend genera:
├─ id = UUID
├─ salt = bcrypt.genSalt(10)
├─ password_hash = bcrypt.hash(password, salt)
├─ role = "admin" (si es primer usuario) o "user"
├─ created_at = ahora
└─ updated_at = ahora

        ↓

Inserta en SQLite:
INSERT INTO users
(id, username, email, password_hash, role, created_at, updated_at)
VALUES (...)

        ↓

Retorna usuario (SIN password_hash):
{
  id: "abc123def456",
  username: "juan123",
  email: "juan@example.com",
  role: "user",
  created_at: "2026-02-03T...",
  updated_at: "2026-02-03T..."
}

        ↓

Frontend guarda en:
├─ Zustand store.currentUser
├─ localStorage (persistencia)
└─ Zustand store.setCurrentView('calendar')


┌─────────────────────────────────────────────────────┐
│              LOGIN (INICIO SESIÓN)                  │
└─────────────────────────────────────────────────────┘

Usuario ingresa:
├─ username/email: "juan123"
└─ password: "MiContraseña123"

        ↓

POST /api/auth/login
{
  username: "juan123",      // puede ser email también
  password: "MiContraseña123"
}

        ↓

Backend busca en SQLite:
SELECT * FROM users
WHERE username = ? OR email = ?

        ↓

¿Usuario existe?
├─ No → Error 404
└─ Sí → continuar

        ↓

Compara contraseña:
bcrypt.compare(inputPassword, user.password_hash)

        ↓

¿Coincide?
├─ No → Error 401 "Contraseña incorrecta"
└─ Sí → continuar

        ↓

Retorna usuario:
{
  id: "abc123def456",
  username: "juan123",
  loginTimestamp: Date.now(),
  lastSyncTimestamp: 0,
  ...
}

        ↓

Frontend:
├─ Zustand.setCurrentUser(user)
├─ localStorage.setItem('currentUser', JSON.stringify(user))
├─ Registra loginTimestamp
└─ Navega a CalendarHome


┌─────────────────────────────────────────────────────┐
│            VALIDACIÓN CONTINUA (App.tsx)            │
└─────────────────────────────────────────────────────┘

Cada vez que carga la app:

1. Valida sesión:
   ├─ Si loginTimestamp + 60 días < ahora
   │  → logout automático
   └─ Else → continuar

2. Valida sincronización:
   ├─ Si lastSyncTimestamp + 24h < ahora
   │  AND navigator.onLine
   │  → fuerza sync completo
   └─ Else → normal
```

---

## 7️⃣ BÚSQUEDA DE DATOS ONLINE vs OFFLINE

```
┌──────────────────────────────────────────────────────────┐
│  GET /garments?userId=abc&category=top                   │
└──────────────────────────────────────────────────────────┘

SCENARIO 1: ONLINE
──────────────────

db-hybrid.ts
  navigator.onLine === true
  
        ↓
        
API Request:
  fetch('/api/garments?userId=abc&category=top')
  
        ↓
        
Backend (Express):
  SELECT * FROM garments
  WHERE user_id = ? AND category = ?
  
        ↓
        
SQLite Retorna: [{ garment1 }, { garment2 }, ...]
  
        ↓
  
Respuesta HTTP 200:
[...]
  
        ↓
  
Frontend recibe en db-hybrid:
  ├─ Guarda en IndexedDB (caché)
  ├─ Actualiza Zustand store
  └─ Re-renderiza UI

Tiempo: ~50ms (local) a ~500ms (con latencia red)


SCENARIO 2: OFFLINE
───────────────────

db-hybrid.ts
  navigator.onLine === false
  
        ↓
        
Salta API → usa IndexedDB directamente:
  
        ↓
  
OfflineDB.getGarmentsOffline(userId):
  const tx = db.transaction(['garments'], 'readonly')
  const index = tx.objectStore('garments')
                  .index('user_id')
  const request = index.getAll(userId)
  
        ↓
  
IndexedDB retorna: [{ garment1 }, { garment2 }, ...]
  (datos cached previamente)
  
        ↓
  
Frontend actualiza UI instantáneamente

Tiempo: ~5-10ms (instantáneo desde caché)


SCENARIO 3: FALLA DE RED
─────────────────────────

db-hybrid.ts intenta API:
  try {
    await apiDb.getGarmentsByUser()
  } catch (error) {
    // API falló (timeout, 500, etc.)
  }
  
        ↓
        
Fallback automático a IndexedDB:
  return await offlineDB.getGarmentsOffline(userId)
  
        ↓
  
Muestra datos en caché (pueden estar algo desactualizados)
```

---

## 8️⃣ CICLO DE VIDA DE UNA IMAGEN

```
┌──────────────────────────────────────────────────┐
│          CICLO DE VIDA DE UNA IMAGEN             │
└──────────────────────────────────────────────────┘

1️⃣ CAPTURA
──────────
Usuario abre UploadModal
├─ Camera API → captura foto
├─ Gallery API → selecciona imagen
└─ Imagen = { data: "data:image/jpeg;base64,..." }

Tamaño: ~200KB-5MB (sin comprimir)


2️⃣ COMPRESIÓN (opcional)
────────────────────────
Reducir tamaño antes de procesar
├─ Canvas API: redimensiona
└─ Resultado: ~50-200KB


3️⃣ ELIMINACIÓN DE FONDO (si está disponible)
──────────────────────────────────────────────
¿Hay internet?
│
├─ Sí → REMBG (servidor Python)
│   ├─ POST /api/remove-background
│   ├─ Input: base64 image
│   ├─ Servidor ejecuta: rembg -i input -o output
│   └─ Output: PNG transparente
│   Tiempo: 1-2 segundos
│
└─ No → @imgly (frontend)
    ├─ JavaScript en navegador
    ├─ removeBackground(imageData)
    └─ Output: PNG transparente
    Tiempo: 10-30 segundos

Resultado: PNG sin fondo (~100-300KB)


4️⃣ SUBIDA A CLOUDINARY
──────────────────────
uploadImageToCloudinary(imageData, userId, garmentId)

├─ cloudinary.uploader.upload(imageData, {
│   folder: `outfit-planner/${userId}/garments`,
│   public_id: garmentId,
│   upload_preset: 'oodt_123',
│   overwrite: true,
│   resource_type: 'image'
│ })
│
└─ Respuesta:
    {
      secure_url: "https://res.cloudinary.com/dogl9tho3/image/upload/v1234567890/outfit-planner/user123/garments/garment456.png",
      public_id: "outfit-planner/user123/garments/garment456",
      format: "png",
      resource_type: "image"
    }

Tiempo: 1-3 segundos (dependiendo de tamaño)
Cloudinary almacena y optimiza


5️⃣ GUARDAR EN BASE DE DATOS
───────────────────────────
POST /api/garments
{
  userId: "user123",
  category: "top",
  sub_category: "shirt",
  image_url: "https://res.cloudinary.com/...",
  cloudinary_id: "outfit-planner/user123/garments/garment456"
}

Backend:
├─ Genera ID de prenda
├─ Inserta en SQLite
└─ Retorna Garment completo

Frontend:
├─ Guarda en IndexedDB (caché)
├─ Actualiza Zustand store
└─ Muestra en Closet


6️⃣ VISUALIZACIÓN (Optimización)
────────────────────────────────
Cuando muestra la imagen:

const url = cloudinary.url(publicId, {
  width: 800,              // Redimensiona automáticamente
  quality: 'auto',         // Calidad óptima según dispositivo
  fetch_format: 'auto'     // WebP en navegadores modernos
});

Resultado:
├─ Desktop: WebP 800px → ~50KB
├─ Mobile: WebP 400px → ~20KB
└─ Viejo navegador: JPEG 800px → ~80KB


7️⃣ ELIMINACIÓN (Usuario borra prenda)
──────────────────────────────────────
DELETE /api/garments/{garmentId}

Backend:
├─ Busca garment en SQLite
├─ Obtiene cloudinary_id
├─ Elimina de Cloudinary
│  cloudinary.uploader.destroy(cloudinary_id)
├─ Elimina de SQLite
└─ Retorna success

Frontend:
├─ Elimina de Zustand store
├─ Elimina de IndexedDB
└─ Re-renderiza Closet


📊 RESUMEN DE ALMACENAMIENTO
────────────────────────────
               Quién           Dónde               Qué contiene
────────────────────────────────────────────────────────────
Comprimida    Browser        RAM                  base64
Sin fondo     Cloudinary     CDN Global           PNG final
Referencia    SQLite         Servidor             URL + ID
Caché         IndexedDB      Browser Local Stor.  Copia para offline

Total almacenado en cliente: ~1-5MB por prenda (IndexedDB)
Total almacenado en servidor: ~100KB por prenda (solo URL)
Total almacenado en Cloudinary: ~200-300KB por prenda (imagen)
```

---

## 9️⃣ ESTADO GLOBAL (Zustand Store)

```
┌───────────────────────────────────────────┐
│       Zustand Store (store.ts)            │
└───────────────────────────────────────────┘

Interface AppStore {
  
  // ========== USUARIO ==========
  currentUser: User | null
    ├─ id: string
    ├─ username: string
    ├─ email: string
    ├─ role: 'admin' | 'user'
    ├─ loginTimestamp: number
    └─ lastSyncTimestamp: number
  
  // ========== VISTA ACTUAL ==========
  currentView: string
    ├─ 'auth'
    ├─ 'calendar'
    ├─ 'closet'
    ├─ 'outfit-editor'
    ├─ 'profile'
    └─ 'admin-users'
  
  // ========== DATOS DE PRENDAS ==========
  garments: Garment[]
    └─ Caché local de prendas del usuario
  
  // ========== DATOS DE OUTFITS ==========
  outfits: Outfit[]
    └─ Caché local de outfits del usuario
  
  selectedOutfit: Outfit | null
    └─ Outfit actual siendo editado
  
  selectedDate: string | null
    └─ Fecha seleccionada (YYYY-MM-DD)
  
  // ========== ESTADO DE CARGA ==========
  isLoading: boolean
    └─ Para mostrar spinners
  
  error: string | null
    └─ Mensajes de error
  
  // ========== MÉTODOS ==========
  
  setCurrentUser(user: User | null)
    └─ Actualiza usuario actual
  
  logout()
    └─ Limpia user + localStorage
  
  setCurrentView(view: string)
    └─ Cambia de pantalla
  
  addGarment(garment: Garment)
    └─ Agrega prenda al caché
  
  removeGarment(id: string)
    └─ Elimina prenda del caché
  
  setGarments(garments: Garment[])
    └─ Actualiza lista completa
  
  updateOutfit(outfit: Outfit)
    └─ Actualiza outfit seleccionado
  
  setLoading(loading: boolean)
    └─ Activa/desactiva spinner
}

┌─────────────────────────────────────────┐
│        Persistencia (localStorage)       │
└─────────────────────────────────────────┘

Zustand con persistencia automática:
  
  localStorage.ootd_planner_storage = {
    state: {
      currentUser: {...},      // Se guarda
      currentView: "calendar", // Se guarda
      garments: [...],         // Se guarda
      // isLoading NO se guarda (runtime only)
    },
    version: 0
  }

Al recargar:
  1. React monta App.tsx
  2. Zustand rehidrata desde localStorage
  3. Valida sesión
  4. Muestra UI con datos recuperados


┌────────────────────────────────────────────┐
│     Uso en Componentes (React Hooks)       │
└────────────────────────────────────────────┘

// En cualquier componente:
import { useStore } from './lib/store';

function MyComponent() {
  // Obtener estado
  const currentUser = useStore((state) => state.currentUser);
  const garments = useStore((state) => state.garments);
  
  // Llamar métodos
  const addGarment = useStore((state) => state.addGarment);
  const logout = useStore((state) => state.logout);
  
  const handleLogout = () => {
    logout();
    // Zustand automáticamente:
    // 1. Limpia currentUser
    // 2. Borra localStorage
    // 3. Re-renderiza componentes suscritos
    // 4. Muestra pantalla Auth
  };
}

// Suscripción selectiva (optimizada)
const userName = useStore((state) => state.currentUser?.username);
// Solo re-renderiza si userName cambia

// Acceso directo (sin hook, para no-React):
const store = useStore.getState();
const user = store.currentUser;
```

---

## 🔟 MANEJO DE ERRORES Y REINTENTOS

```
┌─────────────────────────────────────────────────────┐
│     ERROR HANDLING STRATEGY                         │
└─────────────────────────────────────────────────────┘

1️⃣ NETWORK ERROR (sin internet)
──────────────────────────────────

fetch('/api/garments')
  ↓ (falla porque no hay internet)
  ├─ Error: NetworkError
  │
  └─ db-hybrid detecta:
      ├─ catch(error)
      ├─ Si navigator.onLine === false
      └─ Fallback: usa IndexedDB
         → Usuario sigue trabajando offline


2️⃣ SERVER ERROR (500, 502, etc.)
──────────────────────────────────

fetch('/api/garments')
  ↓ (respuesta 500)
  ├─ response.ok === false
  │
  └─ Reintenta con backoff exponencial:
      ├─ Intento 1: inmediato
      ├─ Intento 2: espera 1 segundo
      ├─ Intento 3: espera 2 segundos
      ├─ Intento 4: espera 4 segundos
      └─ Máximo: 3-5 reintentos
      
      Si sigue fallando:
      ├─ Si está offline: guardar en pending_sync
      ├─ Si está online: mostrar Toast "Error al guardar"
      └─ Permitir que usuario lo reintente manualmente


3️⃣ VALIDATION ERROR (400)
──────────────────────────

POST /api/garments
  body: { invalid: data }
  ↓
  respuesta 400:
  {
    error: "invalid input",
    details: {
      category: "required field"
    }
  }
  ├─ Frontend muestra mensaje de error
  ├─ Resalta campo inválido
  └─ Permite usuario corregir


4️⃣ AUTHENTICATION ERROR (401, 403)
────────────────────────────────────

GET /api/garments (sin token válido)
  ↓
  respuesta 401: "Unauthorized"
  ├─ Frontend detecta:
  ├─ logout automático
  ├─ localStorage.clear()
  ├─ Zustand.setCurrentUser(null)
  └─ Redirige a Auth


5️⃣ SYNC CONFLICT (datos locales ≠ servidor)
───────────────────────────────────────────

Usuario OFFLINE:
  ├─ Crea prenda A en IndexedDB
  └─ Marca como pendiente

Otro dispositivo ONLINE:
  ├─ Crea prenda A (mismo ID)
  └─ Guarda en servidor

Cuando vuelve a estar online (dispositivo 1):
  ├─ Intenta enviar prenda A
  ├─ Servidor retorna 409: "Conflict"
  ├─ Frontend muestra:
  │  "¿Usar versión local o remota?"
  └─ Usuario elige una


TOAST NOTIFICATIONS (Feedback al usuario)
──────────────────────────────────────────

Toast.tsx muestra:
├─ ✅ "Prenda guardada correctamente"
├─ ⏳ "Sincronizando..."
├─ ⚠️ "Offline - Los cambios se sincronizarán"
├─ ❌ "Error al guardar - Intenta de nuevo"
└─ 🔄 "Sincronización completada"
```

---

## 1️⃣1️⃣ PERFORMANCE & OPTIMIZACIONES

```
┌─────────────────────────────────────────────────────┐
│         PERFORMANCE OPTIMIZATIONS                   │
└─────────────────────────────────────────────────────┘

1️⃣ IMAGE OPTIMIZATION (Cloudinary)
─────────────────────────────────────

Sin optimizar:
  └─ 2MB por imagen × 50 prendas = 100MB

Con Cloudinary:
  ├─ Compresión automática
  ├─ Responsive: desktop 800px, mobile 400px
  ├─ Formato: WebP para navegadores modernos
  ├─ Cache: CDN global
  └─ Resultado: ~20-50KB por imagen visualizada
     → 50 prendas × 30KB = 1.5MB


2️⃣ DATABASE INDEXING (SQLite)
───────────────────────────────

Índices creados:
  ├─ idx_garments_user_category
  │  └─ SELECT * FROM garments
  │     WHERE user_id = ? AND category = ?
  │     Antes: O(n) → Después: O(log n)
  │
  └─ idx_outfits_user_date
     └─ SELECT * FROM outfits
        WHERE user_id = ? AND date_scheduled = ?
        Antes: O(n) → Después: O(log n)


3️⃣ LAZY LOADING
────────────────

GarmentCard.tsx (Closet):
  ├─ Solo renderiza prendas visibles
  ├─ useIntersectionObserver()
  ├─ Al scroll → carga más
  └─ Reduce RAM y CPU


4️⃣ MEMOIZATION
────────────────

Componentes optimizados:
  ├─ React.memo(GarmentCard)
  │  └─ Evita re-render si props no cambian
  │
  ├─ useMemo() para listas grandes
  │  └─ const filteredGarments = useMemo(...)
  │
  └─ useCallback() para manejadores
     └─ const handleDelete = useCallback(...)


5️⃣ CACHING STRATEGY
─────────────────────

Triple caché:

  Nivel 1: Zustand (RAM)
    ├─ Más rápido (en memoria)
    ├─ Se pierde al recargar
    ├─ Tiempo: 0ms
    └─ Caso: datos actuales

  Nivel 2: IndexedDB (Browser Storage)
    ├─ Persiste entre sesiones
    ├─ Offline-first
    ├─ Tiempo: 5-10ms
    └─ Caso: caché de respuestas API

  Nivel 3: Servidor (SQLite)
    ├─ Fuente de verdad
    ├─ Requiere internet
    ├─ Tiempo: 50ms-1s
    └─ Caso: fuente oficial

  Flujo:
    Componente necesita datos
    ↓
    ¿En Zustand (RAM)? Sí → usa
    ↓ No
    ¿En IndexedDB (caché)? Sí → carga + actualiza Zustand
    ↓ No/Desactualizado
    ¿Hay internet? Sí → fetch API + caché + Zustand
    ↓ No
    Mostrar último caché disponible


6️⃣ BUNDLING & CODE SPLITTING (Vite)
────────────────────────────────────

Vite automáticamente:
  ├─ Tree-shaking: elimina código no usado
  ├─ Code splitting: carga componentes lazy
  │  import { OutfitEditor } = lazy(() =>
  │    import('./pages/OutfitEditor'))
  │  
  ├─ Minificación: reduce tamaño JS
  ├─ Asset optimization: comprime imágenes
  └─ Resultado:
      - Main bundle: ~500KB
      - Per-page: ~50-100KB
      - Total inicial: ~200KB (gzipped)
```

Espero que este análisis completo te ayude a entender el proyecto. He cubierto:

✅ **Estructura arquitectónica** - Capas y componentes
✅ **Flujos online/offline** - Cómo funciona el sistema híbrido  
✅ **Cloudinary** - Almacenamiento de imágenes
✅ **Sincronización** - Cómo se sincronizan cambios
✅ **Base de datos** - SQLite backend + IndexedDB frontend
✅ **Eliminación de fondos** - REMBG vs @imgly
✅ **Autenticación** - Login/Registro/Sesión
✅ **Performance** - Optimizaciones implementadas

¿Hay algún aspecto específico que quieras que profundice más?

