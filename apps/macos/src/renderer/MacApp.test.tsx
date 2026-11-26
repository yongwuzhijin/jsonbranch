import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JsonbranchApi } from '../shared/macos-api'
import { MacApp } from './MacApp'

afterEach(() => {
  cleanup()
  delete (window as { jsonbranch?: JsonbranchApi }).jsonbranch
})

function useChinese(): void {
  Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'zh-CN' })
}

function installApi(overrides: Partial<JsonbranchApi>): JsonbranchApi {
  const api: JsonbranchApi = {
    openDocument: vi.fn(async () => ({ status: 'canceled' as const })),
    saveDocument: vi.fn(async () => ({ status: 'denied' as const })),
    saveDocumentAs: vi.fn(async () => ({ status: 'canceled' as const })),
    writeClipboard: vi.fn(async () => {}),
    confirmDiscard: vi.fn(async () => 'cancel' as const),
    onOpenFromOs: () => () => {},
    onRequestSaveClose: () => () => {},
    notifyOsCloseReady: () => {},
    readEditorFontSize: vi.fn(async () => 13),
    writeEditorFontSize: vi.fn(async () => ({ ok: true })),
    ...overrides
  }
  window.jsonbranch = api
  return api
}

describe('MacApp editor font', () => {
  it('restores a valid size and falls back when the read fails', async () => {
    useChinese()
    installApi({ readEditorFontSize: vi.fn(async () => 18) })
    render(<MacApp />)
    expect(await screen.findByRole('button', { name: '增大字号，当前 18' })).toBeTruthy()
    cleanup()
    useChinese()
    installApi({ readEditorFontSize: vi.fn(async () => { throw new Error('missing') }) })
    render(<MacApp />)
    expect(await screen.findByRole('button', { name: '增大字号，当前 13' })).toBeTruthy()
  })

  it('keeps the new size visible when the preference write fails and does not save a file', async () => {
    useChinese()
    const api = installApi({
      readEditorFontSize: vi.fn(async () => 13),
      writeEditorFontSize: vi.fn(async () => ({ ok: false }))
    })
    render(<MacApp />)
    fireEvent.click(await screen.findByRole('button', { name: '增大字号，当前 13' }))
    expect(await screen.findByText('字号未能记在本机')).toBeTruthy()
    expect(screen.getByRole('button', { name: '增大字号，当前 14' })).toBeTruthy()
    expect(api.saveDocument).not.toHaveBeenCalled()
    expect(api.saveDocumentAs).not.toHaveBeenCalled()
    expect(screen.getByText('未打开的文档')).toBeTruthy()
    expect(screen.queryByText('未存储')).toBeNull()
  })
})
