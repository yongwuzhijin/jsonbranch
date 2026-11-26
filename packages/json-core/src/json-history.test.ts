import { describe, expect, it } from 'vitest'
import {
  formatHistoryAge,
  formatHistoryBytes,
  formatHistoryClock,
  JSON_HISTORY_LIMIT,
  normalizeJsonHistory,
  rememberJsonHistory,
  removeJsonHistory,
  type JsonHistoryEntry
} from './json-history'

const entry = (id: string, text: string, savedAt: number): JsonHistoryEntry => ({
  id,
  text,
  savedAt,
  bytes: new TextEncoder().encode(text).length
})

describe('json history', () => {
  it('skips empty text and refreshes the latest identical snapshot', () => {
    const first = rememberJsonHistory([], ' {"a":1}', 10, 'a')
    expect(first).toHaveLength(1)
    expect(first[0]?.text).toBe(' {"a":1}')
    expect(rememberJsonHistory(first, '   ', 20, 'b')).toBe(first)
    const refreshed = rememberJsonHistory(first, ' {"a":1}', 30, 'c')
    expect(refreshed).toHaveLength(1)
    expect(refreshed[0]?.id).toBe('a')
    expect(refreshed[0]?.savedAt).toBe(30)
  })

  it('keeps the newest 20 snapshots and drops one entry', () => {
    let entries: JsonHistoryEntry[] = []
    for (let index = 0; index < JSON_HISTORY_LIMIT + 3; index += 1) {
      entries = rememberJsonHistory(entries, `{"n":${index}}`, index, `id-${index}`)
    }
    expect(entries).toHaveLength(20)
    expect(entries[0]?.text).toBe('{"n":22}')
    expect(entries.some((item) => item.text === '{"n":0}')).toBe(false)
    expect(removeJsonHistory(entries, entries[1]!.id)).toHaveLength(19)
    expect(removeJsonHistory(entries, 'missing')).toHaveLength(20)
  })

  it('normalizes stored rows and formats time and size', () => {
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
