@echo off
REM Script para instalar REMBG en Windows (desarrollo local)
echo Instalando REMBG para background removal en Windows...

pip install rembg==0.0.59 onnxruntime onnx pillow

echo.
echo ✅ REMBG instalado correctamente
echo.
echo El servidor ahora puede procesar eliminación de fondos rápidamente.
echo Primera imagen puede tardar más (descargando modelo), después muy rápido.
pause
