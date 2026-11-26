export function parseEditedLiteral(raw: string): unknown {
  const trimmed = raw.trim()
  if (trimmed === 'null') {
    return null
  }
  if (trimmed === 'true') {
    return true
  }
  if (trimmed === 'false') {
    return false
  }
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(trimmed)) {
    const number = Number(trimmed)
    if (Number.isFinite(number)) {
      return number
    }
  }
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const value: unknown = JSON.parse(trimmed)
      if (typeof value === 'string') {
        return value
      }
    } catch {
      // Keep the typed text, including the quote characters, as a string.
    }
  }
  return raw
}

export function renameJsonKey(value: unknown, segments: readonly (string | number)[], nextKey: string): unknown | null {
  const currentKey = segments.at(-1)
  if (typeof currentKey !== 'string' || nextKey.trim().length === 0 || nextKey === currentKey) {
    return null
  }
  const clone = structuredClone(value)
  let parent: unknown = clone
  for (const segment of segments.slice(0, -1)) {
    parent = (parent as Record<string | number, unknown>)[segment]
  }
  if (parent === null || typeof parent !== 'object' || Array.isArray(parent)) {
    return null
  }
  const record = parent as Record<string, unknown>
  if (!Object.prototype.hasOwnProperty.call(record, currentKey) || Object.prototype.hasOwnProperty.call(record, nextKey)) {
    return null
  }
  const rebuilt: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(record)) {
    rebuilt[key === currentKey ? nextKey : key] = item
  }
  for (const key of Object.keys(record)) {
    delete record[key]
  }
  Object.assign(record, rebuilt)
  return clone
}

export function setJsonValue(value: unknown, segments: readonly (string | number)[], next: unknown): unknown {
  if (segments.length === 0) {
    return next
  }
  const clone = structuredClone(value)
  let parent: unknown = clone
  for (const segment of segments.slice(0, -1)) {
    parent = (parent as Record<string | number, unknown>)[segment]
  }
  const last = segments.at(-1)
  if (Array.isArray(parent) && typeof last === 'number') {
    parent[last] = next
    return clone
  }
  if (parent !== null && typeof parent === 'object' && typeof last === 'string') {
    ;(parent as Record<string, unknown>)[last] = next
    return clone
  }
  return clone
}
