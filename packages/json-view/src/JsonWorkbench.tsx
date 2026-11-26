import {
  applyDelete,
  applyFormat,
  applyInput,
  applyUndo,
  buildJsonPairText,
  buildJsonValueText,
  buildVisibleJsonRows,
  collapseAllJsonNodes,
  createJsonExpansion,
  describeJsonParseError,
  expandAllJsonNodes,
  expandJsonAncestors,
  parseJsonInput,
  pruneJsonSubtreeOverrides,
  toCopyablePath,
  toggleJsonNode,
  type JsonDocument,
  type JsonParseResult,
  type JsonTreeRow
} from '@jsonbranch/json-core'
import { clampSplitRatio, DEFAULT_SPLIT_RATIO } from '@jsonbranch/json-core'
import {
  Braces,
  ChevronDown,
  ChevronUp,
  Copy,
  Eraser,
  FoldVertical,
  ListOrdered,
  Minus,
  Plus,
  Route,
  TextQuote,
  Trash2,
  Undo2,
  UnfoldVertical,
  Wand2,
  WholeWord
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { normalizeEditorFontSize, stepEditorFontSize } from './editor-font-size'
import { JsonTreeView } from './JsonTreeView'
import { messages } from './messages'
import { searchState, type CopyText, type TextSlotProps } from './json-view-model'
import './workbench.css'

const PARSE_DEBOUNCE_MS = 200

export function JsonWorkbench(props: {
  document: JsonDocument
  locale: 'zh' | 'en'
  editorFontSize?: number
  TextSlot: (props: TextSlotProps) => JSX.Element
  copyText: CopyText
  onDocument(document: JsonDocument): void
  onEditorFontSize?(size: number): void
}): JSX.Element {
  const { document, locale, TextSlot, copyText, onDocument } = props
  const copy = messages(locale)
  const title = messages('zh')
  const [uncontrolledFontSize, setUncontrolledFontSize] = useState(13)
  const fontControlled = props.editorFontSize !== undefined
  const editorFontSize = normalizeEditorFontSize(fontControlled ? props.editorFontSize : uncontrolledFontSize)
  function changeFont(direction: -1 | 1): void {
    if (direction === -1 && editorFontSize <= 12) {
      return
    }
    if (direction === 1 && editorFontSize >= 24) {
      return
    }
    const next = stepEditorFontSize(editorFontSize, direction)
    if (fontControlled) {
      props.onEditorFontSize?.(next)
      return
    }
    setUncontrolledFontSize(next)
  }
  const containerRef = useRef<HTMLDivElement>(null)
  const [ratio, setRatio] = useState(DEFAULT_SPLIT_RATIO)
  const [expansion, setExpansion] = useState(createJsonExpansion)
  const [result, setResult] = useState<JsonParseResult>(() =>
    parseJsonInput(document.input, { keepEscapes: document.keepEscapes })
  )
  const [query, setQuery] = useState('')
  const [activeMatchIndex, setActiveMatchIndex] = useState(0)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setResult(parseJsonInput(document.input, { keepEscapes: document.keepEscapes }))
    }, PARSE_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [document.input, document.keepEscapes])

  const found = useMemo(
    () => (result.status === 'ok' ? searchState(result.value, query, activeMatchIndex) : { count: 0, active: null }),
    [result, query, activeMatchIndex]
  )
  const rows = useMemo(
    () => (result.status === 'ok' ? buildVisibleJsonRows(result.value, expansion) : []),
    [result, expansion]
  )
  const focusPath = selectedPath ?? found.active?.path ?? null
  const current = focusPath === null ? null : (rows.find((row) => row.path === focusPath) ?? null)
  const activeMatchPath = found.active?.path ?? null

  useEffect(() => {
    if (activeMatchPath === null) {
      return
    }
    setExpansion((prev) => expandJsonAncestors(prev, activeMatchPath))
  }, [activeMatchPath])

  async function writeCopy(text: string): Promise<void> {
    try {
      await copyText(text)
      setNotice('')
    } catch {
      setNotice(copy.copyFailed)
    }
  }

  function publish(next: JsonDocument, nextResult?: JsonParseResult): void {
    onDocument(next)
    if (nextResult) {
      setResult(nextResult)
    }
  }

  function removeRow(row: JsonTreeRow): void {
    const next = applyDelete(document, row.segments)
    if (next === document) {
      return
    }
    publish(next, parseJsonInput(next.input, { keepEscapes: next.keepEscapes }))
    setExpansion((prev) => pruneJsonSubtreeOverrides(prev, row.path))
    setSelectedPath(null)
  }

  return (
    <div className="json-workbench">
      <div className="json-toolbar">
        <button type="button" title={title.format} aria-label={copy.format} disabled={result.status !== 'ok'} onClick={() => publish(applyFormat(document))}>
          <Wand2 size={14} aria-hidden="true" />
        </button>
        <button type="button" title={title.expandAll} aria-label={copy.expandAll} onClick={() => setExpansion(expandAllJsonNodes())}>
          <UnfoldVertical size={14} aria-hidden="true" />
        </button>
        <button type="button" title={title.collapseAll} aria-label={copy.collapseAll} onClick={() => setExpansion(collapseAllJsonNodes())}>
          <FoldVertical size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          title={title.lineNumbers}
          aria-label={copy.lineNumbers}
          aria-pressed={document.showLineNumbers}
          onClick={() => onDocument({ ...document, showLineNumbers: !document.showLineNumbers })}
        >
          <ListOrdered size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          title={title.copy}
          aria-label={copy.copy}
          disabled={result.status !== 'ok'}
          onClick={() => {
            if (result.status === 'ok') {
              void writeCopy(JSON.stringify(result.value, null, 2))
            }
          }}
        >
          <Copy size={14} aria-hidden="true" />
        </button>
        <button type="button" title={title.copyPath} aria-label={copy.copyPath} disabled={current === null} onClick={() => current && void writeCopy(toCopyablePath(current.path))}>
          <Route size={14} aria-hidden="true" />
        </button>
        <button type="button" title={title.copyPair} aria-label={copy.copyPair} disabled={current === null} onClick={() => current && void writeCopy(buildJsonPairText(current))}>
          <Braces size={14} aria-hidden="true" />
        </button>
        <button type="button" title={title.copyValue} aria-label={copy.copyValue} disabled={current === null} onClick={() => current && void writeCopy(buildJsonValueText(current))}>
          <WholeWord size={14} aria-hidden="true" />
        </button>
        <button type="button" title={title.delete} aria-label={copy.delete} disabled={current === null || current.segments.length === 0} onClick={() => current && removeRow(current)}>
          <Trash2 size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          title={title.undo}
          aria-label={copy.undo}
          disabled={document.undoInput === null}
          onClick={() => {
            const next = applyUndo(document)
            publish(next, parseJsonInput(next.input, { keepEscapes: next.keepEscapes }))
          }}
        >
          <Undo2 size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          title={title.clear}
          aria-label={copy.clear}
          onClick={() => {
            const next = applyInput(document, '')
            publish(next, { status: 'empty' })
            setQuery('')
          }}
        >
          <Eraser size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          title={title.keepEscapes}
          aria-label={copy.keepEscapes}
          aria-pressed={document.keepEscapes}
          onClick={() => onDocument({ ...document, keepEscapes: !document.keepEscapes })}
        >
          <TextQuote size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          title={title.decreaseFont(editorFontSize)}
          aria-label={copy.decreaseFont(editorFontSize)}
          disabled={editorFontSize <= 12}
          onClick={() => changeFont(-1)}
        >
          <Minus size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          title={title.increaseFont(editorFontSize)}
          aria-label={copy.increaseFont(editorFontSize)}
          disabled={editorFontSize >= 24}
          onClick={() => changeFont(1)}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>
      <div ref={containerRef} className="json-panes">
        <div className="json-editor-pane" style={{ width: `${ratio * 100}%` }}>
          <TextSlot
            value={document.input}
            fontSize={editorFontSize}
            onChange={(value) => onDocument(applyInput(document, value))}
          />
        </div>
        <div
          className="json-splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label={copy.resize}
          onPointerDown={(event) => {
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
              return
            }
            const bounds = containerRef.current?.getBoundingClientRect()
            if (!bounds || bounds.width === 0) {
              return
            }
            setRatio(clampSplitRatio((event.clientX - bounds.left) / bounds.width))
          }}
        />
        <div className="json-tree-pane">
          <div className="json-search">
            <input
              type="text"
              role="searchbox"
              aria-label={copy.search}
              placeholder={copy.search}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveMatchIndex(0)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  setActiveMatchIndex((prev) => {
                    if (found.count === 0) {
                      return 0
                    }
                    const direction = event.shiftKey ? -1 : 1
                    const index = Math.min(prev, found.count - 1)
                    return (index + direction + found.count) % found.count
                  })
                } else if (event.key === 'Escape') {
                  setQuery('')
                  setActiveMatchIndex(0)
                }
              }}
            />
            {query.length > 0 && (
              <span className="json-search-count" data-testid="json-search-count">
                <span>{found.count}</span>
                <span>{copy.matchSuffix}</span>
              </span>
            )}
            <button type="button" aria-label={copy.previous} disabled={found.count === 0} onClick={() => setActiveMatchIndex((prev) => (found.count === 0 ? 0 : (Math.min(prev, found.count - 1) - 1 + found.count) % found.count))}>
              <ChevronUp size={14} aria-hidden="true" />
            </button>
            <button type="button" aria-label={copy.next} disabled={found.count === 0} onClick={() => setActiveMatchIndex((prev) => (found.count === 0 ? 0 : (Math.min(prev, found.count - 1) + 1) % found.count))}>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
          </div>
          {result.status === 'empty' && <div className="json-tree-message">{copy.empty}</div>}
          {result.status === 'error' && (
            <div className="json-tree-message error">{describeJsonParseError(result, locale)}</div>
          )}
          {result.status === 'ok' && (
            <JsonTreeView
              rows={rows}
              locale={locale}
              showLineNumbers={document.showLineNumbers}
              query={query}
              activeMatch={found.active}
              selectedPath={selectedPath}
              onToggle={(path) => setExpansion((prev) => toggleJsonNode(prev, path))}
              onSelect={setSelectedPath}
              onCopyPath={(row) => void writeCopy(toCopyablePath(row.path))}
              onCopyPair={(row) => void writeCopy(buildJsonPairText(row))}
              onCopyValue={(row) => void writeCopy(buildJsonValueText(row))}
              onDelete={removeRow}
            />
          )}
        </div>
      </div>
      <div className="json-status" role="status">
        {notice}
      </div>
    </div>
  )
}
