import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type JSX,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'

export const TOOLTIP_DELAY_MS = 100
export const TOOLTIP_GAP = 6
export const TOOLTIP_MARGIN = 8

export type TooltipRect = { top: number; left: number; width: number; height: number }

export function placeTooltip(
  anchor: TooltipRect,
  tip: { width: number; height: number },
  viewport: { width: number; height: number }
): { top: number; left: number } {
  let top = anchor.top - tip.height - TOOLTIP_GAP
  if (top < TOOLTIP_MARGIN) {
    top = anchor.top + anchor.height + TOOLTIP_GAP
  }
  const maxTop = viewport.height - tip.height - TOOLTIP_MARGIN
  if (top > maxTop) {
    top = Math.max(TOOLTIP_MARGIN, maxTop)
  }
  if (top < TOOLTIP_MARGIN) {
    top = TOOLTIP_MARGIN
  }

  let left = anchor.left + anchor.width / 2 - tip.width / 2
  const maxLeft = viewport.width - tip.width - TOOLTIP_MARGIN
  if (left > maxLeft) {
    left = maxLeft
  }
  if (left < TOOLTIP_MARGIN) {
    left = TOOLTIP_MARGIN
  }
  return { top, left }
}

export function Tooltip(props: { label: string; children: JSX.Element }): JSX.Element {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const timer = useRef<number | null>(null)

  function clearTimer(): void {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }

  function showSoon(): void {
    clearTimer()
    timer.current = window.setTimeout(() => {
      timer.current = null
      setOpen(true)
    }, TOOLTIP_DELAY_MS)
  }

  function hideNow(): void {
    clearTimer()
    setOpen(false)
  }

  useEffect(() => clearTimer, [])

  useEffect(() => {
    if (!open) {
      return
    }
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        hideNow()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <span
      ref={anchorRef}
      className="json-tooltip-anchor"
      onPointerEnter={showSoon}
      onPointerLeave={hideNow}
      onPointerDown={hideNow}
      onFocusCapture={(event) => {
        const target = event.target
        if (target instanceof Element && target.matches(':focus-visible')) {
          showSoon()
        }
      }}
      onBlurCapture={hideNow}
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape') {
          hideNow()
        }
      }}
    >
      {props.children}
      {open && anchorRef.current ? <TooltipBubble anchor={anchorRef.current} label={props.label} /> : null}
    </span>
  )
}

export function IconButton({
  hint,
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { hint: string; label: string; children: ReactNode }): JSX.Element {
  return (
    <Tooltip label={hint}>
      <button {...props} type="button" aria-label={label}>
        {children}
      </button>
    </Tooltip>
  )
}

function TooltipBubble(props: { anchor: HTMLElement; label: string }): JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const tip = ref.current
    if (!tip) {
      return
    }
    const anchor = props.anchor.getBoundingClientRect()
    const size = tip.getBoundingClientRect()
    setBox(placeTooltip(anchor, size, { width: window.innerWidth, height: window.innerHeight }))
  }, [props.anchor, props.label])

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      className="json-tooltip"
      style={{
        top: box ? `${box.top}px` : '-9999px',
        left: box ? `${box.left}px` : '0px',
        visibility: box ? 'visible' : 'hidden'
      }}
    >
      {props.label}
    </div>,
    document.body
  )
}
