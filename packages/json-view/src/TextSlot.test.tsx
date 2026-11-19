import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TextSlot } from './TextSlot'

afterEach(() => cleanup())

describe('TextSlot', () => {
  it('uses a textarea when the worker constructor throws EvalError', () => {
    render(<TextSlot value="{}" onChange={() => {}} createWorker={() => { throw new EvalError('csp') }} />)
    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA')
  })

  it('keeps the same value through the fallback', () => {
    const seen: string[] = []
    render(<TextSlot value="{}" onChange={(value) => seen.push(value)} createWorker={() => { throw new EvalError('csp') }} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"a":1}' } })
    expect(seen).toEqual(['{"a":1}'])
  })
})
