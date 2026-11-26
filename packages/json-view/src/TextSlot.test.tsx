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

  it('applies a valid font size to the fallback textarea', () => {
    render(<TextSlot value="{}" fontSize={18} onChange={() => {}} createWorker={() => { throw new EvalError('csp') }} />)
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).style.fontSize).toBe('18px')
  })

  it('uses 13px when the font size is missing or illegal', () => {
    const { rerender } = render(<TextSlot value="{}" onChange={() => {}} createWorker={() => { throw new EvalError('csp') }} />)
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).style.fontSize).toBe('13px')
    rerender(<TextSlot value="{}" fontSize={11} onChange={() => {}} createWorker={() => { throw new EvalError('csp') }} />)
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).style.fontSize).toBe('13px')
  })
})
