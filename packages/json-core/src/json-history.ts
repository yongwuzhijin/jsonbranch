export const JSON_HISTORY_LIMIT = 20

export type JsonHistoryEntry = {
  id: string
  text: string
  savedAt: number
  bytes: number
}

export function rememberJsonHistory(
  entries: readonly JsonHistoryEntry[],
  text: string,
  savedAt: number,
  id: string
): JsonHistoryEntry[] {
  if (text.trim().length === 0) {
    return entries as JsonHistoryEntry[]
  }
  const bytes = new TextEncoder().encode(text).length
  const latest = entries[0]
  if (latest && latest.text === text) {
    return [{ ...latest, savedAt, bytes }, ...entries.slice(1)]
  }
  return [{ id, text, savedAt, bytes }, ...entries].slice(0, JSON_HISTORY_LIMIT)
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
