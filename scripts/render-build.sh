#!/usr/bin/env sh
set -eu

echo "[render-build] Installing Python deps (rembg)…"

PY=""
if command -v python3 >/dev/null 2>&1; then
  PY="python3"
elif command -v python >/dev/null 2>&1; then
  PY="python"
else
  echo "[render-build] ERROR: Python not found in build environment." >&2
  echo "[render-build] If you want REMBG server-side, use a Docker service or add Python to the environment." >&2
  exit 1
fi

echo "[render-build] Using: ${PY}"

# Ensure pip exists/up-to-date
"${PY}" -m pip install --upgrade pip setuptools wheel

# Install server-side background removal deps
"${PY}" -m pip install -r requirements.txt

echo "[render-build] Building web app…"
npm run build
