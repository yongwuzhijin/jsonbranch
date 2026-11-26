import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveRendererFile } from './renderer-path'

describe('renderer file boundary', () => {
  const root = path.join('/tmp', 'jsonbranch-renderer')

  it('allows files inside the renderer directory', () => {
    expect(resolveRendererFile(root, '/index.html')).toBe(path.join(root, 'index.html'))
    expect(resolveRendererFile(root, '/')).toBe(path.join(root, 'index.html'))
  })

  it('rejects a sibling directory whose name only shares the root prefix', () => {
    expect(resolveRendererFile(root, '/../jsonbranch-renderer-other/index.html')).toBeNull()
    expect(resolveRendererFile(root, '/../../etc/passwd')).toBeNull()
  })
})
