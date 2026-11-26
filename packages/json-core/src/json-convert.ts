export type ConvertCode = 'invalid' | 'not-object' | 'not-string'

export type ConvertResult = { ok: true; text: string } | { ok: false; code: ConvertCode }

export function minifyJson(input: string): ConvertResult {
  try {
    return { ok: true, text: JSON.stringify(JSON.parse(input)) }
  } catch {
    return { ok: false, code: 'invalid' }
  }
}

export function demoJson(indent: 2 | 4 = 2): string {
  return JSON.stringify(
    {
      name: '枝序',
      ok: true,
      count: 2,
      tags: ['json', 'tree']
    },
    null,
    indent
  )
}

export function chineseToUnicode(text: string): string {
  let out = ''
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (code < 128) {
      out += char
      continue
    }
    if (code <= 0xffff) {
      out += `\\u${code.toString(16).padStart(4, '0')}`
      continue
    }
    const shifted = code - 0x10000
    const high = 0xd800 + (shifted >> 10)
    const low = 0xdc00 + (shifted & 0x3ff)
    out += `\\u${high.toString(16).padStart(4, '0')}\\u${low.toString(16).padStart(4, '0')}`
  }
  return out
}

export function unicodeToChinese(text: string): string {
  return text.replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
}

export function escapeJsonString(text: string): string {
  return JSON.stringify(text)
}

export function unescapeJsonString(text: string): ConvertResult {
  const direct = parseString(text)
  if (direct !== null) {
    return { ok: true, text: direct }
  }
  if (text.includes('\\')) {
    const wrapped = parseString(`"${text}"`)
    if (wrapped !== null) {
      return { ok: true, text: wrapped }
    }
  }
  return { ok: false, code: 'not-string' }
}

export function jsonToQuery(input: string): ConvertResult {
  let value: unknown
  try {
    value = JSON.parse(input)
  } catch {
    return { ok: false, code: 'invalid' }
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, code: 'not-object' }
  }
  const parts: string[] = []
  for (const [key, item] of Object.entries(value)) {
    const raw = item !== null && typeof item === 'object' ? JSON.stringify(item) : String(item)
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(raw)}`)
  }
  return { ok: true, text: parts.join('&') }
}

export function pythonDictToJson(input: string, indent: 2 | 4 = 2): ConvertResult {
  try {
    const value: unknown = JSON.parse(pythonToJsonText(input))
    return { ok: true, text: JSON.stringify(value, null, indent) }
  } catch {
    return { ok: false, code: 'invalid' }
  }
}

function parseString(text: string): string | null {
  try {
    const value: unknown = JSON.parse(text)
    return typeof value === 'string' ? value : null
  } catch {
    return null
  }
}

function pythonToJsonText(input: string): string {
  let out = ''
  let index = 0
  while (index < input.length) {
    const char = input[index] ?? ''
    if (char === "'" || char === '"') {
      const quote = char
      index += 1
      let body = ''
      while (index < input.length) {
        const current = input[index] ?? ''
        if (current === '\\' && input[index + 1] === quote) {
          body += quote
          index += 2
          continue
        }
        if (current === '\\' && input[index + 1] === '\\') {
          body += '\\'
          index += 2
          continue
        }
        if (current === quote) {
          index += 1
          break
        }
        body += current
        index += 1
      }
      out += JSON.stringify(body)
      continue
    }
    if (/[A-Za-z_]/.test(char)) {
      let word = ''
      while (index < input.length && /[A-Za-z0-9_]/.test(input[index] ?? '')) {
        word += input[index]
        index += 1
      }
      if (word === 'True') out += 'true'
      else if (word === 'False') out += 'false'
      else if (word === 'None') out += 'null'
      else out += word
      continue
    }
    out += char
    index += 1
  }
  return out
}
