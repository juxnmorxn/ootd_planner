# 🎯 Instalación de REMBG para Desarrollo Local y Render

## Para Desarrollo Local (Windows/Mac/Linux)

### Opción 1: Instalar Python + REMBG
```bash
# Instalar Python 3.9+ desde https://www.python.org/downloads/

# Luego instalar REMBG:
python -m pip install rembg==0.0.59 onnxruntime onnx pillow
```

### Opción 2: Usar Python de Anaconda
```bash
conda install -c conda-forge rembg
```

---

## Para Render (Producción)

### Paso 1: Agregar a `runtime.txt`
```
python-3.11.8
```

### Paso 2: Agregar a `requirements.txt` (en raíz del proyecto)
```
rembg==0.0.59
onnxruntime==1.18.0
onnx==1.15.0
Pillow==10.1.0
```

### Paso 3: Actualizar Render Build Command
En Render Dashboard:
```
pip install -r requirements.txt && npm install
```

### Paso 4: Agregar Start Command
```
node server.cjs
```

---

## Verificar Instalación Correcta

```bash
# Probar REMBG en CLI
rembg i input.jpg output.png

# O desde Node.js
node -e "const { spawn } = require('child_process'); spawn('python', ['-m', 'rembg', 'i', 'test.jpg', 'out.png'])"
```

---

## ¿Qué hace el endpoint?

```
POST /api/remove-background
{
  "imageData": "data:image/png;base64,...base64..."
}
```

- Si hay internet → **REMBG Backend** (~1-2s, servidor)
- Si NO hay internet → **@imgly Local** (~5-8s, dispositivo)

**Respuesta:**
```json
{
  "imageData": "data:image/png;base64,...resultado..."
}
```

---

## Notas Importantes

⚠️ **Primera imagen:** Descarga modelo (~400MB en servidor, se cachea)  
⚠️ **Siguientes:** Muy rápido (~1-2s)  
⚠️ **Timeout:** 30 segundos máximo  
⚠️ **Requiere:** Python + pip en servidor  

---

## Alternativa: Si REMBG no funciona en Render

Si Render no tiene Python o hay issues:
1. Mantener solo **fallback @imgly** (offline, lento)
2. O usar **Remove.bg API** (gratis 50/mes, requiere API key)

---
