import {
  applyDelete,
  applyFormat,
  applyInput,
  applyUndo,
  buildJsonPairText,
  buildJsonValueText,
  buildVisibleJsonRows,
  chineseToUnicode,
  collapseAllJsonNodes,
  createJsonExpansion,
  demoJson,
  describeJsonParseError,
  escapeJsonString,
  expandAllJsonNodes,
  expandJsonAncestors,
  jsonToQuery,
  jsonToSchema,
  minifyJson,
  parseJsonInput,
  pruneJsonSubtreeOverrides,
  pythonDictToJson,
  rememberJsonHistory,
  removeJsonHistory,
  toCopyablePath,
  toggleJsonNode,
  unescapeJsonString,
  unicodeToChinese,
  type ConvertCode,
  type JsonDocument,
  type JsonHistoryEntry,
  type JsonParseResult,
  type JsonTreeRow
} from '@jsonbranch/json-core'
import { clampSplitRatio, DEFAULT_SPLIT_RATIO } from '@jsonbranch/json-core'
import {
  Braces,
  ChevronsDownUp,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Copy,
  Eraser,
  FileJson,
  FoldVertical,
  Lightbulb,
  ListOrdered,
  ListTree,
  Maximize2,
  Minimize2,
  Minus,
  PanelLeft,
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
import { JsonHistoryRail } from './JsonHistoryRail'
import { IconButton } from './Tooltip'
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
  history?: readonly JsonHistoryEntry[]
  historyReady?: boolean
  onHistoryChange?(entries: JsonHistoryEntry[]): void
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
  const [indent, setIndent] = useState<2 | 4>(2)
  const [view, setView] = useState<'tree' | 'schema'>('tree')
  const [rightFull, setRightFull] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [localHistory, setLocalHistory] = useState<JsonHistoryEntry[]>([])
  const [now, setNow] = useState(() => Date.now())
  const history = props.history ?? localHistory
  const historyRef = useRef(history)
  historyRef.current = history
  const sawInput = useRef(false)

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
    const next = applyDelete(document, row.segments, indent)
    if (next === document) {
      return
    }
    publish(next, parseJsonInput(next.input, { keepEscapes: next.keepEscapes }))
    setExpansion((prev) => pruneJsonSubtreeOverrides(prev, row.path))
    setSelectedPath(null)
  }

  function commitHistory(next: JsonHistoryEntry[]): void {
    if (next === historyRef.current) {
      return
    }
    if (props.onHistoryChange) {
      props.onHistoryChange(next)
      return
    }
    setLocalHistory(next)
  }

  function replaceText(text: string): void {
    if (text === document.input) {
      return
    }
    publish({ ...document, undoInput: document.input, input: text }, parseJsonInput(text, { keepEscapes: document.keepEscapes }))
  }

  function applyConvert(result: { ok: true; text: string } | { ok: false; code: ConvertCode }): void {
    if (!result.ok) {
      const reason = {
        invalid: copy.convertInvalid,
        'not-object': copy.convertNotObject,
        'not-string': copy.convertNotString
      }[result.code]
      setNotice(reason)
      return
    }
    setNotice('')
    replaceText(result.text)
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (props.historyReady === false) {
      return
    }
    if (!sawInput.current) {
      sawInput.current = true
      return
    }
    const timer = window.setTimeout(() => {
      commitHistory(rememberJsonHistory(historyRef.current, document.input, Date.now(), crypto.randomUUID()))
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [document.input, props.historyReady])

  const schemaText = result.status === 'ok' ? JSON.stringify(jsonToSchema(result.value), null, indent) : ''

  return (
    <div className={rightFull ? 'json-workbench right-full' : 'json-workbench'}>
      <div className="json-stage">
      {historyOpen ? (
        <JsonHistoryRail
          entries={history}
          locale={locale}
          now={now}
          onCollapse={() => setHistoryOpen(false)}
          onSave={() => commitHistory(rememberJsonHistory(history, document.input, Date.now(), crypto.randomUUID()))}
          onClear={() => commitHistory([])}
          onDelete={(id) => commitHistory(removeJsonHistory(history, id))}
          onRestore={(text) => replaceText(text)}
        />
      ) : null}
      <div ref={containerRef} className="json-panes">
        <div className="json-editor-pane" style={{ width: rightFull ? '0%' : `${ratio * 100}%` }}>
          <div className="json-editor-tools json-toolbar">
            {!historyOpen ? (
              <IconButton hint={title.toggleHistory} label={copy.toggleHistory} onClick={() => setHistoryOpen(true)}>
                <PanelLeft size={14} aria-hidden="true" />
              </IconButton>
            ) : null}
            <IconButton hint={title.format} label={copy.format} disabled={result.status !== 'ok'} onClick={() => publish(applyFormat(document, indent))}>
              <Wand2 size={14} aria-hidden="true" />
            </IconButton>
            <IconButton hint={title.minify} label={copy.minify} disabled={result.status !== 'ok'} onClick={() => applyConvert(minifyJson(document.input))}>
              <ChevronsDownUp size={14} aria-hidden="true" />
            </IconButton>
            <IconButton hint={title.demo} label={copy.demo} onClick={() => replaceText(demoJson(indent))}>
              <Lightbulb size={14} aria-hidden="true" />
            </IconButton>
            <span className="json-tool-sep" aria-hidden="true" />
            <IconButton
              hint={title.undo}
              label={copy.undo}
              disabled={document.undoInput === null}
              onClick={() => {
                const next = applyUndo(document)
                publish(next, parseJsonInput(next.input, { keepEscapes: next.keepEscapes }))
              }}
            >
              <Undo2 size={14} aria-hidden="true" />
            </IconButton>
            <IconButton hint={title.copySource} label={copy.copySource} onClick={() => void writeCopy(document.input)}>
              <ClipboardCopy size={14} aria-hidden="true" />
            </IconButton>
            <IconButton
              hint={title.clear}
              label={copy.clear}
              onClick={() => {
                const next = applyInput(document, '')
                publish(next, { status: 'empty' })
                setQuery('')
              }}
            >
              <Eraser size={14} aria-hidden="true" />
            </IconButton>
          </div>
          <TextSlot
            value={document.input}
            fontSize={editorFontSize}
            onChange={(value) => onDocument(applyInput(document, value))}
          />
          <div className="json-convert">
            <button type="button" onClick={() => replaceText(chineseToUnicode(document.input))}>{copy.convertChinese}</button>
            <button type="button" onClick={() => replaceText(unicodeToChinese(document.input))}>{copy.convertUnicode}</button>
            <button type="button" onClick={() => replaceText(escapeJsonString(document.input))}>{copy.addEscape}</button>
            <button type="button" onClick={() => applyConvert(unescapeJsonString(document.input))}>{copy.removeEscape}</button>
            <button type="button" onClick={() => applyConvert(jsonToQuery(document.input))}>{copy.toQuery}</button>
            <button type="button" onClick={() => applyConvert(pythonDictToJson(document.input, indent))}>{copy.dictToJson}</button>
          </div>
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
          <div className="json-view-tools json-toolbar">
            <IconButton hint={title.treeView} label={copy.treeView} aria-pressed={view === 'tree'} onClick={() => setView('tree')}>
              <ListTree size={14} aria-hidden="true" />
            </IconButton>
            <IconButton hint={title.schemaView} label={copy.schemaView} aria-pressed={view === 'schema'} onClick={() => setView('schema')}>
              <FileJson size={14} aria-hidden="true" />
            </IconButton>
            {view === 'tree' ? (
              <>
                <span className="json-tool-sep" aria-hidden="true" />
                <IconButton hint={title.expandAll} label={copy.expandAll} onClick={() => setExpansion(expandAllJsonNodes())}>
                  <UnfoldVertical size={14} aria-hidden="true" />
                </IconButton>
                <IconButton hint={title.collapseAll} label={copy.collapseAll} onClick={() => setExpansion(collapseAllJsonNodes())}>
                  <FoldVertical size={14} aria-hidden="true" />
                </IconButton>
                <IconButton hint={title.copyPair} label={copy.copyPair} disabled={current === null} onClick={() => current && void writeCopy(buildJsonPairText(current))}>
                  <Braces size={14} aria-hidden="true" />
                </IconButton>
                <IconButton hint={title.copyValue} label={copy.copyValue} disabled={current === null} onClick={() => current && void writeCopy(buildJsonValueText(current))}>
                  <WholeWord size={14} aria-hidden="true" />
                </IconButton>
                <IconButton hint={title.copyPath} label={copy.copyPath} disabled={current === null} onClick={() => current && void writeCopy(toCopyablePath(current.path))}>
                  <Route size={14} aria-hidden="true" />
                </IconButton>
                <IconButton hint={title.delete} label={copy.delete} disabled={current === null || current.segments.length === 0} onClick={() => current && removeRow(current)}>
                  <Trash2 size={14} aria-hidden="true" />
                </IconButton>
                <input
                  className="json-view-search"
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
                        if (found.count === 0) return 0
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
                {query.length > 0 ? <span className="json-search-count" data-testid="json-search-count"><span>{found.count}</span><span>{copy.matchSuffix}</span></span> : null}
                <IconButton hint={title.previous} label={copy.previous} disabled={found.count === 0} onClick={() => setActiveMatchIndex((prev) => (found.count === 0 ? 0 : (Math.min(prev, found.count - 1) - 1 + found.count) % found.count))}>
                  <ChevronUp size={14} aria-hidden="true" />
                </IconButton>
                <IconButton hint={title.next} label={copy.next} disabled={found.count === 0} onClick={() => setActiveMatchIndex((prev) => (found.count === 0 ? 0 : (Math.min(prev, found.count - 1) + 1) % found.count))}>
                  <ChevronDown size={14} aria-hidden="true" />
                </IconButton>
              </>
            ) : null}
            <span className="json-tool-sep" aria-hidden="true" />
            <select aria-label={copy.indent} value={indent} onChange={(event) => setIndent(event.target.value === '4' ? 4 : 2)}>
              <option value="2">{copy.indent2}</option>
              <option value="4">{copy.indent4}</option>
            </select>
            <IconButton hint={title.lineNumbers} label={copy.lineNumbers} aria-pressed={document.showLineNumbers} onClick={() => onDocument({ ...document, showLineNumbers: !document.showLineNumbers })}>
              <ListOrdered size={14} aria-hidden="true" />
            </IconButton>
            <IconButton hint={title.keepEscapes} label={copy.keepEscapes} aria-pressed={document.keepEscapes} onClick={() => onDocument({ ...document, keepEscapes: !document.keepEscapes })}>
              <TextQuote size={14} aria-hidden="true" />
            </IconButton>
            <IconButton hint={title.decreaseFont(editorFontSize)} label={copy.decreaseFont(editorFontSize)} disabled={editorFontSize <= 12} onClick={() => changeFont(-1)}>
              <Minus size={14} aria-hidden="true" />
            </IconButton>
            <IconButton hint={title.increaseFont(editorFontSize)} label={copy.increaseFont(editorFontSize)} disabled={editorFontSize >= 24} onClick={() => changeFont(1)}>
              <Plus size={14} aria-hidden="true" />
            </IconButton>
            <IconButton
              hint={title.copyResult}
              label={copy.copyResult}
              disabled={view === 'schema' ? result.status !== 'ok' : false}
              onClick={() => {
                if (view === 'schema') {
                  if (result.status !== 'ok') {
                    setNotice(copy.schemaNeedsJson)
                    return
                  }
                  void writeCopy(schemaText)
                  return
                }
                void writeCopy(document.input)
              }}
            >
              <Copy size={14} aria-hidden="true" />
            </IconButton>
            <IconButton hint={rightFull ? title.restoreView : title.fullscreen} label={rightFull ? copy.restoreView : copy.fullscreen} onClick={() => setRightFull((value) => !value)}>
              {rightFull ? <Minimize2 size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}
            </IconButton>
          </div>
          {view === 'schema' ? (
            result.status === 'ok' ? <pre className="json-schema">{schemaText}</pre> : <div className="json-tree-message">{result.status === 'error' ? describeJsonParseError(result, locale) : copy.schemaNeedsJson}</div>
          ) : (
            <>
              {result.status === 'empty' && <div className="json-tree-message">{copy.empty}</div>}
              {result.status === 'error' && <div className="json-tree-message error">{describeJsonParseError(result, locale)}</div>}
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
            </>
          )}
        </div>
      </div>
      </div>
      <div className="json-status" role="status">
        {notice}
      </div>
    </div>
  )
}
