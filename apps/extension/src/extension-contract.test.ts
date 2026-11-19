import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { loadStoredDocument, saveStoredDocument } from './storage'
import { openViewer } from './background'

describe('extension contract', () => {
  it('requests only storage and opens a full tab', () => {
    const manifest = JSON.parse(readFileSync('apps/extension/manifest.json', 'utf8'))
    expect(manifest.manifest_version).toBe(3)
    expect(manifest.permissions).toEqual(['storage'])
    expect(manifest.host_permissions).toBeUndefined()
    expect(manifest.content_scripts).toBeUndefined()
    expect(manifest.action.default_popup).toBeUndefined()
    expect(manifest.content_security_policy.extension_pages).toBe("script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self'")
  })

  it('restores an empty document and focuses an existing tab id', async () => {
    const area = { get: async () => undefined, set: vi.fn(async () => {}) }
    expect(await loadStoredDocument(area)).toEqual({ input: '', keepEscapes: true, showLineNumbers: false })
    const tabs = { create: vi.fn(async () => ({ id: 7 })), update: vi.fn(async () => {}) }
    const session = { get: async () => 7, set: vi.fn(async () => {}) }
    await openViewer(tabs, session)
    expect(tabs.update).toHaveBeenCalledWith(7, true)
    expect(tabs.create).not.toHaveBeenCalled()
    await saveStoredDocument(area, { input: '{}', keepEscapes: true, showLineNumbers: false })
    expect(area.set).toHaveBeenCalledWith('document', { input: '{}', keepEscapes: true, showLineNumbers: false })
  })

  it('opens a new full tab when the remembered id is gone', async () => {
    const tabs = {
      create: vi.fn(async (url: string) => {
        expect(url).toContain('viewer.html')
        return { id: 9 }
      }),
      update: vi.fn(async () => {
        throw new Error('no tab')
      })
    }
    const session = { get: async () => 4, set: vi.fn(async () => {}) }
    await openViewer(tabs, session)
    expect(tabs.create).toHaveBeenCalled()
    expect(session.set).toHaveBeenCalledWith('viewerTabId', 9)
  })
})
