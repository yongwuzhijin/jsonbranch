import { findNodeAtLocation, parseTree, type ParseError } from 'jsonc-parser'

export type JsonSourceRange = {
  start: number
  end: number
  line: number
  column: number
}

export function locateJsonPath(input: string, segments: readonly (string | number)[]): JsonSourceRange | null {
  const errors: ParseError[] = []
  const root = parseTree(input, errors, { disallowComments: true, allowTrailingComma: false })
  if (!root || errors.length > 0) {
    return null
  }
  const node = segments.length === 0 ? root : findNodeAtLocation(root, [...segments])
  if (!node) {
    return null
  }
  return {
    start: node.offset,
    end: node.offset + node.length,
    ...lineColumn(input, node.offset)
  }
}

function lineColumn(input: string, offset: number): { line: number; column: number } {
  let line = 1
  let column = 1
  const limit = Math.min(Math.max(offset, 0), input.length)
  for (let index = 0; index < limit; index += 1) {
    if (input[index] === '\n') {
      line += 1
      column = 1
    } else {
      column += 1
    }
  }
  return { line, column }
}
