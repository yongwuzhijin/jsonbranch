import { useEffect, useRef, useState, type JSX } from 'react'
import { normalizeEditorFontSize } from './editor-font-size'
import type { TextSlotProps } from './json-view-model'
import { installMonacoWorkers, probeEditorWorker } from './monaco-environment'
import './workbench.css'

type MonacoEditor = {
  getModel(): { getPositionAt(offset: number): { lineNumber: number; column: number } } | null
  setSelection(range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }): void
  revealRangeInCenter(range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }, scrollType?: number): void
  deltaDecorations(oldDecorations: string[], newDecorations: { range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }; options: { className?: string; isWholeLine?: boolean } }[]): string[]
}

type EditorComponent = (props: {
  height: string
  language: string
  value: string
  theme: string
  onChange?: (value: string | undefined) => void
  onMount?: (editor: MonacoEditor) => void
  options: Record<string, unknown>
  loading: JSX.Element
}) => JSX.Element

export function TextSlot(props: TextSlotProps & { createWorker?: () => Worker }): JSX.Element {
  const { value, onChange, createWorker, reveal } = props
  const fontSize = normalizeEditorFontSize(props.fontSize)
  const [mode, setMode] = useState<'monaco' | 'textarea'>(() => probeEditorWorker(createWorker))
  const [Editor, setEditor] = useState<EditorComponent | null>(null)
  const editorReady = useRef(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const monacoRef = useRef<MonacoEditor | null>(null)

  useEffect(() => {
    if (!reveal) {
      return
    }
    if (mode === 'textarea' && areaRef.current) {
      const element = areaRef.current
      element.focus()
      element.setSelectionRange(reveal.start, reveal.end)
      const line = value.slice(0, reveal.start).split('\n').length
      const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight) || fontSize * 1.5
      element.scrollTo?.({ top: Math.max(0, (line - 3) * lineHeight), behavior: 'smooth' })
      return
    }
    const editor = monacoRef.current
    const model = editor?.getModel()
    if (!editor || !model) {
      return
    }
    const from = model.getPositionAt(reveal.start)
    const to = model.getPositionAt(reveal.end)
    const range = {
      startLineNumber: from.lineNumber,
      startColumn: from.column,
      endLineNumber: to.lineNumber,
      endColumn: to.column
    }
    editor.setSelection(range)
    editor.revealRangeInCenter(range, 0)
    const ids = editor.deltaDecorations([], [{ range, options: { className: 'json-source-flash', isWholeLine: true } }])
    const timer = window.setTimeout(() => editor.deltaDecorations(ids, []), 1200)
    return () => window.clearTimeout(timer)
  }, [reveal, mode, value, fontSize])

  useEffect(() => {
    if (mode !== 'monaco') {
      return
    }
    let cancelled = false
    installMonacoWorkers()
    void import('monaco-editor')
      .then(async (monaco) => {
        const reactEditor = await import('@monaco-editor/react')
        reactEditor.loader.config({ monaco })
        if (!cancelled) {
          editorReady.current = true
          setEditor(() => reactEditor.default as EditorComponent)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMode('textarea')
        }
      })
    const onViolation = (event: SecurityPolicyViolationEvent) => {
      if (event.violatedDirective.startsWith('worker-src') || event.violatedDirective.startsWith('script-src')) {
        setMode('textarea')
      }
    }
    const timer = window.setTimeout(() => {
      if (!cancelled && !editorReady.current) {
        setMode('textarea')
      }
    }, 4000)
    window.addEventListener('securitypolicyviolation', onViolation)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.removeEventListener('securitypolicyviolation', onViolation)
    }
  }, [mode])

  if (mode === 'textarea') {
    return (
      <textarea
        ref={areaRef}
        className="json-fallback"
        style={{ fontSize }}
        aria-label="json"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  if (Editor === null) {
    return <div className="json-tree-message" role="status">正在打开编辑器</div>
  }

  return (
    <Editor
      height="100%"
      language="json"
      theme="vs"
      value={value}
      loading={<textarea className="json-fallback" style={{ fontSize }} aria-label="json" spellCheck={false} value={value} readOnly />}
      onMount={(editor) => {
        monacoRef.current = editor
      }}
      onChange={(next) => onChange(next ?? '')}
      options={{
        fontSize,
        fontFamily: '"SF Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
        minimap: { enabled: false },
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        renderWhitespace: 'none'
      }}
    />
  )
}
