import { describe, expect, it } from 'vitest'
import {
  formatHistoryAge,
  formatHistoryBytes,
  formatHistoryClock,
  formatHistoryPreview,
  JSON_HISTORY_LIMIT,
  normalizeJsonHistory,
  removeJsonHistory,
  reviseActiveHistory,
  snapshotJsonHistory,
  type JsonHistoryEntry
} from './json-history'

const entry = (id: string, text: string, savedAt: number): JsonHistoryEntry => ({
  id,
  text,
  savedAt,
  bytes: new TextEncoder().encode(text).length
})

describe('json history', () => {
  it('updates the active document in place and ignores drafts and placeholders', () => {
    const first = reviseActiveHistory([], null, '{"a":1}', 10, 'a')
    expect(first.activeId).toBe('a')
    expect(first.entries).toEqual([entry('a', '{"a":1}', 10)])
    const ignored = reviseActiveHistory(first.entries, first.activeId, '{', 20, 'b')
    expect(ignored.entries).toBe(first.entries)
    expect(reviseActiveHistory(first.entries, first.activeId, '{}', 21, 'c').entries).toBe(first.entries)
    expect(reviseActiveHistory(first.entries, first.activeId, '[]', 22, 'd').entries).toBe(first.entries)
    expect(reviseActiveHistory(first.entries, first.activeId, '""', 23, 'e').entries).toBe(first.entries)
    const edited = reviseActiveHistory(first.entries, first.activeId, '{"a":2}', 30, 'f')
    expect(edited.activeId).toBe('a')
    expect(edited.entries).toHaveLength(1)
    expect(edited.entries[0]).toMatchObject({ id: 'a', text: '{"a":2}', savedAt: 30 })
  })

  it('starts a new entry only when the json is a different document', () => {
    const first = reviseActiveHistory([], null, '{"a":1}', 10, 'a')
    const added = reviseActiveHistory(first.entries, first.activeId, '{"a":1,"b":2}', 20, 'b')
    expect(added.activeId).toBe('a')
    expect(added.entries).toHaveLength(1)
    const replaced = reviseActiveHistory(added.entries, added.activeId, '{"name":"枝序","ok":true}', 30, 'c')
    expect(replaced.activeId).toBe('c')
    expect(replaced.entries.map((item) => item.id)).toEqual(['c', 'a'])
  })

  it('keeps 20 snapshots, lets a manual save store a placeholder, and deletes one row', () => {
    let entries: JsonHistoryEntry[] = []
    for (let index = 0; index < JSON_HISTORY_LIMIT + 3; index += 1) {
      entries = snapshotJsonHistory(entries, `{"n":${index}}`, index, `id-${index}`).entries
    }
    expect(entries).toHaveLength(20)
    expect(entries[0]?.id).toBe('id-22')
    expect(entries.some((item) => item.id === 'id-0')).toBe(false)
    const placeholder = snapshotJsonHistory(entries, '{}', 40, 'empty')
    expect(placeholder.entries[0]).toMatchObject({ id: 'empty', text: '{}' })
    expect(placeholder.entries).toHaveLength(20)
    expect(removeJsonHistory(placeholder.entries, 'empty')).toHaveLength(19)
  })

  it('compresses a formatted preview and formats time and size', () => {
    expect(formatHistoryPreview('{\n  "name": "枝序",\n  "ok": true\n}')).toBe('{"name": "枝序", "ok": true}')
    expect(formatHistoryPreview('x'.repeat(60), 12)).toBe(`${'x'.repeat(11)}…`)
    const savedAt = new Date(2026, 10, 26, 16, 36, 16).getTime()
    expect(normalizeJsonHistory([{ id: 'a', text: '{}', savedAt, bytes: 2 }, { text: 'no' }, 'x'])).toEqual([
      entry('a', '{}', savedAt)
    ])
    expect(formatHistoryClock(savedAt)).toBe('2026/11/26 16:36:16')
    expect(formatHistoryAge(savedAt, savedAt + 5_000)).toBe('刚刚')
    expect(formatHistoryAge(savedAt, savedAt + 3 * 60_000)).toBe('3 分钟前')
    expect(formatHistoryAge(savedAt, savedAt + 5_000, 'en')).toBe('Just now')
    expect(formatHistoryBytes(8)).toBe('8 B')
    expect(formatHistoryBytes(1229)).toBe('1.2 KB')
  })
})
