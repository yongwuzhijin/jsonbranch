import { describe, expect, it } from 'vitest'
import { parseEditedLiteral, renameJsonKey, setJsonValue } from './json-edit'

describe('json inline edit', () => {
  it('parses literals and otherwise keeps the typed text', () => {
    expect(parseEditedLiteral(' true ')).toBe(true)
    expect(parseEditedLiteral('false')).toBe(false)
    expect(parseEditedLiteral('null')).toBeNull()
    expect(parseEditedLiteral('3.5')).toBe(3.5)
    expect(parseEditedLiteral('"hi"')).toBe('hi')
    expect(parseEditedLiteral('01')).toBe('01')
    expect(parseEditedLiteral('hello world')).toBe('hello world')
  })

  it('renames a key in place and rejects an empty or duplicate name', () => {
    const value = { b: 1, a: { b: 2 } }
    expect(Object.keys(renameJsonKey(value, ['b'], 'c') as object)).toEqual(['c', 'a'])
    expect(renameJsonKey(value, ['a', 'b'], 'z')).toMatchObject({ b: 1, a: { z: 2 } })
    expect(renameJsonKey(value, ['b'], '')).toBeNull()
    expect(renameJsonKey(value, ['b'], 'a')).toBeNull()
    expect(value).toEqual({ b: 1, a: { b: 2 } })
  })

  it('writes a value without reordering siblings', () => {
    const next = setJsonValue({ b: 1, a: 'x' }, ['a'], 4) as { b: number; a: number }
    expect(Object.keys(next)).toEqual(['b', 'a'])
    expect(next.a).toBe(4)
  })
})
