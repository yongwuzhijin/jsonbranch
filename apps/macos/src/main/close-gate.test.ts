import { describe, expect, it } from 'vitest'
import { choiceEffect, createCloseGate } from './close-gate'

describe('os close gate', () => {
  it('asks to save and only closes after that save succeeds', () => {
    const gate = createCloseGate()
    expect(gate.shouldPrevent(true)).toBe(true)
    expect(choiceEffect('save')).toBe('request-save')
    expect(gate.shouldPrevent(true)).toBe(true)
    gate.arm()
    expect(gate.shouldPrevent(true)).toBe(false)
    expect(gate.shouldPrevent(true)).toBe(true)
  })

  it('arms discard for one close and prompts again afterwards', () => {
    const gate = createCloseGate()
    expect(choiceEffect('discard')).toBe('arm-and-close')
    expect(choiceEffect('cancel')).toBe('stay')
    gate.arm()
    expect(gate.shouldPrevent(true)).toBe(false)
    expect(gate.shouldPrevent(true)).toBe(true)
    expect(gate.shouldPrevent(false)).toBe(false)
  })
})
