# Análisis: Sistema Offline-First + Sync Diario + Sesión 2 Meses

## Objetivo
Usuarios pueden trabajar sin internet, se conectan al menos 1x diario, sesión válida 2 meses.

---

## 1. ESTADO ACTUAL DEL PROYECTO

### ✅ Lo que YA existe:

#### a) **Persistencia local (WatermelonDB)**
- Base de datos local en IndexedDB: `ootd_planner`
- Garments y Outfits se guardan localmente
- Fallback graceful si IndexedDB no disponible
- Funcionamiento offline: SÍ (datos locales se leen/escriben sin API)

#### b) **Auto-sync periódica**
- Archivo: `src/lib/watermelon.ts` (líneas 111-134)
- Cada 30 segundos, si hay internet: intenta `POST /api/sync/pull` y `POST /api/sync/push`
- Detecta `navigator.onLine` para saber si hay conexión
- Captura cambios locales en queue automáticamente

#### c) **Service Worker & PWA**
- `public/sw.js`: cachea assets y GET requests
- Offline browsing: SÍ
- Auto-update del SW: SÍ (cada 30s chequea cambios)
- Falla graceful en POST offline: SÍ (devuelve JSON 503)

#### d) **Autenticación offline**
- Login normal: requiere API
- **"Continuar offline"**: crea usuario local (sin API) → SÍ
- Sesión persistida en localStorage: `outfit-planner-storage`

#### e) **Endpoints de sync en servidor**
- `POST /api/sync/pull`: descarga cambios desde Turso
- `POST /api/sync/push`: sube cambios locales a Turso
- Migración automática de `garments.updated_at` en Turso al arrancar

---

## 2. PROBLEMAS / GAPS IDENTIFICADOS

### 🔴 **CRÍTICO 1: Imágenes en Cloudinary requieren internet**

**Problema:**
- Al subir prenda: `watermelonService.createGarment()` → almacena en WatermelonDB
- Imagen se guarda como base64 en `image_url` localmente
- Pero en Turso se espera Cloudinary URL, no base64
- Sync se quiebra si la imagen es demasiado grande (base64 muy pesado)

