# 📋 SNIPPETS: Código Listo para Usar

## 1️⃣ Actualizar Closet.tsx

### Código actual (probablemente)
```tsx
// src/pages/Closet.tsx
export function Closet() {
  const [garments, setGarments] = useState<Garment[]>([]);
  
  useEffect(() => {
    db.getGarmentsByUser(userId).then(setGarments);
  }, [userId]);
  
  return <div>{garments.map(...)}</div>;
}
```

### Código mejorado
```tsx
// src/pages/Closet.tsx
import { useDataSync } from '../hooks/useDataSync';
import { useState, useEffect } from 'react';

export function Closet() {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [loading, setLoading] = useState(false);
  const userId = useStore((state) => state.currentUser?.id);
  const showToast = useToast();

  // ✅ Cargar garments (cache-first)
  useEffect(() => {
    if (!userId) return;
    
    setLoading(true);
    db.getGarmentsByUser(userId)  // ← Cache-first automático
      .then(setGarments)
      .catch(error => showToast(`Error: ${error.message}`))
      .finally(() => setLoading(false));
  }, [userId]);

  // ✅ Escuchar actualizaciones en background
  useDataSync((data) => {
    if (data.type === 'garments') {
      console.log('✨ Nuevas prendas en caché');
      setGarments(data.data);
      showToast('📦 Caché actualizado', 'info');
    }
  });

  // ✅ Botón para forzar actualización
  const handleForceRefresh = async () => {
    setLoading(true);
    try {
      const fresh = await db.getGarmentsByUser(
        userId,
        undefined,
        true  // ← forceRefresh = true
      );
      setGarments(fresh);
      showToast('✅ Actualizado desde servidor');
    } catch (error) {
      showToast(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Mi Closet</h1>
        <button
          onClick={handleForceRefresh}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {loading ? '⏳ Actualizando...' : '🔄 Actualizar'}
        </button>
      </div>

      {garments.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          {loading ? 'Cargando prendas...' : 'No hay prendas aún'}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {garments.map(g => (
            <GarmentCard key={g.id} garment={g} />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 2️⃣ Actualizar CalendarHome.tsx

```tsx
// src/pages/CalendarHome.tsx
import { useDataSync } from '../hooks/useDataSync';

