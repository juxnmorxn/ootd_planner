# 🧪 GUÍA DE PRUEBAS - Chat en Tiempo Real

## 🚀 Inicio Rápido

### 1. Instalar dependencias
```bash
npm install
```

### 2. Iniciar servidor y cliente

**Opción A - Dos terminales (recomendado):**
```bash
# Terminal 1
npm run server:ts

# Terminal 2
npm run dev
```

**Opción B - Una terminal:**
```bash
npm run dev:full
```

### 3. Acceder a la aplicación
```
http://localhost:5173
```

---

## 👥 Crear 2 Usuarios para Pruebas

### Usuario 1
- Email: `user1@test.com`
- Username: `juan`
- Password: `test123`

### Usuario 2
- Email: `user2@test.com`
- Username: `maria`
- Password: `test123`

---

## 🧪 ESCENARIOS DE PRUEBA

### ✅ Test 1: Enviar Mensaje en Tiempo Real

**Objetivo:** Verificar que los mensajes se envíen y reciban instantáneamente

**Pasos:**
1. Abre 2 navegadores (o ventanas)
2. Inicia sesión con User 1 en browser 1
3. Inicia sesión con User 2 en browser 2

4. **Browser 1:**
   - Ve a "👥 Contactos"
   - Busca "maria"
   - Clic en "Agregar amigo"

5. **Browser 2:**
   - Debe recibir solicitud automáticamente
   - Clic en "Aceptar"

6. **Browser 1:**
   - Clic en "maria" para abrir chat
   - Escribe: "¡Hola! ¿Cómo estás?"
   - Presiona Enter

**Resultado esperado:**
- ✅ Mensaje aparece en browser 1 instantáneamente
- ✅ Mensaje aparece en browser 2 sin delay (< 100ms)
- ✅ Muestra timestamp y check (✓)

---

### ✅ Test 2: Indicador "Escribiendo"

**Objetivo:** Verificar que se muestra cuando el otro usuario escribe

**Pasos:**
1. Ambos browsers con la conversación abierta

2. **Browser 2:**
   - Comienza a escribir en el campo de texto
   - Mantén presionando (sin enviar)

**Resultado esperado:**
- ✅ Browser 1 muestra animación: `● ● ●` saltando
- ✅ Texto bajo el avatar dice: "maria está escribiendo..."
- ✅ Desaparece después de 2 segundos de no escribir

3. **Browser 2:**
   - Escribe: "Yo también estoy bien"
   - Presiona Enter

**Resultado esperado:**
- ✅ Se detiene la animación de escritura
- ✅ El mensaje aparece instantáneamente

---

### ✅ Test 3: Estado Online/Offline

**Objetivo:** Verificar que se muestra el estado de conectado

**Pasos:**
1. Ambos browsers con la conversación abierta

2. **Browser 1 - Cabecera del chat:**
   - Debe mostrar: `● En línea` (verde)

3. **Browser 2 - Recarga la página:**
   - Browser 2 se desconecta brevemente
   - Browser 1 debe mostrar: `● Desconectado` (gris)

4. **Browser 2 - Vuelve a conectar:**
   - Después de recargar, Browser 2 se reconecta
   - Browser 1 debe mostrar nuevamente: `● En línea`

**Resultado esperado:**
- ✅ Estado cambia en tiempo real
- ✅ Colores: verde = online, gris = offline
- ✅ Sin delay visible

---

### ✅ Test 4: Confirmación de Lectura

**Objetivo:** Verificar check simple y doble

**Pasos:**
1. **Browser 1:**
   - Escribe: "¿Viste este mensaje?"
   - Envía

2. **Browser 1 - Observa el mensaje:**
   - Debe mostrar: `✓` (check simple)
   - Indica que fue entregado

3. **Browser 2:**
   - Abre/ve el mensaje
   - El chat se marca como leído

4. **Browser 1 - Observa el mensaje:**
   - Debe actualizar a: `✓✓` (doble check)
   - Indica que fue visto

**Resultado esperado:**
- ✅ Inicialmente `✓` (entregado)
- ✅ Actualiza a `✓✓` cuando se lee
- ✅ Sin delay

---

### ✅ Test 5: Múltiples Mensajes Rápidos

