# Testing de Sincronización Turso + WatermelonDB

## Estado Actual

**✅ Implementado:**
- `POST /api/sync/pull` - Descarga cambios desde Turso
- `POST /api/sync/push` - Carga cambios a Turso
- WatermelonDB auto-sync cada 30 segundos
- Offline-first architecture lista

**✅ Ya funciona:**
- Crear garments (POST /api/garments → Turso + Cloudinary)
- Crear outfits (POST /api/outfits → Turso)
- Eliminar garments (DELETE /api/garments/:id)
- REMBG background removal en servidor

**❌ Pendiente:**
- Testear todo en navegador (DevTools)

## Test 1: Offline-First (5 minutos)

### Paso 1: Abre la app en Chrome

```bash
cd c:\Users\Enrique C Rebsamen\Music\ootd_planner
npm run dev
```

Abre `http://localhost:5173` en Chrome.

### Paso 2: Abre Chrome DevTools

1. Presiona `F12` o `Ctrl+Shift+I`
2. Ve a la pestaña **Network**
3. Busca el icono que dice **Offline** (en la esquina superior izquierda)
4. Haz clic en **"No throttling"** → Selecciona **"Offline"**

### Paso 3: Crea un garment OFFLINE

1. En la app, navega a **Closet**
2. Presiona el botón **"+"** para subir una prenda
3. Selecciona una imagen de tu computadora
4. Espera a que diga "Procesando..." y luego "Prenda agregada" ✅

**Lo que está pasando detrás:**
```
1. Imagen se procesa localmente (REMBG está online pero la app está offline)
   → Falla la llamada a /api/remove-background (porque está offline)
   
2. Si la imagen no se sube a Cloudinary, se guarda en IndexedDB de todas formas
   (offline-first)

NOTA: Para que funcione completamente offline, necesitaría:
- Local processing (ml5.js, TensorFlow.js)
- O caché de imágenes
```

**Si falla la subida:**
Es normal. Vamos a probar algo más simple.

### Paso 4: Crea un outfit OFFLINE

1. Navega a **Calendar**
2. Selecciona una fecha
3. Selecciona una prenda (de las ya creadas)
4. Presiona **Save**

**Lo que debe pasar:**
```
1. Outfit se guarda en IndexedDB local (INSTANTÁNEO)
2. Consola muestra: "[WatermelonDB] Created outfit locally"
3. App dice: "Outfit guardado" ✅
```

### Paso 5: Vuelve a Online

1. En Chrome DevTools → Network → Selecciona **"No throttling"** (quita Offline)
2. O simplemente recarga la página

### Paso 6: Verifica que la sincronización ocurrió

1. Abre **Chrome DevTools → Network**
2. Filtra por **"sync"** en el search box
3. Deberías ver dos requests:
   - `POST /api/sync/pull` ✅
   - `POST /api/sync/push` ✅

**En la consola deberías ver:**
```
[WatermelonDB] Starting sync...
[WatermelonDB] Pulled changes: {...}
[WatermelonDB] Pushed changes successfully
[WatermelonDB] ✅ Sync complete
```

## Test 2: Multi-Dispositivo (10 minutos)

### Setup

Necesitas dos navegadores o dos pestañas diferentes:
- **Chrome Desktop** (Device 1)
- **iPhone/iPad si tienes** o simplemente otra pestaña en el mismo Chrome (Device 2)

Para simular en el mismo Chrome:
```
Device 1: http://localhost:5173 (pestana 1)
Device 2: http://localhost:5173 (pestana 2)
```

Ambas pestañas tendrán IndexedDB **independientes** porque son contextos diferentes.

### Paso 1: Abre la app en ambos navegadores

```
Chrome Pestaña 1 (Device 1): http://localhost:5173
Chrome Pestaña 2 (Device 2): http://localhost:5173
```

**Nota:** Necesitas hacer login en ambas pestañas con el mismo usuario.

### Paso 2: En Device 1, crea un garment

1. Pestana 1 → Closet → Sube una prenda
2. Espera a que sincronice (30s máximo)
3. Verifica en Chrome DevTools que `/api/sync/push` se ejecutó

### Paso 3: En Device 2, espera 30 segundos y recarga

1. Pestana 2 → Espera 30 segundos (auto-sync)
2. O recarga la página manualmente (Ctrl+R)
3. **Deberías ver la prenda que creaste en Device 1** ✅