export function CalendarHome() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const userId = useStore((state) => state.currentUser?.id);
  const showToast = useToast();

  // ✅ Cargar outfits (cache-first)
  useEffect(() => {
    if (!userId) return;
    
    setLoading(true);
    db.getOutfitsByUser(userId)  // ← Cache-first automático
      .then(setOutfits)
      .finally(() => setLoading(false));
  }, [userId]);

  // ✅ Escuchar cambios en outfits
  useDataSync((data) => {
    if (data.type === 'outfits') {
      setOutfits(data.data);
      showToast('📅 Outfits actualizados');
    }
  });

  // ✅ Pull-to-refresh
  const handleRefresh = async () => {
    setLoading(true);
    try {
      const fresh = await db.getOutfitsByUser(userId, true);  // forceRefresh = true
      setOutfits(fresh);
      showToast('✅ Actualizado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <button 
        onClick={handleRefresh} 
        disabled={loading}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded"
      >
        {loading ? '⏳...' : '⬇️ Tirar para actualizar'}
      </button>

      <HorizontalDateStrip 
        onDateSelect={setSelectedDate}
      />

      {loading && !outfits.length && (
        <p className="text-center text-gray-500">Cargando...</p>
      )}

      {outfits.length > 0 ? (
        <div className="space-y-4">
          {outfits.map(outfit => (
            <OutfitCard key={outfit.id} outfit={outfit} />
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-500">No hay outfits</p>
      )}
    </div>
  );
}
```

---

## 3️⃣ Simplificar UploadModal.tsx

```tsx
// src/components/closet/UploadModal.tsx
import { removeBackgroundHybrid } from '../../lib/background-removal-hybrid';
import { uploadImageToCloudinary } from '../../lib/cloudinary';

export function UploadModal({ onClose, onSuccess }: Props) {
  const [imageData, setImageData] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const userId = useStore((state) => state.currentUser?.id);
  const showToast = useToast();

  // ✅ Manejar carga
  const handleUploadGarment = async () => {
    if (!imageData || !userId) return;

    try {
      setUploading(true);

      // 1️⃣ Eliminar fondo (@imgly solo)
      setProgress('🧠 Removiendo fondo...');
      const withoutBg = await removeBackgroundHybrid(
        imageData,
        (msg) => setProgress(msg)
      );

      // 2️⃣ Subir a Cloudinary
      setProgress('☁️ Subiendo a Cloudinary...');
      const cloudinaryUrl = await uploadImageToCloudinary(
        withoutBg,
        userId,
        `garment-${Date.now()}`
      );

      // 3️⃣ Guardar en base de datos
      setProgress('💾 Guardando en base de datos...');
      const garment = await db.createGarment({
        id: `garment-${Date.now()}`,
        user_id: userId,
        category: 'top',  // cambiar según interfaz
        sub_category: 'shirt',  // cambiar según interfaz
        image_url: cloudinaryUrl,
        cloudinary_id: `outfit-planner/${userId}/garments/${Date.now()}`,
        created_at: new Date().toISOString(),
      });

      // ✅ Éxito
      setProgress('');
      showToast('✅ Prenda guardada correctamente');
      onSuccess(garment);
      onClose();

    } catch (error) {
      setProgress('');
      showToast(`❌ Error: ${error.message}`);
      console.error('[UploadModal]', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Añadir Prenda</h2>

        {/* Preview */}
        {imageData && (
          <img
            src={imageData}
            alt="preview"
            className="w-full h-48 object-cover mb-4 rounded"
          />
        )}

        {/* Selector de imagen */}
        {!imageData && (
          <div className="mb-4 space-y-2">
            <button
              onClick={() => {
                // Abrir cámara
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      setImageData(e.target?.result as string);
                    };
                    reader.readAsDataURL(file);
                  }
                };
                input.click();
              }}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded"
            >
              📸 Tomar Foto
            </button>
          </div>
        )}

        {/* Progreso */}
        {progress && (
          <div className="mb-4 p-3 bg-blue-100 rounded text-sm">
            {progress}
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={uploading}
            className="flex-1 px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleUploadGarment}
            disabled={!imageData || uploading}
            className="flex-1 px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
          >
            {uploading ? '⏳ Guardando...' : '✅ Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 4️⃣ Agregar Hook useDataSync

**Archivo**: `src/hooks/useDataSync.ts`

```typescript
import { useEffect } from 'react';

/**
 * Hook para escuchar cambios en datos sincronizados en background
 * 
 * Uso:
 * useDataSync((data) => {
 *   if (data.type === 'garments') {
 *     // Actualizar estado
 *   }
 * });
 */
export function useDataSync(
  callback: (data: { type: string; data: any }) => void
) {
  useEffect(() => {
    const handleDataUpdated = (event: any) => {
      console.log('[useDataSync] Nuevos datos disponibles:', event.detail);
      callback(event.detail);
    };

    window.addEventListener('data-updated', handleDataUpdated);

    return () => {
      window.removeEventListener('data-updated', handleDataUpdated);
    };
  }, [callback]);
}
```

---

## 5️⃣ Hook para ver tamaño de caché

**Archivo**: `src/hooks/useCacheSize.ts`

```typescript
import { useEffect, useState } from 'react';

export function useCacheSize() {
  const [cacheSize, setCacheSize] = useState(0);
  const [maxSize, setMaxSize] = useState(0);

  useEffect(() => {
    const checkSize = async () => {
      try {
        if (!navigator.storage?.estimate) return;
        
        const estimate = await navigator.storage.estimate();
        const usageKB = (estimate.usage || 0) / 1024;
        const quotaKB = (estimate.quota || 0) / 1024;
        
        setCacheSize(Math.round(usageKB));
        setMaxSize(Math.round(quotaKB));
      } catch (error) {
        console.error('[useCacheSize]', error);
      }
    };

    checkSize();
    
    // Chequear cada 30 segundos
    const interval = setInterval(checkSize, 30000);
    return () => clearInterval(interval);
  }, []);

  return { cacheSize, maxSize, percentage: (cacheSize / maxSize) * 100 };
}
```

---

## 6️⃣ Mostrar cache size en Profile.tsx

```tsx
// src/pages/Profile.tsx
import { useCacheSize } from '../hooks/useCacheSize';

export function Profile() {
  const { cacheSize, maxSize, percentage } = useCacheSize();
  const currentUser = useStore((state) => state.currentUser);

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Mi Perfil</h1>

      {/* Info Usuario */}
      <div className="mb-6 p-4 bg-gray-50 rounded">
        <h2 className="font-semibold mb-2">Datos de Perfil</h2>
        <p>👤 {currentUser?.username}</p>
        <p>📧 {currentUser?.email || 'No definido'}</p>
      </div>

      {/* Almacenamiento */}
      <div className="mb-6 p-4 bg-blue-50 rounded">
        <h2 className="font-semibold mb-3">Almacenamiento Offline</h2>
        
        <div className="mb-3">
          <p className="text-sm text-gray-600 mb-1">
            {cacheSize} KB de {maxSize} KB ({Math.round(percentage)}%)
          </p>
          <div className="w-full bg-gray-300 rounded h-2">
            <div
              className={`bg-blue-500 h-2 rounded transition-all ${
                percentage > 80 ? 'bg-red-500' : ''
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Los datos se cachean automáticamente para usar offline.
          Este almacenamiento se limpia al desinstalar la app.
        </p>
      </div>

      {/* Botón Logout */}
      <button
        onClick={() => {
          logout();
          // Opcional: limpiar caché al logout
          // await offlineDB.clearAll();
        }}
        className="w-full px-4 py-2 bg-red-500 text-white rounded"
      >
        🚪 Cerrar Sesión
      </button>
    </div>
  );
}
```

---

## 7️⃣ Configuración opcional: Sync periódico

**En App.tsx:**

```tsx
// src/App.tsx
useEffect(() => {
  if (!currentUser?.id) return;

  // Sincronizar cada 5 minutos (opcional)
  const syncInterval = setInterval(async () => {
    if (navigator.onLine) {
      console.log('[App] Sync periódico');
      try {
        await db.syncPendingChanges();
      } catch (error) {
        console.error('[App] Sync falló:', error);
      }
    }
  }, 5 * 60 * 1000);  // 5 minutos

  return () => clearInterval(syncInterval);
}, [currentUser?.id]);
```

---

## 8️⃣ Toast mejorado con tipo

**Mejora Toast.tsx:**

```tsx
// src/components/ui/Toast.tsx
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

// En el componente renderizar:
<div
  className={`p-4 rounded mb-2 ${
    type === 'success'
      ? 'bg-green-100 text-green-800'
      : type === 'error'
      ? 'bg-red-100 text-red-800'
      : type === 'info'
      ? 'bg-blue-100 text-blue-800'
      : 'bg-yellow-100 text-yellow-800'
  }`}
>
  {message}
</div>
```

---

## 9️⃣ Limpiar caché (opcional)

```typescript
// En db-offline.ts agregar:

async clearAllCache(): Promise<void> {
  if (!this.db) throw new Error('DB not initialized');

  const stores = ['garments', 'outfits', 'pending_sync'];
  
  for (const storeName of stores) {
    await new Promise((resolve, reject) => {
      const tx = this.db!.transaction([storeName], 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(null);
    });
  }
  
  console.log('[OfflineDB] ✅ Caché limpiado');
}
```

**Usar en logout:**

```typescript
async function logout() {
  const store = useStore.getState();
  
  // Limpiar estado global
  store.setCurrentUser(null);
  
  // Opcional: limpiar caché
  // await db.offlineDB.clearAllCache();
  
  // Redirigir a login
  store.setCurrentView('auth');
}
```

---

## 🔟 Test en DevTools

**Console JS para verificar caché:**

```javascript
// Ver si hay datos en IndexedDB
db.offlineDB.getGarmentsOffline('user-id').then(g => {
  console.log(`Prendas en caché: ${g.length}`);
  console.log(g);
});

// Ver tamaño de almacenamiento
navigator.storage.estimate().then(e => {
  console.log(`Usando: ${(e.usage / 1024).toFixed(2)} KB`);
  console.log(`Máximo: ${(e.quota / 1024).toFixed(2)} KB`);
});

// Simular evento data-updated
window.dispatchEvent(
  new CustomEvent('data-updated', {
    detail: { type: 'garments', data: [] }
  })
);
```

---

## ✅ Checklist de Implementación

- [ ] Actualizar `Closet.tsx` con código mejorado
- [ ] Actualizar `CalendarHome.tsx` con código mejorado
- [ ] Simplificar `UploadModal.tsx`
- [ ] Crear `src/hooks/useDataSync.ts`
- [ ] Crear `src/hooks/useCacheSize.ts` (opcional)
- [ ] Actualizar `Profile.tsx` con caché stats (opcional)
- [ ] Agregar sync periódico en `App.tsx` (opcional)
- [ ] Testear en DevTools Network tab
- [ ] Testear en Offline mode
- [ ] Testear eliminar fondo con @imgly
- [ ] Deploy y verificar en producción

