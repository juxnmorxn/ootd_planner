# ✅ ANÁLISIS: PWA Offline + Caché de Datos

## 🔍 ESTADO ACTUAL

### ✅ PWA YA ES OFFLINE
Tu PWA **SÍ es offline** gracias a:

1. **Service Worker** (`public/sw.js`) ✅
   - Instala caché de assets
   - Cachea respuestas API GET
   - Fallback offline para llamadas API

2. **Manifest** (`public/manifest.webmanifest`) ✅
   - Define que es installable
   - Funciona como app nativa

3. **Estrategia de caché**:
   - **Assets** (HTML, CSS, JS): cache-first
   - **API calls** (GET): network-first + caché
   - **Mutaciones** (POST, PUT, DELETE): solo network

---

## ❌ EL PROBLEMA ACTUAL

Aunque **el SW cachea las respuestas API**, hay problemas:

```
Visita 1: GET /api/garments
  ↓
SW cachea respuesta
  ↓
Visita 2: GET /api/garments
  ↓
SW compara hash → descarga nuevamente
  ↓
❌ Cada visita = descarga (lento, datos móvil)
```

### ¿Por qué pasa?

En `db-hybrid.ts`:
```typescript
async getGarmentsByUser(userId: string): Promise<Garment[]> {
  try {
    if (this.isOnline) {
      // ❌ SIEMPRE trae del API (network-first)
      const garments = await apiDb.getGarmentsByUser(userId);
      // Guarda en IndexedDB pero NO confía en él
      for (const g of garments) {
        await offlineDB.saveGarmentOffline(g);
      }
      return garments;
    }
  } catch {
    // Solo usa offline si falla
    return await offlineDB.getGarmentsOffline(userId);
  }
}
```

**Problema**: Siempre intenta API primero, descargando datos innecesariamente.

---

## 🎯 SOLUCIÓN: Cache-First para Datos

### Opción 1: Cache-First Simple (⭐ RECOMENDADO)

```typescript
// db-hybrid.ts - MEJORADO
async getGarmentsByUser(userId: string, forceRefresh = false): Promise<Garment[]> {
  // Si el usuario NO quiere refresh forzado, usa caché primero
  if (!forceRefresh) {
    const cached = await offlineDB.getGarmentsOffline(userId);
    if (cached.length > 0) {
      // Tiene caché → usar sin descargar
      console.log('[HybridDB] Usando caché (no descargando)');
      return cached;
    }
  }

  // Si no hay caché o fuerza refresh
  if (this.isOnline) {
    try {
      const garments = await apiDb.getGarmentsByUser(userId);
      for (const g of garments) {
        await offlineDB.saveGarmentOffline(g);
      }
      return garments;
    } catch (error) {
      console.warn('[HybridDB] API falló, usando caché');
      return await offlineDB.getGarmentsOffline(userId);
    }
  }

  // Sin internet → usa caché
  return await offlineDB.getGarmentsOffline(userId);
}
```

**Beneficio**: En visita 2 = 0 descargas, 0 latencia (caché local)

---

### Opción 2: Cache con Sync en Background (⭐⭐ PROFESIONAL)

```typescript
// db-hybrid.ts - CON SYNC EN BACKGROUND
async getGarmentsByUser(userId: string): Promise<Garment[]> {
  // 1. Retorna caché inmediatamente
  const cached = await offlineDB.getGarmentsOffline(userId);
  if (cached.length > 0) {
    console.log('[HybridDB] Retornando caché inmediatamente');
    
    // 2. Sincroniza en background (sin bloquear UI)
    if (this.isOnline) {
      this.syncGarmentsInBackground(userId);
    }
    
    return cached;
  }

  // Sin caché → descarga
  if (this.isOnline) {
    try {
      const garments = await apiDb.getGarmentsByUser(userId);
      for (const g of garments) {
        await offlineDB.saveGarmentOffline(g);
      }
      return garments;
    } catch {
      return [];
    }
  }

  return [];
}

// Sincronizar sin bloquear
private async syncGarmentsInBackground(userId: string) {
  try {
    const fresh = await apiDb.getGarmentsByUser(userId);
    const cached = await offlineDB.getGarmentsOffline(userId);
    
    // Comparar si cambió algo
    const changed = JSON.stringify(fresh) !== JSON.stringify(cached);
    
    if (changed) {
      console.log('[HybridDB] Cambios detectados, actualizando caché');
      for (const g of fresh) {
        await offlineDB.saveGarmentOffline(g);
      }
      
      // Notificar al usuario
      window.dispatchEvent(new CustomEvent('data-updated', { 
        detail: { type: 'garments', fresh } 
      }));
    }
  } catch {
    // Sync falló silenciosamente, caché sigue siendo válido
  }
}
```

**Beneficio**: Instantáneo + actualizado en background

---

## 🎨 SOLO IMGLY (Eliminar REMBG)

### Cambio 1: Simplificar background-removal

```typescript
// src/lib/background-removal-hybrid.ts - SOLO IMGLY

export async function removeBackgroundHybrid(
    imageData: string,
    onProgress?: (message: string) => void
): Promise<string> {
    onProgress?.('🧠 Removiendo fondo...');
    
    // Solo usar @imgly, sin intentar REMBG
    return await removeBackgroundFromImage(imageData);
}
```

---

### Cambio 2: Eliminar endpoint REMBG del backend

En `server.ts`, comentar o eliminar:
```typescript
// ❌ BORRAR ESTO:
app.post('/api/remove-background', async (req, res) => {
    // ... código REMBG ...
});
```