**Dónde:**
- [src/lib/watermelon-service.ts](src/lib/watermelon-service.ts#L62): `g.image_url = garment.image_data || ''`
- [src/components/closet/UploadModal.tsx](src/components/closet/UploadModal.tsx#L82): `image_data: imageData`

**Impacto:**
- Subes una prenda offline → se guarda localmente bien
- Cuando conectas internet → sync intenta subir base64 a Turso
- Turso rechaza o se rompe el schema (espera URL, no 30MB de base64)

**Solución necesaria:**
Dos opciones:
1. **Almacenar base64 locally, uploadear a Cloudinary en background** cuando hay internet (cola de upload pendiente)
2. **Guardar solo imagen local** (IndexedDB Blob storage) y nunca sincronizar imágenes a Turso (solo referencias)

---

### 🔴 **CRÍTICO 2: Sin logout automático después de 2 meses**

**Problema:**
- `useStore` persiste `currentUser` indefinidamente en localStorage
- No hay TTL ni expiración automática
- Usuario sigue logueado aunque pasen 6 meses

**Dónde:**
- [src/lib/store.ts](src/lib/store.ts#L114-L119): `persist()` sin `expires`
- [src/App.tsx](src/App.tsx#L25-26): carga sesión desde localStorage sin validar edad

**Solución necesaria:**
Guardar `loginTimestamp` con la sesión y chequear en `App.tsx`:
```typescript
if (currentUser && Date.now() - currentUser.loginTimestamp > 60 * 24 * 60 * 60 * 1000) {
  logout() // 60 días
}
```

---

### 🟡 **IMPORTANTE 3: Sync solo cada 30s, no garantiza 1x diario**

**Problema:**
- Auto-sync corre cada 30 segundos si hay internet
- Pero si usuario nunca abre la app al día siguiente, sync no ocurre
- No hay garantía de "sync diario"

**Dónde:**
- [src/lib/watermelon.ts](src/lib/watermelon.ts#L130): `setInterval(performSync, 30000)`

**Solución necesaria:**
Agregar mecanismo de sync forzado:
- Guardar `lastSyncTimestamp`
- Al abrir app: si `Date.now() - lastSyncTimestamp > 24h`, forzar sync
- O usar Background Sync API (en PWA) para programar sync cuando hay conexión

---

### 🟡 **IMPORTANTE 4: Cambios en offline no persisten a través de reinicio**

**Problema:**
- Si usuario edita prenda offline → se guarda en WatermelonDB
- Pero durante sync, WatermelonDB intenta enviar cambios a Turso
- Si la sync falla, los cambios se pierden si el usuario limpia caché

**Dónde:**
- [src/lib/watermelon.ts](src/lib/watermelon.ts#L84-100): `pushChanges` sin retry logic
- No hay queue persistente de cambios fallidos

**Solución necesaria:**
Implementar retry logic con exponential backoff para sync fallidos

---

### 🟡 **IMPORTANTE 5: Imagen offline nunca se sincroniza a Cloudinary**

**Problema:**
- Base64 se guarda en WatermelonDB local
- Cuando conecta internet, sync no sube imagen a Cloudinary
- Resultado: en otro dispositivo, la imagen no aparece (o aparece como base64 pesado)

**Dónde:**
- [src/lib/watermelon-service.ts](src/lib/watermelon-service.ts#L62-63): se guarda como `cloudinary_id` falso
- Nunca se crea trabajo de "subir a Cloudinary"

**Solución necesaria:**
Crear "pending uploads" queue:
1. Al crear prenda offline → guardar base64 local + marcar como "pendiente upload"
2. Cuando hay internet → background job sube a Cloudinary
3. Luego actualizar `image_url` en Turso

---

### 🟡 **IMPORTANTE 6: API endpoints no toleran usuario offline**

**Problema:**
- `POST /api/garments` espera subir imagen a Cloudinary
- Pero en offline, usuario crea prenda con base64
- Cuando sincroniza, servidor recibe base64 en lugar de URL Cloudinary

**Dónde:**
- [server-turso.cjs](server-turso.cjs#L431): `INSERT INTO garments` con `image_url` que espera URL

**Solución necesaria:**
Backend debe aceptar base64 temporalmente O crear endpoint de upload diferente

---

### 🟠 **MENOR 7: Sin UI para forzar sync manual**

**Problema:**
- Usuario offline no sabe cuándo es la última sync
- No hay botón "Sincronizar ahora"
- No hay indicador de "cambios pendientes"

**Dónde:**
- Ningún lado: UI no existe

**Solución necesaria:**
Agregar en Profile.tsx:
- Indicador de última sync
- Botón "Sincronizar"
- Indica "X cambios pendientes"

---

### 🟠 **MENOR 8: Sin clear data UI**

**Problema:**
- Usuario no puede borrar sesión + datos locales fácilmente
- Solo tiene logout manual

**Dónde:**
- [src/pages/Profile.tsx](src/pages/Profile.tsx#L131-133): `logout()` solo limpia sesión, no IndexedDB

**Solución necesaria:**
Botón "Borrar datos locales" que llame a `watermelonService.clearAll()`

---

## 3. ARQUITECTURA ACTUAL

```
┌─ USUARIO OFFLINE ─────────┐
│                           │
│  React + Zustand Store    │  ← Sesión en localStorage
│         ↓                 │
│  WatermelonDB (IndexedDB) │  ← Garments + Outfits (local)
│         ↓                 │
│  Base64 images            │  ← Se guardan en IndexedDB (PROBLEMA!)
│                           │
└─ Sin internet ────────────┘
         ↓ (cuando hay internet, cada 30s)
┌─ CUANDO CONECTA ──────────┐
│                           │
│  Auto-sync (30s)          │
│         ↓                 │
│  POST /api/sync/pull      │  ← Descarga cambios Turso
│  POST /api/sync/push      │  ← Sube cambios WatermelonDB
│         ↓                 │
│  Turso (PostgreSQL)       │  ← DB remota persistente
│         ↓                 │
│  Cloudinary               │  ← URLs de imágenes (NO SE SUBEN OFFLINE!)
│                           │
└───────────────────────────┘
```

---

## 4. QUÉ FALTA PARA "100% OFFLINE + SYNC DIARIO + 2 MESES"

### **Línea 1: Sesión (30 min - implementar)**
- [ ] Agregar `loginTimestamp` a User en [src/types/index.ts](src/types/index.ts)
- [ ] En [src/App.tsx](src/App.tsx), chequear expiración al cargar
- [ ] Logout automático si > 60 días

### **Línea 2: Imágenes Offline (2-3 horas - arquitectura)**
Elegir enfoque:
- **Opción A (recomendada):**
  - Guardar base64 en IndexedDB bajo tabla `pending_uploads`
  - Al conectar: background job sube a Cloudinary
  - Actualiza referencia en Turso
  
- **Opción B (simple pero pesado):**
  - Sincronizar base64 a Turso tal cual
  - En otro dispositivo, servir desde Turso o convertir a blob
  - Problema: base64 muy pesado para sync

### **Línea 3: Sync Garantizado Diario (1 hora - mecanismo)**
- [ ] Guardar `lastSyncTimestamp` en localStorage
- [ ] Al abrir app: si > 24h, forzar `syncDatabase()`
- [ ] O implementar Service Worker + Background Sync API

### **Línea 4: Retry Logic (1-2 horas)**
- [ ] Implementar queue de cambios fallidos
- [ ] Retry con exponential backoff (3 intentos max)
- [ ] Persistir en IndexedDB si falla

### **Línea 5: UI Indicadores (1 hora)**
- [ ] En Profile: "Última sync: hace 2h" o "Sin sincronizar"
- [ ] Botón "Sincronizar ahora"
- [ ] Indicador "X cambios pendientes"
- [ ] Botón "Borrar datos locales"

---

## 5. CHECKLIST DE IMPLEMENTACIÓN

### **Fase 1: Sesión + Logout automático**
```
[ ] Agregar loginTimestamp a User type
[ ] Modificar Auth.tsx para guardar timestamp
[ ] En App.tsx: chequear expiración en useEffect
[ ] Test: login → esperar 60 días → debería logout
```

### **Fase 2: Pending Images Upload**
```
[ ] Crear tabla IndexedDB: pending_uploads
[ ] En watermelon-service: al crear garment offline, agregar a pending_uploads
[ ] En sync: background job "processPendingUploads()"
  - Chequear si hay internet
  - Para cada pending: subir a Cloudinary
  - Actualizar image_url en Turso via /api/sync/push
  - Marcar como completo en IndexedDB
[ ] Test: crear prenda offline → conectar internet → imagen aparece en Cloudinary
```

### **Fase 3: Sync Diario Garantizado**
```
[ ] Guardar lastSyncTimestamp en localStorage
[ ] En App.tsx useEffect: chequear si > 24h
[ ] Si sí: await syncDatabase() con feedback al usuario
[ ] Test: apagar internet → esperar 25h → conectar → debería sync
```

### **Fase 4: Retry Logic**
```
[ ] Modificar watermelon.ts: pushChanges con try/catch mejorado
[ ] Si falla: guardar cambios en IndexedDB pending_sync con timestamp
[ ] Cada 5 min: reintentar pending_sync con exponential backoff
[ ] Marcar como synced cuando tenga éxito
```

### **Fase 5: UI Indicadores**
```
[ ] En Profile.tsx:
  - Mostrar lastSyncTimestamp formateado
  - Botón para forzar sync (con loading)
  - Contador de pending changes
  - Botón "Clear local data" (con confirmación)
[ ] Toast al completar sync
```

---

## 6. TIEMPO ESTIMADO

- **Fase 1 (Sesión)**: 30 min
- **Fase 2 (Imágenes)**: 2-3 h
- **Fase 3 (Sync diario)**: 1 h
- **Fase 4 (Retry)**: 1-2 h
- **Fase 5 (UI)**: 1 h
- **Testing**: 1-2 h

**Total: 6-10 horas para "100% offline + sync diario + 2 meses"**

---

## 7. OBSERVACIONES CLAVE

1. **Sin cambios en Turso**: la arquitectura del backend está ok, solo necesita tolerancia a base64 en images
2. **WatermelonDB es sólido**: ya está bien configurado para offline-first
3. **El mayor reto**: sincronización de imágenes (base64 ↔ Cloudinary)
4. **Segundo reto**: garantizar sync diario sin depender de Service Workers complejos
5. **PWA + iOS**: en iOS/Capacitor, App Shell y datos se guardan en filesystem, no IndexedDB (diferente arquitectura)

