import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IconButton, placeTooltip, Tooltip, TOOLTIP_DELAY_MS } from './Tooltip'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('placeTooltip', () => {
  const viewport = { width: 400, height: 300 }
  const tip = { width: 80, height: 20 }

  it('centers the tip above the anchor when there is room', () => {
    expect(placeTooltip({ top: 80, left: 100, width: 20, height: 20 }, tip, viewport)).toEqual({ top: 54, left: 70 })
  })

  it('flips below an anchor that sits on the top edge', () => {
    expect(placeTooltip({ top: 2, left: 100, width: 20, height: 28 }, tip, viewport).top).toBe(36)
  })

  it('keeps the tip inside the left and right edges', () => {
    expect(placeTooltip({ top: 80, left: 0, width: 28, height: 28 }, tip, viewport).left).toBe(8)
    expect(placeTooltip({ top: 80, left: 360, width: 28, height: 28 }, tip, viewport).left).toBe(312)
  })
})

describe('Tooltip', () => {
  it('opens after a short hover and closes as soon as the pointer leaves', async () => {
    vi.useFakeTimers()
    render(
      <Tooltip label="格式化">
        <button type="button">格式</button>
      </Tooltip>
    )
    const button = screen.getByRole('button', { name: '格式' })
    expect(button.hasAttribute('title')).toBe(false)
    expect(button.parentElement?.hasAttribute('title')).toBe(false)
    fireEvent.pointerEnter(button.parentElement!)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY_MS - 1)
    })
    expect(screen.queryByRole('tooltip')).toBeNull()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(screen.getByRole('tooltip').textContent).toBe('格式化')
    expect(screen.getByRole('tooltip').closest('.json-workbench')).toBeNull()
    fireEvent.pointerLeave(button.parentElement!)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('does not open when the pointer leaves before the delay', async () => {
    vi.useFakeTimers()
    render(
      <Tooltip label="格式化">
        <button type="button">格式</button>
      </Tooltip>
    )
    const anchor = screen.getByRole('button').parentElement!
    fireEvent.pointerEnter(anchor)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40)
    })
    fireEvent.pointerLeave(anchor)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY_MS)
    })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('closes on click, blur, and Escape without blocking the button', async () => {
    vi.useFakeTimers()
    const onClick = vi.fn()
    render(
      <Tooltip label="格式化">
        <button type="button" onClick={onClick}>
          格式
        </button>
      </Tooltip>
    )
    const button = screen.getByRole('button', { name: '格式' })
    const anchor = button.parentElement!
    fireEvent.pointerEnter(anchor)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY_MS)
    })
    fireEvent.pointerDown(anchor)
    expect(screen.queryByRole('tooltip')).toBeNull()
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()

    const matches = button.matches.bind(button)
    button.matches = (selector: string) => selector === ':focus-visible' || matches(selector)
    fireEvent.focus(button)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY_MS)
    })
    expect(screen.getByRole('tooltip').textContent).toBe('格式化')
    fireEvent.keyDown(button, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()

    fireEvent.focus(button)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY_MS)
    })
    fireEvent.blur(button)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('ignores focus that is not focus-visible and still shows on a disabled button', async () => {
    vi.useFakeTimers()
    render(
      <IconButton hint="格式化" label="格式化" disabled>
        <svg />
      </IconButton>
    )
    const button = screen.getByRole('button', { name: '格式化' })
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(button.hasAttribute('title')).toBe(false)
    fireEvent.focus(button)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY_MS)
    })
    expect(screen.queryByRole('tooltip')).toBeNull()
    fireEvent.pointerEnter(button.parentElement!)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY_MS)
    })
    expect(screen.getByRole('tooltip').textContent).toBe('格式化')
  })

  it('pins a left-edge tooltip inside the viewport', async () => {
    vi.useFakeTimers()
    const original = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.classList.contains('json-tooltip')) {
        return box(0, 0, 80, 20)
      }
      if (this.classList.contains('json-tooltip-anchor')) {
        return box(0, 40, 28, 28)
      }
      return original.call(this)
    }
    try {
      render(
        <Tooltip label="格式化">
          <button type="button">格式</button>
        </Tooltip>
      )
      fireEvent.pointerEnter(screen.getByRole('button').parentElement!)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY_MS)
      })
      expect(screen.getByRole('tooltip').style.left).toBe('8px')
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original
    }
  })
})

function box(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON() {
      return {}
    }
  }
}
