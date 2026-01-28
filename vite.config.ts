import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@imgly/background-removal', 'sql.js'],
  },
  // Asegurar que los assets de procesamiento de imágenes se manejen bien
  build: {
    rollupOptions: {
      external: ['@imgly/background-removal']
    }
  }
})
