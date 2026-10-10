import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

// Throwaway spike server: serves only spikes/presence, reads env from the repo root.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  envDir: repoRoot,
  server: { port: 5174, strictPort: true, fs: { allow: [repoRoot] } },
})