**Objetivo:** Verificar que no hay lag con múltiples mensajes

**Pasos:**
1. **Browser 1:**
   - Escribe y envía 10 mensajes rápido:
     - "Mensaje 1"
     - "Mensaje 2"
     - "Mensaje 3"
     - ... etc

2. **Browser 2:**
   - Observa que todos llegan en orden
   - Sin duplicados
   - Sin perdidas

**Resultado esperado:**
- ✅ Todos los mensajes llegan en orden
- ✅ No hay lag visible
- ✅ Coinciden los numbers

---

### ✅ Test 6: Reconexión Automática

**Objetivo:** Verificar que funciona si se desconecta la red

**Pasos:**
1. Ambos browsers con chat abierto

2. **Abre DevTools (F12):**
   - Pestaña "Network"
   - Clic en "Throttling"
   - Selecciona "Offline"

3. **Browser 1:**
   - Intenta enviar un mensaje
   - El cliente debería intentar reconectar

4. **DevTools:**
   - Cambia a "Online"
   - El socket debería reconectarse automáticamente

5. **Browser 1:**
   - El estado debería cambiar a "● En línea"

**Resultado esperado:**
- ✅ Se intenta reconectar automáticamente
- ✅ Los mensajes se envían una vez reconectado
- ✅ Sin cambiar página

---

### ✅ Test 7: Múltiples Conversaciones

**Objetivo:** Verificar que funciona con varios chats simultáneos

**Pasos:**
1. Crea 3 usuarios (juan, maria, pedro)

2. **Browser 1 (Juan):**
   - Agrega a Maria
   - Agrega a Pedro
   - Acepta ambas solicitudes

3. **Browser 1:**
   - Abre chat con Maria
   - Envía: "Hola Maria"

4. **Browser 2 (Maria):**
   - Recibe mensaje
   - Responde

5. **Browser 1:**
   - Va a chat con Pedro
   - Envía: "Hola Pedro"

6. **Browser 3 (Pedro):**
   - Recibe mensaje
   - Responde

**Resultado esperado:**
- ✅ Todos los mensajes se sincronizan correctamente
- ✅ No hay interferencia entre conversaciones
- ✅ Cada persona ve sus propios mensajes

---

## 🔧 Solución de Problemas

### ❌ Los mensajes no aparecen
- Verificar que el servidor está corriendo (puerto 3001)
- Verificar console del navegador (F12 → Console)
- Buscar errores de WebSocket

### ❌ No se conecta el WebSocket
- Verificar CORS en server.ts
- Verificar que `VITE_API_URL` es correcto
- Ver si hay firewall bloqueando puerto 3001

### ❌ Los indicadores no funcionan
- Verificar que ambos usuarios están conectados
- Ver en DevTools → Network si hay conexión WebSocket

### ❌ No se sincroniza el estado
- Refresh la página
- Verificar que el servidor guarda en BD

---

## 📊 Métricas a Observar

Durante las pruebas, nota:

1. **Latencia de mensajes:**
   - Ideal: < 100ms
   - Aceptable: < 500ms
   - Malo: > 1s

2. **Latencia de typing indicator:**
   - Ideal: < 50ms
   - Aceptable: < 200ms

3. **Estabilidad de conexión:**
   - ¿Se reconecta automáticamente?
   - ¿Hay desconexiones inesperadas?

4. **Uso de memoria:**
   - Ver DevTools → Memory
   - No debería crecer indefinidamente

---

## 📝 Checklist de Validación

- [ ] Mensajes se envían instantáneamente
- [ ] Indicador "escribiendo" aparece
- [ ] Estado online/offline funciona
- [ ] Check simple y doble se actualizan
- [ ] Múltiples mensajes funcionan
- [ ] Reconexión automática funciona
- [ ] Múltiples conversaciones funcionan
- [ ] No hay errores en console
- [ ] No hay lag visible
- [ ] La base de datos se actualiza

---

## 🎉 Si todo funciona

```
✅ Chat en tiempo real: COMPLETO
✅ Indicadores visuales: COMPLETO
✅ Estado de usuario: COMPLETO
✅ LISTO PARA PRODUCCIÓN
```

---

*Guía de pruebas - 6 Feb 2026*