**En la consola de Device 2:**
```
[WatermelonDB] Pulled changes: {garments: {created: [{id: "...", ...}]}}
```

### Paso 4: En Device 2, crea un outfit

1. Pestana 2 → Calendar → Crea un outfit
2. Espera a que sincronice (30s)

### Paso 5: En Device 1, verifica que vea el outfit

1. Pestana 1 → Calendar → Espera 30s o recarga
2. **Deberías ver el outfit que creó Device 2** ✅

## Test 3: Datos Persisten Después de Recargar (5 minutos)

### Paso 1: Crea datos

1. Abre la app en Chrome
2. Crea 2-3 garments
3. Crea 2 outfits

### Paso 2: Recarga la página

```
Presiona Ctrl+R o F5
```

### Paso 3: Verifica que los datos están ahí

1. **Closet** debe mostrar los 2-3 garments ✅
2. **Calendar** debe mostrar los 2 outfits ✅

**Lo que está pasando:**
```
Los datos están en IndexedDB (navegador)
WatermelonDB los carga automáticamente al iniciar
No necesita conectarse a Turso (se usa el caché local)
```

## Test 4: Sincronización con Turso Directa (Admin Test)

### Paso 1: Consulta Turso directamente

Si tienes acceso a la consola de Turso o SQLite CLI:

```sql
-- Consulta garments en Turso
SELECT * FROM garments WHERE user_id = 'tu-user-id' ORDER BY created_at DESC;

-- Consulta outfits
SELECT * FROM outfits WHERE user_id = 'tu-user-id' ORDER BY created_at DESC;
```

### Paso 2: Verifica que coincida con la app

**En la app (IndexedDB):**
```
Closet → 3 garments
Calendar → 2 outfits
```

**En Turso:**
```
SELECT COUNT(*) FROM garments WHERE user_id = 'id';
-- Debería retornar 3

SELECT COUNT(*) FROM outfits WHERE user_id = 'id';
-- Debería retornar 2
```

Si los números coinciden, la sincronización está funcionando correctamente ✅

## Test 5: Flujo Completo End-to-End (15 minutos)

Este es el test más importante. Simula un flujo real:

### Paso 1: Abre DevTools en Chrome (Device 1)

### Paso 2: Ve offline

DevTools → Network → Offline

### Paso 3: Crea un outfit OFFLINE

1. Calendar → Selecciona una fecha
2. Selecciona una prenda
3. Presiona Save
4. Deberías ver "Outfit guardado" ✅

**Verifica en IndexedDB:**
```
DevTools → Application → IndexedDB → ootd_planner → outfits
Deberías ver el outfit que acabas de crear
```

### Paso 4: Vuelve a Online

DevTools → Network → No throttling

### Paso 5: Espera 30 segundos

WatermelonDB debería sincronizar automáticamente.

**Verifica en DevTools:**
```
Network → Filtra por "sync"
Deberías ver:
- POST /api/sync/pull ✅
- POST /api/sync/push ✅
```

### Paso 6: En otra pestaña, verifica que se sincronizó

```
Pestaña 2: http://localhost:5173 (con el mismo usuario)
Calendar → Debería ver el outfit que creaste en la Pestaña 1 ✅
```

### Paso 7: Elimina el outfit en Pestaña 1

1. Calendar → Haz clic en el outfit
2. Presiona Delete
3. Espera a que se elimine

### Paso 8: En Pestaña 2, espera 30s

Debería desaparecer el outfit ✅

**En DevTools de Pestaña 2:**
```
[WatermelonDB] Pulled changes: {outfits: {deleted: ["id"]}}
```

## Test 6: Comportamiento en Production (Render)

### Paso 1: Deploy a Render

```bash
git add -A
git commit -m "Implement sync endpoints for WatermelonDB"
git push
```

Espera a que Render termine de compilar.

### Paso 2: Abre la app en Render

```
https://ootd-planner.onrender.com
```

### Paso 3: Abre DevTools en otra pestaña

```
https://ootd-planner.onrender.com (pestaña 2)
```

### Paso 4: En Pestaña 1, crea un garment

1. Closet → Sube una prenda
2. Espera a que sincronice (puede tardar 1-2 minutos más por latencia)

### Paso 5: En Pestaña 2, recarga y verifica

