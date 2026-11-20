import type { JsonTextRange } from '@jsonbranch/json-core'

type HighlightedTextProps = {
  text: string
  ranges: readonly JsonTextRange[]
  activeRange: JsonTextRange | null
}

export function HighlightedText({ text, ranges, activeRange }: HighlightedTextProps) {
  if (ranges.length === 0) {
    return <>{text}</>
  }
  const parts = []
  let cursor = 0
  for (const range of ranges) {
    if (range.start > cursor) {
      parts.push(<span key={`gap-${cursor}`}>{text.slice(cursor, range.start)}</span>)
    }
    const active = activeRange?.start === range.start && activeRange.end === range.end
    parts.push(
      <span key={`hit-${range.start}`} className={active ? 'json-highlight active' : 'json-highlight'}>
        {text.slice(range.start, range.end)}
      </span>
    )
    cursor = range.end
  }
  if (cursor < text.length) {
    parts.push(<span key={`gap-${cursor}`}>{text.slice(cursor)}</span>)
  }
  return <>{parts}</>
}
