import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { applyCloseChoice, releaseClosedWindow, sendToLiveWindow, senderWebContentsId, webContentsId, type LiveWindow } from './window-lifetime'

describe('window lifetime', () => {
  it('reads webContents.id only while the window is still alive', () => {
    const live = fakeWindow(false)
    expect(webContentsId(live)).toBe(7)
    expect(live.webContents.id).toBe(7)

    const destroyed = fakeWindow(true)
    expect(webContentsId(destroyed)).toBeNull()
    expect(webContentsId(null)).toBeNull()
    expect(destroyed.reads).toBe(0)
  })

  it('does not send menu or save commands through a destroyed webContents', () => {
    const destroyed = fakeWindow(true)
    expect(sendToLiveWindow(destroyed, 'jsonbranch:menu', 'open')).toBe(false)
    expect(sendToLiveWindow(null, 'jsonbranch:menu', 'save')).toBe(false)
    expect(destroyed.reads).toBe(0)
    expect(destroyed.sent).not.toHaveBeenCalled()

    const live = fakeWindow(false)
    expect(sendToLiveWindow(live, 'jsonbranch:menu', 'save-as')).toBe(true)
    expect(live.sent).toHaveBeenCalledWith('jsonbranch:menu', 'save-as')
  })

  it('drops a close choice when the window is already destroyed and does not arm the gate', () => {
    const destroyed = fakeWindow(true)
    const arm = vi.fn()
    expect(applyCloseChoice(destroyed, 'arm-and-close', arm)).toBe(false)
    expect(applyCloseChoice(destroyed, 'request-save', arm)).toBe(false)
    expect(applyCloseChoice(null, 'arm-and-close', arm)).toBe(false)
    expect(arm).not.toHaveBeenCalled()
    expect(destroyed.closed).not.toHaveBeenCalled()
    expect(destroyed.reads).toBe(0)

    const live = fakeWindow(false)
    expect(applyCloseChoice(live, 'stay', arm)).toBe(false)
    expect(arm).not.toHaveBeenCalled()
    expect(live.closed).not.toHaveBeenCalled()

    expect(applyCloseChoice(live, 'arm-and-close', arm)).toBe(true)
    expect(arm).toHaveBeenCalledOnce()
    expect(live.closed).toHaveBeenCalledOnce()

    expect(applyCloseChoice(live, 'request-save', arm)).toBe(true)
    expect(live.sent).toHaveBeenCalledWith('jsonbranch:request-save-close')
  })

  it('keeps menu and close callbacks off a destroyed webContents', () => {
    const source = readFileSync('apps/macos/src/main/index.ts', 'utf8')
    expect(source).toContain("window.on('closed'")
    expect(source).toContain('sendToLiveWindow')
    expect(source).toContain('applyCloseChoice')
    expect(source).toContain('releaseClosedWindow')
    expect(source).not.toContain('webContents.send')
    expect(source).not.toContain('webContents.id')
  })

  it('does not read a destroyed sender id before resolving its window', () => {
    let reads = 0
    const sender: { isDestroyed(): boolean; readonly id: number } = {
      isDestroyed: () => true,
      get id(): number {
        reads += 1
        throw new Error('Object has been destroyed')
      }
    }
    expect(senderWebContentsId(sender)).toBeNull()
    expect(reads).toBe(0)
    expect(senderWebContentsId({ isDestroyed: () => false, id: 4 })).toBe(4)
    expect(senderWebContentsId(null)).toBeNull()
  })

  it('forgets a window on closed without dropping a newer one', () => {
    const first = fakeWindow(false)
    const second = fakeWindow(false)
    expect(releaseClosedWindow(first, first)).toBeNull()
    expect(releaseClosedWindow(second, first)).toBe(second)
    expect(releaseClosedWindow(null, first)).toBeNull()
  })
})

function fakeWindow(destroyed: boolean): LiveWindow & { reads: number; sent: ReturnType<typeof vi.fn>; closed: ReturnType<typeof vi.fn> } {
  const sent = vi.fn()
  const closed = vi.fn()
  let reads = 0
  const contents = { id: 7, send: sent }
  return {
    isDestroyed: () => destroyed,
    close: closed,
    sent,
    closed,
    get reads() {
      return reads
    },
    get webContents() {
      reads += 1
      if (destroyed) {
        throw new Error('Object has been destroyed')
      }
      return contents
    }
  }
}
