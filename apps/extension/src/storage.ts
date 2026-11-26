import { normalizeEditorFontSize } from '@jsonbranch/json-view/editor-font-size'

export type StoredDocument = {
  input: string
  keepEscapes: boolean
  showLineNumbers: boolean
}

export type StorageArea = {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
}

export type SessionArea = {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
}

export const DOCUMENT_KEY = 'document'
export const EDITOR_FONT_KEY = 'editorFontSize'
export const VIEWER_TAB_KEY = 'viewerTabId'

const EMPTY_DOCUMENT: StoredDocument = {
  input: '',
  keepEscapes: true,
  showLineNumbers: false
}

export async function loadStoredDocument(area: StorageArea): Promise<StoredDocument> {
  const value = await area.get(DOCUMENT_KEY)
  if (!value || typeof value !== 'object') {
    return { ...EMPTY_DOCUMENT }
  }
  const record = value as Partial<StoredDocument>
  return {
    input: typeof record.input === 'string' ? record.input : '',
    keepEscapes: typeof record.keepEscapes === 'boolean' ? record.keepEscapes : true,
    showLineNumbers: typeof record.showLineNumbers === 'boolean' ? record.showLineNumbers : false
  }
}

export async function saveStoredDocument(area: StorageArea, document: StoredDocument): Promise<void> {
  await area.set(DOCUMENT_KEY, {
    input: document.input,
    keepEscapes: document.keepEscapes,
    showLineNumbers: document.showLineNumbers
  })
}

export async function loadEditorFontSize(area: StorageArea): Promise<number> {
  try {
    return normalizeEditorFontSize(await area.get(EDITOR_FONT_KEY))
  } catch {
    return 13
  }
}

export async function saveEditorFontSize(area: StorageArea, size: number): Promise<void> {
  await area.set(EDITOR_FONT_KEY, normalizeEditorFontSize(size))
}

export function chromeLocalArea(): StorageArea {
  return {
    async get(key) {
      const stored = await chrome.storage.local.get(key)
      return stored[key]
    },
    async set(key, value) {
      await chrome.storage.local.set({ [key]: value })
    }
  }
}

export function chromeSessionArea(): SessionArea {
  return {
    async get(key) {
      const stored = await chrome.storage.session.get(key)
      return stored[key]
    },
    async set(key, value) {
      await chrome.storage.session.set({ [key]: value })
    }
  }
}
