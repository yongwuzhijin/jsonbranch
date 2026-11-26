export const EDITOR_FONT_MIN = 12
export const EDITOR_FONT_MAX = 24
export const EDITOR_FONT_DEFAULT = 13

export function normalizeEditorFontSize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return EDITOR_FONT_DEFAULT
  }
  if (value < EDITOR_FONT_MIN || value > EDITOR_FONT_MAX) {
    return EDITOR_FONT_DEFAULT
  }
  return value
}

export function stepEditorFontSize(current: unknown, direction: -1 | 1): number {
  const base = normalizeEditorFontSize(current)
  if (base !== current) {
    return EDITOR_FONT_DEFAULT
  }
  return normalizeEditorFontSize(base + direction)
}
