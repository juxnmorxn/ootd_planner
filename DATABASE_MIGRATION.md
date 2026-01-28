# Outfit Planner - Nueva Arquitectura con SQLite + Cloudinary

## 🎯 Cambios Importantes

Se ha migrado de **localStorage** a **SQLite + Cloudinary** para resolver el problema de cuota excedida.

### Antes:
- ❌ localStorage (límite ~5-10MB)
- ❌ Imágenes guardadas como base64
- ❌ QuotaExceededError al guardar muchas prendas

### Ahora:
- ✅ SQLite (sin límite práctico)
- ✅ Imágenes en Cloudinary (escalable)
- ✅ Metadata organizada por usuario
- ✅ Carpetas automáticas: `outfit-planner/{userId}/garments/{garmentId}`

## 🚀 Cómo Ejecutar

### Opción 1: Todo junto (Recomendado)
```bash
npm run dev:full
```

Esto ejecuta:
- Backend API (puerto 3001)
- Frontend Vite (puerto 5173)

### Opción 2: Por separado
Terminal 1 - Backend:
```bash
npm run server
```

Terminal 2 - Frontend:
```bash
npm run dev
```

## 📁 Estructura de Archivos

```
src/
├── lib/
│   ├── api-db.ts          # Cliente API (frontend)
│   ├── sqlite-db.ts       # Base de datos SQLite (backend)
│   ├── cloudinary.ts      # Servicio de Cloudinary
│   └── db.ts              # (Deprecado - usar api-db.ts)
server.ts                  # Servidor Express API
outfit-planner.db          # Base de datos SQLite (auto-creada)
```

## 🔑 Configuración de Cloudinary

Ya está configurado con tus credenciales:
- Cloud name: `dogl9tho3`
- API Key: `637587472785454`
- Upload Preset: `oodt_123`

### Organización en Cloudinary:
```
outfit-planner/
  └── {userId}/
      └── garments/
          ├── {garmentId1}.png
          ├── {garmentId2}.png
          └── ...
```

## 📊 Base de Datos SQLite

### Tablas:

**users**
- id (TEXT PRIMARY KEY)
- name (TEXT)
- gender (TEXT)
- created_at (INTEGER)

**garments**
- id (TEXT PRIMARY KEY)
- user_id (TEXT)
- category (TEXT)
- sub_category (TEXT)
- image_url (TEXT) ← URL de Cloudinary
- cloudinary_id (TEXT)
- created_at (INTEGER)

**outfits**
- id (TEXT PRIMARY KEY)
- user_id (TEXT)
- date (TEXT)
- layers_json (TEXT)
- created_at (INTEGER)
- updated_at (INTEGER)

## 🔄 Migración de Datos

Si tienes datos en localStorage, se perderán al cambiar al nuevo sistema. Para migrar:

1. Exporta tus datos actuales (si es necesario)
2. El nuevo sistema empezará limpio
3. Re-sube tus prendas (se guardarán en Cloudinary)

## 🐛 Troubleshooting

### Error: "Failed to connect to API"
- Asegúrate de que el servidor esté corriendo (`npm run server`)
- Verifica que el puerto 3001 esté libre

### Error: "Cloudinary upload failed"
- Verifica tu conexión a internet
- Revisa las credenciales en `src/lib/cloudinary.ts`

### Error: "Database locked"
- Cierra todas las instancias del servidor
- Elimina `outfit-planner.db` y reinicia

## 📈 Ventajas del Nuevo Sistema

1. **Sin límites de almacenamiento** - SQLite crece según necesites
2. **Imágenes optimizadas** - Cloudinary comprime automáticamente
3. **Mejor organización** - Carpetas por usuario
4. **Más rápido** - No cargas todas las imágenes en memoria
5. **Escalable** - Listo para producción

## 🔐 Seguridad

⚠️ **IMPORTANTE**: Las credenciales de Cloudinary están en el código. Para producción:
1. Mueve las credenciales a variables de entorno (`.env`)
2. Usa `dotenv` para cargarlas
3. No subas `.env` a Git

## 📝 Notas

- El archivo `db.ts` antiguo ya no se usa
- Usa `api-db.ts` para todas las operaciones de base de datos
- Las imágenes se suben automáticamente a Cloudinary al crear una prenda
- Al eliminar una prenda, también se elimina de Cloudinary
