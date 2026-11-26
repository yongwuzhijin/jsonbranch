import type { JsonHistoryEntry } from '@jsonbranch/json-core'

export type MacFileStamp = {
  mtimeMs: number
  size: number
}

export type MacOpenResult =
  | { status: 'canceled' }
  | { status: 'error'; reason: 'not-file' | 'bad-extension' | 'not-utf8' | 'too-large' }
  | { status: 'ok'; path: string; content: string; stamp: MacFileStamp }

export type MacSaveResult =
  | { status: 'ok'; path: string; stamp: MacFileStamp }
  | { status: 'unchanged' }
  | { status: 'stale' }
  | { status: 'denied' }
  | { status: 'failed'; message: string }

export type JsonbranchApi = {
  openDocument(): Promise<MacOpenResult>
  saveDocument(input: {
    path: string
    content: string
    previous: string
    stamp: MacFileStamp
    overwrite: boolean
  }): Promise<MacSaveResult>
  saveDocumentAs(input: { content: string }): Promise<MacSaveResult | { status: 'canceled' }>
  writeClipboard(text: string): Promise<void>
  confirmDiscard(): Promise<'save' | 'discard' | 'cancel'>
  onOpenFromOs(callback: (result: MacOpenResult) => void): () => void
  onRequestSaveClose(callback: () => void): () => void
  notifyOsCloseReady(): void
  readEditorFontSize(): Promise<number>
  writeEditorFontSize(size: number): Promise<{ ok: boolean }>
  readJsonHistory(): Promise<JsonHistoryEntry[]>
  writeJsonHistory(entries: JsonHistoryEntry[]): Promise<void>
}

export const jsonbranchMethods = [
  'openDocument',
  'saveDocument',
  'saveDocumentAs',
  'writeClipboard',
  'confirmDiscard',
  'onOpenFromOs',
  'onRequestSaveClose',
  'notifyOsCloseReady',
  'readEditorFontSize',
  'writeEditorFontSize',
  'readJsonHistory',
  'writeJsonHistory'
] as const

declare global {
  interface Window {
    jsonbranch: JsonbranchApi
  }
}
