import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  editorFontFilePath,
  readEditorFontFile,
  writeEditorFontFile,
  writeEditorFontResult
} from './editor-font-file'

function tempDir(): string {
  return mkdtempSync(path.join(tmpdir(), 'jsonbranch-font-'))
}

describe('editor font file', () => {
  it('uses 13 when the file is missing and does not create it', () => {
    const dir = tempDir()
    expect(readEditorFontFile(dir)).toBe(13)
    expect(existsSync(editorFontFilePath(dir))).toBe(false)
  })

  it('uses 13 for corrupt or illegal contents', () => {
    const dir = tempDir()
    const file = editorFontFilePath(dir)
    for (const content of ['not json', '{"fontSize":"13"}', '{"fontSize":13.5}', '{"fontSize":11}', '{"fontSize":25}', '{"input":"{}"}']) {
      writeFileSync(file, content)
      expect(readEditorFontFile(dir)).toBe(13)
    }
  })

  it('stores only the font size and leaves a sibling json file untouched', () => {
    const dir = tempDir()
    const sibling = path.join(dir, 'notes.json')
    writeFileSync(sibling, '{"keep":true}')
    writeEditorFontFile(dir, 18)
    expect(readFileSync(editorFontFilePath(dir), 'utf8')).toBe('{"fontSize":18}\n')
    expect(readEditorFontFile(dir)).toBe(18)
    writeEditorFontFile(dir, 11)
    expect(readFileSync(editorFontFilePath(dir), 'utf8')).toBe('{"fontSize":13}\n')
    expect(readFileSync(sibling, 'utf8')).toBe('{"keep":true}')
  })

  it('reports a failed write without throwing', () => {
    const blocker = path.join(tempDir(), 'not-a-directory')
    writeFileSync(blocker, 'x')
    expect(writeEditorFontResult(blocker, 16)).toEqual({ ok: false })
  })
})
