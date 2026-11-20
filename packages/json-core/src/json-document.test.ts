import { describe, expect, it } from 'vitest'
import { applyDelete, applyFormat, applyUndo, createJsonDocument, isDirty } from './json-document'
import { describeJsonParseError } from './json-parse-error-message'
import { parseJsonInput } from './parse-json-input'
import { buildVisibleJsonRows } from './json-tree-rows'
import { createJsonExpansion } from './json-tree-expansion'

describe('json document', () => {
  it('formats with two spaces and becomes dirty', () => {
    const next = applyFormat(createJsonDocument('{"a":1}'))
    expect(next.input).toBe('{\n  "a": 1\n}')
    expect(isDirty(next)).toBe(true)
  })

  it('restores the exact input after one undo', () => {
    const start = createJsonDocument('{"a":1,"b":2}')
    const parsed = parseJsonInput(start.input, { keepEscapes: true })
    const row = buildVisibleJsonRows(parsed.status === 'ok' ? parsed.value : null, createJsonExpansion()).find((item) => item.path === 'a')
    const deleted = applyDelete(start, row!.segments)
    expect(applyUndo(deleted).input).toBe(start.input)
  })

  it('describes a comment error with a line number in Chinese', () => {
    const result = parseJsonInput('{ /* x */ }', { keepEscapes: true })
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(describeJsonParseError(result, 'zh')).toContain('注释')
      expect(describeJsonParseError(result, 'zh')).toContain(String(result.line))
    }
  })
})
