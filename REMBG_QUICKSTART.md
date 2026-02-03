# 🚀 REMBG - Guía Rápida de Instalación

## ⚡ Por qué REMBG es mejor

| Aspecto | @imgly (IA local) | **REMBG (Servidor)** |
|--------|-----------------|-----------------|
| **Velocidad** | 5-8s (móvil) | ⚡ **1-2s** |
| **Dependencias** | WASM (40MB) | Python CLI |
| **Offline** | ✅ Sí | ❌ No |
| **CPU/GPU** | Cliente | Servidor |

---

## 🔧 Instalación para Desarrollo Local

### Windows

```powershell
# Opción 1: Instalar Python desde https://www.python.org/downloads/
# Asegúrate de marcar "Add Python to PATH"

# Luego ejecuta esto en la terminal
pip install rembg==0.0.59 onnxruntime onnx pillow

# O ejecuta el script
.\install-rembg.bat
```

### Mac/Linux

```bash
pip install rembg==0.0.59 onnxruntime onnx pillow

# O ejecuta el script
bash install-rembg.sh
```

---

## ▶️ Cómo ejecutar la aplicación

```bash
# Terminal 1: Backend (incluye REMBG)
npm run server

# Terminal 2: Frontend
npm run dev

# O todo junto:
npm run dev:full
```

---

## ✅ Verificar que REMBG funciona

```bash
# En la terminal, verifica que el comando existe
python -m rembg --help

# Deberías ver algo como:
# usage: __main__.py [-h] [--model {u2net...}] [input] [output]
# ...
```

---

## 🐛 Si REMBG no funciona

### Error: "python: command not found"
- ❌ Python no está en PATH
- ✅ Reinstala Python con "Add to PATH" marcado
- O usa `python3` en lugar de `python`

### Error: "No module named 'rembg'"
```bash
# Intenta instalar nuevamente
pip install --upgrade rembg==0.0.59
```

### Error: "REMBG timeout (30s)"
- La imagen es muy grande
- Reduce el tamaño (el código ya lo hace automáticamente)

---

## 📊 Rendimiento esperado

```
1ª imagen: ~2s (descarga modelos ~400MB)
Siguientes: ~1-2s (muy rápido)
```

---

## 🚀 Producción (Render, Heroku, etc.)

1. Asegúrate que `requirements.txt` tenga:
   ```
   rembg==0.0.59
   onnxruntime==1.18.0
   onnx==1.15.0
   Pillow==10.1.0
   ```

2. En la configuración del servidor, instala dependencias:
   ```bash
   pip install -r requirements.txt
   npm install
   npm run build
   npm run start
   ```

---

## 💡 Notas

- ✅ REMBG ahora es el método por defecto (adiós @imgly lento)
- ✅ Mucho más rápido: **1-2 segundos**
- ✅ La interfaz ya está actualizada
- ⚠️ Requiere Python en el servidor

**¡Listo para usar!** 🎉
