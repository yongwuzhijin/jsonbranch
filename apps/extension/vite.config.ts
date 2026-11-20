import react from '@vitejs/plugin-react'
import { cpSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(root, 'dist')

function copyExtensionStatic(): Plugin {
  return {
    name: 'copy-extension-static',
    apply: 'build',
    closeBundle() {
      mkdirSync(path.join(outDir, 'icons'), { recursive: true })
      cpSync(path.join(root, 'manifest.json'), path.join(outDir, 'manifest.json'))
      cpSync(path.join(root, 'icons'), path.join(outDir, 'icons'), { recursive: true })
      const workerDir = path.join(outDir, 'workers')
      const keep = new Set(['editor.worker.js', 'json.worker.js'])
      for (const file of readdirSync(workerDir)) {
        if (!keep.has(file)) {
          unlinkSync(path.join(workerDir, file))
        }
      }
    }
  }
}

export default defineConfig({
  root,
  publicDir: false,
  plugins: [react(), copyExtensionStatic()],
  worker: {
    format: 'es',
    plugins: () => [react()],
    rollupOptions: {
      output: {
        entryFileNames: 'workers/[name].js'
      }
    }
  },
  build: {
    outDir,
    emptyOutDir: true,
    modulePreload: false,
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      input: {
        viewer: path.resolve(root, 'viewer.html'),
        background: path.resolve(root, 'src/background.ts')
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name].js'),
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  }
})
