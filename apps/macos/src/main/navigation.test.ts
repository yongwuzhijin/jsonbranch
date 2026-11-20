import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { shouldBlockRequest, windowSecurityOptions } from './navigation'

describe('mac window boundary', () => {
  it('keeps the renderer sandboxed and blocks every non-app request', () => {
    expect(windowSecurityOptions()).toEqual({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    })
    expect(shouldBlockRequest('https://example.com/json')).toBe(true)
    expect(shouldBlockRequest('app://jsonbranch/index.html')).toBe(false)
    const preload = readFileSync('apps/macos/src/preload/index.ts', 'utf8')
    expect(preload).toContain("exposeInMainWorld('jsonbranch'")
    expect(preload).not.toContain('leafnote')
    for (const method of ['openDocument', 'saveDocument', 'saveDocumentAs', 'writeClipboard', 'confirmDiscard', 'onOpenFromOs']) {
      expect(preload).toContain(method)
    }
  })
})
