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

  it('keeps the dirty text when saving fails', async () => {
    const save = vi.fn(async () => ({ status: 'failed' as const, message: '磁盘已满' }))
    render(<MacShell path="/a.json" initial={'{'} locale="zh" save={save} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"a":1}' } })
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    fireEvent.click(screen.getByRole('button', { name: '存储' }))
    expect((await screen.findByRole('alert')).textContent).toContain('磁盘已满')
    expect(screen.getByDisplayValue('{"a":1}')).toBeTruthy()
    expect(screen.getByText('未存储')).toBeTruthy()
  })

  it('asks before opening another file over a dirty buffer', () => {
    const open = vi.fn()
    const save = vi.fn(async () => ({ status: 'ok' as const, path: '/a.json', stamp: { mtimeMs: 2, size: 2 } }))
    render(<MacShell path="/a.json" initial={'{'} locale="zh" save={save} onOpen={open} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"a":1}' } })
    fireEvent.click(screen.getByRole('button', { name: '打开' }))
    expect(open).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.getByDisplayValue('{"a":1}')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '打开' }))
    fireEvent.click(screen.getByRole('button', { name: '不存储' }))
    expect(open).toHaveBeenCalledTimes(1)
    expect(save).not.toHaveBeenCalled()
  })

  it('saves and signals the window only after the os close save succeeds', async () => {
    const save = vi.fn()
      .mockResolvedValueOnce({ status: 'failed' as const, message: '磁盘已满' })
      .mockResolvedValueOnce({ status: 'ok' as const, path: '/a.json', stamp: { mtimeMs: 4, size: 4 } })
    const onOsCloseReady = vi.fn()
    render(<MacShell path="/a.json" initial={'{'} locale="zh" save={save} onOsCloseReady={onOsCloseReady} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"a":1}' } })
    window.dispatchEvent(new Event('jsonbranch-request-save-close'))
    expect((await screen.findByRole('alert')).textContent).toContain('磁盘已满')
    expect(save).toHaveBeenCalledWith('{"a":1}', { overwrite: false })
    expect(onOsCloseReady).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('{"a":1}')).toBeTruthy()
    window.dispatchEvent(new Event('jsonbranch-request-save-close'))
    expect(await screen.findByText('已关闭')).toBeTruthy()
    expect(onOsCloseReady).toHaveBeenCalledTimes(1)
  })

  it('does not mark a clean mac document unsaved when the editor font changes', () => {
    const save = vi.fn(async () => ({ status: 'ok' as const, path: '/a.json', stamp: { mtimeMs: 1, size: 1 } }))
    render(<MacShell path="/a.json" initial="{}" locale="zh" save={save} />)
    fireEvent.click(screen.getByRole('button', { name: '增大字号，当前 13', exact: true }))
    expect(screen.queryByText('未存储')).toBeNull()
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '增大字号，当前 14', exact: true })).toBeTruthy()
  })
})
