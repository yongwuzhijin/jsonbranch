import { describe, expect, it } from 'vitest'
import { messages } from './messages'
import { normalizeEditorFontSize, stepEditorFontSize } from './editor-font-size'

describe('normalizeEditorFontSize', () => {
  it('keeps integers inside 12 through 24', () => {
    expect(normalizeEditorFontSize(13)).toBe(13)
    expect(normalizeEditorFontSize(12)).toBe(12)
    expect(normalizeEditorFontSize(24)).toBe(24)
  })

  it('returns 13 for missing, illegal, and out-of-range values without clamping', () => {
    expect(normalizeEditorFontSize(undefined)).toBe(13)
    expect(normalizeEditorFontSize(null)).toBe(13)
    expect(normalizeEditorFontSize('13')).toBe(13)
    expect(normalizeEditorFontSize(13.5)).toBe(13)
    expect(normalizeEditorFontSize(Number.NaN)).toBe(13)
    expect(normalizeEditorFontSize(Number.POSITIVE_INFINITY)).toBe(13)
    expect(normalizeEditorFontSize(11)).toBe(13)
    expect(normalizeEditorFontSize(25)).toBe(13)
  })

  it('steps by one and normalizes the result', () => {
    expect(stepEditorFontSize(13, -1)).toBe(12)
    expect(stepEditorFontSize(13, 1)).toBe(14)
    expect(stepEditorFontSize(12, -1)).toBe(13)
    expect(stepEditorFontSize(24, 1)).toBe(13)
    expect(stepEditorFontSize('13', 1)).toBe(13)
  })
})

describe('font messages', () => {
  it('uses the value from before the click', () => {
    expect(messages('zh').decreaseFont(13)).toBe('减小字号，当前 13')
    expect(messages('zh').increaseFont(24)).toBe('增大字号，当前 24')
    expect(messages('zh').fontSaveFailed).toBe('字号未能记在本机')
    expect(messages('en').decreaseFont(13)).toBe('Decrease font size, current 13')
    expect(messages('en').increaseFont(24)).toBe('Increase font size, current 24')
    expect(messages('en').fontSaveFailed).toBe('Font size was not saved on this device.')
  })
})
