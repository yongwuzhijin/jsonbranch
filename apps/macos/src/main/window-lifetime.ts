export interface LiveWindow {
  isDestroyed(): boolean
  close(): void
  readonly webContents: {
    readonly id: number
    send(channel: string, payload?: unknown): void
  }
}

export function senderWebContentsId(sender: { isDestroyed(): boolean; readonly id: number } | null): number | null {
  if (sender === null || sender.isDestroyed()) {
    return null
  }
  return sender.id
}

export function webContentsId(window: LiveWindow | null): number | null {
  if (window === null || window.isDestroyed()) {
    return null
  }
  return window.webContents.id
}

export function sendToLiveWindow(window: LiveWindow | null, channel: string, payload?: unknown): boolean {
  if (window === null || webContentsId(window) === null) {
    return false
  }
  window.webContents.send(channel, payload)
  return true
}

export function applyCloseChoice(
  window: LiveWindow | null,
  effect: 'stay' | 'arm-and-close' | 'request-save',
  arm: () => void
): boolean {
  if (effect === 'stay' || window === null || webContentsId(window) === null) {
    return false
  }
  if (effect === 'arm-and-close') {
    arm()
    window.close()
    return true
  }
  window.webContents.send('jsonbranch:request-save-close')
  return true
}

export function releaseClosedWindow<T>(current: T | null, closed: T): T | null {
  return current === closed ? null : current
}
