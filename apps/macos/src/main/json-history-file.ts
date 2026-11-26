import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { normalizeJsonHistory, type JsonHistoryEntry } from '@jsonbranch/json-core'

export function jsonHistoryFilePath(userDataDir: string): string {
  return path.join(userDataDir, 'json-history.json')
}

export function readJsonHistoryFile(userDataDir: string): JsonHistoryEntry[] {
  try {
    const parsed: unknown = JSON.parse(readFileSync(jsonHistoryFilePath(userDataDir), 'utf8'))
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return []
    }
    return normalizeJsonHistory((parsed as { entries?: unknown }).entries)
  } catch {
    return []
  }
}

export function writeJsonHistoryFile(userDataDir: string, entries: unknown): void {
  mkdirSync(userDataDir, { recursive: true })
  writeFileSync(jsonHistoryFilePath(userDataDir), `${JSON.stringify({ entries: normalizeJsonHistory(entries) })}\n`)
}
