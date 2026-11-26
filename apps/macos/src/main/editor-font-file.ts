import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { normalizeEditorFontSize } from '@jsonbranch/json-view/editor-font-size'

export function editorFontFilePath(userDataDir: string): string {
  return path.join(userDataDir, 'editor-font-size.json')
}

export function readEditorFontFile(userDataDir: string): number {
  try {
    const parsed: unknown = JSON.parse(readFileSync(editorFontFilePath(userDataDir), 'utf8'))
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return 13
    }
    return normalizeEditorFontSize((parsed as { fontSize?: unknown }).fontSize)
  } catch {
    return 13
  }
}

export function writeEditorFontFile(userDataDir: string, size: number): void {
  mkdirSync(userDataDir, { recursive: true })
  writeFileSync(editorFontFilePath(userDataDir), `${JSON.stringify({ fontSize: normalizeEditorFontSize(size) })}\n`)
}

export function writeEditorFontResult(userDataDir: string, size: unknown): { ok: true } | { ok: false } {
  try {
    writeEditorFontFile(userDataDir, normalizeEditorFontSize(size))
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
