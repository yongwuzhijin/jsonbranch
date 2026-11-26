import { describe, expect, it } from 'vitest'
import { locateJsonPath } from './json-location'

describe('locateJsonPath', () => {
  const formatted = `{
  "a": {
    "a": 1
  },
  "tags": ["x", "y"]
}`

  it('finds a nested key that shares its name with an ancestor', () => {
    const range = locateJsonPath(formatted, ['a', 'a'])
    expect(range).not.toBeNull()
    expect(formatted.slice(range!.start, range!.end)).toBe('1')
    expect(range).toMatchObject({ line: 3, column: 10 })
  })

  it('finds an array item in formatted and compressed json', () => {
    const formattedRange = locateJsonPath(formatted, ['tags', 1])
    expect(formatted.slice(formattedRange!.start, formattedRange!.end)).toBe('"y"')
    const compressed = '{"tags":["x","y"],"a":{"a":1}}'
    const compressedRange = locateJsonPath(compressed, ['a', 'a'])
    expect(compressed.slice(compressedRange!.start, compressedRange!.end)).toBe('1')
  })

  it('returns null when the json cannot be read', () => {
    expect(locateJsonPath('{', ['a'])).toBeNull()
    expect(locateJsonPath(formatted, ['missing'])).toBeNull()
  })
})