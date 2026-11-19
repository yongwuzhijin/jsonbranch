import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MacShell } from './MacShell'

afterEach(() => cleanup())

describe('MacShell', () => {
  it('asks before closing a dirty buffer and stays on cancel', () => {
    render(
      <MacShell
        path="/a.json"
        initial={'{'}
        locale="zh"
        save={async () => ({ status: 'ok', path: '/a.json', stamp: { mtimeMs: 2, size: 2 } })}
      />
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"a":1}' } })
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(screen.getByRole('button', { name: '存储' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.getByDisplayValue('{"a":1}')).toBeTruthy()
  })

  it('discards without saving and overwrites only after confirmation', async () => {
    const save = vi.fn(async (_content: string, options?: { overwrite?: boolean }) => {
      if (!options?.overwrite) {
        return { status: 'stale' as const }
      }
      return { status: 'ok' as const, path: '/a.json', stamp: { mtimeMs: 3, size: 3 } }
    })
    render(<MacShell path="/a.json" initial={'{'} locale="zh" save={save} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"a":1}' } })
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    fireEvent.click(screen.getByRole('button', { name: '不存储' }))
    expect(save).not.toHaveBeenCalled()
    expect(screen.queryByDisplayValue('{"a":1}')).toBeNull()

    cleanup()
    render(<MacShell path="/a.json" initial={'{'} locale="zh" save={save} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"a":1}' } })
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    fireEvent.click(screen.getByRole('button', { name: '存储' }))
    expect(await screen.findByRole('button', { name: '覆盖' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '覆盖' }))
    expect(save).toHaveBeenLastCalledWith('{"a":1}', { overwrite: true })
  })
})
