import type { JsonParseErrorCode, JsonParseResult } from './parse-json-input'

const CODES_WITHOUT_POSITION = new Set<JsonParseErrorCode>(['too-large', 'too-deep'])

const ZH: Record<JsonParseErrorCode, string> = {
  'too-large': '内容过大，无法预览',
  'too-deep': 'JSON 嵌套过深，无法预览',
  'unexpected-end': 'JSON 意外结束',
  'invalid-symbol': 'JSON 中出现意外符号',
  'invalid-number': 'JSON 数字无效',
  'invalid-escape': 'JSON 转义无效',
  'comments-not-allowed': 'JSON 中不允许注释',
  'trailing-content': 'JSON 结束后还有内容',
  syntax: 'JSON 无效'
}

const EN: Record<JsonParseErrorCode, string> = {
  'too-large': 'Content is too large to preview.',
  'too-deep': 'JSON is nested too deeply to preview.',
  'unexpected-end': 'Unexpected end of JSON input.',
  'invalid-symbol': 'Unexpected token in JSON.',
  'invalid-number': 'Invalid number format in JSON.',
  'invalid-escape': 'Invalid escape sequence in JSON text.',
  'comments-not-allowed': 'Comments are not allowed in JSON.',
  'trailing-content': 'Unexpected content after the end of JSON.',
  syntax: 'Invalid JSON.'
}

export function describeJsonParseError(
  result: Extract<JsonParseResult, { status: 'error' }>,
  locale: 'zh' | 'en' = 'zh'
): string {
  const message = (locale === 'en' ? EN : ZH)[result.code]
  if (CODES_WITHOUT_POSITION.has(result.code)) {
    return message
  }
  const position =
    locale === 'en'
      ? `Line ${result.line}, column ${result.column}`
      : `第 ${result.line} 行，第 ${result.column} 列`
  return `${message} ${position}`
}