```
Ctrl+R
Closet → Deberías ver la prenda que creaste en Pestaña 1 ✅
```

### Paso 6: Causa un reinicio de Render (opcional)

```bash
# En tu terminal local
git commit --allow-empty -m "Force Render restart"
git push
```

Espera a que Render reinicie.

### Paso 7: Verifica que los datos sobrevivieron al reinicio

```
En navegador abierto:
Closet → Deberías ver TODOS los garments que creaste
(Porque están en Turso, no en memoria de Render)
```

## Esperado vs Real

### Esperado ✅

| Acción | Esperado | Real |
|--------|----------|------|
| **Crear garment offline** | Se guarda en IndexedDB | ⏳ Testear |
| **Volver online** | Auto-sync en 30s | ⏳ Testear |
| **Multi-dispositivo** | Los cambios aparecen en 30-60s | ⏳ Testear |
| **Recarga** | Datos persistentes en IndexedDB | ⏳ Testear |
| **Render reinicia** | Datos en Turso se mantienen | ⏳ Testear |
| **Eliminar prenda** | Se elimina localmente y en Turso | ⏳ Testear |

### Posibles Problemas y Soluciones

#### Problema 1: "No puedo crear un garment offline"

**Razón:** REMBG requiere servidor, no funciona offline.

**Solución:** Testea primero online (con /api/remove-background), luego la sincronización.

#### Problema 2: "No veo los cambios en el otro dispositivo después de 30s"

**Razón:** WatermelonDB no inició auto-sync o hay error de conexión.

**Solución:**
1. Abre DevTools → Console
2. Busca errores rojos
3. Verifica que `/api/sync/pull` y `/api/sync/push` existan
4. Haz clic en refresh manual

#### Problema 3: "Turso retorna error en /api/sync/pull"

**Razón:** Query de Turso tiene problema con dates o types.

**Solución:**
1. Verifica que `lastPulledAt` sea un timestamp válido (ms)
2. Revisa que las columnas `created_at` y `updated_at` existan en Turso
3. Ejecuta manualmente:
```sql
SELECT * FROM garments WHERE user_id = 'tu-id' LIMIT 1;
```

#### Problema 4: "No sincroniza automáticamente"

**Razón:** `startAutoSync()` no se llamó o hay error.

**Solución:**
1. Verifica en App.tsx que `await watermelonService.initialize(userId)` se ejecute
2. Abre DevTools Console y busca "[AutoSync]" logs
3. Verifica que `navigator.onLine` sea true

## Checklist de Testing

- [ ] Test 1: Offline-first (crea outfit offline, luego sync)
- [ ] Test 2: Multi-dispositivo (2 navegadores ven cambios)
- [ ] Test 3: Persistencia (recarga mantiene datos)
- [ ] Test 4: Turso sincronizado (counts coinciden)
- [ ] Test 5: Flujo completo (online → offline → online)
- [ ] Test 6: Production (Render + Turso)

Una vez todos los tests pasen, **la sincronización está al 100%** ✅

## Comandos Útiles

### Ver logs en console.log

```javascript
// En navegador console
// Ver todos los logs de WatermelonDB
document.addEventListener('db-synced', () => {
  console.log('✅ Sync completado');
});
```

### Inspeccionar IndexedDB

```
DevTools → Application → IndexedDB → ootd_planner
→ outfits → Ver todos los registros locales
```

### Limpiar IndexedDB (reset)

```javascript
// En navegador console
await indexedDB.databases().then(dbs => {
  dbs.forEach(db => {
    indexedDB.deleteDatabase(db.name);
  });
  console.log('IndexedDB limpido');
});
```

### Ver requests de sync

```
DevTools → Network → Filtra por "sync"
Click en /api/sync/pull → Pestaña "Response" → Ver JSON
Click en /api/sync/push → Pestaña "Response" → Ver JSON
```

## Conclusión

Con estos tests verificas:

1. **Offline-first:** ✅ App funciona sin internet
2. **Sincronización automática:** ✅ Cambios se sincronizan cada 30s
3. **Multi-dispositivo:** ✅ Múltiples usuarios/devices ven cambios
4. **Persistencia:** ✅ Los datos sobreviven recargas
5. **Production:** ✅ Turso es la BD oficial y persiste
6. **Render reinicia:** ✅ Datos no se pierden

Si todo pasa, tu OOTD Planner está listo para producción con offline-first completo.
