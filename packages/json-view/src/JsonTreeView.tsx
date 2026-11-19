import {
  findTextRanges,
  formatJsonContainerText,
  formatJsonRowLabel,
  formatJsonScalarText,
  type JsonSearchMatch,
  type JsonTextRange,
  type JsonTreeRow
} from '@jsonbranch/json-core'
import { observeElementRect, useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, ChevronRight, Braces, Route, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { HighlightedText } from './HighlightedText'
import { messages, type WorkbenchLocale } from './messages'

const ROW_HEIGHT = 22
const NO_RANGES: JsonTextRange[] = []

type JsonTreeViewProps = {
  rows: readonly JsonTreeRow[]
  locale: WorkbenchLocale
  showLineNumbers: boolean
  query: string
  activeMatch: JsonSearchMatch | null
  selectedPath: string | null
  onToggle(path: string): void
  onSelect(path: string): void
  onCopyPath(row: JsonTreeRow): void
  onCopyPair(row: JsonTreeRow): void
  onCopyValue(row: JsonTreeRow): void
  onDelete(row: JsonTreeRow): void
}

function activeRangeFor(
  row: JsonTreeRow,
  activeMatch: JsonSearchMatch | null,
  field: 'key' | 'value'
): JsonTextRange | null {
  if (activeMatch === null || activeMatch.path !== row.path || activeMatch.field !== field) {
    return null
  }
  return { start: activeMatch.start, end: activeMatch.end }
}

export function JsonTreeView({
  rows,
  locale,
  showLineNumbers,
  query,
  activeMatch,
  selectedPath,
  onToggle,
  onSelect,
  onCopyPath,
  onCopyPair,
  onCopyValue,
  onDelete
}: JsonTreeViewProps) {
  const copy = messages(locale)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    initialRect: { width: 800, height: 800 },
    observeElementRect: (instance, callback) => {
      const element = instance.scrollElement
      if (!(element instanceof Element) || element.clientHeight === 0) {
        callback({ width: 800, height: 800 })
        return () => {}
      }
      return observeElementRect(instance, callback)
    }
  })
  const activeMatchPath = activeMatch?.path ?? null
  const lastScrollKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (activeMatchPath === null) {
      lastScrollKeyRef.current = null
      return
    }
    const index = rows.findIndex((row) => row.path === activeMatchPath)
    if (index === -1) {
      return
    }
    const scrollKey = `${activeMatchPath}:${rows.length}:${index}`
    if (lastScrollKeyRef.current === scrollKey) {
      return
    }
    lastScrollKeyRef.current = scrollKey
    virtualizer.scrollToIndex(index, { align: 'center' })
  }, [activeMatchPath, rows, virtualizer])

  return (
    <div ref={scrollRef} className="json-tree-scroll">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const row = rows[virtualItem.index]
          if (!row) {
            return null
          }
          return (
            <div
              key={row.path || '$'}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualItem.start}px)` }}
            >
              <JsonTreeLine
                row={row}
                lineNumber={showLineNumbers ? virtualItem.index + 1 : null}
                query={query}
                activeMatch={activeMatch}
                selected={selectedPath === row.path}
                copy={copy}
                onToggle={onToggle}
                onSelect={onSelect}
                onCopyPath={onCopyPath}
                onCopyPair={onCopyPair}
                onCopyValue={onCopyValue}
                onDelete={onDelete}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function JsonTreeLine({
  row,
  lineNumber,
  query,
  activeMatch,
  selected,
  copy,
  onToggle,
  onSelect,
  onCopyPath,
  onCopyPair,
  onCopyValue,
  onDelete
}: {
  row: JsonTreeRow
  lineNumber: number | null
  query: string
  activeMatch: JsonSearchMatch | null
  selected: boolean
  copy: ReturnType<typeof messages>
  onToggle(path: string): void
  onSelect(path: string): void
  onCopyPath(row: JsonTreeRow): void
  onCopyPair(row: JsonTreeRow): void
  onCopyValue(row: JsonTreeRow): void
  onDelete(row: JsonTreeRow): void
}) {
  const isContainer = row.kind === 'object' || row.kind === 'array'
  const labelText =
    row.label === null ? null : formatJsonRowLabel(row.label, row.labelKind === 'index' ? 'index' : 'key')
  const valueText = isContainer
    ? formatJsonContainerText(row.kind, row.childCount)
    : formatJsonScalarText(row.value, row.kind)
  const searchableLabel = labelText !== null && row.labelKind === 'key'
  const labelRanges = useMemo(
    () => (searchableLabel ? findTextRanges(labelText ?? '', query) : NO_RANGES),
    [searchableLabel, labelText, query]
  )
  const valueRanges = useMemo(
    () => (isContainer ? NO_RANGES : findTextRanges(valueText, query)),
    [isContainer, valueText, query]
  )
  const testId = `json-tree-row-${row.path || 'root'}`
  return (
    <div
      className={['json-row', selected ? 'selected' : '', activeMatch?.path === row.path ? 'active-match' : ''].filter(Boolean).join(' ')}
      data-testid={testId}
      onClick={() => onSelect(row.path)}
    >
      {lineNumber !== null && <span className="json-line-number">{lineNumber}</span>}
      <span style={{ width: row.depth * 12, flex: 'none' }} />
      {row.isExpandable ? (
        <button
          type="button"
          className="json-toggle"
          aria-label={row.isCollapsed ? copy.expandNode : copy.collapseNode}
          aria-expanded={!row.isCollapsed}
          onClick={(event) => {
            event.stopPropagation()
            onToggle(row.path)
          }}
        >
          {row.isCollapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        </button>
      ) : (
        <span className="json-toggle-spacer" />
      )}
      <div className="json-token">
        {labelText !== null && (
          <>
            <span className={row.labelKind === 'index' ? 'json-index' : 'json-key'}>
              <HighlightedText text={labelText} ranges={labelRanges} activeRange={activeRangeFor(row, activeMatch, 'key')} />
            </span>
            <span className="json-punct">: </span>
          </>
        )}
        <span className={isContainer ? 'json-punct' : `json-${row.kind}`}>
          <HighlightedText text={valueText} ranges={valueRanges} activeRange={activeRangeFor(row, activeMatch, 'value')} />
        </span>
      </div>
      <div className="json-row-actions">
        <button type="button" aria-label={`${copy.copyPair} ${row.path || '$'}`} title={copy.copyPair} onClick={() => onCopyPair(row)}>
          <Braces size={13} aria-hidden="true" />
        </button>
        <button type="button" aria-label={`${copy.copyPath} ${row.path || '$'}`} title={copy.copyPath} onClick={() => onCopyPath(row)}>
          <Route size={13} aria-hidden="true" />
        </button>
        <button type="button" aria-label={`${copy.copyValue} ${row.path || '$'}`} title={copy.copyValue} onClick={() => onCopyValue(row)}>
          <Braces size={13} aria-hidden="true" />
        </button>
        {row.segments.length > 0 && (
          <button type="button" aria-label={`${copy.delete} ${row.path || '$'}`} title={copy.delete} onClick={() => onDelete(row)}>
            <Trash2 size={13} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
