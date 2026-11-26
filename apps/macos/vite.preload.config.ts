import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: path.resolve('apps/macos/src/preload/index.ts'),
    outDir: path.resolve('apps/macos/dist/preload'),
    emptyOutDir: true,
    rollupOptions: {
      external: ['electron']
    }
  }
})
