import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@jsonbranch/json-view/editor-font-size', replacement: path.resolve('packages/json-view/src/editor-font-size.ts') },
      { find: '@jsonbranch/json-core', replacement: path.resolve('packages/json-core/src/index.ts') },
      { find: '@jsonbranch/json-view', replacement: path.resolve('packages/json-view/src/index.ts') }
    ]
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'packages/**/*.test.ts', 'packages/**/*.test.tsx', 'apps/**/*.test.ts', 'apps/**/*.test.tsx'],
    exclude: ['**/*.e2e.ts', '**/dist/**', '**/node_modules/**', '**/release/**']
  }
})
