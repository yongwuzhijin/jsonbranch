export const JSON_HISTORY_LIMIT = 20

export type JsonHistoryEntry = {
  id: string
  text: string
  savedAt: number
  bytes: number
}

export type HistoryRevision = {
  entries: JsonHistoryEntry[]
  activeId: string | null
}

export function isMeaningfulJson(text: string): boolean {
  try {
    const value: unknown = JSON.parse(text)
    if (typeof value === 'string' && value.length === 0) {
      return false
    }
    if (Array.isArray(value)) {
      return value.length > 0
    }
    if (value !== null && typeof value === 'object') {
      return Object.keys(value).length > 0
    }
    return value !== undefined
  } catch {
    return false
  }
}

export function isDistinctJsonDocument(previous: string, next: string): boolean {
  let before: unknown
  let after: unknown
  try {
    before = JSON.parse(previous)
    after = JSON.parse(next)
  } catch {
    return true
  }
  const beforeKind = jsonKind(before)
  const afterKind = jsonKind(after)
  if (beforeKind !== afterKind) {
    return true
  }
  if (beforeKind !== 'object' || afterKind !== 'object') {
    return false
  }
  const beforeKeys = Object.keys(before as Record<string, unknown>)
  const afterKeys = Object.keys(after as Record<string, unknown>)
  const shared = afterKeys.filter((key) => beforeKeys.includes(key)).length
  const union = beforeKeys.length + afterKeys.length - shared
  if (union === 0) {
    return false
  }
  const subset = shared === Math.min(beforeKeys.length, afterKeys.length)
  if (subset && Math.abs(beforeKeys.length - afterKeys.length) <= 3) {
    return false
  }
  return shared / union < 0.5
}

export function reviseActiveHistory(
  entries: readonly JsonHistoryEntry[],
  activeId: string | null,
  text: string,
  savedAt: number,
  id: string
): HistoryRevision {
  if (!isMeaningfulJson(text)) {
    return { entries: entries as JsonHistoryEntry[], activeId }
  }
  const active = activeId === null ? undefined : entries.find((entry) => entry.id === activeId)
  if (!active || isDistinctJsonDocument(active.text, text)) {
    return { entries: placeFirst(entries, entryFrom(id, text, savedAt)), activeId: id }
  }
  return { entries: placeFirst(entries, { ...active, text, savedAt, bytes: utf8Bytes(text) }), activeId: active.id }
}

export function snapshotJsonHistory(
  entries: readonly JsonHistoryEntry[],
  text: string,
  savedAt: number,
  id: string
): HistoryRevision {
  if (text.length === 0) {
    return { entries: entries as JsonHistoryEntry[], activeId: null }
  }
  return { entries: placeFirst(entries, entryFrom(id, text, savedAt)), activeId: id }
}

export function formatHistoryPreview(text: string, limit = 48): string {
  const compact = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\{\s+/g, '{')
    .replace(/\s+\}/g, '}')
    .replace(/\[\s+/g, '[')
    .replace(/\s+\]/g, ']')
  if (compact.length <= limit) {
    return compact
  }
  return `${compact.slice(0, Math.max(0, limit - 1))}…`
}

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length
}

function entryFrom(id: string, text: string, savedAt: number): JsonHistoryEntry {
  return { id, text, savedAt, bytes: utf8Bytes(text) }
}

function placeFirst(entries: readonly JsonHistoryEntry[], entry: JsonHistoryEntry): JsonHistoryEntry[] {
  return [entry, ...entries.filter((item) => item.id !== entry.id)].slice(0, JSON_HISTORY_LIMIT)
}

function jsonKind(value: unknown): string {
  if (value === null) {
    return 'null'
  }
  if (Array.isArray(value)) {
    return 'array'
  }
  return typeof value
}

export function removeJsonHistory(entries: readonly JsonHistoryEntry[], id: string): JsonHistoryEntry[] {
  return entries.filter((entry) => entry.id !== id)
}

export function normalizeJsonHistory(value: unknown): JsonHistoryEntry[] {
  if (!Array.isArray(value)) {
    return []
  }
  const entries: JsonHistoryEntry[] = []
  for (const item of value) {
    if (item === null || typeof item !== 'object') {
      continue
    }
    const record = item as Partial<JsonHistoryEntry>
    if (typeof record.id !== 'string' || typeof record.text !== 'string' || typeof record.savedAt !== 'number') {
      continue
    }
    if (record.text.trim().length === 0) {
      continue
    }
    entries.push({
      id: record.id,
      text: record.text,
      savedAt: record.savedAt,
      bytes: typeof record.bytes === 'number' ? record.bytes : new TextEncoder().encode(record.text).length
    })
  }
  return entries.slice(0, JSON_HISTORY_LIMIT)
}

export function formatHistoryBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  const kilobytes = bytes / 1024
  const digits = kilobytes >= 10 ? 0 : 1
  return `${kilobytes.toFixed(digits)} KB`
}

export function formatHistoryClock(savedAt: number): string {
  const date = new Date(savedAt)
  const part = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}/${part(date.getMonth() + 1)}/${part(date.getDate())} ${part(date.getHours())}:${part(date.getMinutes())}:${part(date.getSeconds())}`
}

export function formatHistoryAge(savedAt: number, now: number, locale: 'zh' | 'en' = 'zh'): string {
  const delta = Math.max(0, now - savedAt)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (delta < minute) {
    return locale === 'en' ? 'Just now' : '刚刚'
  }
  if (delta < hour) {
    const count = Math.floor(delta / minute)
    return locale === 'en' ? `${count} min ago` : `${count} 分钟前`
  }
  if (delta < day) {
    const count = Math.floor(delta / hour)
    return locale === 'en' ? `${count} hr ago` : `${count} 小时前`
  }
  const count = Math.floor(delta / day)
  return locale === 'en' ? `${count} d ago` : `${count} 天前`
}
