import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxy = {
  '/api': {
    target: 'https://climateye-apis.up.railway.app',
    changeOrigin: true,
    secure: true
  }
}

// maplibre-gl 6 locates its worker at runtime with
// new URL('maplibre-gl-worker.mjs', import.meta.url). Rollup cannot see through
// that, so the worker never lands in the build and the request resolves next to
// the entry chunk, where a SPA host answers with index.html. The module worker
// then fails on the HTML MIME type and every geojson-backed layer — heatmaps,
// flood corridors, chainage, vegetation — silently stops rendering while raster
// overlays keep working. Dev is unaffected because import.meta.url still points
// inside node_modules.
const MAPLIBRE_RUNTIME_FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']

function emitMaplibreWorker() {
  return {
    name: 'emit-maplibre-worker',
    apply: 'build',
    generateBundle() {
      const require = createRequire(import.meta.url)
      let dist
      try {
        dist = path.dirname(require.resolve('maplibre-gl/dist/maplibre-gl.mjs'))
      } catch {
        dist = path.resolve(process.cwd(), 'node_modules/maplibre-gl/dist')
      }

      for (const file of MAPLIBRE_RUNTIME_FILES) {
        // Fail the build rather than ship a bundle whose worker 404s.
        const source = readFileSync(path.join(dist, file))
        this.emitFile({ type: 'asset', fileName: `assets/${file}`, source })
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), emitMaplibreWorker()],
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
