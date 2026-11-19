import { useEffect, useRef, useState, type JSX } from 'react'
import type { TextSlotProps } from './json-view-model'
import { installMonacoWorkers, probeEditorWorker } from './monaco-environment'
import './workbench.css'

type EditorComponent = (props: {
  height: string
  language: string
  value: string
  theme: string
  onChange?: (value: string | undefined) => void
  options: Record<string, unknown>
  loading: JSX.Element
}) => JSX.Element

export function TextSlot(props: TextSlotProps & { createWorker?: () => Worker }): JSX.Element {
  const { value, onChange, createWorker } = props
  const [mode, setMode] = useState<'monaco' | 'textarea'>(() => probeEditorWorker(createWorker))
  const [Editor, setEditor] = useState<EditorComponent | null>(null)
  const editorReady = useRef(false)

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
        className="json-fallback"
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
      loading={<textarea className="json-fallback" aria-label="json" spellCheck={false} value={value} readOnly />}
      onChange={(next) => onChange(next ?? '')}
      options={{
        fontSize: 13,
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
