import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StorageArea } from './storage'
import { ViewerApp } from './viewer'

afterEach(() => cleanup())

describe('extension persistence', () => {
  it('does not replace typed text with a late storage read', async () => {
    let finish: (value: unknown) => void = () => {}
    const area: StorageArea = {
      get: () => new Promise((resolve) => { finish = resolve }),
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
})