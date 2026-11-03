import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { parse } from 'yaml'

// `virtual:app-manifest` is app.manifest.yaml at the repo root, parsed at build time, so the
// logger's identity (app_id, client_id, log_endpoint, ...) is never typed into feature code.
const MANIFEST_ID = 'virtual:app-manifest'
const RESOLVED_ID = `\0${MANIFEST_ID}`

function appManifest(): Plugin {
  const file = fileURLToPath(new URL('../../app.manifest.yaml', import.meta.url))
  return {
    name: 'app-manifest',
    resolveId: (id) => (id === MANIFEST_ID ? RESOLVED_ID : null),
    load(id) {
      if (id !== RESOLVED_ID) return null
      this.addWatchFile(file)
      return `export default ${JSON.stringify(parse(readFileSync(file, 'utf8')))}`
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), appManifest()],
  server: { port: 5173, host: true },
})
