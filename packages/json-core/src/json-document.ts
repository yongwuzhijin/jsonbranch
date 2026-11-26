import { deleteJsonNodeAt } from './json-delete-node'
import { parseJsonInput } from './parse-json-input'

export type JsonDocument = {
  input: string
  baseline: string
  keepEscapes: boolean
  showLineNumbers: boolean
  undoInput: string | null
}

export function createJsonDocument(input = ''): JsonDocument {
  return {
    input,
    baseline: input,
    keepEscapes: true,
    showLineNumbers: false,
    undoInput: null
  }
}

export function applyFormat(document: JsonDocument, indent: 2 | 4 = 2): JsonDocument {
  const result = parseJsonInput(document.input, { keepEscapes: document.keepEscapes })
  if (result.status !== 'ok') {
    return document
  }
  const input = JSON.stringify(result.value, null, indent)
  if (input === document.input) {
    return document
  }
  return { ...document, undoInput: document.input, input }
}

export function applyDelete(
  document: JsonDocument,
  segments: readonly (string | number)[],
  indent: 2 | 4 = 2
): JsonDocument {
  if (segments.length === 0) {
    return document
  }
  const result = parseJsonInput(document.input, { keepEscapes: document.keepEscapes })
  if (result.status !== 'ok') {
    return document
  }
  let nextValue: unknown
  try {
    nextValue = deleteJsonNodeAt(result.value, segments)
  } catch {
    return document
  }
  return {
    ...document,
    undoInput: document.input,
    input: JSON.stringify(nextValue, null, indent)
  }
}

export function applyUndo(document: JsonDocument): JsonDocument {
  if (document.undoInput === null) {
    return document
  }
  return { ...document, input: document.undoInput, undoInput: null }
}

export function applyInput(document: JsonDocument, input: string): JsonDocument {
  return { ...document, input, undoInput: null }
}

export function isDirty(document: JsonDocument): boolean {
  return document.input !== document.baseline
}
