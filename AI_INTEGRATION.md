# 🧠 Integración de IA On-Device (Background Removal)

## 🎯 Objetivo
Permitir que el usuario elimine el fondo de las fotos de sus prendas automágicamente, **sin costo de servidores** y **100% offline**.

## 🛠️ Tecnología Usada
- **Librería:** `@imgly/background-removal`
- **Motor:** WebAssembly (WASM) + ONNX Runtime
- **Modelos:** U2Net (optimizado para móviles)

## ⚙️ Configuración Crítica

### 1. Headers de Seguridad (Vite)
Para que WASM funcione con `SharedArrayBuffer`, el servidor debe enviar estos headers:
```javascript
// vite.config.ts
headers: {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}
```

### 2. Flujo de Datos
```
Input (File) 
  ↓ 
[Compress Image] (Canvas API, resize a 1024px)
  ↓
[AI Processor] (@imgly WASM engine)
  ↓
Blob (PNG Transparente)
  ↓
Base64 String
  ↓
Storage (localStorage / SQLite)
```

## 📱 Experiencia de Usuario

1. **Toggle "Eliminar fondo con IA":** El usuario decide si quiere usar IA o foto original.
2. **Feedback Visual:** Spinner con texto "Eliminando fondo con IA...".
3. **Resultado:** Muestra la imagen procesada sobre un fondo de ajedrez para verificar transparencia.

## ⚠️ Consideraciones de Rendimiento

- **Primer uso:** Descarga los modelos de IA (~40MB). Puede tardar un poco dependiendo de la red.
- **Usos siguientes:** Los modelos están cacheados. Funciona offline.
- **Tiempo de proceso:** 
  - Desktop: < 1 seg
  - Móvil Gama Alta: ~2 segs
  - Móvil Gama Baja: ~5-8 segs

## 🐛 Solución de Problemas Comunes

- **Error "SharedArrayBuffer is not defined":** Faltan los headers en `vite.config.ts`.
- **Error de Memoria:** La imagen es muy grande. Nuestra función `compressImage` la reduce a 1024px antes de procesar para evitar esto.

---

**Estado:** ✅ Implementado y listo para probar.
