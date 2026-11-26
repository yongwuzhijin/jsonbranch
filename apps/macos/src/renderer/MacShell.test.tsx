import { readFileSync } from 'node:fs'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TOOLTIP_DELAY_MS } from '@jsonbranch/json-view'
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
    fireEvent.click(screen.getByRole('button', { name: '增大字号，当前 13' }))
    expect(screen.queryByText('未存储')).toBeNull()
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '增大字号，当前 14' })).toBeTruthy()
  })

  it('renders the logo and icon actions with fast tooltips', async () => {
    vi.useFakeTimers()
    try {
      const save = vi.fn(async () => ({ status: 'ok' as const, path: '/tmp/a.json', stamp: { mtimeMs: 2, size: 2 } }))
      const saveAs = vi.fn()
      render(<MacShell path="/tmp/a.json" initial="{}" locale="zh" save={save} onOpen={() => {}} onSaveAs={saveAs} />)
      const logo = document.querySelector('img.mac-logo') as HTMLImageElement | null
      expect(logo?.getAttribute('src')).toBeTruthy()
      expect(logo?.getAttribute('alt')).toBe('')
      expect(logo?.getAttribute('width')).toBe('22')
      expect(screen.getByText('枝序')).toBeTruthy()
      expect(screen.getByText('JSONBranch')).toBeTruthy()
      expect(screen.getByText('a.json')).toBeTruthy()
      const css = readFileSync('apps/macos/src/renderer/mac-shell.css', 'utf8')
      expect(css).toMatch(/\.mac-title\s*\{[^}]*height:\s*44px/)
      expect(css).toContain('border-bottom: 1px solid #e5e7eb')
      expect(css).toContain('-apple-system, BlinkMacSystemFont, "PingFang SC"')
      for (const name of ['打开', '保存', '另存为', '关闭']) {
        const button = screen.getByRole('button', { name })
        expect(button.hasAttribute('title')).toBe(false)
        expect(button.querySelector('svg')).toBeTruthy()
      }
      expect(screen.getByRole('button', { name: '保存' }).hasAttribute('disabled')).toBe(true)
      const open = screen.getByRole('button', { name: '打开' })
      fireEvent.pointerEnter(open.parentElement!)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY_MS)
      })
      expect(screen.getByRole('tooltip').textContent).toBe('打开 ⌘O')
      fireEvent.pointerLeave(open.parentElement!)
      expect(screen.queryByRole('tooltip')).toBeNull()
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"a":1}' } })
      fireEvent.click(screen.getByRole('button', { name: '保存' }))
      expect(save).toHaveBeenCalledWith('{"a":1}', { overwrite: false })
      await act(async () => {
        await save.mock.results[0]?.value
      })
      expect(screen.queryByText('已关闭')).toBeNull()
      expect(screen.queryByText('未存储')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
