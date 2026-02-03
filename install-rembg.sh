#!/bin/bash
# Script para instalar REMBG en el servidor Render/Linux
# Ejecutar en el servidor antes de iniciar la app

echo "Instalando REMBG para background removal..."

# Instalar rembg via pip
pip install rembg==0.0.59 onnxruntime onnx pillow

echo "✅ REMBG instalado correctamente"
echo ""
echo "El servidor ahora puede procesar eliminación de fondos rápidamente."
echo "Primera imagen puede tardar más (descargando modelo), después muy rápido."
