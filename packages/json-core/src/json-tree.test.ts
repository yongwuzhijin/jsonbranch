import { describe, expect, it } from 'vitest'
import { buildJsonPairText, buildJsonValueText } from './json-copy-text'
import { deleteJsonNodeAt } from './json-delete-node'
import { toCopyablePath } from './json-path'
import { findJsonMatches } from './json-search'
import { createJsonExpansion } from './json-tree-expansion'
import { buildVisibleJsonRows } from './json-tree-rows'

describe('json tree', () => {
  it('uses dot paths for identifiers and brackets for odd keys', () => {
    const rows = buildVisibleJsonRows({ ok: 1, 'a b': 2 }, createJsonExpansion())
    expect(rows.map((row) => row.path)).toContain('ok')
    expect(rows.map((row) => row.path)).toContain('["a b"]')
    expect(toCopyablePath('')).toBe('$')
  })

  it('searches keys and values without case sensitivity', () => {
    const matches = findJsonMatches({ Name: 'Beta' }, 'name')
    expect(matches.some((match) => match.field === 'key')).toBe(true)
    expect(findJsonMatches({ Name: 'Beta' }, 'beta').some((match) => match.field === 'value')).toBe(true)
  })

  it('deletes one node and can describe the removed pair', () => {
    const rows = buildVisibleJsonRows({ a: 1, b: 2 }, createJsonExpansion())
    const row = rows.find((item) => item.path === 'a')
    expect(row).toBeTruthy()
    expect(deleteJsonNodeAt({ a: 1, b: 2 }, row!.segments)).toEqual({ b: 2 })
    expect(buildJsonPairText(row!)).toContain('"a"')
    expect(buildJsonValueText(row!)).toBe('1')
  })
})
