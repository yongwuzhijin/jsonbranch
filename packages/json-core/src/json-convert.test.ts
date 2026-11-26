import { describe, expect, it } from 'vitest'
import {
  chineseToUnicode,
  demoJson,
  escapeJsonString,
  jsonToQuery,
  minifyJson,
  pythonDictToJson,
  unescapeJsonString,
  unicodeToChinese
} from './json-convert'
import { jsonToSchema } from './json-schema'

describe('json conversions', () => {
  it('minifies to one line and rejects broken json', () => {
    expect(minifyJson('{\n  "a": 1\n}')).toEqual({ ok: true, text: '{"a":1}' })
    expect(minifyJson('{')).toEqual({ ok: false, code: 'invalid' })
  })

  it('builds a small demo document at the chosen indent', () => {
    expect(demoJson(2)).toContain('\n  "name"')
    expect(demoJson(4)).toContain('\n    "name"')
    expect(JSON.parse(demoJson(2))).toMatchObject({ name: '枝序', ok: true })
  })

  it('turns Chinese into unicode escapes and back', () => {
    expect(chineseToUnicode('枝A')).toBe('\\u679dA')
    expect(unicodeToChinese('\\u679dA')).toBe('枝A')
    expect(unicodeToChinese(chineseToUnicode('😀'))).toBe('😀')
  })

  it('escapes and restores a json string', () => {
    expect(escapeJsonString('a"b\n枝')).toBe('"a\\"b\\n枝"')
    expect(unescapeJsonString('"a\\"b\\n枝"')).toEqual({ ok: true, text: 'a"b\n枝' })
    expect(unescapeJsonString('a\\nb')).toEqual({ ok: true, text: 'a\nb' })
    expect(unescapeJsonString('{')).toEqual({ ok: false, code: 'not-string' })
  })

  it('turns an object into a query and explains other shapes', () => {
    expect(jsonToQuery('{"a":1,"b":"2"}')).toEqual({ ok: true, text: 'a=1&b=2' })
    expect(jsonToQuery('[]')).toEqual({ ok: false, code: 'not-object' })
    expect(jsonToQuery('{')).toEqual({ ok: false, code: 'invalid' })
  })

  it('turns a python dict into formatted json', () => {
    const result = pythonDictToJson("{'name': '枝序', 'ok': True, 'n': None, 'count': 2}", 2)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(JSON.parse(result.text)).toEqual({ name: '枝序', ok: true, n: null, count: 2 })
      expect(result.text).toContain('\n  "name"')
    }
    expect(pythonDictToJson('not a dict').ok).toBe(false)
  })

  it('describes a value as json schema', () => {
    expect(jsonToSchema({ name: '枝序', count: 2, ok: true, extra: null, tags: ['a'], mix: [1, 'a'] })).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        name: { type: 'string' },
        count: { type: 'integer' },
        ok: { type: 'boolean' },
        extra: { type: 'null' },
        tags: { type: 'array', items: { type: 'string' } },
        mix: { type: 'array', items: { anyOf: [{ type: 'integer' }, { type: 'string' }] } }
      },
      additionalProperties: false
    })
  })
})