---

### Cambio 3: Optimizar @imgly (más rápido)

```typescript
// src/lib/img-process.ts

import { removeBackground } from '@imgly/background-removal';

export async function removeBackgroundFromImage(imageData: string): Promise<string> {
    const canvas = await removeBackground(imageData, {
        // Opciones de optimización
        model: 'medium',  // 'small' | 'medium' | 'large'
        batch: true,      // Procesa en batch
        nChannels: 4,     // RGBA
    });
    
    // Retornar como PNG con transparencia
    return canvas.toDataURL('image/png');
}
```

---

## 🔧 IMPLEMENTACIÓN PASO A PASO

### Paso 1: Mejorar db-hybrid.ts (Cache-First)

**Archivo**: `src/lib/db-hybrid.ts`

**Cambiar** getGarmentsByUser para cache-first + sync background

---

### Paso 2: Simplificar background removal

**Archivo**: `src/lib/background-removal-hybrid.ts`

**Cambiar** para usar solo @imgly

---

### Paso 3: Actualizar UploadModal

**Archivo**: `src/components/closet/UploadModal.tsx`

**Cambiar** el flujo para que use solo local @imgly

---

### Paso 4: (Opcional) Agregar "Pull to Refresh"

Para que el usuario pueda forzar actualización si quiere:

```tsx
// En Closet.tsx
const [refreshing, setRefreshing] = useState(false);

const handleRefresh = async () => {
  setRefreshing(true);
  try {
    // Fuerza descarga
    const fresh = await db.getGarmentsByUser(userId, true);
    setGarments(fresh);
  } finally {
    setRefreshing(false);
  }
};

return (
  <div className="p-4">
    <button onClick={handleRefresh} disabled={refreshing}>
      {refreshing ? '⏳ Actualizando...' : '🔄 Actualizar'}
    </button>
    {/* resto del UI */}
  </div>
);
```

---

## 📊 COMPARATIVA: ANTES vs DESPUÉS

| Métrica | Antes | Después (Cache-First) |
|---------|-------|----------------------|
| **Visita 1** | ⬇️ 2-5s (descarga) | ⬇️ 2-5s (descarga) |
| **Visita 2** | ⬇️ 2-5s (descarga NUEVAMENTE) ❌ | ✅ 0.05s (caché local) |
| **Sin internet** | ❌ Datos viejos o error | ✅ Datos locales |
| **Con cambios** | ❌ Puede desincronizar | ✅ Actualiza en background |
| **Datos móvil** | ❌ Gasta por cada visita | ✅ Economiza datos |

---

## 🚀 BONUS: IndexedDB Stats (monitorear caché)

```tsx
// Crear hook para ver tamaño caché
export function useCacheStats() {
  const [stats, setStats] = useState({
    garments: 0,
    outfits: 0,
    sizeKB: 0,
  });

  useEffect(() => {
    (async () => {
      if (!navigator.storage?.estimate) return;
      
      const estimate = await navigator.storage.estimate();
      const usageKB = (estimate.usage || 0) / 1024;
      
      setStats(prev => ({
        ...prev,
        sizeKB: Math.round(usageKB)
      }));
    })();
  }, []);

  return stats;
}

// Usar en Profile:
function Profile() {
  const cacheStats = useCacheStats();
  return (
    <div>
      <p>Datos offline: {cacheStats.sizeKB} KB</p>
    </div>
  );
}
```

---

## ⚠️ POSIBLES PROBLEMAS Y SOLUCIONES

### Problema 1: "Caché desactualizado"
**Solución**: Agregar pull-to-refresh o background sync

### Problema 2: "@imgly es lento (10-30s)"
**Soluciones**:
- Usar `model: 'small'` (rápido pero menos preciso)
- Reducir resolución imagen antes de procesar
- Mostrar progreso visual

```typescript
export async function removeBackgroundFromImage(
    imageData: string,
    onProgress?: (msg: string) => void
): Promise<string> {
    onProgress?.('⏳ Procesando... 0%');
    
    const canvas = await removeBackground(imageData, {
        model: 'small',  // Rápido
        batch: true,
    });
    
    onProgress?.('✅ Listo!');
    return canvas.toDataURL('image/png');
}
```

### Problema 3: IndexedDB se llena
**Solución**: Limpiar caché antiguo

```typescript
async cleanOldCache() {
  const allGarments = await offlineDB.getGarmentsOffline(userId);
  const maxItems = 500;
  
  if (allGarments.length > maxItems) {
    // Eliminar los más viejos
    const toDelete = allGarments
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(0, allGarments.length - maxItems);
    
    for (const item of toDelete) {
      await offlineDB.deleteGarmentOffline(item.id);
    }
  }
}
```

---

## ✅ RESUMEN FINAL

### PWA Offline: ✅ YA FUNCIONA
- Service Worker cachea assets
- IndexedDB guarda datos
- Funciona offline

### Pero: ❌ DESCARGAS INNECESARIAS
- db-hybrid usa network-first
- Cada visita = descarga aunque tenga caché

### Solución: 🎯 CAMBIAR A CACHE-FIRST
```typescript
// 1. Retorna caché si existe
// 2. Sincroniza en background (si hay internet)
// 3. Si no hay caché, entonces descarga
```

### Solo IMGLY: 🎨 SIMPLE
```typescript
// Eliminar REMBG
// Usar @imgly local (más lento pero siempre funciona)
```

