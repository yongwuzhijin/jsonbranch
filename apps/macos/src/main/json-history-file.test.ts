import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { jsonHistoryFilePath, readJsonHistoryFile, writeJsonHistoryFile } from './json-history-file'

describe('json history file', () => {
  it('reads an empty list when the file is missing and does not create it', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'jsonbranch-history-'))
    expect(readJsonHistoryFile(dir)).toEqual([])
    expect(existsSync(jsonHistoryFilePath(dir))).toBe(false)
  })

  it('stores snapshots beside the font file without touching it', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'jsonbranch-history-'))
    const font = path.join(dir, 'editor-font-size.json')
    writeFileSync(font, '{"fontSize":18}\n')
    writeJsonHistoryFile(dir, [{ id: 'a', text: '{"a":1}', savedAt: 5, bytes: 7 }])
    expect(readJsonHistoryFile(dir)).toEqual([{ id: 'a', text: '{"a":1}', savedAt: 5, bytes: 7 }])
    expect(readFileSync(font, 'utf8')).toBe('{"fontSize":18}\n')
    expect(readJsonHistoryFile(dir)).not.toEqual(expect.arrayContaining([expect.objectContaining({ fontSize: 18 })]))
  })
})