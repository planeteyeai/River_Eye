import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxy = {
  '/api': {
    target: 'https://climateye-apis.up.railway.app',
    changeOrigin: true,
    secure: true
  }
}

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    // maplibre-gl ships its own bundled worker; prebundling it drops
    // maplibre-gl-worker.mjs and every geojson-backed layer stops rendering.
    exclude: ['maplibre-gl'],
  },
  server: {
    port: 3000,
    open: true,
    proxy
  },
  preview: {
    proxy
  }
})
