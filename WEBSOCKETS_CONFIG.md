# Configuración para WebSockets

## Variables de Entorno Necesarias

### Frontend (.env.local o similar)
```env
VITE_API_URL=http://localhost:3001
```

Si está en producción:
```env
VITE_API_URL=https://tu-dominio.com
```

### Backend
El servidor debe correr en el puerto 3001 (o el que configures en server.ts)

```env
PORT=3001
```

## Instalación de Dependencias

```bash
npm install
```

Esto instalará:
- `socket.io@^4.7.2` (servidor WebSocket)
- `socket.io-client@^4.7.2` (cliente WebSocket)

## Iniciar Desarrollo

```bash
# En una terminal - servidor
npm run server:ts

# En otra terminal - cliente
npm run dev
```

O juntos:
```bash
npm run dev:full
```

## Características Implementadas

### ✅ WebSockets en Tiempo Real
- Mensajes instantáneos (sin polling)
- Indicador "escribiendo..."
- Estado online/offline del usuario
- Confirmación de mensajes leídos

### Eventos WebSocket Disponibles

**Cliente → Servidor:**
- `user:connect` - Usuario se conecta
- `message:send` - Enviar mensaje
- `user:typing` - Indicador de escritura
- `message:markAsRead` - Marcar como leído

**Servidor → Cliente:**
- `user:status` - Estado del usuario (online/offline)
- `message:received` - Mensaje recibido
- `message:sent` - Confirmación de envío
- `message:read` - Confirmación de lectura
- `user:typing` - Usuario está escribiendo

## Próximas Mejoras Sugeridas

1. **Envío de imágenes en chat** - Usar Cloudinary como lo hacen con las prendas
2. **Notificaciones Push** - Firebase o WebPush API
3. **Reacciones en mensajes** - Agregar emojis a mensajes
4. **Búsqueda de chats** - Filtrar conversaciones
5. **Eliminación de conversaciones** - UI para limpiar historial
