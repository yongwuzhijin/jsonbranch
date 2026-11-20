import { findJsonMatches, type JsonSearchMatch } from '@jsonbranch/json-core'

export type TextSlotProps = {
  value: string
  onChange(value: string): void
}

export type CopyText = (text: string) => Promise<void>

export function searchState(
  value: unknown,
  query: string,
  index: number
): { count: number; active: JsonSearchMatch | null } {
  const matches = findJsonMatches(value, query)
  if (matches.length === 0) {
    return { count: 0, active: null }
  }
  const clamped = Math.min(Math.max(index, 0), matches.length - 1)
  return { count: matches.length, active: matches[clamped] ?? null }
}
