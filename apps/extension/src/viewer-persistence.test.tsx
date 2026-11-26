import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadEditorFontSize, saveEditorFontSize, type StorageArea } from './storage'
import { ViewerApp } from './viewer'

afterEach(() => cleanup())

describe('extension persistence', () => {
  it('does not replace typed text with a late storage read', async () => {
    let finish: (value: unknown) => void = () => {}
    const area: StorageArea = {
      get: (key) => {
        if (key !== 'document') {
          return Promise.resolve(undefined)
        }
        return new Promise((resolve) => { finish = resolve })
      },
      set: vi.fn(async () => {})
    }
    render(<ViewerApp area={area} locale="zh" />)
    expect(screen.queryByRole('textbox')).toBeNull()
    finish({ input: '{"late":1}', keepEscapes: true, showLineNumbers: false })
    expect(await screen.findByDisplayValue('{"late":1}')).toBeTruthy()
  })

  it('does not write an empty document when the stored record cannot be read', async () => {
    const area: StorageArea = {
      get: async () => { throw new Error('storage unavailable') },
      set: vi.fn(async () => {})
    }
    render(<ViewerApp area={area} locale="zh" />)
    expect((await screen.findByRole('alert')).textContent).toContain('无法读取本机记录')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"a":1}' } })
    expect(area.set).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('{"a":1}')).toBeTruthy()
  })

  it('keeps the text and reports a failed write', async () => {
    const area: StorageArea = {
      get: async () => ({ input: '{}', keepEscapes: true, showLineNumbers: false }),
      set: vi.fn(async () => { throw new Error('quota') })
    }
    render(<ViewerApp area={area} locale="zh" />)
    const box = await screen.findByDisplayValue('{}')
    fireEvent.change(box, { target: { value: '{"a":1}' } })
    expect((await screen.findByRole('alert')).textContent).toContain('无法保存在本机')
    expect(screen.getByDisplayValue('{"a":1}')).toBeTruthy()
  })

  it('returns 13 for a missing or illegal font value and does not write the document', async () => {
    const set = vi.fn(async () => {})
    expect(await loadEditorFontSize({ get: async () => undefined, set })).toBe(13)
    expect(await loadEditorFontSize({ get: async () => '13', set })).toBe(13)
    expect(await loadEditorFontSize({ get: async () => 11, set })).toBe(13)
    expect(await loadEditorFontSize({ get: async () => { throw new Error('storage unavailable') }, set })).toBe(13)
    expect(set).not.toHaveBeenCalled()
    await saveEditorFontSize({ get: async () => undefined, set }, 18)
    expect(set).toHaveBeenCalledWith('editorFontSize', 18)
    expect(set).not.toHaveBeenCalledWith('document', expect.anything())
  })

  it('remembers a font change without rewriting the document record', async () => {
    const set = vi.fn(async () => {})
    const area: StorageArea = {
      get: async (key) => (key === 'document' ? { input: '{"a":1}', keepEscapes: true, showLineNumbers: false } : undefined),
      set
    }
    render(<ViewerApp area={area} locale="zh" />)
    expect(await screen.findByDisplayValue('{"a":1}')).toBeTruthy()
    await vi.waitFor(() => {
      expect(set).toHaveBeenCalledWith('document', expect.objectContaining({ input: '{"a":1}' }))
    })
    set.mockClear()
    fireEvent.click(screen.getByRole('button', { name: '增大字号，当前 13', exact: true }))
    expect(await screen.findByRole('button', { name: '增大字号，当前 14', exact: true })).toBeTruthy()
    expect(set).toHaveBeenCalledWith('editorFontSize', 14)
    expect(set).not.toHaveBeenCalledWith('document', expect.anything())
    expect(screen.getByDisplayValue('{"a":1}')).toBeTruthy()
  })

  it('keeps the selected font and the document when font storage fails', async () => {
    let failFont = true
    const set = vi.fn(async (key: string) => {
      if (key === 'editorFontSize' && failFont) {
        throw new Error('quota')
      }
    })
    const area: StorageArea = {
      get: async (key) => (key === 'document' ? { input: '{}', keepEscapes: true, showLineNumbers: false } : 13),
      set
    }
    render(<ViewerApp area={area} locale="zh" />)
    fireEvent.click(await screen.findByRole('button', { name: '增大字号，当前 13', exact: true }))
    expect((await screen.findByRole('alert')).textContent).toContain('字号未能记在本机')
    expect(screen.getByRole('button', { name: '增大字号，当前 14', exact: true })).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"b":2}' } })
    expect(await screen.findByDisplayValue('{"b":2}')).toBeTruthy()
    await vi.waitFor(() => {
      expect(set).toHaveBeenCalledWith('document', expect.objectContaining({ input: '{"b":2}' }))
    })
    expect(screen.getByText('字号未能记在本机')).toBeTruthy()
    failFont = false
    fireEvent.click(screen.getByRole('button', { name: '增大字号，当前 14', exact: true }))
    expect(await screen.findByRole('button', { name: '增大字号，当前 15', exact: true })).toBeTruthy()
    expect(screen.queryByText('字号未能记在本机')).toBeNull()
  })

  it('uses the English font error without blocking the editor', async () => {
    const area: StorageArea = {
      get: async (key) => (key === 'document' ? { input: '{}', keepEscapes: true, showLineNumbers: false } : 13),
      set: async (key) => {
        if (key === 'editorFontSize') {
          throw new Error('quota')
        }
      }
    }
    render(<ViewerApp area={area} locale="en" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Increase font size, current 13', exact: true }))
    expect((await screen.findByRole('alert')).textContent).toContain('Font size was not saved on this device.')
    expect(screen.getByDisplayValue('{}')).toBeTruthy()
  })
})